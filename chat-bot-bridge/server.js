#!/usr/bin/env node
/**
 * Chat-bot bridge for the trading desk — phone messenger in, Claude Code out.
 * Multi-provider, all official; auto-detected from .env credentials
 * (precedence telegram > discord > twilio > meta) or forced with PROVIDER=...:
 *   - telegram: Bot API long-polling (current; free, no tunnel, near-instant)
 *   - twilio:   Twilio WhatsApp API (polling or webhook mode)
 *   - meta:     WhatsApp Business Cloud API (webhook + Graph API)
 *   - discord:  Discord Bot API polling (no public webhook or npm dependency)
 *
 * Zero npm dependencies: Node built-ins (http, crypto) + global fetch only.
 *
 * Security model:
 *  - Only the allowlisted sender is obeyed (TELEGRAM_ALLOWED_USER_ID /
 *    ALLOWED_WA_ID); everyone else is logged and ignored.
 *  - Webhook modes require a valid provider signature — X-Twilio-Signature
 *    (HMAC-SHA1 of PUBLIC_URL + sorted params) or X-Hub-Signature-256
 *    (HMAC-SHA256 of the raw body). Anything else -> 401. Polling modes have
 *    no inbound surface at all (outbound HTTPS only).
 *  - Claude runs headless (`claude -p --resume`) in the ai-trader-toolbox repo with
 *    the permission settings in claude-settings.json and the chat house rules
 *    appended to its system prompt (order confirm flow, account masking,
 *    FILE: attachment directives).
 *  - Secrets live in .env (git-ignored). See .env.example.
 */

import http from 'http';
import https from 'https';
import crypto from 'crypto';
import dns from 'dns';
import fs from 'fs';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { chatRulesBase, modeRules, currentMode, setMode, MODES } from './chat-rules.js';
import {
  CODEX_UNAVAILABLE_RE,
  availabilityFailure,
  brokerRequestKind,
  claudeRateLimitBlocked,
  codexAvailabilityError,
  createManualAgentChoice,
  createRunCircuitBreaker,
  formatManualAgentChoiceForPhone,
  implicitManualAgentChoice,
  preferredAgentOrder,
  prioritizeBrokerAgent,
  resolveManualAgentChoice,
  shouldFallbackForBroker,
} from './agent-routing.js';
import { forbiddenSendPath, sanitizePhoneText } from './phone-output.js';
import {
  DEFAULT_CLAUDE_MODELS,
  automaticModelHandoffPrompt,
  buildInterleavedModelPlan,
  buildModelChoiceSet,
  executeAvailabilityPlan,
  formatModelChoiceForPhone,
  implicitModelChoiceAnswer,
  isMoreModelsRequest,
  modelHandoffPrompt,
  nextModelChoicePage,
  parseCodexModelCatalog,
  resolveModelChoice,
  shouldAutoModelFallback,
} from './model-routing.js';
import {
  buildScheduledPrompt,
  isDuplicateScheduledRun,
  localCalendarDay,
  SCHEDULE_KINDS,
  scheduledLabel,
} from './scheduled-task.js';
import { pacificLabel } from './clock.js';
import {
  createRunTranscript,
  decisionContinuation,
  formatDecisionForPhone,
  parseDecisionRequest,
  toolEventLine,
} from './run-telemetry.js';
import {
  createRemoteRunView,
  finishRemoteRunView,
  formatPhoneHelp,
  formatRemoteRunView,
  parseRemoteControl,
  updateRemoteRunView,
} from './remote-control.js';
import {
  recoveryNextAttemptAt,
  handoffChoiceFromState,
  resetSecondsToMs,
  shouldRunRecovery,
  temporaryChoiceForRun,
} from './availability-recovery.js';
import {
  availabilityRetryLabel,
  clearAvailabilityFailure,
  explicitFutureResetAtMs,
  filterAvailableModels,
  findAvailabilityFailure,
  recordAvailabilityFailure,
  sameAgentModel,
} from './model-availability.js';
import {
  applyAgentModelSelection,
  registeredAgentNames,
  selectedAgentModel,
  selectedRegisteredAgent,
} from './agent-registry.js';
import {
  MAX_INBOUND_IMAGES,
  MAX_INBOUND_IMAGE_BYTES,
  cleanupInboundImages,
  codexImageArgs,
  imagePromptSuffix,
  normalizedImageType,
  saveInboundImage,
} from './inbound-media.js';
import { createBrokerPreflightTracker, scheduledBrokerCorrectionPrompt } from './broker-preflight.js';
import {
  buildChangeReview,
  captureWorkspaceSnapshot,
  parseChangeReason,
} from './change-review.js';
import {
  brokerExecutionFailed,
  brokerExecutionSucceeded,
  buildTrustedBrokerApprovalInstructions,
  extractReportTickets,
  formatExecutionItemsMessage,
  resolveTicketApproval,
} from './ticket-approval.js';
import {
  captureReportSnapshot,
  deliverReportArtifacts,
  generatedHtmlReports,
} from './report-delivery.js';
import {
  captureReportDraftSnapshot,
  recoverableReportDrafts,
} from './report-artifact-recovery.js';
import {
  buildReportRecoveryPrompt,
  isBrokerWriteTool,
  isReportRequest,
  reportRecoverySafetyInstructions,
  shouldRecoverReportRun,
} from './report-recovery.js';

// Some macOS/Wi-Fi combinations advertise an IPv6 route that black-holes
// Telegram traffic. Node's fetch can then sit in the OS connect path for many
// minutes. Prefer IPv4 for all lookups; telegramApi below also forces family 4.
dns.setDefaultResultOrder('ipv4first');

// ---------------------------------------------------------------- config ---
const BRIDGE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DESK_DIR = path.resolve(BRIDGE_DIR, '..');
const REPORTS_DIR = path.join(DESK_DIR, 'reports');
const STATE_FILE = path.join(BRIDGE_DIR, 'state.json');
const MODEL_AVAILABILITY_FILE = path.join(BRIDGE_DIR, 'model-availability.json');
const SETTINGS_FILE = path.join(BRIDGE_DIR, 'claude-settings.json');
const RUN_LOG_DIR = path.join(BRIDGE_DIR, 'logs', 'phone-runs');
const INBOUND_MEDIA_DIR = path.join(BRIDGE_DIR, 'logs', 'inbound-media');
const CHANGE_SNAPSHOT_DIR = path.join(BRIDGE_DIR, 'logs', 'change-snapshots');
const CHANGE_REVIEW_DIR = path.join(BRIDGE_DIR, 'logs', 'change-reviews');
const RESTART_REQUEST_FILE = path.join(BRIDGE_DIR, 'logs', 'restart-request.json');
const SERVICE_CONTROL = path.join(BRIDGE_DIR, 'service-control.sh');
const SCHEDULER_TOKEN_FILE = path.join(BRIDGE_DIR, 'logs', 'scheduler-token');

// minimal .env loader (no dotenv dependency)
try {
  for (const line of fs.readFileSync(path.join(BRIDGE_DIR, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* .env optional if real env vars are set */ }

const {
  // telegram provider (Bot API, long-polling — no tunnel, free)
  TELEGRAM_BOT_TOKEN,       // from @BotFather
  TELEGRAM_ALLOWED_USER_ID, // YOUR numeric Telegram user id — the only allowed sender
  // discord provider (Bot REST API polling — no gateway or public listener)
  DISCORD_BOT_TOKEN,
  DISCORD_ALLOWED_USER_ID,
  DISCORD_CHANNEL_ID,
  // whatsapp shared
  ALLOWED_WA_ID,         // YOUR phone in digits-only form e.g. 14155551234
  // twilio provider
  TWILIO_ACCOUNT_SID,    // ACxxxxxxxx from the Twilio console dashboard
  TWILIO_AUTH_TOKEN,     // auth token from the same page (also signs webhooks)
  TWILIO_WHATSAPP_FROM,  // e.g. whatsapp:+14155238886 (the sandbox number)
  PUBLIC_URL,            // exact public webhook URL, e.g. https://x.ngrok-free.app/webhook
  // meta provider
  WHATSAPP_TOKEN,        // system-user token w/ whatsapp_business_messaging
  PHONE_NUMBER_ID,       // the business/test number's ID (not the number itself)
  APP_SECRET,            // Meta app secret — validates webhook signatures
  VERIFY_TOKEN,          // any string you choose; must match Meta webhook config
} = process.env;
const PROVIDER = process.env.PROVIDER ||
  (TELEGRAM_BOT_TOKEN ? 'telegram' : DISCORD_BOT_TOKEN ? 'discord' : TWILIO_ACCOUNT_SID ? 'twilio' : 'meta');
const PORT = Number(process.env.PORT || 3000);
const GRAPH_VERSION = process.env.GRAPH_VERSION || 'v23.0';
const CLAUDE_BIN = process.env.CLAUDE_BIN || path.join(process.env.HOME, '.local/bin/claude');
const CODEX_BIN = process.env.CODEX_BIN || '/opt/homebrew/bin/codex';
const AGENT_PRIORITY = (process.env.AGENT_PRIORITY || 'codex,claude').split(',').map(x => x.trim()).filter(Boolean);
const CODEX_MODEL = process.env.CODEX_MODEL || 'gpt-5.6-sol';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-fable-5';
const CLAUDE_MODEL_CANDIDATES = (process.env.CLAUDE_MODEL_CANDIDATES || DEFAULT_CLAUDE_MODELS.join(','))
  .split(',').map((item) => item.trim()).filter(Boolean);
const AGENT_MODEL_DEFAULTS = { codex: CODEX_MODEL, claude: CLAUDE_MODEL };
const MODEL_ALIASES = {
  claude: Object.fromEntries(DEFAULT_CLAUDE_MODELS.map((family) => [family, [family, `claude-${family}`]])),
};
const BROKER_AGENT = process.env.BROKER_AGENT || 'claude';
// full desk runs + report builds regularly pass 30 min; killed runs lose the
// whole result (seen 2026-07-11: META report SIGTERMed at the old 30-min cap)
const CLAUDE_TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MIN || 60) * 60 * 1000;
const CODEX_TIMEOUT_MS = Number(process.env.CODEX_TIMEOUT_MIN || 60) * 60 * 1000;
const MAX_AGENT_ATTEMPTS = Math.max(1, Math.min(4, Number(process.env.MAX_AGENT_ATTEMPTS || 2)));
const MAX_TOOL_CALLS = Math.max(1, Number(process.env.MAX_TOOL_CALLS || 120));
const REPORT_RECOVERY_MAX_TOOL_CALLS = Math.max(
  1,
  Math.min(48, Number(process.env.REPORT_RECOVERY_MAX_TOOL_CALLS || 24)),
);
const MAX_IDENTICAL_TOOL_CALLS = Math.max(1, Number(process.env.MAX_IDENTICAL_TOOL_CALLS || 6));
const MAX_STREAM_OUTPUT_TOKENS = Math.max(1, Number(process.env.MAX_STREAM_OUTPUT_TOKENS || 64_000));
const MAX_QUEUE_DEPTH = Math.max(0, Number(process.env.MAX_QUEUE_DEPTH || 5));
const BROKER_RECOVERY_WINDOW_MS = Math.max(60_000, Number(process.env.BROKER_RECOVERY_WINDOW_MIN || 15) * 60_000);
const PHONE_EXECUTION_LOG = (process.env.PHONE_EXECUTION_LOG || 'off').toLowerCase();
const SCHEDULE_PREFERRED_AGENT = (process.env.SCHEDULE_AGENT_PRIORITY || 'claude,codex')
  .split(',').map((item) => item.trim()).find((item) => ['claude', 'codex'].includes(item)) || 'claude';
// Provider caps vary; the phone-output gate applies the desk's stricter
// 1,500-character ceiling before any text reaches a provider.
// twilio runs in webhook mode when PUBLIC_URL is set, else POLLING mode:
// pull inbound messages from the Twilio API over outbound HTTPS — no tunnel,
// no inbound exposure, ~POLL_MS reply latency.
const TWILIO_POLLING = PROVIDER === 'twilio' && !PUBLIC_URL;
const POLL_MS = Number(process.env.POLL_MS || 3000);

const SUPPORTED_PROVIDERS = ['telegram', 'discord', 'twilio', 'meta'];
if (!SUPPORTED_PROVIDERS.includes(PROVIDER)) {
  console.error(`Unknown PROVIDER=${PROVIDER}. Supported: ${SUPPORTED_PROVIDERS.join(', ')}`);
  process.exit(1);
}
const required =
  PROVIDER === 'telegram' ? { TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_USER_ID }
  : PROVIDER === 'discord' ? { DISCORD_BOT_TOKEN, DISCORD_ALLOWED_USER_ID, DISCORD_CHANNEL_ID }
  : PROVIDER === 'twilio' ? { ALLOWED_WA_ID, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM }
  : { ALLOWED_WA_ID, WHATSAPP_TOKEN, PHONE_NUMBER_ID, APP_SECRET, VERIFY_TOKEN };
// the one identity allowed to drive the desk, regardless of provider
const ALLOWED_SENDER = PROVIDER === 'telegram' ? TELEGRAM_ALLOWED_USER_ID
  : PROVIDER === 'discord' ? DISCORD_ALLOWED_USER_ID : ALLOWED_WA_ID;
const SCHEDULE_REPLY_TO = process.env.SCHEDULE_REPLY_TO ||
  (PROVIDER === 'discord' ? DISCORD_CHANNEL_ID : ALLOWED_SENDER);
const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`[${PROVIDER} mode] Missing required config: ${missing.join(', ')} — see .env.example.`);
  process.exit(1);
}

// house rules now live in chat-rules.js (shared with scheduled-run.js) and
// are rebuilt per run so a /mode switch applies to the very next message

// ------------------------------------------------------------- state -------
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}
function saveState(s) {
  const tmp = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, STATE_FILE);
}
let state = loadState(); // separate provider sessions + shared last-run metadata
if (state.sessionId && !state.claudeSessionId) state.claudeSessionId = state.sessionId; // migrate v2

function loadAvailabilityLedger() {
  try {
    const parsed = JSON.parse(fs.readFileSync(MODEL_AVAILABILITY_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return Array.isArray(state.modelAvailability) ? state.modelAvailability : [];
  }
}

function saveAvailabilityLedger(records) {
  const tmp = `${MODEL_AVAILABILITY_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(Array.isArray(records) ? records : [], null, 2), { mode: 0o600 });
  fs.renameSync(tmp, MODEL_AVAILABILITY_FILE);
}

let availabilityLedger = loadAvailabilityLedger();

function migratePendingTicketSet() {
  if (state.pendingTicketSet || state.pendingBrokerExecution) return false;
  const history = Array.isArray(state.recentHistory) ? [...state.recentHistory].reverse() : [];
  for (const item of history) {
    if (item?.role !== 'assistant') continue;
    const parsed = extractReportTickets(item.text);
    if (!parsed.tickets.length) continue;
    state.pendingTicketSet = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      sourcePrompt: 'migrated from recent phone report context',
      status: 'pending',
      tickets: parsed.tickets,
    };
    saveState(state);
    return true;
  }
  return false;
}

function repairFalseCompletedBrokerExecution() {
  if (state.pendingBrokerExecution?.status !== 'completed' || state.pendingTicketSet?.status !== 'handled') {
    return false;
  }
  const latestAssistant = [...(Array.isArray(state.recentHistory) ? state.recentHistory : [])]
    .reverse().find((item) => item?.role === 'assistant');
  if (!latestAssistant || !brokerExecutionFailed(latestAssistant.text)) return false;
  state.pendingBrokerExecution.status = 'blocked';
  state.pendingBrokerExecution.finishedAt = new Date().toISOString();
  state.pendingTicketSet.status = 'pending';
  delete state.pendingTicketSet.handledAt;
  saveState(state);
  return true;
}

function reconcileFinishedBrokerExecution() {
  const execution = state.pendingBrokerExecution;
  if (execution?.status !== 'needs_verification' || !execution.finishedAt) return false;
  if (state.pendingTicketSet?.id !== execution.ticketSetId || state.pendingTicketSet?.status !== 'pending') {
    return false;
  }
  const latestAssistant = [...(Array.isArray(state.recentHistory) ? state.recentHistory : [])]
    .reverse().find((item) => item?.role === 'assistant');
  if (!latestAssistant || !brokerExecutionSucceeded(latestAssistant.text)) return false;
  execution.status = 'completed';
  execution.reconciledAt = new Date().toISOString();
  state.pendingTicketSet.status = 'handled';
  state.pendingTicketSet.handledAt = new Date().toISOString();
  saveState(state);
  return true;
}

function schedulerToken() {
  try {
    const existing = fs.readFileSync(SCHEDULER_TOKEN_FILE, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch { /* create below */ }
  fs.mkdirSync(path.dirname(SCHEDULER_TOKEN_FILE), { recursive: true });
  const token = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SCHEDULER_TOKEN_FILE, token + '\n', { mode: 0o600 });
  fs.chmodSync(SCHEDULER_TOKEN_FILE, 0o600);
  return token;
}
const SCHEDULER_TOKEN = schedulerToken();

// --- session rotation: resuming one session forever replays an ever-growing
// transcript on EVERY message (seen 2026-07-11: a 927KB session made each
// phone message cost ~a full context of input tokens and runs slow to the
// point of timing out). Rotate to a fresh session when the transcript gets
// big or the conversation has gone stale.
const PROJECT_DIR = path.join(process.env.HOME, '.claude', 'projects', DESK_DIR.replace(/[^a-zA-Z0-9]/g, '-'));
const MAX_SESSION_KB = Number(process.env.MAX_SESSION_KB || 300);
const MAX_SESSION_IDLE_H = Number(process.env.MAX_SESSION_IDLE_H || 6);

function sessionTranscriptKB() {
  if (!state.claudeSessionId) return 0;
  try { return Math.round(fs.statSync(path.join(PROJECT_DIR, `${state.claudeSessionId}.jsonl`)).size / 1024); }
  catch { return 0; }
}

function agentLabel(agent, model) {
  const pretty = agent === 'codex' ? 'Codex' : agent === 'claude' ? 'Claude' : String(agent || 'unknown');
  return model ? `${pretty} (${model})` : pretty;
}

function compactHistory(history) {
  if (!Array.isArray(history) || history.length === 0) return '';
  const tail = history.slice(-2);
  return tail.map((item) => {
    const role = item?.role === 'assistant' ? 'Assistant' : 'User';
    const text = String(item?.text || '').replace(/\s+/g, ' ').trim().slice(0, role === 'Assistant' ? 900 : 500);
    return `${role}: ${text}`;
  }).join('\n');
}

function brokerFirstPrompt(prompt, kind, history) {
  const recent = compactHistory(history);
  return [
    `LIVE BROKER ${kind.toUpperCase()} REQUEST — mandatory fast path.`,
    'Before reading repository docs, journal history, reports, or local registry files, use ToolSearch to load the Robinhood MCP tools if needed, then query the live broker state required for this request.',
    kind === 'action'
      ? 'Resolve the approved/current ticket from recent context, verify live account and order state, preview through the broker, and execute only if the active trading-mode confirmation gate is satisfied. Reconcile the resulting order status through MCP.'
      : 'Answer from current MCP quotes, positions, portfolio, or order state as applicable. Do not substitute cached history for live status.',
    'If Robinhood MCP is unavailable or unauthenticated, stop the live path, say execution/status is pending broker auth, and do not present docs or history as current state.',
    recent ? `Recent phone context:\n${recent}` : '',
    `Current request:\n${prompt}`,
  ].filter(Boolean).join('\n\n');
}

function rotateSessionIfNeeded() {
  if (!state.claudeSessionId && !state.codexSessionId) return null;
  let reason = null;
  if (state.lastRunAt && Date.now() - state.lastRunAt > MAX_SESSION_IDLE_H * 3600_000) reason = 'idle';
  const kb = sessionTranscriptKB();
  if (kb > MAX_SESSION_KB) reason = reason || 'size';
  if (reason) {
    state.claudeSessionId = null;
    state.codexSessionId = null;
    saveState(state);
  }
  return reason;
}

const log = (...a) => console.log(new Date().toISOString(), ...a);

// structured activity events → logs/activity.jsonl (debugging + reliability
// audit trail; the text log above stays the human-readable stream)
const ACTIVITY_LOG = path.join(BRIDGE_DIR, 'logs', 'activity.jsonl');
function logEvent(event, data = {}) {
  try {
    fs.mkdirSync(path.dirname(ACTIVITY_LOG), { recursive: true });
    try { // rotate at 10 MB so the file never grows unbounded
      if (fs.statSync(ACTIVITY_LOG).size > 10 * 1024 * 1024) {
        fs.renameSync(ACTIVITY_LOG, ACTIVITY_LOG + '.1');
      }
    } catch { /* no file yet */ }
    fs.appendFileSync(ACTIVITY_LOG,
      JSON.stringify({ ts: new Date().toISOString(), component: 'bridge', event, ...data }) + '\n');
  } catch { /* logging must never take the bridge down */ }
}

// per-message latency breakdown → logs/timing.jsonl (one line per prompt;
// legs are seconds relative to bridge receipt, phone_to_bridge_s from the
// provider's sent timestamp when it supplies one)
const TIMING_LOG = path.join(BRIDGE_DIR, 'logs', 'timing.jsonl');
function logTiming(rec) {
  try {
    fs.appendFileSync(TIMING_LOG, JSON.stringify({ ts: new Date().toISOString(), ...rec }) + '\n');
  } catch { /* never take the bridge down */ }
}

function managedAgentEnv() {
  return {
    ...process.env,
    PATH: `${process.env.HOME}/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`,
    BRIDGE_MANAGED_RUN: '1',
    BRIDGE_RESTART_REQUEST_FILE: RESTART_REQUEST_FILE,
  };
}

function summarizeTool(name, input = {}) {
  if (/bash|shell/i.test(name)) return String(input.command || input.cmd || '').replace(/\s+/g, ' ').slice(0, 900);
  if (/read|edit|write/i.test(name)) return String(input.file_path || input.path || '').slice(0, 900);
  if (/search/i.test(name)) return String(input.query || input.q || '').replace(/\s+/g, ' ').slice(0, 900);
  return '';
}

// ------------------------------------------------------------ claude -------
// Streams claude's output (--output-format stream-json) so the bridge can
// notify the phone the moment things happen instead of after the run ends:
//   onEvent('started')          — the agent process is up and working
//   onEvent('trouble', detail)  — rate limit / fetch failure / network error
//                                 seen mid-run (throttled: ≥2 min apart, ≤3/run)
const TROUBLE_RE = /rate.?limit|too many requests|overloaded|quota exceeded|\b429\b|\b529\b|fetch failed|failed to fetch|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|network error|API Error/i;

function runClaude(prompt, onEvent = () => {}, model = CLAUDE_MODEL, attachments = [], runtime = {}) {
  return new Promise((resolve) => {
    const mediaContext = imagePromptSuffix(attachments);
    const args = [
      '-p', [prompt, mediaContext].filter(Boolean).join('\n\n'),
      '--output-format', 'stream-json',
      '--verbose',
      '--settings', SETTINGS_FILE,
      '--model', model,
      '--append-system-prompt', chatRulesBase(),
      '--append-system-prompt', modeRules(currentMode()),
    ];
    if (runtime.trustedBrokerApproval) {
      args.push('--append-system-prompt', runtime.trustedBrokerApproval);
    }
    if (runtime.reportRecoveryInstructions) {
      args.push('--append-system-prompt', runtime.reportRecoveryInstructions);
    }
    if (state.claudeSessionId) args.push('--resume', state.claudeSessionId);

    const child = spawn(CLAUDE_BIN, args, {
      cwd: DESK_DIR,
      stdio: ['ignore', 'pipe', 'pipe'], // no stdin — stops the CLI's 3s stdin wait/warning
      env: managedAgentEnv(),
    });
    if (activeRun) {
      activeRun.child = child; activeRun.agent = 'claude'; activeRun.model = model;
      if (activeRun.interrupt) child.kill('SIGTERM');
    }

    let buf = '', err = '', result = null, started = false, timedOut = false;
    let fallbackRequested = false, fallbackReason = null, resetAtMs = null;
    let circuitBroken = null;
    let lastTroubleMs = 0, troubleCount = 0;
    const toolNames = new Map();
    const guard = createRunCircuitBreaker({
      maxToolCalls: Number(runtime.maxToolCalls) || MAX_TOOL_CALLS,
      maxIdenticalToolCalls: Number(runtime.maxIdenticalToolCalls) || MAX_IDENTICAL_TOOL_CALLS,
      maxOutputTokens: Number(runtime.maxOutputTokens) || MAX_STREAM_OUTPUT_TOKENS,
    });
    const tripCircuit = (reason) => {
      if (circuitBroken) return;
      circuitBroken = reason;
      onEvent('circuit_breaker', { agent: 'claude', reason, ...guard.snapshot() });
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 10_000);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 10_000);
    }, CLAUDE_TIMEOUT_MS);

    const reportTrouble = (detail) => {
      const now = Date.now();
      if (now - lastTroubleMs < 120_000 || troubleCount >= 3) return;
      lastTroubleMs = now; troubleCount++;
      onEvent('trouble', String(detail).replace(/\s+/g, ' ').trim().slice(0, 300));
    };

    child.stdout.on('data', (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        let ev;
        try { ev = JSON.parse(line); } catch { continue; }
        if (!started) { started = true; onEvent('started', { agent: 'claude', model }); }
        if (ev.type === 'system' && ev.subtype === 'init' && ev.session_id) {
          state.claudeSessionId = ev.session_id;
          saveState(state);
        }
        if (ev.type === 'result') { result = ev; continue; }
        if (ev.type === 'assistant') {
          const outputStop = guard.observeOutputTokens(ev.message?.usage?.output_tokens);
          if (outputStop) { tripCircuit(outputStop); continue; }
          for (const c of ev.message?.content || []) {
            if (c.type !== 'tool_use') continue;
            toolNames.set(c.id, c.name);
            if (runtime.blockBrokerActions && isBrokerWriteTool(c.name)) {
              tripCircuit(`report recovery blocked broker order tool (${c.name})`);
              break;
            }
            onEvent('execution', { agent: 'claude', phase: 'started', tool: c.name,
              summary: summarizeTool(c.name, c.input) });
            const toolStop = guard.observeTool(JSON.stringify([c.name, c.input]));
            if (toolStop) { tripCircuit(toolStop); break; }
          }
        }
        // the CLI reports usage-limit state as a first-class event
        if (ev.type === 'rate_limit_event') {
          const ri = ev.rate_limit_info;
          if (claudeRateLimitBlocked(ri)) {
            resetAtMs = resetSecondsToMs(ri.resetsAt);
            const resets = resetAtMs ? ` — resets ${pacificLabel(resetAtMs)}` : '';
            fallbackRequested = true;
            fallbackReason = `usage limit: ${ri.status}${resets}`;
            // Write this immediately. The CLI may be terminated before it
            // emits a final result, and /agent must still show the outage
            // after a bridge restart or an interrupted run.
            persistModelAvailabilityFailure('claude', model, {
              reason: fallbackReason,
              ...(resetAtMs ? { resetAtMs } : {}),
            });
            reportTrouble(`Claude usage limit: ${ri.status}${resets}`);
            child.kill('SIGTERM');
          }
          continue;
        }
        // FAILED tool calls (yahoo fetch, web search, MCP) — surface right
        // away. is_error gate matters: successful tool output can quote these
        // words legitimately (seen 2026-07-11: the agent Read this very file
        // and the TROUBLE_RE source line was texted to the phone as trouble)
        if (ev.type === 'user') {
          for (const c of ev.message?.content || []) {
            if (c.type !== 'tool_result') continue;
            onEvent('execution', { agent: 'claude', phase: 'completed', ok: c.is_error !== true,
              tool: toolNames.get(c.tool_use_id) || 'tool' });
            if (c.is_error !== true) continue;
            const t = typeof c.content === 'string' ? c.content : JSON.stringify(c.content ?? '');
            if (TROUBLE_RE.test(t)) reportTrouble(t.match(/[^"\\]*(?:rate.?limit|429|529|fetch failed|failed to fetch|ETIMEDOUT|ECONNRESET|ENOTFOUND|too many requests|overloaded)[^"\\]*/i)?.[0] || t);
          }
        }
      }
    });
    child.stderr.on('data', (d) => {
      err += d;
      if (err.length > 20_000) err = err.slice(-10_000);
      const s = String(d);
      // the CLI prints API retry errors (429/529, network) to stderr
      if (TROUBLE_RE.test(s)) reportTrouble(s.split('\n').find((l) => TROUBLE_RE.test(l)) || s);
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, agent: 'claude', fallbackEligible: true,
        model, switchReason: `could not start Claude (${e.message})`,
        text: `bridge error: could not start Claude (${e.message})` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (activeRun?.interrupt) {
        resolve({ ok: false, interrupted: true, agent: 'claude', model,
          fallbackEligible: false, text: activeRun.interrupt.reason });
      } else if (circuitBroken) {
        resolve({ ok: false, agent: 'claude', model, fallbackEligible: false,
          text: `Circuit breaker stopped Claude: ${circuitBroken}. The run was halted to prevent a loop or excess token use.` });
      } else if (result) {
        if (result.session_id) { state.claudeSessionId = result.session_id; }
        state.lastRunAt = Date.now();
        saveState(state);
        const text = result.result || result.error || '(empty reply)';
        const unavailable = Boolean(result.is_error && availabilityFailure(text));
        const u = result.usage || {};
        resolve({
          ok: !result.is_error,
          text: String(text),
          costUsd: result.total_cost_usd,
          agent: 'claude', model: result.model || model,
          fallbackEligible: unavailable,
          switchReason: unavailable ? String(text).slice(0, 500) : null,
          resetAtMs: unavailable ? resetAtMs : null,
          tokens: {
            in: u.input_tokens, out: u.output_tokens,
            cache_read: u.cache_read_input_tokens, cache_write: u.cache_creation_input_tokens,
          },
        });
      } else if (timedOut) {
        resolve({ ok: false, agent: 'claude', model, fallbackEligible: false, text: `run hit the ${Math.round(CLAUDE_TIMEOUT_MS / 60_000)}-min bridge limit and was stopped — the work up to that point is saved in the session; send a follow-up to resume/finish it.` });
      } else if (fallbackRequested) {
        resolve({ ok: false, agent: 'claude', model, fallbackEligible: true,
          switchReason: fallbackReason || 'usage limit reached', resetAtMs,
          text: `${model} hit a usage limit and paused for model selection.` });
      } else {
        const tail = err.trim().slice(-1500);
        resolve({ ok: false, agent: 'claude', model, fallbackEligible: false, text: `claude exited (code ${code}) without a result.\n${tail || '(no output)'}` });
      }
    });
  });
}

function runCodex(prompt, onEvent = () => {}, model = CODEX_MODEL, attachments = [], runtime = {}) {
  return new Promise((resolve) => {
    const phonePrompt = prompt;
    const developerInstructions = [
      chatRulesBase(),
      modeRules(currentMode()),
      runtime.trustedBrokerApproval,
      runtime.reportRecoveryInstructions,
    ]
      .filter(Boolean).join('\n\n');
    // Headless runs have no stdin, so interactive MCP confirmations are
    // interpreted as "user cancelled MCP tool call". Full CLI access is
    // required for Robinhood tools; financial authority remains constrained
    // by the independently injected trading-mode and ticket-confirm rules.
    const common = ['--json', '--dangerously-bypass-approvals-and-sandbox',
      '-c', `developer_instructions=${JSON.stringify(developerInstructions)}`];
    const imageArgs = codexImageArgs(attachments);
    const args = state.codexSessionId
      ? ['exec', 'resume', ...common, '--model', model, ...imageArgs, state.codexSessionId, phonePrompt]
      : ['exec', ...common, '--model', model, '--cd', DESK_DIR, ...imageArgs, phonePrompt];
    const child = spawn(CODEX_BIN, args, {
      cwd: DESK_DIR, stdio: ['ignore', 'pipe', 'pipe'],
      env: managedAgentEnv(),
    });
    if (activeRun) {
      activeRun.child = child; activeRun.agent = 'codex'; activeRun.model = model;
      if (activeRun.interrupt) child.kill('SIGTERM');
    }
    let buf = '', err = '', eventTail = '', availabilityError = '', finalText = '', sessionId = null, usage = null;
    let started = false, timedOut = false, settled = false, circuitBroken = null;
    const guard = createRunCircuitBreaker({
      maxToolCalls: Number(runtime.maxToolCalls) || MAX_TOOL_CALLS,
      maxIdenticalToolCalls: Number(runtime.maxIdenticalToolCalls) || MAX_IDENTICAL_TOOL_CALLS,
      maxOutputTokens: Number(runtime.maxOutputTokens) || MAX_STREAM_OUTPUT_TOKENS,
    });
    const finish = (value) => { if (settled) return; settled = true; resolve(value); };
    const tripCircuit = (reason) => {
      if (circuitBroken) return;
      circuitBroken = reason;
      onEvent('circuit_breaker', { agent: 'codex', reason, ...guard.snapshot() });
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 10_000);
    };
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 10_000); }, CODEX_TIMEOUT_MS);
    child.stdout.on('data', (d) => {
      buf += d; let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        eventTail = (eventTail + '\n' + line).slice(-6000);
        if (!started) { started = true; onEvent('started', { agent: 'codex', model }); }
        if (ev.type === 'thread.started') {
          sessionId = ev.thread_id || ev.thread?.id || sessionId;
          if (sessionId) { state.codexSessionId = sessionId; saveState(state); }
        }
        if (ev.type === 'item.started' && ['command_execution', 'mcp_tool_call', 'web_search'].includes(ev.item?.type)) {
          const item = ev.item || {};
          const tool = item.type === 'command_execution' ? 'command'
            : item.type === 'mcp_tool_call' ? `${item.server || 'mcp'}.${item.tool || 'tool'}` : 'web search';
          const summary = item.type === 'command_execution' ? String(item.command || '').replace(/\s+/g, ' ').slice(0, 900) : '';
          if (runtime.blockBrokerActions && isBrokerWriteTool(tool)) {
            tripCircuit(`report recovery blocked broker order tool (${tool})`);
            continue;
          }
          onEvent('execution', { agent: 'codex', phase: 'started', tool, summary });
          const toolStop = guard.observeTool(JSON.stringify([
            ev.item.type, ev.item.server, ev.item.tool, ev.item.arguments, ev.item.command,
          ]));
          if (toolStop) { tripCircuit(toolStop); continue; }
        }
        if (ev.type === 'item.completed' && ['command_execution', 'mcp_tool_call', 'web_search'].includes(ev.item?.type)) {
          const item = ev.item || {};
          const tool = item.type === 'command_execution' ? 'command'
            : item.type === 'mcp_tool_call' ? `${item.server || 'mcp'}.${item.tool || 'tool'}` : 'web search';
          const failed = item.status === 'failed' || (Number.isInteger(item.exit_code) && item.exit_code !== 0);
          onEvent('execution', { agent: 'codex', phase: 'completed', ok: !failed, tool,
            summary: Number.isInteger(item.exit_code) ? `exit ${item.exit_code}` : String(item.status || '') });
        }
        if (ev.type === 'item.completed' && ev.item?.type === 'agent_message') {
          finalText = ev.item.text || finalText;
          const outputStop = guard.observeOutputTokens(Math.ceil(String(ev.item.text || '').length / 4));
          if (outputStop) { tripCircuit(outputStop); continue; }
        }
        if (ev.type === 'turn.completed') usage = ev.usage || usage;
        const unavailable = codexAvailabilityError(ev);
        if (unavailable) {
          availabilityError = unavailable;
          onEvent('trouble', `Codex availability: ${unavailable.slice(0, 250)}`);
        }
      }
    });
    child.stderr.on('data', (d) => { err += d; if (err.length > 20_000) err = err.slice(-10_000); });
    child.on('error', (e) => { clearTimeout(timer); finish({ ok: false, agent: 'codex', model, fallbackEligible: true, switchNotified: true, switchReason: `could not start Codex (${e.message})`, text: `could not start Codex (${e.message})` }); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (activeRun?.interrupt) {
        finish({ ok: false, interrupted: true, agent: 'codex', model,
          fallbackEligible: false, text: activeRun.interrupt.reason });
      } else if (circuitBroken) {
        finish({ ok: false, agent: 'codex', model, fallbackEligible: false,
          text: `Circuit breaker stopped Codex: ${circuitBroken}. The run was halted to prevent a loop or excess token use.` });
      } else if (finalText) {
        if (availabilityError) {
          finish({
            ok: false,
            agent: 'codex', model, fallbackEligible: true,
            switchReason: availabilityError.slice(-1500),
            text: finalText,
          });
          return;
        }
        if (sessionId) state.codexSessionId = sessionId;
        state.lastRunAt = Date.now(); state.lastAgent = 'codex'; saveState(state);
        finish({ ok: true, agent: 'codex', fallbackEligible: false, text: finalText,
                 model,
                 tokens: usage ? { in: usage.input_tokens, out: usage.output_tokens,
                   cache_read: usage.cached_input_tokens } : undefined });
      } else {
        const detail = (err || eventTail || buf).trim().slice(-1500) || `Codex exited ${code} without a final message`;
        const unavailable = (availabilityError || err).trim();
        finish({ ok: false, agent: 'codex', fallbackEligible: !timedOut && Boolean(unavailable && CODEX_UNAVAILABLE_RE.test(unavailable)),
                 model,
                 switchNotified: Boolean(unavailable && CODEX_UNAVAILABLE_RE.test(unavailable)),
                 switchReason: unavailable && CODEX_UNAVAILABLE_RE.test(unavailable) ? unavailable.slice(-1500) : null,
                 text: timedOut ? `Codex hit the ${Math.round(CODEX_TIMEOUT_MS / 60_000)}-minute bridge limit.` : detail });
      }
    });
  });
}

let codexCatalogCache = { at: 0, models: [] };

// Add future runtime adapters here; ordering and saved preference behavior are
// handled by the provider-neutral registry module.
function agentRunners() {
  return { codex: runCodex, claude: runClaude };
}

function currentCodexModels() {
  if (Date.now() - codexCatalogCache.at < 5 * 60_000 && codexCatalogCache.models.length) {
    return codexCatalogCache.models;
  }
  const result = spawnSync(CODEX_BIN, ['debug', 'models'], {
    cwd: DESK_DIR,
    env: managedAgentEnv(),
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  const models = parseCodexModelCatalog(result.status === 0 ? result.stdout : '', CODEX_MODEL);
  codexCatalogCache = { at: Date.now(), models };
  return models;
}

function createPendingModelSwitch(last, prompt, history, attachments = []) {
  const failedAgent = last.agent === 'claude' ? 'claude' : 'codex';
  const failedModel = last.model || selectedDefaultModel(failedAgent);
  const choiceSet = buildModelChoiceSet({
    failedAgent,
    failedModel,
    claudeModels: routableModels('claude', CLAUDE_MODEL_CANDIDATES),
    codexModels: routableModels('codex', currentCodexModels()),
  });
  return {
    failedAgent,
    failedModel,
    reason: String(last.switchReason || last.text || 'model unavailable').replace(/\s+/g, ' ').slice(0, 500),
    resetAtMs: Number.isFinite(last.resetAtMs) ? last.resetAtMs : null,
    prompt,
    recentContext: compactHistory(history),
    ...choiceSet,
    page: 1,
    requestedAt: new Date().toISOString(),
    attachments: attachments.slice(0, MAX_INBOUND_IMAGES)
      .map((item) => ({ path: item.path, mime: item.mime, bytes: item.bytes })),
  };
}

async function runAutomaticModelPlan(prompt, onEvent, attachments, preferredAgent, options = {}) {
  const runners = agentRunners();
  if (options.resetSessions || options.resetBrokerSession) {
    state.sessionId = null;
    state.claudeSessionId = null;
    state.codexSessionId = null;
    saveState(state);
    logEvent('scheduled_sessions_reset', { kind: options.scheduledKind || null });
  }
  const plan = buildInterleavedModelPlan({
    preferredAgent,
    defaultClaudeModel: routableDefaultModel(
      'claude',
      options.preferredChoice?.agent === 'claude'
        ? options.preferredChoice.model : selectedDefaultModel('claude'),
    ),
    defaultCodexModel: routableDefaultModel(
      'codex',
      options.preferredChoice?.agent === 'codex'
        ? options.preferredChoice.model : selectedDefaultModel('codex'),
    ),
    claudeModels: routableModels('claude', CLAUDE_MODEL_CANDIDATES),
    codexModels: routableModels('codex', currentCodexModels()),
    maxPerAgent: 3,
  }).filter((choice) => runners[choice.agent]);
  const runLabel = options.scheduledKind ? 'scheduled run' : 'full-auto run';
  const attemptedAgents = new Set();
  const execution = await executeAvailabilityPlan({
    plan,
    prompt,
    handoffPrompt: (last, choice, originalPrompt) => options.trustedBrokerApproval
      ? originalPrompt
      : automaticModelHandoffPrompt({
          last, choice, prompt: originalPrompt, runLabel,
          reconcileBroker: options.reconcileBroker === true,
          recentContext: options.recentContext || '',
        }),
    onSwitch: (last, choice) => {
      onEvent('switch', {
        from: { name: last.agent, model: last.model },
        to: { name: choice.agent, model: choice.model },
        reason: last.switchReason || last.text || 'model unavailable',
        restart: false,
        automatic: true,
      });
    },
    onAttempt: (choice, index) => {
      // A different agent cannot continue the current agent's session. Its
      // previously saved phone session may be unrelated and expensive to replay,
      // so start clean on first entry; later returns in this plan resume the
      // session created for this same fallback chain.
      if (!attemptedAgents.has(choice.agent) && attemptedAgents.size > 0) {
        if (choice.agent === 'claude') state.claudeSessionId = null;
        else state.codexSessionId = null;
        saveState(state);
        logEvent('automatic_target_session_reset', { agent: choice.agent, run: runLabel });
      }
      attemptedAgents.add(choice.agent);
      logEvent(options.scheduledKind ? 'scheduled_model_attempt' : 'full_auto_model_attempt', {
        attempt: index + 1, total: plan.length,
        agent: choice.agent, model: choice.model,
      });
    },
    runAttempt: async (choice, routedPrompt) => {
      const brokerPreflight = createBrokerPreflightTracker();
      const trackedEvent = (kind, detail) => {
        brokerPreflight.observe(kind, detail);
        onEvent(kind, detail);
      };
      let result = await runners[choice.agent](routedPrompt, trackedEvent, choice.model, attachments, {
        trustedBrokerApproval: options.trustedBrokerApproval,
        reportRecoveryInstructions: options.reportRecoveryInstructions,
        blockBrokerActions: options.blockBrokerActions,
        maxToolCalls: options.maxToolCalls,
        maxIdenticalToolCalls: options.maxIdenticalToolCalls,
        maxOutputTokens: options.maxOutputTokens,
      });
      if (result.ok && shouldFallbackForBroker(prompt, result.text)) {
        result = {
          ...result,
          ok: false,
          fallbackEligible: true,
          switchReason: `${agentLabel(choice.agent, result.model)} could not access live broker tools`,
          text: `${agentLabel(choice.agent, result.model)} reported that live broker tools are unavailable.`,
        };
      }
      if (result.ok && options.scheduledKind && options.scheduledKind !== 'test' && !brokerPreflight.attempted) {
        onEvent('trouble', 'Scheduled report missed its Robinhood MCP preflight; correcting before delivery.');
        logEvent('scheduled_broker_preflight_missing', {
          kind: options.scheduledKind, agent: choice.agent, model: choice.model,
        });
        const correction = await runners[choice.agent](
          scheduledBrokerCorrectionPrompt(), trackedEvent, choice.model, attachments,
        );
        if (correction.ok && brokerPreflight.attempted) result = correction;
        else if (correction.fallbackEligible) result = correction;
        else {
          result = {
            ...correction,
            ok: false,
            fallbackEligible: false,
            text: 'Scheduled report blocked: no Robinhood MCP get_accounts preflight was observed after correction.',
          };
        }
      }
      if (result.ok && options.scheduledKind && options.scheduledKind !== 'test') {
        result = {
          ...result,
          broker_mcp_preflight: brokerPreflight.completed
            ? (brokerPreflight.succeeded ? 'succeeded' : 'failed') : 'started',
        };
      }
      if (result.ok) clearModelAvailabilityFailure(choice.agent, choice.model);
      else if (isModelAvailabilityFailure(result)) {
        persistModelAvailabilityFailure(choice.agent, choice.model, {
          reason: result.switchReason || result.text,
          ...(result.resetAtMs ? { resetAtMs: result.resetAtMs } : {}),
        });
      }
      return result;
    },
  });
  const { last, attempts, firstAvailabilityFailure } = execution;
  if (last.ok) {
    const automaticFallback = attempts > 1 && options.persistFallbackChoice && firstAvailabilityFailure
      ? {
          agent: last.agent,
          model: last.model,
          defaultAgent: options.defaultAgent || preferredAgent,
          failedAgent: firstAvailabilityFailure.agent,
          failedModel: firstAvailabilityFailure.model,
          resetAtMs: firstAvailabilityFailure.resetAtMs || null,
          selectedAt: new Date().toISOString(),
          automatic: true,
        }
      : null;
    return { ...last, automaticFallback, modelPlan: plan, attempts };
  }
  if (!execution.exhausted) return { ...last, modelPlan: plan, attempts };
  return {
    ...last,
    fallbackEligible: false,
    modelPlan: plan,
    attempts,
    text: `All ${plan.length} ${runLabel} model candidates were unavailable. Last error: ${last.text}`,
  };
}

async function runPreferredAgent(prompt, onEvent = () => {}, forcedChoice = null, attachments = [], options = {}) {
  const runners = agentRunners();
  const available = [...new Set([...AGENT_PRIORITY, ...Object.keys(runners)])]
    .filter((name) => runners[name]);
  const preference = available.includes(state.agentPreference) ? state.agentPreference : available[0];
  const configuredOrder = preferredAgentOrder(preference, available);
  const history = Array.isArray(state.recentHistory) ? state.recentHistory.slice(-8) : [];
  const brokerKind = options.disableBrokerRouting
    ? null : (options.brokerKind || brokerRequestKind(prompt, history));
  const temporaryChoice = !forcedChoice && !options.autoModelFallback
    ? temporaryChoiceForRun(state.temporaryModelChoice, preference, Boolean(brokerKind)) : null;
  const effectiveChoice = forcedChoice || temporaryChoice;
  let order = effectiveChoice ? [effectiveChoice.agent] : configuredOrder;
  if (!effectiveChoice && brokerKind && runners[BROKER_AGENT]) {
    order = prioritizeBrokerAgent(order, BROKER_AGENT, brokerKind);
  }
  if (shouldAutoModelFallback(currentMode(), options.autoModelFallback)) {
    const preferredAgent = options.preferredAgent || order[0] || preference;
    const preferredChoice = effectiveChoice || {
      agent: preferredAgent,
      model: selectedDefaultModel(preferredAgent),
    };
    const routedPrompt = brokerKind && !options.trustedBrokerApproval
      ? brokerFirstPrompt(prompt, brokerKind, history) : prompt;
    return runAutomaticModelPlan(routedPrompt, onEvent, attachments, preferredAgent, {
      ...options,
      preferredChoice,
      defaultAgent: preference,
      persistFallbackChoice: !options.scheduledKind && (!brokerKind || preferredAgent === preference),
      reconcileBroker: currentMode() === 'full',
      recentContext: compactHistory(history),
    });
  }
  let last = { ok: false, text: 'No configured agent is available.' };
  let attempts = 0;
  const brokerSessionsReset = new Set();
  for (const name of order) {
    const runner = runners[name];
    if (!runner) continue;
    if (attempts >= MAX_AGENT_ATTEMPTS) {
      const reason = `agent-attempt limit reached (${attempts}/${MAX_AGENT_ATTEMPTS})`;
      onEvent('circuit_breaker', { agent: name, reason });
      return { ok: false, agent: last.agent || name, model: last.model,
        fallbackEligible: false, text: `Circuit breaker stopped routing: ${reason}.` };
    }
    attempts++;
    if (options.resetBrokerSession && !brokerSessionsReset.has(name)) {
      if (name === 'claude') state.claudeSessionId = null;
      else state.codexSessionId = null;
      brokerSessionsReset.add(name);
      saveState(state);
      logEvent('broker_execution_session_reset', { agent: name });
    }
    const basePrompt = brokerKind && !options.trustedBrokerApproval
      ? brokerFirstPrompt(prompt, brokerKind, history) : prompt;
    const chosenModel = effectiveChoice?.agent === name
      ? effectiveChoice.model : selectedDefaultModel(name);
    const knownFailure = recordedModelFailure(name, chosenModel);
    if (knownFailure) {
      last = {
        ok: false,
        agent: name,
        model: chosenModel,
        fallbackEligible: true,
        switchReason: `${agentLabel(name, chosenModel)} is unavailable: ${availabilityRetryLabel(knownFailure)}`,
        resetAtMs: knownFailure.resetAtMs || null,
        text: `${agentLabel(name, chosenModel)} remains unavailable (${availabilityRetryLabel(knownFailure)}).`,
      };
      const pendingModelSwitch = createPendingModelSwitch(last, prompt, history, attachments);
      return {
        ...last,
        pausedForModel: true,
        pendingModelSwitch,
        text: formatModelChoiceForPhone(pendingModelSwitch),
      };
    }
    last = await runner(basePrompt, onEvent, chosenModel, attachments, {
      trustedBrokerApproval: options.trustedBrokerApproval,
      reportRecoveryInstructions: options.reportRecoveryInstructions,
      blockBrokerActions: options.blockBrokerActions,
      maxToolCalls: options.maxToolCalls,
      maxIdenticalToolCalls: options.maxIdenticalToolCalls,
      maxOutputTokens: options.maxOutputTokens,
    });
    if (last.ok && shouldFallbackForBroker(prompt, last.text)) {
      last = {
        ...last,
        ok: false,
        fallbackEligible: true,
        switchReason: `${agentLabel(name, last.model)} could not access live broker tools`,
        text: `${agentLabel(name, last.model)} reported that live broker tools are unavailable.`,
      };
    }
    if (last.ok) clearModelAvailabilityFailure(name, chosenModel);
    else if (isModelAvailabilityFailure(last)) {
      persistModelAvailabilityFailure(name, chosenModel, {
        reason: last.switchReason || last.text,
        ...(last.resetAtMs ? { resetAtMs: last.resetAtMs } : {}),
      });
    }
    if (last.ok || !last.fallbackEligible) return last;
    const pendingModelSwitch = createPendingModelSwitch(last, prompt, history, attachments);
    return {
      ...last,
      pausedForModel: true,
      pendingModelSwitch,
      text: formatModelChoiceForPhone(pendingModelSwitch),
    };
  }
  return last;
}

// ---------------------------------------------------------- providers ------
// --- twilio ---
function twilioAuthorization() {
  return 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
}

function twilioVerify(params, header) {
  // signature = Base64(HMAC-SHA1(auth_token, PUBLIC_URL + sorted(key+value)))
  let data = PUBLIC_URL;
  for (const k of Object.keys(params).sort()) data += k + params[k];
  const expected = crypto.createHmac('sha1', TWILIO_AUTH_TOKEN).update(data).digest('base64');
  const got = Buffer.from(String(header || ''), 'utf8');
  const want = Buffer.from(expected, 'utf8');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

async function twilioSend(toDigits, body) {
  // Some accounts (2026 trial/tryout) require a ContentSid on every WhatsApp
  // send. With TWILIO_CONTENT_SID set to a passthrough template ("{{1}}"),
  // the whole reply travels as the template variable; otherwise freeform Body.
  const params = { From: TWILIO_WHATSAPP_FROM, To: `whatsapp:+${toDigits}` };
  if (process.env.TWILIO_CONTENT_SID) {
    params.ContentSid = process.env.TWILIO_CONTENT_SID;
    params.ContentVariables = JSON.stringify({ 1: body });
  } else {
    params.Body = body;
  }
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: twilioAuthorization(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    },
  );
  if (!res.ok) log(`twilio API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.ok;
}

async function twilioPollingImages(message) {
  if (Number(message.num_media || 0) < 1 || !message.subresource_uris?.media) return [];
  const response = await fetch(`https://api.twilio.com${message.subresource_uris.media}`, {
    headers: { Authorization: twilioAuthorization() },
  });
  if (!response.ok) throw new Error(`Twilio media list returned ${response.status}`);
  const body = await response.json();
  const sources = (body.media_list || []).filter((item) => normalizedImageType(item.content_type))
    .slice(0, MAX_INBOUND_IMAGES).map((item) => ({
      url: `https://api.twilio.com${String(item.uri || '').replace(/\.json$/, '')}`,
      mime: item.content_type,
      headers: { Authorization: twilioAuthorization() },
      provider: 'twilio',
    }));
  return collectInboundImages(sources);
}

async function twilioWebhookImages(params) {
  const sources = [];
  for (let index = 0; index < Math.min(Number(params.NumMedia || 0), MAX_INBOUND_IMAGES); index++) {
    const mime = normalizedImageType(params[`MediaContentType${index}`]);
    const url = params[`MediaUrl${index}`];
    if (mime && url) sources.push({ url, mime, headers: { Authorization: twilioAuthorization() }, provider: 'twilio' });
  }
  return collectInboundImages(sources);
}

async function fetchAndStoreInboundImage({ url, mime, headers = {}, provider }) {
  const declared = normalizedImageType(mime);
  if (!declared) throw new Error('unsupported image type');
  const target = new URL(url);
  if (target.protocol !== 'https:') throw new Error('image URL must use HTTPS');
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new Error('image download timed out')), 45_000);
  try {
    const response = await fetch(target, { headers, signal: ac.signal, redirect: 'follow' });
    if (!response.ok) throw new Error(`image download returned ${response.status}`);
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_INBOUND_IMAGE_BYTES) throw new Error('image exceeds size limit');
    const responseType = normalizedImageType(response.headers.get('content-type'));
    const actualType = responseType || declared;
    if (responseType && responseType !== declared) throw new Error('image content type changed during download');
    const chunks = [];
    let total = 0;
    const reader = response.body?.getReader();
    if (!reader) throw new Error('image response has no body');
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_INBOUND_IMAGE_BYTES) {
        await reader.cancel('image exceeds size limit');
        throw new Error('image exceeds size limit');
      }
      chunks.push(Buffer.from(value));
    }
    const bytes = Buffer.concat(chunks, total);
    const saved = saveInboundImage(INBOUND_MEDIA_DIR, bytes, actualType);
    logEvent('inbound_image_saved', { provider, mime: saved.mime, bytes: saved.bytes });
    return saved;
  } finally {
    clearTimeout(timer);
  }
}

async function collectInboundImages(sources = []) {
  const saved = [];
  for (const source of sources.slice(0, MAX_INBOUND_IMAGES)) {
    try { saved.push(await fetchAndStoreInboundImage(source)); }
    catch (e) { logEvent('inbound_image_rejected', { provider: source.provider, error: e.message }); }
  }
  return saved;
}

// --- telegram ---
function telegramApiOnce(method, payload, timeoutMs) {
  // Use node:https instead of fetch/undici so socket destruction is a genuine
  // hard deadline even during DNS/connect/TLS. `agent: false` prevents a dead
  // keep-alive socket surviving a laptop sleep or Wi-Fi handoff.
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const started = Date.now();
    const req = https.request({
      hostname: 'api.telegram.org', family: 4, agent: false,
      path: `/bot${TELEGRAM_BOT_TOKEN}/${method}`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { raw += d; if (raw.length > 2_000_000) req.destroy(new Error('Telegram response too large')); });
      res.on('end', () => {
        let j = {};
        try { j = JSON.parse(raw); } catch { return reject(new Error(`${method} returned invalid JSON (${res.statusCode})`)); }
        const elapsedMs = Date.now() - started;
        logEvent('telegram_api', { method, elapsed_ms: elapsedMs, ok: Boolean(j.ok), status: res.statusCode });
        if (!j.ok) log(`telegram ${method} ${res.statusCode}: ${JSON.stringify(j).slice(0, 200)}`);
        resolve(j);
      });
    });
    const timer = setTimeout(() => req.destroy(
      new Error(`${method} hard timeout after ${timeoutMs / 1000}s`)), timeoutMs);
    req.on('close', () => clearTimeout(timer));
    req.on('error', reject);
    req.end(body);
  });
}

async function telegramApi(method, payload, timeoutMs = 15_000, retries = 1) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try { return await telegramApiOnce(method, payload, timeoutMs); }
    catch (e) {
      last = e;
      logEvent('telegram_api_error', { method, attempt: attempt + 1, error: e.message });
      if (attempt < retries) await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw last;
}

async function telegramSend(chatId, text) {
  const result = await telegramApi(
    'sendMessage', { chat_id: Number(chatId), text }, 12_000, 1);
  if (!result.ok) throw new Error(`Telegram sendMessage rejected: ${result.description || 'unknown error'}`);
  return true;
}

async function telegramCreateLive(chatId, text) {
  const result = await telegramApi(
    'sendMessage', { chat_id: Number(chatId), text }, 12_000, 1);
  if (!result.ok || !result.result?.message_id) {
    throw new Error(`Telegram live status rejected: ${result.description || 'unknown error'}`);
  }
  return { chatId: Number(chatId), messageId: result.result.message_id };
}

async function telegramEditLive(handle, text) {
  const result = await telegramApi('editMessageText', {
    chat_id: handle.chatId,
    message_id: handle.messageId,
    text,
  }, 12_000, 0);
  // Telegram returns "message is not modified" for identical cards. Treat it
  // as success so a harmless timing race never breaks the run monitor.
  return Boolean(result.ok || /message is not modified/i.test(result.description || ''));
}

const MIME = { '.html': 'text/html', '.pdf': 'application/pdf', '.svg': 'image/svg+xml', '.png': 'image/png', '.csv': 'text/csv', '.md': 'text/markdown', '.txt': 'text/plain' };

async function telegramSendDocument(chatId, filePath, caption) {
  const fd = new FormData();
  fd.append('chat_id', String(Number(chatId)));
  if (caption) fd.append('caption', caption.slice(0, 1000));
  const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  fd.append('document', new Blob([fs.readFileSync(filePath)], { type }), path.basename(filePath));
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new Error('sendDocument hard timeout after 120s')), 120_000);
  const started = Date.now();
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: 'POST', body: fd, signal: ac.signal,
    });
    const j = await res.json().catch(() => ({}));
    logEvent('telegram_api', { method: 'sendDocument', elapsed_ms: Date.now() - started,
      ok: Boolean(j.ok), status: res.status });
    if (!j.ok) log(`telegram sendDocument ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
    return j.ok;
  } finally {
    clearTimeout(timer);
  }
}

async function telegramInboundImages(message) {
  const candidates = [];
  const photo = Array.isArray(message.photo) ? message.photo.at(-1) : null;
  if (photo?.file_id) candidates.push({ fileId: photo.file_id, mime: 'image/jpeg' });
  const documentType = normalizedImageType(message.document?.mime_type);
  if (message.document?.file_id && documentType) {
    candidates.push({ fileId: message.document.file_id, mime: documentType });
  }
  const sources = [];
  for (const candidate of candidates.slice(0, MAX_INBOUND_IMAGES)) {
    const result = await telegramApi('getFile', { file_id: candidate.fileId }, 15_000, 1);
    const filePath = result.result?.file_path;
    if (!result.ok || !filePath) continue;
    sources.push({
      url: `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`,
      mime: candidate.mime,
      provider: 'telegram',
    });
  }
  return collectInboundImages(sources);
}

// Resolve symlinks before applying the last-mile file policy. A repo-local link
// to a secret must not bypass a string-prefix check.
function extractFileDirectives(reply) {
  const files = [], lines = [];
  for (const line of String(reply).split('\n')) {
    const m = line.match(/^\s*FILE:\s*(\/\S.*?)\s*$/);
    if (!m) { lines.push(line); continue; }
    let real = null;
    try { real = fs.realpathSync(path.resolve(m[1])); } catch { real = null; }
    let ok = Boolean(real) && !forbiddenSendPath(real, DESK_DIR, BRIDGE_DIR);
    if (ok) {
      try { const st = fs.lstatSync(real); ok = st.isFile() && st.size < 45 * 1024 * 1024; }
      catch { ok = false; }
    }
    if (ok) files.push(real);
    else { log(`blocked FILE directive: ${m[1]}`); lines.push(`(file not sendable: ${path.basename(m[1])})`); }
  }
  return { text: lines.join('\n').trim(), files };
}

async function telegramPollLoop() {
  const startedSec = Math.floor(Date.now() / 1000) - 60; // skip pre-start backlog
  log('telegram long-polling mode — near-instant delivery, no inbound port, no tunnel');
  let offset = 0, failures = 0;
  for (;;) {
    try {
      // Short polls plus a 5s hard-deadline margin recover quickly after sleep,
      // Wi-Fi handoff, or a silently dropped route.
      const j = await telegramApi('getUpdates', {
        timeout: 20, offset, allowed_updates: ['message'],
      }, 25_000, 0);
      failures = 0;
      for (const u of j.result || []) {
        offset = Math.max(offset, u.update_id + 1);
        const m = u.message;
        if (!m?.from) continue;
        if (m.date < startedSec) continue; // stale backlog — acknowledged, not processed
        const from = String(m.from.id);
        if (from !== ALLOWED_SENDER) { log('ignored Telegram media/message from non-allowlisted sender'); continue; }
        const hasImage = Boolean(m.photo?.length || /^image\//i.test(String(m.document?.mime_type || '')));
        const text = String(m.text || m.caption || '').trim();
        if (!text && !hasImage) continue;
        let attachments = [];
        try { attachments = hasImage ? await telegramInboundImages(m) : []; }
        catch (e) { logEvent('inbound_image_error', { provider: 'telegram', error: e.message }); }
        if (hasImage && !attachments.length) {
          await sendText(String(m.chat.id), 'Image rejected or unavailable. Send JPEG, PNG, WebP, or GIF up to 20 MB.');
          continue;
        }
        enqueue(`tg${m.message_id}-${m.chat.id}`, from,
          text || 'Inspect the attached image and explain what matters.', String(m.chat.id), m.date * 1000, attachments);
      }
    } catch (e) {
      failures++;
      log('telegram poll error:', e.message);
      await new Promise((r) => setTimeout(r, Math.min(1000 * failures, 10_000)));
    }
  }
}

// --- meta ---
function metaVerify(rawBody, header) {
  if (!header?.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');
  const got = header.slice(7);
  return got.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(expected, 'hex'));
}

async function metaGraphPost(body) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) log(`graph API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.ok;
}

async function metaInboundImages(message) {
  if (message.type !== 'image' || !message.image?.id) return [];
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${message.image.id}`, {
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
  });
  if (!response.ok) throw new Error(`Meta media lookup returned ${response.status}`);
  const metadata = await response.json();
  const mime = normalizedImageType(metadata.mime_type);
  if (!mime || !metadata.url) return [];
  return collectInboundImages([{
    url: metadata.url,
    mime,
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
    provider: 'meta',
  }]);
}

// --- discord ---
async function discordApi(route, options = {}) {
  const res = await fetch(`https://discord.com/api/v10${route}`, {
    ...options,
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      'User-Agent': 'TradingDeskBridge/3.0',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) log(`discord API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res;
}

async function discordSend(channelId, body) {
  const res = await discordApi(`/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: body, allowed_mentions: { parse: [] } }),
  });
  return res.ok;
}

async function discordSendDocument(channelId, filePath, caption) {
  const form = new FormData();
  form.append('payload_json', JSON.stringify({ content: caption || '', allowed_mentions: { parse: [] } }));
  const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  form.append('files[0]', new Blob([fs.readFileSync(filePath)], { type }), path.basename(filePath));
  const res = await discordApi(`/channels/${channelId}/messages`, { method: 'POST', body: form });
  return res.ok;
}

async function discordInboundImages(message) {
  const sources = (message.attachments || [])
    .filter((item) => normalizedImageType(item.content_type) && item.url)
    .slice(0, MAX_INBOUND_IMAGES)
    .map((item) => ({ url: item.url, mime: item.content_type, provider: 'discord' }));
  return collectInboundImages(sources);
}

async function discordPollLoop() {
  log(`discord polling mode — channel ${DISCORD_CHANNEL_ID}, every ${POLL_MS / 1000}s`);
  let after = state.discordLastMessageId || null;
  let initializing = !after;
  let failures = 0;
  for (;;) {
    try {
      const query = after ? `?after=${encodeURIComponent(after)}&limit=100` : '?limit=1';
      const res = await discordApi(`/channels/${DISCORD_CHANNEL_ID}/messages${query}`);
      if (!res.ok) throw new Error(`Discord poll returned ${res.status}`);
      const messages = await res.json();
      for (const m of messages.reverse()) {
        // On first install, establish a watermark without replaying the latest
        // historical command into a potentially resumable trading session.
        if (!initializing && !m.author?.bot && String(m.author?.id) === ALLOWED_SENDER) {
          const hasImage = (m.attachments || []).some((item) => /^image\//i.test(String(item.content_type || '')));
          const text = String(m.content || '').trim();
          if (text || hasImage) {
            let attachments = [];
            try { attachments = hasImage ? await discordInboundImages(m) : []; }
            catch (e) { logEvent('inbound_image_error', { provider: 'discord', error: e.message }); }
            if (hasImage && !attachments.length) {
              await sendText(String(m.channel_id), 'Image rejected or unavailable. Send JPEG, PNG, WebP, or GIF up to 20 MB.');
            } else {
              enqueue(`discord-${m.id}`, String(m.author.id),
                text || 'Inspect the attached image and explain what matters.',
                String(m.channel_id), Date.parse(m.timestamp), attachments);
            }
          }
        }
        if (!after || BigInt(m.id) > BigInt(after)) after = m.id;
      }
      initializing = false;
      if (after && after !== state.discordLastMessageId) {
        state.discordLastMessageId = after;
        saveState(state);
      }
      failures = 0;
    } catch (e) {
      failures++;
      log('discord poll error:', e.message);
    }
    await new Promise((r) => setTimeout(r, Math.min(POLL_MS * (failures + 1), 60_000)));
  }
}

// Every transport implements the same small contract. The desk/message flow
// below never needs to know which app delivered a message.
const messengers = {
  telegram: {
    maxTextChars: 3900,
    send: telegramSend,
    sendFile: telegramSendDocument,
    createLive: telegramCreateLive,
    editLive: telegramEditLive,
    typing: (to) => telegramApi('sendChatAction', { chat_id: Number(to), action: 'typing' }).catch(() => {}),
    start: telegramPollLoop,
    mode: 'long-poll',
  },
  discord: {
    maxTextChars: 1900,
    send: discordSend,
    sendFile: discordSendDocument,
    typing: (to) => discordApi(`/channels/${to}/typing`, { method: 'POST' }).then((r) => r.ok),
    start: discordPollLoop,
    mode: 'poll',
  },
  twilio: {
    maxTextChars: 1500,
    send: twilioSend,
    sendFile: null,
    typing: null,
    start: TWILIO_POLLING ? pollLoop : null,
    mode: TWILIO_POLLING ? 'poll' : 'webhook',
  },
  meta: {
    maxTextChars: 3900,
    send: (to, body) => metaGraphPost({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
    sendFile: null,
    typing: null,
    start: null,
    mode: 'webhook',
  },
};
const messenger = messengers[PROVIDER];

async function sendText(to, text) {
  const safe = sanitizePhoneText(text, { maxChars: messenger.maxTextChars });
  if (safe.redactions || safe.shortened) {
    logEvent('phone_output_sanitized', { redactions: safe.redactions, shortened: safe.shortened });
  }
  if (safe.text) await messenger.send(to, safe.text);
}

async function sendStatus(to, kind, text) {
  try {
    await sendText(to, text);
    logEvent('status_sent', { kind, provider: PROVIDER });
    return true;
  } catch (e) {
    log(`status send failed (${kind}):`, e.message);
    logEvent('status_send_error', { kind, provider: PROVIDER, error: e.message });
    return false;
  }
}

async function createLiveRunMonitor(to, view) {
  if (!messenger.createLive || !messenger.editLive) return null;
  let handle;
  try {
    const safe = sanitizePhoneText(formatRemoteRunView(view), { maxChars: messenger.maxTextChars });
    handle = await messenger.createLive(to, safe.text);
  } catch (e) {
    logEvent('live_monitor_error', { phase: 'create', error: e.message });
    return null;
  }
  let timer = null;
  let closed = false;
  let lastText = '';
  const flush = async () => {
    timer = null;
    const safe = sanitizePhoneText(formatRemoteRunView(view), { maxChars: messenger.maxTextChars });
    if (!safe.text || safe.text === lastText) return;
    lastText = safe.text;
    try { await messenger.editLive(handle, safe.text); }
    catch (e) { logEvent('live_monitor_error', { phase: 'edit', error: e.message }); }
  };
  return {
    event(kind, detail) {
      if (closed) return;
      updateRemoteRunView(view, kind, detail);
      if (!timer) timer = setTimeout(flush, 1500);
    },
    refresh() {
      if (!closed && !timer) timer = setTimeout(flush, 50);
    },
    async finish(status, result = '') {
      closed = true;
      if (timer) { clearTimeout(timer); timer = null; }
      finishRemoteRunView(view, status, result);
      await flush();
    },
  };
}

async function deliverExecutionTranscript(to, transcript, ok) {
  if (!transcript || PHONE_EXECUTION_LOG === 'off') return false;
  if (PHONE_EXECUTION_LOG === 'errors' && ok) return false;
  if (!messenger.sendFile) {
    await sendText(to, 'Agent execution log is saved on the desk; this messenger does not support file delivery yet.');
    return false;
  }
  const sent = await messenger.sendFile(to, transcript.path, 'Agent execution log');
  logEvent('execution_log_sent', { ok: Boolean(sent), provider: PROVIDER, file: path.basename(transcript.path) });
  return Boolean(sent);
}

async function deliverRunFiles(to, explicitFiles, reportSnapshot, runStartedMs) {
  const delivery = await deliverReportArtifacts({
    reportsDir: REPORTS_DIR,
    before: reportSnapshot,
    runStartedMs,
    explicitFiles,
    sendFile: messenger.sendFile
      ? (filePath, caption) => messenger.sendFile(to, filePath, caption) : null,
  });
  for (const item of delivery.outcomes) {
    if (item.status === 'sent') {
      logEvent('file_sent', {
        file: path.basename(item.filePath), automatic_report: item.automaticReport, ok: true,
      });
    } else if (item.status === 'unsupported') {
      await sendText(
        to,
        `(report ready on the laptop: ${item.filePath} — ${PROVIDER} file delivery is not enabled yet)`,
      );
    } else {
      logEvent('file_delivery_error', {
        provider: PROVIDER,
        file: path.basename(item.filePath),
        error: item.error || 'provider rejected document',
      });
      await sendText(to, `⚠️ Could not attach ${path.basename(item.filePath)}. It remains saved locally.`);
    }
  }
  return delivery;
}

function renderReportDraft(draftPath) {
  return new Promise((resolve) => {
    const source = path.resolve(draftPath);
    const output = path.join(REPORTS_DIR, `${path.basename(source, '.md')}.html`);
    const chartsDir = path.join(REPORTS_DIR, 'assets', 'charts', path.basename(path.dirname(source)));
    const child = spawn('python3', [
      path.join(DESK_DIR, 'scripts', 'report', 'build_report.py'),
      source,
      '--out', output,
      '--charts-dir', chartsDir,
    ], { cwd: DESK_DIR, stdio: ['ignore', 'pipe', 'pipe'], env: managedAgentEnv() });
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), 60_000);
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-1200); });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        error: code === 0 ? null : stderr.trim() || `build_report.py exited ${code}`,
      });
    });
  });
}

async function recoverReportArtifacts(draftSnapshot, runStartedMs) {
  let drafts = [];
  try { drafts = recoverableReportDrafts(REPORTS_DIR, draftSnapshot, runStartedMs); }
  catch (error) { return { built: 0, errors: [error.message] }; }
  const errors = [];
  let built = 0;
  for (const draft of drafts) {
    const rendered = await renderReportDraft(draft.realPath);
    if (rendered.ok) built++;
    else errors.push(`${path.basename(draft.realPath)}: ${rendered.error}`);
  }
  return { built, errors };
}

async function deliverChangeReview(to, snapshotDir, request, outcome, reason = {}) {
  let review;
  try {
    review = buildChangeReview({
      root: DESK_DIR, snapshotDir, outputDir: CHANGE_REVIEW_DIR, request, outcome, reason,
    });
  } catch (e) {
    logEvent('change_review_error', { error: e.message });
    return null;
  }
  if (!review) return null;
  try {
    if (messenger.sendFile) {
      await messenger.sendFile(to, review.path, 'Code change review');
    } else {
      const shown = review.files.slice(0, 4).join(', ');
      await sendText(to, `Code changes: ${shown}${review.files.length > 4 ? ` +${review.files.length - 4} more` : ''}\nDetailed diff saved; this messenger cannot receive HTML documents yet.`);
    }
  } catch (e) {
    logEvent('change_review_delivery_error', { provider: PROVIDER, error: e.message });
    return review;
  }
  logEvent('change_review_sent', { provider: PROVIDER, files: review.count, file: path.basename(review.path) });
  return review;
}

async function applyDeferredRestart(to, transcript) {
  if (!fs.existsSync(RESTART_REQUEST_FILE)) return false;
  if (queueDepth > 0) {
    logEvent('restart_deferred_queue_busy', { queue_depth: queueDepth });
    return false;
  }
  let request = {};
  try { request = JSON.parse(fs.readFileSync(RESTART_REQUEST_FILE, 'utf8')); } catch { /* malformed still means requested */ }
  try { fs.unlinkSync(RESTART_REQUEST_FILE); } catch { /* helper must still run */ }
  transcript?.append('ACTIVATE', request.reason || 'bridge update requested');
  await sendStatus(to, 'restart_scheduled', '♻️ Update complete — activating the new bridge after this reply. New messages will resume automatically.');
  const helper = spawn(SERVICE_CONTROL, ['activate'], {
    cwd: BRIDGE_DIR,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, BRIDGE_MANAGED_RUN: '0', BRIDGE_RESTART_DELAY_S: '2' },
  });
  helper.unref();
  logEvent('restart_scheduled', { requested_at: request.requested_at || null, helper_pid: helper.pid });
  return true;
}

// mark inbound message read + typing indicator (meta only; twilio has no equivalent)
function markReadAndTyping(messageId) {
  if (PROVIDER !== 'meta') return Promise.resolve(true);
  return metaGraphPost({
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
    typing_indicator: { type: 'text' },
  });
}

// -------------------------------------------------------- message flow -----
const seenIds = new Set(); // webhook deliveries can retry — dedup by message id
let queue = Promise.resolve(); // never run two claude sessions concurrently
let activeRun = null; // { prompt, startedMs } while a claude run is in flight
let queueDepth = 0;   // messages waiting behind it
let availabilityRetryTimer = null;
let temporaryDiscoveryTimer = null;

function selectedDefaultAgent() {
  return selectedRegisteredAgent(
    state.agentPreference,
    AGENT_PRIORITY,
    Object.keys(agentRunners()),
  );
}

function selectedDefaultModel(agent = selectedDefaultAgent()) {
  return selectedAgentModel(agent, AGENT_MODEL_DEFAULTS, state.agentModelPreferences);
}

// Availability is an observed fact, not a guess made while drawing /agent.
// Keep it separately from an in-flight handoff/recovery so a restart, a
// completed handoff, or a manual default change cannot make a known
// rate-limited model look available again.
function recordedAvailabilityFailures() {
  return availabilityLedger;
}

function persistModelAvailabilityFailure(agent, model, details = {}) {
  availabilityLedger = recordAvailabilityFailure(
    recordedAvailabilityFailures(),
    agent,
    model,
    details,
    Date.now(),
    MODEL_ALIASES,
  );
  saveAvailabilityLedger(availabilityLedger);
  const next = availabilityLedger.at(-1);
  logEvent('model_availability_recorded', { agent, model, reset_at: next.resetAtMs || null,
    retry_date: next.retryDate || null, reason: next.reason });
  return next;
}

function clearModelAvailabilityFailure(agent, model, source = 'successful_run') {
  const records = recordedAvailabilityFailures();
  const next = clearAvailabilityFailure(records, agent, model, MODEL_ALIASES);
  if (next.length === records.length) return false;
  availabilityLedger = next;
  saveAvailabilityLedger(availabilityLedger);
  logEvent('model_availability_cleared', { agent, model, source });
  return true;
}

function recordedModelFailure(agent, model) {
  return findAvailabilityFailure(
    recordedAvailabilityFailures(), agent, model, Date.now(), MODEL_ALIASES,
  );
}

function routableModels(agent, models) {
  return filterAvailableModels(
    recordedAvailabilityFailures(), agent, models, Date.now(), MODEL_ALIASES,
  );
}

function routableDefaultModel(agent, model) {
  return recordedModelFailure(agent, model) ? undefined : model;
}

function isModelAvailabilityFailure(result) {
  if (!result || result.ok) return false;
  return explicitFutureResetAtMs(result.resetAtMs) !== null ||
    availabilityFailure(`${result.switchReason || ''}\n${result.text || ''}`);
}

function clearAvailabilityRecovery() {
  if (availabilityRetryTimer) clearTimeout(availabilityRetryTimer);
  availabilityRetryTimer = null;
  delete state.availabilityRecovery;
  saveState(state);
}

function probeClaudeAvailability(model) {
  return new Promise((resolve) => {
    const child = spawn(CLAUDE_BIN, [
      '-p', 'Availability check. Reply exactly AVAILABLE.',
      '--output-format', 'stream-json', '--verbose', '--model', model,
      '--no-session-persistence', '--tools', '', '--strict-mcp-config', '--settings', SETTINGS_FILE,
    ], { cwd: DESK_DIR, stdio: ['ignore', 'pipe', 'pipe'], env: managedAgentEnv() });
    let buf = '', err = '', timedOut = false, result = null, resetAtMs = null;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 10_000);
    }, 90_000);
    child.stdout.on('data', (data) => {
      buf += data;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        let event;
        try { event = JSON.parse(line); } catch { continue; }
        if (event.type === 'rate_limit_event' && claudeRateLimitBlocked(event.rate_limit_info)) {
          resetAtMs = resetSecondsToMs(event.rate_limit_info?.resetsAt) || resetAtMs;
          child.kill('SIGTERM');
        }
        if (event.type === 'result') result = event;
      }
      if (buf.length > 50_000) buf = buf.slice(-20_000);
    });
    child.stderr.on('data', (data) => { err += data; if (err.length > 20_000) err = err.slice(-10_000); });
    child.on('error', () => { clearTimeout(timer); resolve({ ok: false, resetAtMs }); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const failed = timedOut || code !== 0 || result?.is_error === true ||
        /rate.?limit|quota|unavailable|authentication/i.test(`${result?.error || ''}\n${err}`);
      resolve({ ok: !failed, resetAtMs });
    });
  });
}

function armAvailabilityRecovery() {
  if (availabilityRetryTimer) clearTimeout(availabilityRetryTimer);
  availabilityRetryTimer = null;
  const recovery = state.availabilityRecovery;
  if (!recovery) return;
  const delay = Math.max(1000, Number(recovery.nextAttemptAtMs || Date.now()) - Date.now());
  availabilityRetryTimer = setTimeout(() => { attemptAvailabilityRecovery().catch((e) => {
    logEvent('availability_recovery_error', { error: e.message });
  }); }, delay);
}

async function attemptAvailabilityRecovery() {
  const recovery = state.availabilityRecovery;
  if (!recovery) return;
  if (!shouldRunRecovery(recovery, selectedDefaultAgent(), Boolean(activeRun))) {
    if (recovery.defaultAgent !== selectedDefaultAgent()) {
      logEvent('availability_recovery_cancelled', { reason: 'default_agent_changed' });
      clearAvailabilityRecovery();
      return;
    }
    recovery.nextAttemptAtMs = Date.now() + 120_000;
    saveState(state);
    armAvailabilityRecovery();
    return;
  }
  // Reset times are currently emitted by Claude's rate-limit event. Keep this
  // branch explicit so future agents need a real availability probe too.
  const probe = recovery.agent === 'claude'
    ? await probeClaudeAvailability(recovery.model) : { ok: false, resetAtMs: null };
  // A manual /agent command can arrive while the probe is running. Its choice
  // wins; never send a stale restoration notice or alter its routing.
  if (state.availabilityRecovery !== recovery || recovery.defaultAgent !== selectedDefaultAgent()) return;
  if (probe.ok) {
    const replyTo = recovery.replyTo;
    state.lastAvailabilityRecovery = { agent: recovery.agent, model: recovery.model, restoredAt: new Date().toISOString() };
    if (state.temporaryModelChoice?.defaultAgent === recovery.defaultAgent) delete state.temporaryModelChoice;
    clearModelAvailabilityFailure(recovery.agent, recovery.model, 'reset_probe');
    clearAvailabilityRecovery();
    logEvent('availability_recovered', { agent: recovery.agent, model: recovery.model });
    if (replyTo) await sendStatus(replyTo, 'availability_recovered', `Default ${agentLabel(recovery.agent, recovery.model)} is available again. Future requests use your default.`);
    return;
  }
  recovery.attempts = Number(recovery.attempts || 0) + 1;
  if (probe.resetAtMs && probe.resetAtMs > Date.now() + 1000) {
    recovery.resetAtMs = probe.resetAtMs;
    recovery.nextAttemptAtMs = probe.resetAtMs;
  } else {
    recovery.nextAttemptAtMs = recoveryNextAttemptAt(recovery.resetAtMs, recovery.attempts);
  }
  saveState(state);
  logEvent('availability_recovery_retry', { agent: recovery.agent, attempts: recovery.attempts,
    next_attempt_at: new Date(recovery.nextAttemptAtMs).toISOString() });
  armAvailabilityRecovery();
}

function scheduleAvailabilityRecovery(pending, replyTo) {
  if (!pending?.resetAtMs || pending.failedAgent !== selectedDefaultAgent()) return;
  state.availabilityRecovery = {
    agent: pending.failedAgent,
    model: pending.failedModel,
    defaultAgent: selectedDefaultAgent(),
    resetAtMs: pending.resetAtMs,
    nextAttemptAtMs: recoveryNextAttemptAt(pending.resetAtMs),
    attempts: 0,
    replyTo,
  };
  saveState(state);
  logEvent('availability_recovery_scheduled', { agent: pending.failedAgent, model: pending.failedModel,
    reset_at: new Date(pending.resetAtMs).toISOString() });
  armAvailabilityRecovery();
}

function alternativeAgentLabels(preferred) {
  const available = configuredAgentNames();
  return preferredAgentOrder(preferred, available).slice(1)
    .map((name) => agentLabel(name, selectedDefaultModel(name)));
}

function configuredAgentNames() {
  return registeredAgentNames(AGENT_PRIORITY, Object.keys(agentRunners()));
}

function knownModelFailure(agent, model) {
  const transient = [state.pendingModelSwitch, state.availabilityRecovery, state.temporaryModelChoice]
    .filter(Boolean)
    .map((item) => ({
      agent: item.failedAgent || item.agent,
      model: item.failedModel || item.model,
      resetAtMs: item.resetAtMs,
  }));
  return recordedModelFailure(agent, model) ||
    transient.find((item) => item.agent === agent
      && sameAgentModel(agent, item.model, model, MODEL_ALIASES)) || null;
}

function modelAvailability(agent, item) {
  const model = String(item?.model || item || '');
  const failure = knownModelFailure(agent, model);
  if (failure) {
    return { model, label: String(item?.label || model), availability: 'unavailable',
      detail: availabilityRetryLabel(failure) };
  }
  return {
    model,
    label: String(item?.label || model),
    availability: 'available',
    detail: agent === 'codex' ? 'live catalog' : 'configured; verified when selected',
  };
}

function firstAgentModels(agent) {
  if (agent === 'codex') {
    const seen = new Set();
    return [{ model: selectedDefaultModel(agent), label: selectedDefaultModel(agent) }, ...currentCodexModels()]
      .filter((item) => {
        const key = String(item?.model || item || '').toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 4)
      .map((item) => modelAvailability(agent, item));
  }
  const seen = new Set();
  const models = [selectedDefaultModel(agent), CLAUDE_MODEL, ...CLAUDE_MODEL_CANDIDATES].filter((model) => {
    const value = String(model).toLowerCase();
    const key = ['fable', 'opus', 'sonnet', 'haiku'].find((name) => value.includes(name)) || value;
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
  return models.map((model) => modelAvailability(agent, { model, label: model }));
}

function newManualAgentChoice(agents = configuredAgentNames()) {
  return createManualAgentChoice({
    agents,
    current: selectedDefaultAgent(),
    models: { codex: selectedDefaultModel('codex'), claude: selectedDefaultModel('claude') },
    modelChoices: Object.fromEntries(agents.map((agent) => [agent, firstAgentModels(agent)])),
  });
}

function setDefaultAgentPreference(choice) {
  const want = choice.agent;
  if (choice.explicitModel && choice.model) {
    const selected = applyAgentModelSelection(state, choice, configuredAgentNames());
    if (!selected) throw new Error(`agent/model selection is not registered: ${want}`);
    state = selected;
  } else {
    state.agentPreference = want;
  }
  delete state.pendingAgentChoice;
  delete state.temporaryModelChoice;
  if (temporaryDiscoveryTimer) { clearTimeout(temporaryDiscoveryTimer); temporaryDiscoveryTimer = null; }
  if (state.availabilityRecovery) {
    clearAvailabilityRecovery();
    logEvent('availability_recovery_cancelled', { reason: 'manual_default_change', preference: want });
  } else saveState(state);
  logEvent('agent_preference', { preference: want, model: selectedDefaultModel(want), explicit_model: Boolean(choice.explicitModel) });
  return alternativeAgentLabels(want);
}

async function applyManualAgentChoice(replyTo, choice) {
  const want = choice.agent;
  const alternatives = setDefaultAgentPreference(choice);
  const fallback = currentMode() === 'full'
    ? `Full-auto availability fallback remains automatic; other agent: ${alternatives.join(' → ') || 'none available'}`
    : `Automatic availability inquiry remains enabled; other agent: ${alternatives.join(' → ') || 'no other agent'}`;
  const unfinished = state.pendingModelSwitch
    ? '\nA prior model-switch inquiry is still waiting; use /decide to continue that unfinished run.'
    : '';
  return sendText(replyTo, `Default agent and model set: ${agentLabel(want, selectedDefaultModel(want))}\n${fallback}\nApplies to the next new run.${unfinished}`);
}

async function handleManualAgentCommand(replyTo, text) {
  const answer = String(text || '').trim().replace(/^\/agent\s*/i, '');
  const priorityNote = state.pendingModelSwitch || state.pendingDecision
    ? '\nA prior numbered inquiry is also pending. Use explicit /agent N here; a bare number answers that earlier inquiry.'
    : '';
  if (!answer) {
    state.pendingAgentChoice = newManualAgentChoice();
    saveState(state);
    logEvent('manual_agent_picker_opened', { choices: state.pendingAgentChoice.choices.map((choice) => choice.agent) });
    return sendText(replyTo, formatManualAgentChoiceForPhone(state.pendingAgentChoice) + priorityNote);
  }
  const namedAgent = configuredAgentNames().find((agent) => agent === answer.toLowerCase());
  if (namedAgent) {
    state.pendingAgentChoice = newManualAgentChoice([namedAgent]);
    saveState(state);
    logEvent('manual_agent_picker_opened', { choices: [namedAgent], filtered: true });
    return sendText(replyTo, formatManualAgentChoiceForPhone(state.pendingAgentChoice) + priorityNote);
  }
  const pending = state.pendingAgentChoice || newManualAgentChoice();
  const want = resolveManualAgentChoice(pending, answer);
  if (!want) {
    state.pendingAgentChoice = newManualAgentChoice();
    saveState(state);
    return sendText(replyTo, `Unknown agent choice "${answer}".\n${formatManualAgentChoiceForPhone(state.pendingAgentChoice)}`);
  }
  logEvent('manual_agent_picker_selected', { agent: want.agent, model: want.model,
    input: /^\d+$/.test(answer) ? 'number' : 'name' });
  return applyManualAgentChoice(replyTo, want);
}

function migrateLastHandoffChoice() {
  if (state.temporaryModelChoice || state.pendingModelSwitch) return false;
  const choice = handoffChoiceFromState({
    recentHistory: state.recentHistory,
    lastRunView: state.lastRunView,
    defaultAgent: selectedDefaultAgent(),
    defaultModel: selectedDefaultModel(),
  });
  if (!choice) return false;
  state.temporaryModelChoice = choice;
  saveState(state);
  logEvent('temporary_model_migrated', { agent: choice.agent, model: choice.model,
    default_agent: selectedDefaultAgent() });
  return true;
}

function armTemporaryResetDiscovery(delayMs = 2000) {
  if (temporaryDiscoveryTimer) clearTimeout(temporaryDiscoveryTimer);
  temporaryDiscoveryTimer = null;
  const choice = state.temporaryModelChoice;
  if (!choice || state.availabilityRecovery || choice.defaultAgent !== selectedDefaultAgent() ||
      choice.failedAgent !== 'claude' || choice.resetAtMs) return;
  temporaryDiscoveryTimer = setTimeout(async () => {
    temporaryDiscoveryTimer = null;
    const current = state.temporaryModelChoice;
    if (!current || current.selectedAt !== choice.selectedAt) return;
    if (activeRun) return armTemporaryResetDiscovery(120_000);
    const probe = await probeClaudeAvailability(current.failedModel || selectedDefaultModel('claude'));
    if (state.temporaryModelChoice?.selectedAt !== current.selectedAt ||
        current.defaultAgent !== selectedDefaultAgent()) return;
    if (probe.ok) {
      delete state.temporaryModelChoice;
      state.lastAvailabilityRecovery = { agent: 'claude', model: current.failedModel || selectedDefaultModel('claude'),
        restoredAt: new Date().toISOString() };
      clearModelAvailabilityFailure('claude', current.failedModel || selectedDefaultModel('claude'), 'reset_probe');
      saveState(state);
      logEvent('availability_recovered', { agent: 'claude', model: current.failedModel || selectedDefaultModel('claude'),
        source: 'handoff_migration' });
      return;
    }
    if (probe.resetAtMs) {
      current.resetAtMs = probe.resetAtMs;
      saveState(state);
      scheduleAvailabilityRecovery({ failedAgent: 'claude', failedModel: current.failedModel || selectedDefaultModel('claude'),
        resetAtMs: probe.resetAtMs }, current.replyTo);
    }
  }, delayMs);
}

async function handleInbound(replyTo, text, sentAtMs = null, attachments = [], continuationSnapshotDir = null, runOptions = {}) {
  queueDepth = Math.max(0, queueDepth - 1); // this message just left the queue
  const cmd = text.toLowerCase();
  const remoteControl = parseRemoteControl(text);
  if (remoteControl) {
    if (remoteControl.action === 'status') {
      return sendText(replyTo, state.lastRunView
        ? formatRemoteRunView(state.lastRunView)
        : 'No run is active and no recent run summary is available.');
    }
    if (remoteControl.action === 'steer' && !remoteControl.prompt) {
      return sendText(replyTo, 'Add the new direction after /steer. Example: /steer stop researching and run the tests.');
    }
    return sendText(replyTo, 'No run is active. Send the request normally to start one.');
  }
  if (cmd === '/new') {
    state.sessionId = null; state.claudeSessionId = null; state.codexSessionId = null;
    state.lastAgent = null; state.recentHistory = [];
    delete state.pendingDecision; delete state.pendingModelSwitch; delete state.pendingAgentChoice;
    delete state.lastRunView; saveState(state);
    return sendText(replyTo, 'Fresh sessions started for Codex and Claude. Context cleared.');
  }
  if (cmd === '/agent' || cmd.startsWith('/agent ')) {
    return handleManualAgentCommand(replyTo, text);
  }
  if (/^\d+$/.test(text.trim()) && state.pendingAgentChoice && !state.pendingModelSwitch && !state.pendingDecision) {
    const want = implicitManualAgentChoice(state, text);
    if (want) return applyManualAgentChoice(replyTo, want);
    delete state.pendingAgentChoice;
    saveState(state);
  }
  if (cmd === '/status' || cmd === '/start') {
    const up = Math.round(process.uptime() / 60);
    const sessions = `Codex ${state.codexSessionId ? state.codexSessionId.slice(0, 8) : 'fresh'} · Claude ${state.claudeSessionId ? state.claudeSessionId.slice(0, 8) : 'fresh'}`;
    const last = state.lastAgent
      ? agentLabel(state.lastAgent, state.lastRunView?.model || selectedDefaultModel(state.lastAgent)) : 'none';
    const pending = state.pendingModelSwitch ? '\nDecision: waiting for model choice'
      : state.pendingDecision ? '\nDecision: waiting for /decide'
      : state.pendingAgentChoice && resolveManualAgentChoice(state.pendingAgentChoice, '1')
        ? '\nDecision: waiting for /agent selection' : '';
    const tickets = state.pendingTicketSet?.status === 'pending'
      ? `\nReport tickets: ${state.pendingTicketSet.tickets?.length || 0} awaiting approval` : '';
    const brokerRecovery = ['running', 'waiting_model', 'needs_reconfirmation', 'needs_verification', 'blocked'].includes(state.pendingBrokerExecution?.status)
      ? `\nBroker execution: ${state.pendingBrokerExecution.status.replaceAll('_', ' ')}` : '';
    return sendText(replyTo, `Bridge up ${up}m (${PROVIDER})\nDefault: ${agentLabel(selectedDefaultAgent(), selectedDefaultModel())}${state.lastAgent ? ` (last: ${last})` : ''}\nMode: ${currentMode()}${pending}${tickets}${brokerRecovery}\nDesk: ${DESK_DIR}\nSessions: ${sessions}\nNo active run. Send a request normally to begin.`);
  }
  if (cmd === '/mode' || cmd.startsWith('/mode ')) {
    const want = cmd.slice(5).trim();
    if (!want) {
      return sendText(replyTo, `Current mode: ${currentMode().toUpperCase()}\n${MODES[currentMode()]}\n\nSwitch with:\n/mode full — ${MODES.full}\n/mode semi — ${MODES.semi}\n/mode manual — ${MODES.manual}`);
    }
    if (!(want in MODES)) return sendText(replyTo, `Unknown mode "${want}". Use: /mode full | semi | manual`);
    setMode(want);
    logEvent('mode_change', { mode: want });
    return sendText(replyTo, `Mode set: ${want.toUpperCase()}\n${MODES[want]}\n\nApplies from the next message and the next scheduled run.${want === 'full' ? '\n\nAvailability failures switch automatically across up to three models per agent. Broker state is reconciled before continuation.\n⚠️ Full-auto executes only in the configured execution account without asking. Kill switch: /mode manual' : ''}`);
  }
  if (['/help', '/commands', 'help', '/'].includes(cmd)) {
    return sendText(replyTo, formatPhoneHelp());
  }

  if (isMoreModelsRequest(text)) {
    const pending = state.pendingModelSwitch;
    if (!pending) return sendText(replyTo, 'No model choice is waiting. Model alternatives appear when an active model becomes unavailable.');
    const next = nextModelChoicePage(pending);
    if (!next) return sendText(replyTo, 'No additional available models were found. Choose one shown or type claude MODEL or codex MODEL.');
    state.pendingModelSwitch = next;
    saveState(state);
    logEvent('model_choices_expanded', { page: next.page, options: next.choices.length,
      remaining: next.remainingChoices.length });
    return sendText(replyTo, formatModelChoiceForPhone(next));
  }

  let agentPrompt = text;
  let brokerExecution = runOptions.brokerExecution || null;
  let answeredDecision = false;
  let answeredModelSwitch = false;
  let forcedChoice = null;
  let changeSnapshotDir = continuationSnapshotDir;
  let inheritedChangeReason = {};
  let runAttachments = attachments.slice(0, MAX_INBOUND_IMAGES);
  let reportSnapshot = {};
  let reportDraftSnapshot = {};
  if (brokerExecution) {
    agentPrompt = brokerExecution.userText || text;
  } else if (!runAttachments.length && !text.trim().startsWith('/')) {
    const approvableTicketSet = !state.pendingTicketSet?.status || state.pendingTicketSet.status === 'pending'
      ? state.pendingTicketSet : null;
    const approval = resolveTicketApproval(text, approvableTicketSet);
    if (approval?.kind === 'clarify') {
      logEvent('ticket_approval_clarification', { prompt: text.slice(0, 120), ticket_set: state.pendingTicketSet?.id || null });
      return sendText(replyTo, approval.message);
    }
    if (approval?.kind === 'approved') {
      brokerExecution = {
        id: crypto.randomUUID(),
        ticketSetId: state.pendingTicketSet.id,
        ticketSetCreatedAt: state.pendingTicketSet.createdAt,
        tickets: approval.tickets,
        userText: text,
        approvedAt: new Date().toISOString(),
        replyTo,
        status: 'running',
        recoveryAttempts: 0,
      };
      state.pendingBrokerExecution = brokerExecution;
      saveState(state);
      agentPrompt = text;
      logEvent('ticket_approval_resolved', {
        execution_id: brokerExecution.id,
        ticket_set: brokerExecution.ticketSetId,
        tickets: approval.tickets.map((ticket) => ticket.number),
      });
    }
  }
  const pendingModel = state.pendingModelSwitch;
  const implicitModelAnswer = implicitModelChoiceAnswer(pendingModel, text);
  const implicitAgentDecision = state.pendingDecision && /^\d+$/.test(text.trim()) ? text.trim() : null;
  if (cmd === '/decide' || cmd.startsWith('/decide ') || implicitModelAnswer || implicitAgentDecision) {
    const answer = (implicitModelAnswer || implicitAgentDecision || text.slice(7)).trim();
    if (pendingModel) {
      if (!answer) return sendText(replyTo, formatModelChoiceForPhone(pendingModel));
      forcedChoice = resolveModelChoice(pendingModel, answer);
      if (!forcedChoice) {
        return sendText(replyTo, `Choose 1-${pendingModel.choices.length}, or type claude MODEL or codex MODEL.`);
      }
      agentPrompt = modelHandoffPrompt(pendingModel, forcedChoice);
      if (pendingModel.brokerExecution) {
        brokerExecution = pendingModel.brokerExecution;
        brokerExecution.status = 'running';
        state.pendingBrokerExecution = brokerExecution;
        saveState(state);
        agentPrompt = brokerExecution.userText || text;
      }
      runAttachments = Array.isArray(pendingModel.attachments) ? pendingModel.attachments : runAttachments;
      answeredModelSwitch = true;
      changeSnapshotDir ||= pendingModel.changeSnapshotDir || null;
    } else {
      const pending = state.pendingDecision;
      if (!pending) return sendText(replyTo, 'No agent decision is waiting.');
      if (!answer) return sendText(replyTo, formatDecisionForPhone(pending));
      const number = Number(answer);
      if (Number.isInteger(number) && (number < 1 || number > pending.options.length)) {
        return sendText(replyTo, `Choose 1-${pending.options.length}, or describe your decision after /decide.`);
      }
      agentPrompt = decisionContinuation(pending, answer);
      answeredDecision = true;
      changeSnapshotDir ||= pending.changeSnapshotDir || null;
      inheritedChangeReason = pending.changeReason || {};
    }
  }

  if (brokerExecution) {
    const savedSet = state.pendingTicketSet?.id === brokerExecution.ticketSetId
      ? state.pendingTicketSet : { id: brokerExecution.ticketSetId, createdAt: brokerExecution.ticketSetCreatedAt };
    runOptions = {
      ...runOptions,
      brokerKind: 'action',
      resetBrokerSession: true,
      trustedBrokerApproval: buildTrustedBrokerApprovalInstructions(savedSet, brokerExecution.tickets, brokerExecution),
    };
  }

  const inboundLagS = sentAtMs ? Math.max(0, Math.round((Date.now() - sentAtMs) / 1000)) : null;
  log(`prompt${inboundLagS !== null ? ` (lag ${inboundLagS}s)` : ''}: ${text.slice(0, 120)}`);
  logEvent('inbound', { prompt: text.slice(0, 120), inbound_lag_s: inboundLagS });
  // deterministic status ladder, bridge-sent (never depends on the agent):
  // receipt immediately → "agent running" when the process is actually up →
  // trouble (rate limit / fetch failure) the moment it appears → elapsed
  // pings → result or error
  const looksLong = /report|scan|sweep|analy|research|review|deep|audit|run/i.test(text);
  const reportRequest = isReportRequest(agentPrompt, runOptions);
  const startMs = Date.now();
  if (reportRequest) {
    try { reportSnapshot = captureReportSnapshot(REPORTS_DIR); }
    catch (e) { logEvent('report_snapshot_error', { error: e.message }); }
    try { reportDraftSnapshot = captureReportDraftSnapshot(REPORTS_DIR); }
    catch (e) { logEvent('report_draft_snapshot_error', { error: e.message }); }
  }
  if (!changeSnapshotDir || !fs.existsSync(changeSnapshotDir)) {
    try { changeSnapshotDir = captureWorkspaceSnapshot(DESK_DIR, CHANGE_SNAPSHOT_DIR); }
    catch (e) { changeSnapshotDir = null; logEvent('change_snapshot_error', { error: e.message }); }
  }
  const transcript = createRunTranscript(RUN_LOG_DIR, text);
  if (runAttachments.length) transcript.append('IMAGES', `${runAttachments.length} private inbound image${runAttachments.length === 1 ? '' : 's'}`);
  const runView = createRemoteRunView(text, startMs);
  activeRun = { prompt: text, startedMs: startMs, replyTo, transcript, view: runView, changeSnapshotDir,
    reportSnapshot,
    brokerExecutionId: brokerExecution?.id || null };
  const timers = [];
  const rotated = rotateSessionIfNeeded();
  if (rotated) {
    log(`session rotated (${rotated})`);
    logEvent('session_rotate', { reason: rotated });
  }
  // Receipt is ordered before agent startup. Previously this was fire-and-forget,
  // which let it race later messages and silently hid delivery failures.
  const liveMonitor = await createLiveRunMonitor(replyTo, runView);
  activeRun.liveMonitor = liveMonitor;
  if (!liveMonitor) {
    await sendStatus(replyTo, 'received', rotated
      ? `📥 Command received — processing… (fresh session: previous chat context ${rotated === 'idle' ? 'went stale' : 'grew too large'} and was retired)`
      : '📥 Command received — processing…');
  }
  if (liveMonitor) {
    timers.push(setInterval(() => liveMonitor.refresh(), 15_000));
  } else {
    timers.push(setTimeout(function ping() {
      const mins = Math.round((Date.now() - startMs) / 60_000);
      sendStatus(replyTo, 'progress', `⏳ Still working — ${mins}m elapsed…`);
      timers.push(setTimeout(ping, 300_000)); // then every 5 minutes
    }, 120_000)); // first ping at 2 minutes
  }
  // Keep transient typing indicators alive for transports that support them.
  if (messenger.typing) {
    const typing = () => Promise.resolve(messenger.typing(replyTo)).catch(() => {});
    typing();
    const t = setInterval(typing, 4500);
    timers.push(t);
  }
  let agentStartS = null;
  let agentStartedTimer = null;
  let agentStartedDetail = null;
  const scheduledPreflight = runOptions.scheduledKind && runOptions.scheduledKind !== 'test'
    ? createBrokerPreflightTracker() : null;
  const flushAgentStarted = () => {
    if (!agentStartedTimer || !agentStartedDetail) return;
    clearTimeout(agentStartedTimer);
    agentStartedTimer = null;
    const current = agentStartedDetail?.agent
      ? agentLabel(agentStartedDetail.agent, agentStartedDetail.model) : 'Agent';
    if (!liveMonitor) {
      sendStatus(replyTo, 'agent_started', looksLong
        ? `🤖 ${current} running — full reports can take a few minutes (up to ~20). The result lands here when done.`
        : `🤖 ${current} running — this might take a few minutes…`);
    }
    agentStartedDetail = null;
  };
  const onRunEvent = (kind, detail) => {
    scheduledPreflight?.observe(kind, detail);
    activeRun?.liveMonitor?.event(kind, detail);
    if (kind === 'started') {
      agentStartS = Math.round((Date.now() - startMs) / 1000);
      agentStartedDetail = detail || { agent, model };
      agentStartedTimer = setTimeout(flushAgentStarted, 1000);
      logEvent('agent_started', { after_s: agentStartS });
      transcript.append('START', `${agentLabel(detail?.agent, detail?.model)}`);
    } else if (kind === 'switch') {
      if (agentStartedTimer) {
        clearTimeout(agentStartedTimer);
        agentStartedTimer = null;
        agentStartedDetail = null;
      }
      const from = detail?.from ? agentLabel(detail.from.name, detail.from.model) : 'unknown';
      const to = detail?.to ? agentLabel(detail.to.name, detail.to.model) : null;
      const mode = detail?.restart ? 'restarting clean' : 'continuing the current thread';
      sendStatus(replyTo, 'agent_fallback', `🔄 Switching ${from}${to ? ` -> ${to}` : ''}; ${mode}.\n${detail?.reason || 'agent changed.'}`);
    } else if (kind === 'trouble') {
      sendStatus(replyTo, 'trouble', `⚠️ Hit an issue mid-run — the agent is retrying / working around it:\n${detail}`);
      logEvent('run_trouble', { detail });
    } else if (kind === 'circuit_breaker') {
      const recoveryNote = reportRequest && !brokerExecution
        ? 'Completed report work will be preserved for one bounded recovery.'
        : 'The run was stopped to prevent a loop or excess token use.';
      sendStatus(replyTo, 'circuit_breaker', `🛑 Circuit breaker stopped this pass.\n${detail?.reason || 'Safety limit reached.'}\n${recoveryNote}`);
      logEvent('circuit_breaker', detail || {});
      transcript.append('STOP', detail?.reason || 'circuit breaker');
    } else if (kind === 'execution') {
      const line = toolEventLine(detail);
      transcript.append(line.kind, line.text);
    }
  };
  let result = await runPreferredAgent(
    agentPrompt, onRunEvent, forcedChoice, runAttachments, runOptions,
  );
  if (agentStartedTimer) {
    clearTimeout(agentStartedTimer);
    agentStartedTimer = null;
    agentStartedDetail = null;
  }

  let reportRecoveryAttempted = false;
  if (!result.ok && reportRequest && !activeRun?.interrupt && !brokerExecution) {
    const artifactRecovery = await recoverReportArtifacts(reportDraftSnapshot, startMs);
    if (artifactRecovery.errors.length) {
      logEvent('report_artifact_recovery_failed', { errors: artifactRecovery.errors });
    }
    let reportAlreadyBuilt = false;
    try {
      reportAlreadyBuilt = generatedHtmlReports(REPORTS_DIR, reportSnapshot, startMs).length > 0
        && (!scheduledPreflight || scheduledPreflight.attempted);
    } catch (error) {
      logEvent('report_recovery_artifact_check_error', { error: error.message });
    }
    if (reportAlreadyBuilt) {
      result = {
        ok: true,
        agent: 'bridge',
        model: 'artifact-recovery',
        fallbackEligible: false,
        text: artifactRecovery.built
          ? `Recovered ${artifactRecovery.built} completed HTML report artifact.`
          : 'Recovered the completed HTML report artifact from the interrupted run.',
        artifactRecovery: true,
      };
      logEvent('report_artifact_recovered', { built: artifactRecovery.built });
    } else if (shouldRecoverReportRun({
      result,
      prompt: agentPrompt,
      options: runOptions,
      brokerExecution: false,
      alreadyRecovered: reportRecoveryAttempted,
      reportAlreadyBuilt,
    })) {
      reportRecoveryAttempted = true;
      const failed = result;
      const recoveryPrompt = buildReportRecoveryPrompt({
        originalPrompt: agentPrompt,
        maxToolCalls: REPORT_RECOVERY_MAX_TOOL_CALLS,
        scheduledKind: runOptions.scheduledKind,
      });
      const recoveryChoice = configuredAgentNames().includes(failed.agent) && failed.model
        ? { agent: failed.agent, model: failed.model } : null;
      const savedSessions = {
        claudeSessionId: state.claudeSessionId,
        codexSessionId: state.codexSessionId,
      };
      state.claudeSessionId = null;
      state.codexSessionId = null;
      saveState(state);
      await sendStatus(
        replyTo,
        'report_recovery',
        '♻️ Report work reached its safety budget. Running one fresh, bounded artifact-completion pass; no broker order action is permitted.',
      );
      logEvent('report_recovery_started', {
        agent: failed.agent,
        model: failed.model,
        max_tool_calls: REPORT_RECOVERY_MAX_TOOL_CALLS,
        scheduled_kind: runOptions.scheduledKind || null,
      });
      try {
        result = await runPreferredAgent(recoveryPrompt, onRunEvent, recoveryChoice, [], {
          autoModelFallback: false,
          disableBrokerRouting: true,
          reportRecoveryInstructions: reportRecoverySafetyInstructions(),
          blockBrokerActions: true,
          maxToolCalls: REPORT_RECOVERY_MAX_TOOL_CALLS,
          maxIdenticalToolCalls: Math.min(MAX_IDENTICAL_TOOL_CALLS, 4),
          maxOutputTokens: Math.min(MAX_STREAM_OUTPUT_TOKENS, 24_000),
        });
      } finally {
        state.claudeSessionId = savedSessions.claudeSessionId;
        state.codexSessionId = savedSessions.codexSessionId;
        saveState(state);
      }
      if (result.pausedForModel) {
        result = {
          ok: false,
          agent: result.agent,
          model: result.model,
          fallbackEligible: false,
          reportRecovery: true,
          text: 'The single bounded report recovery could not start because its selected model was unavailable.',
        };
      } else {
        result = { ...result, reportRecovery: true };
      }
      const postRecoveryArtifacts = await recoverReportArtifacts(reportDraftSnapshot, startMs);
      const preflightOk = !scheduledPreflight || scheduledPreflight.attempted;
      let completedArtifacts = [];
      try { completedArtifacts = generatedHtmlReports(REPORTS_DIR, reportSnapshot, startMs); }
      catch (error) { logEvent('report_recovery_artifact_check_error', { error: error.message }); }
      if (result.ok && (!completedArtifacts.length || !preflightOk)) {
        result = {
          ...result,
          ok: false,
          fallbackEligible: false,
          text: !preflightOk
            ? 'Scheduled report recovery stopped because the required read-only broker preflight was not observed.'
            : 'The bounded recovery finished without producing a completed HTML report artifact.',
        };
      }
      logEvent('report_recovery_finished', {
        ok: result.ok,
        artifacts: completedArtifacts.length,
        rendered_drafts: postRecoveryArtifacts.built,
      });
    }
  }
  if (activeRun?.interrupt && !result.interrupted) {
    result = { ok: false, interrupted: true, agent: activeRun.agent || result.agent,
      model: activeRun.model || result.model, fallbackEligible: false, text: activeRun.interrupt.reason };
  }
  if (result.interrupted) {
    for (const t of timers) { clearTimeout(t); clearInterval(t); }
    transcript.append('INTERRUPTED', result.text || 'phone remote control');
    await activeRun?.liveMonitor?.finish('interrupted', result.text);
    state.lastRunView = activeRun?.view;
    if (brokerExecution && state.pendingBrokerExecution?.id === brokerExecution.id) {
      state.pendingBrokerExecution = { ...state.pendingBrokerExecution,
        status: activeRun?.interrupt?.action === 'stop' ? 'stopped' : 'needs_reconfirmation',
        interruptedAt: new Date().toISOString() };
    }
    saveState(state);
    if (activeRun?.interrupt?.action !== 'steer') {
      await deliverChangeReview(replyTo, changeSnapshotDir, text, result.text || 'Run stopped.');
    }
    activeRun = null;
    logEvent('run_interrupted', { agent: result.agent, reason: result.text });
    return;
  }
  if (result.pausedForModel) {
    for (const t of timers) { clearTimeout(t); clearInterval(t); }
    state.pendingModelSwitch = result.pendingModelSwitch;
    state.pendingModelSwitch.changeSnapshotDir = changeSnapshotDir;
    if (brokerExecution) {
      brokerExecution.status = 'waiting_model';
      state.pendingBrokerExecution = brokerExecution;
      state.pendingModelSwitch.brokerExecution = brokerExecution;
    }
    saveState(state);
    scheduleAvailabilityRecovery(result.pendingModelSwitch, replyTo);
    transcript.append('MODEL DECISION', `${result.pendingModelSwitch.failedAgent} ${result.pendingModelSwitch.failedModel}`);
    await activeRun?.liveMonitor?.finish('paused', 'Waiting for a model choice');
    state.lastRunView = activeRun?.view;
    saveState(state);
    await sendText(replyTo, formatModelChoiceForPhone(result.pendingModelSwitch));
    await deliverExecutionTranscript(replyTo, transcript, false);
    activeRun = null;
    await applyDeferredRestart(replyTo, transcript);
    logEvent('model_decision_requested', {
      failed_agent: result.pendingModelSwitch.failedAgent,
      failed_model: result.pendingModelSwitch.failedModel,
      options: result.pendingModelSwitch.choices.length,
    });
    return;
  }
  const { ok, text: rawReply, costUsd, tokens, agent = 'unknown', model = null } = result;
  const decisionParsed = parseDecisionRequest(rawReply);
  const changeParsed = parseChangeReason(decisionParsed.text);
  const combinedChangeReason = {
    summary: changeParsed.changeReason?.summary || inheritedChangeReason.summary || '',
    files: { ...(inheritedChangeReason.files || {}), ...(changeParsed.changeReason?.files || {}) },
  };
  const ticketParsed = extractReportTickets(changeParsed.text);
  const parsedReply = { ...decisionParsed, text: ticketParsed.text };
  const reply = parsedReply.text;
  transcript.append(ok ? 'COMPLETE' : 'ERROR', `${agentLabel(agent, model)} — ${ok ? 'finished' : String(rawReply).slice(0, 800)}`);
  for (const t of timers) { clearTimeout(t); clearInterval(t); }
  const runS = Math.round((Date.now() - startMs) / 1000);
  if (ok) {
    state.lastAgent = agent;
    if (parsedReply.decision) {
      state.pendingDecision = {
        ...parsedReply.decision,
        requestedAt: new Date().toISOString(),
        agent,
        model,
        changeSnapshotDir,
        changeReason: combinedChangeReason,
      };
      transcript.append('DECISION', parsedReply.decision.question);
    } else if (answeredDecision) {
      delete state.pendingDecision;
    }
    if (result.automaticFallback) {
      state.temporaryModelChoice = {
        ...result.automaticFallback,
        replyTo,
      };
      delete state.pendingModelSwitch;
      logEvent('temporary_model_selected', {
        agent: result.automaticFallback.agent,
        model: result.automaticFallback.model,
        default_agent: result.automaticFallback.defaultAgent,
        reset_at: result.automaticFallback.resetAtMs,
        automatic: true,
      });
      scheduleAvailabilityRecovery(result.automaticFallback, replyTo);
    } else if (answeredModelSwitch) {
      state.temporaryModelChoice = {
        agent: forcedChoice.agent,
        model: forcedChoice.model,
        defaultAgent: selectedDefaultAgent(),
        failedAgent: pendingModel?.failedAgent || null,
        failedModel: pendingModel?.failedModel || null,
        resetAtMs: pendingModel?.resetAtMs || null,
        selectedAt: new Date().toISOString(),
        replyTo,
      };
      delete state.pendingModelSwitch;
      logEvent('temporary_model_selected', { agent: forcedChoice.agent, model: forcedChoice.model,
        default_agent: selectedDefaultAgent(), reset_at: pendingModel?.resetAtMs || null });
    }
    state.recentHistory = [...(Array.isArray(state.recentHistory) ? state.recentHistory : []),
      { role: 'user', text: text.slice(0, 2000) },
      { role: 'assistant', text: `${String(reply).slice(0, 2500)}${parsedReply.decision ? `\nDecision requested: ${parsedReply.decision.question}` : ''}` }].slice(-12);
    if (ticketParsed.tickets.length && !brokerExecution) {
      state.pendingTicketSet = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        sourcePrompt: text.slice(0, 500),
        status: 'pending',
        tickets: ticketParsed.tickets,
      };
      logEvent('report_tickets_saved', { ticket_set: state.pendingTicketSet.id,
        tickets: ticketParsed.tickets.map((ticket) => ticket.number) });
    }
    if (brokerExecution && state.pendingBrokerExecution?.id === brokerExecution.id) {
      const blocked = brokerExecutionFailed(reply);
      const completed = !blocked && brokerExecutionSucceeded(reply);
      state.pendingBrokerExecution = {
        ...state.pendingBrokerExecution,
        status: blocked ? 'blocked' : completed ? 'completed' : 'needs_verification',
        finishedAt: new Date().toISOString(),
      };
      if (completed && state.pendingTicketSet?.id === brokerExecution.ticketSetId) {
        state.pendingTicketSet.status = 'handled';
        state.pendingTicketSet.handledAt = new Date().toISOString();
      } else if (state.pendingTicketSet?.id === brokerExecution.ticketSetId) {
        state.pendingTicketSet.status = 'pending';
        delete state.pendingTicketSet.handledAt;
      }
      logEvent('broker_execution_finished', { execution_id: brokerExecution.id, blocked, completed });
    }
    saveState(state);
  }
  logEvent('agent_run', {
    agent, model, ok, duration_s: runS, reply_chars: String(reply).length,
    cost_usd: costUsd, tokens, session_kb: sessionTranscriptKB(),
  });
  if (!ok) {
    if (brokerExecution && state.pendingBrokerExecution?.id === brokerExecution.id) {
      state.pendingBrokerExecution = { ...state.pendingBrokerExecution, status: 'failed',
        finishedAt: new Date().toISOString() };
      saveState(state);
    }
    await activeRun?.liveMonitor?.finish('failed', String(rawReply).trim().slice(0, 110));
    state.lastRunView = activeRun?.view;
    saveState(state);
    const canDeliverFailedReport = reportRequest
      && (!scheduledPreflight || scheduledPreflight.attempted);
    const failedReportDelivery = canDeliverFailedReport
      ? await deliverRunFiles(replyTo, [], reportSnapshot, startMs)
      : { delivered: 0, discoveredReports: 0 };
    await sendText(replyTo, [
      '⚠️ Error — the run failed.',
      result.reportRecovery
        ? 'The initial pass hit its safety cap and the single bounded recovery did not finish.' : '',
      failedReportDelivery.delivered
        ? `A completed HTML report was still recovered and attached (${failedReportDelivery.delivered}).` : '',
      String(rawReply).trim().slice(0, 3000) || '(no error detail)',
    ].filter(Boolean).join('\n'));
    await deliverChangeReview(replyTo, changeSnapshotDir, text, String(rawReply).trim(), combinedChangeReason);
    await deliverExecutionTranscript(replyTo, transcript, false);
    activeRun = null;
    await applyDeferredRestart(replyTo, transcript);
    log('replied with error');
    logEvent('reply_error', { detail: String(reply).trim().slice(0, 500) });
    logTiming({ prompt: text.slice(0, 80), phone_to_bridge_s: inboundLagS, agent_start_s: agentStartS, run_s: runS, reply_sent_s: Math.round((Date.now() - startMs) / 1000), ok: false, files: 0 });
    return;
  }
  let changeReview = null;
  const { text: replyText, files } = extractFileDirectives(reply);
  if (replyText) {
    const numberedItems = (replyText.match(/^\s*\d+[.)]\s+\S/gm) || []).length;
    const maxLines = numberedItems >= 3 ? Math.min(numberedItems + 4, 40) : 5;
    const finalReply = sanitizePhoneText(replyText, { maxChars: messenger.maxTextChars, maxLines });
    if (finalReply.redactions || finalReply.shortened) {
      logEvent('final_reply_sanitized', { redactions: finalReply.redactions, shortened: finalReply.shortened });
    }
    if (finalReply.text) await sendText(replyTo, finalReply.text);
  }
  const fileDelivery = await deliverRunFiles(replyTo, files, reportSnapshot, startMs);
  const executionMode = currentMode();
  if (!brokerExecution
      && ticketParsed.tickets.length
      && (executionMode === 'semi' || executionMode === 'manual')) {
    const itemsMessage = formatExecutionItemsMessage(ticketParsed.tickets, { mode: executionMode });
    if (itemsMessage) {
      const items = sanitizePhoneText(itemsMessage, {
        maxChars: messenger.maxTextChars,
        maxLines: ticketParsed.tickets.length + 4,
      });
      if (items.text) await sendText(replyTo, items.text);
      logEvent('execution_items_sent', {
        ticket_set: state.pendingTicketSet?.id || null,
        count: ticketParsed.tickets.length,
        mode: executionMode,
      });
    }
  }
  if (!parsedReply.decision) {
    changeReview = await deliverChangeReview(replyTo, changeSnapshotDir, text, reply, combinedChangeReason);
  }
  if (parsedReply.decision) {
    await sendText(replyTo, formatDecisionForPhone(parsedReply.decision));
    logEvent('decision_requested', { question: parsedReply.decision.question.slice(0, 300), options: parsedReply.decision.options.length });
  }
  await activeRun?.liveMonitor?.finish(parsedReply.decision ? 'paused' : 'done',
    parsedReply.decision ? 'Waiting for your decision' : 'Final reply delivered below');
  state.lastRunView = activeRun?.view;
  saveState(state);
  await deliverExecutionTranscript(replyTo, transcript, true);
  activeRun = null;
  if ((answeredModelSwitch || result.automaticFallback) && !state.availabilityRecovery) armTemporaryResetDiscovery();
  await applyDeferredRestart(replyTo, transcript);
  log('replied');
  logTiming({ prompt: text.slice(0, 80), phone_to_bridge_s: inboundLagS, agent_start_s: agentStartS, run_s: runS, reply_sent_s: Math.round((Date.now() - startMs) / 1000), ok: true, files: fileDelivery.delivered, discovered_reports: fileDelivery.discoveredReports, change_review_files: changeReview?.count || 0 });
}

function enqueue(id, from, text, replyTo = from, sentAtMs = null, attachments = [], runOptions = {}) {
  if (seenIds.has(id)) return;
  seenIds.add(id);
  if (seenIds.size > 500) seenIds.delete(seenIds.values().next().value);

  // HARD GATE: only the owner drives the desk
  if (from !== ALLOWED_SENDER) {
    log(`ignored message from non-allowlisted sender ${from}`);
    return;
  }
  if (/^(join|stop)\b/i.test(text)) return; // twilio sandbox control words, not prompts
  const immediateAgentCommand = !attachments.length && /^\/agent(?:\s+\S+)?\s*$/i.test(text);
  if (activeRun && immediateAgentCommand) {
    handleManualAgentCommand(replyTo, text).catch((e) => {
      logEvent('manual_agent_picker_error', { error: e.message });
      sendText(replyTo, `Agent selection failed: ${e.message}`).catch(() => {});
    });
    return;
  }
  const immediateAgentNumber = activeRun && !attachments.length
    ? implicitManualAgentChoice(state, text) : null;
  if (immediateAgentNumber) {
    applyManualAgentChoice(replyTo, immediateAgentNumber).catch((e) => {
      logEvent('manual_agent_picker_error', { error: e.message });
    });
    return;
  }
  if (activeRun && !attachments.length && /^\/status$/i.test(text.trim())) {
    sendText(replyTo, formatRemoteRunView(activeRun.view)).catch(() => {});
    return;
  }
  const remoteControl = attachments.length ? null : parseRemoteControl(text);
  if (activeRun && remoteControl) {
    if (remoteControl.action === 'status') {
      sendText(replyTo, formatRemoteRunView(activeRun.view)).catch(() => {});
      return;
    }
    if (remoteControl.action === 'steer' && !remoteControl.prompt) {
      sendText(replyTo, 'Add the new direction after /steer. Example: /steer stop researching and run the tests.').catch(() => {});
      return;
    }
    const reason = remoteControl.action === 'steer'
      ? 'Redirected from the phone; resuming the same session with the new instruction.'
      : 'Stopped from the phone; session preserved.';
    activeRun.interrupt = { action: remoteControl.action, reason };
    const interruptedChild = activeRun.child;
    interruptedChild?.kill('SIGTERM');
    if (interruptedChild) setTimeout(() => interruptedChild.kill('SIGKILL'), 10_000);
    logEvent('remote_control', { action: remoteControl.action, agent: activeRun.agent || null });
    if (remoteControl.action === 'stop') {
      sendText(replyTo, 'Stopping the active turn. The agent session and completed file changes are preserved.').catch(() => {});
      return;
    }
    const continuationSnapshot = activeRun.changeSnapshotDir || null;
    queueDepth++;
    sendText(replyTo, 'Redirecting the active turn. The same agent session will resume with your new instruction.').catch(() => {});
    queue = queue.then(() => handleInbound(replyTo, remoteControl.prompt, sentAtMs, [], continuationSnapshot)).catch((e) => {
      log('steer handler error:', e);
      logEvent('handler_error', { error: String(e?.message || e), source: 'steer' });
      sendText(replyTo, `Bridge error: ${e?.message || e}`).catch(() => {});
    });
    return;
  }
  // runs are serialized — if one is active, say so NOW instead of leaving the
  // message in a silent queue (seen 2026-07-11: a 12:49 message waited 47 min
  // behind a long run with zero acknowledgment)
  if (activeRun) {
    if (queueDepth >= MAX_QUEUE_DEPTH) {
      logEvent('queue_rejected', { prompt: text.slice(0, 80), max_queue_depth: MAX_QUEUE_DEPTH });
      sendText(replyTo, `🛑 Queue full (${MAX_QUEUE_DEPTH}). This message was not scheduled, preventing an unbounded backlog and token spend. Retry after the current run finishes.`).catch(() => {});
      return;
    }
    const mins = Math.round((Date.now() - activeRun.startedMs) / 60_000);
    queueDepth++;
    logEvent('queued', { prompt: text.slice(0, 80), behind_mins: mins, position: queueDepth });
    sendText(replyTo, `📥 Received — queued behind the current run ("${activeRun.prompt.slice(0, 60)}", running ${mins}m${queueDepth > 1 ? `; position ${queueDepth}` : ''}). It starts as soon as that finishes.`).catch(() => {});
  }
  queue = queue.then(() => handleInbound(replyTo, text, sentAtMs, attachments, null, runOptions)).catch((e) => {
    log('handler error:', e);
    logEvent('handler_error', { error: String(e?.message || e) });
    sendText(replyTo, `⚠️ Bridge error: ${e?.message || e}`).catch(() => {});
  });
}

// ---------------------------------------------------- twilio polling mode --
// Inbound messages land in Twilio's message log; pull them over outbound
// HTTPS instead of exposing a public webhook. Only messages created after
// process start are processed (restart-safe, no replay).
async function pollOnce(sinceMs) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json` +
    `?PageSize=20&To=${encodeURIComponent(TWILIO_WHATSAPP_FROM)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: twilioAuthorization(),
    },
  });
  if (!res.ok) {
    log(`twilio poll ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return;
  }
  const { messages = [] } = await res.json();
  // newest first — reverse so a burst is handled in send order
  for (const m of messages.reverse()) {
    if (m.direction !== 'inbound') continue;
    const ts = Date.parse(m.date_created);
    if (ts < sinceMs) continue;
    // persisted watermark: a restart (or a skewed clock) must never replay an
    // already-handled message — a stale "yes" replayed into a resumed session
    // could confirm a pending order ticket.
    if (state.lastPollTs && ts <= state.lastPollTs) continue;
    const from = String(m.from || '').replace(/\D/g, '');
    if (from !== ALLOWED_SENDER) continue;
    const hasImage = Number(m.num_media || 0) > 0;
    const text = String(m.body || '').trim();
    if (!text && !hasImage) continue;
    let attachments = [];
    try { attachments = hasImage ? await twilioPollingImages(m) : []; }
    catch (e) { logEvent('inbound_image_error', { provider: 'twilio', error: e.message }); }
    if (hasImage && !attachments.length) {
      await sendText(from, 'Image rejected or unavailable. Send JPEG, PNG, WebP, or GIF up to 20 MB.');
    } else {
      enqueue(m.sid, from, text || 'Inspect the attached image and explain what matters.', from, ts, attachments);
    }
    if (!state.lastPollTs || ts > state.lastPollTs) { state.lastPollTs = ts; saveState(state); }
  }
}

async function pollLoop() {
  const startedAt = Date.now() - 60_000; // small grace window for clock skew
  log(`twilio polling mode — checking every ${POLL_MS / 1000}s (no inbound port, no tunnel)`);
  let failures = 0;
  for (;;) {
    try { await pollOnce(startedAt); failures = 0; }
    catch (e) { failures++; log('poll error:', e.message); }
    // back off on repeated failures (network down, laptop waking from sleep)
    await new Promise((r) => setTimeout(r, Math.min(POLL_MS * (failures + 1), 60_000)));
  }
}

// --------------------------------------------------------------- server ----
function handleTwilioPost(raw, req, res) {
  const params = Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
  if (!twilioVerify(params, req.headers['x-twilio-signature'])) {
    log('rejected POST: bad twilio signature');
    res.writeHead(401);
    return res.end();
  }
  // ack with empty TwiML — the real reply goes out via the REST API
  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

  const from = String(params.From || '').replace(/\D/g, ''); // "whatsapp:+1415..." -> digits
  const text = String(params.Body || '').trim();
  const hasImage = Number(params.NumMedia || 0) > 0;
  if (!params.MessageSid || (!text && !hasImage) || from !== ALLOWED_SENDER) return;
  void (async () => {
    const attachments = hasImage ? await twilioWebhookImages(params) : [];
    if (hasImage && !attachments.length) {
      await sendText(from, 'Image rejected or unavailable. Send JPEG, PNG, WebP, or GIF up to 20 MB.');
      return;
    }
    enqueue(params.MessageSid, from, text || 'Inspect the attached image and explain what matters.', from, Date.now(), attachments);
  })().catch(async (e) => {
    logEvent('inbound_image_error', { provider: 'twilio', error: e.message });
    await sendText(from, 'Image download failed. Please resend it.').catch(() => {});
  });
}

function handleMetaPost(raw, req, res) {
  if (!metaVerify(raw, req.headers['x-hub-signature-256'])) {
    log('rejected POST: bad signature');
    res.writeHead(401);
    return res.end();
  }
  res.writeHead(200); res.end(); // ack fast — Meta retries slow webhooks

  let payload;
  try { payload = JSON.parse(raw.toString('utf8')); } catch { return; }
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      for (const msg of change.value?.messages || []) {
        if (!['text', 'image'].includes(msg.type) || msg.from !== ALLOWED_SENDER) continue;
        markReadAndTyping(msg.id).catch(() => {});
        void (async () => {
          const hasImage = msg.type === 'image';
          const text = String(msg.text?.body || msg.image?.caption || '').trim();
          const attachments = hasImage ? await metaInboundImages(msg) : [];
          if (hasImage && !attachments.length) {
            await sendText(msg.from, 'Image rejected or unavailable. Send JPEG, PNG, WebP, or GIF up to 20 MB.');
            return;
          }
          enqueue(msg.id, msg.from, text || 'Inspect the attached image and explain what matters.', msg.from,
            Number(msg.timestamp || 0) * 1000 || Date.now(), attachments);
        })().catch(async (e) => {
          logEvent('inbound_image_error', { provider: 'meta', error: e.message });
          await sendText(msg.from, 'Image download failed. Please resend it.').catch(() => {});
        });
      }
    }
  }
}

function handleScheduledPost(req, res) {
  const remote = String(req.socket.remoteAddress || '');
  const supplied = String(req.headers['x-scheduler-token'] || '');
  const local = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  const got = Buffer.from(supplied);
  const want = Buffer.from(SCHEDULER_TOKEN);
  if (!local || got.length !== want.length || !crypto.timingSafeEqual(got, want)) {
    res.writeHead(403); return res.end('forbidden');
  }
  const chunks = [];
  let bytes = 0;
  req.on('data', (chunk) => {
    bytes += chunk.length;
    if (bytes > 8192) req.destroy(new Error('scheduled request too large'));
    else chunks.push(chunk);
  });
  req.on('end', () => {
    let payload;
    try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { res.writeHead(400); return res.end('invalid JSON'); }
    const kind = String(payload.kind || '');
    if (!SCHEDULE_KINDS.includes(kind)) { res.writeHead(400); return res.end('invalid schedule kind'); }
    const dow = new Date().getDay();
    if (kind !== 'test' && payload.force !== true && (dow === 0 || dow === 6)) {
      res.writeHead(202); return res.end(`${kind} skipped on weekend`);
    }
    if (activeRun && queueDepth >= MAX_QUEUE_DEPTH) {
      logEvent('scheduled_queue_rejected', { kind, max_queue_depth: MAX_QUEUE_DEPTH });
      res.writeHead(429);
      return res.end(`${kind} not scheduled — bridge queue is full`);
    }
    const today = localCalendarDay();
    state.scheduledRunDays = state.scheduledRunDays || {};
    if (isDuplicateScheduledRun(
      state.scheduledRunDays[kind],
      today,
      { force: payload.force === true, kind },
    )) {
      logEvent('scheduled_duplicate_skipped', { kind, day: today });
      res.writeHead(202);
      return res.end(`${kind} already ran ${today} — duplicate skipped`);
    }
    state.scheduledRunDays[kind] = today;
    saveState(state);
    const mode = currentMode();
    const prompt = buildScheduledPrompt(kind, mode);
    const id = `scheduled-${kind}-${new Date().toISOString()}`;
    res.writeHead(202, { 'Content-Type': 'text/plain' });
    res.end(`${kind} accepted by bridge model router`);
    logEvent('scheduled_submitted', { kind, mode, preferred_agent: SCHEDULE_PREFERRED_AGENT });
    sendText(SCHEDULE_REPLY_TO, `${scheduledLabel(kind)} scheduled run accepted — automatic model fallback is enabled.`).catch(() => {});
    enqueue(id, ALLOWED_SENDER, prompt, SCHEDULE_REPLY_TO, Date.now(), [], {
      autoModelFallback: true,
      preferredAgent: SCHEDULE_PREFERRED_AGENT,
      scheduledKind: kind,
      resetSessions: kind !== 'test',
    });
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/internal/scheduled') {
    if (req.method !== 'POST') { res.writeHead(405); return res.end(); }
    return handleScheduledPost(req, res);
  }
  if (url.pathname !== '/webhook') { res.writeHead(404); return res.end(); }

  // Meta webhook verification handshake (twilio never sends GET — 403 is fine)
  if (req.method === 'GET') {
    if (PROVIDER === 'meta' &&
        url.searchParams.get('hub.mode') === 'subscribe' &&
        url.searchParams.get('hub.verify_token') === VERIFY_TOKEN) {
      res.writeHead(200);
      return res.end(url.searchParams.get('hub.challenge'));
    }
    res.writeHead(403);
    return res.end();
  }

  if (req.method !== 'POST') { res.writeHead(405); return res.end(); }

  const bufs = [];
  req.on('data', (d) => bufs.push(d));
  req.on('end', () => {
    const raw = Buffer.concat(bufs);
    if (PROVIDER === 'twilio') handleTwilioPost(raw, req, res);
    else handleMetaPost(raw, req, res);
  });
});

// Unexpected termination still reports the interrupted run. Normal code
// activation is deferred until after reply/log delivery and uses kickstart.
process.on('SIGTERM', () => {
  const dying = activeRun;
  logEvent('shutdown', dying ? { interrupted: dying.prompt.slice(0, 80) } : {});
  if (!dying) process.exit(0);
  if (dying.brokerExecutionId && state.pendingBrokerExecution?.id === dying.brokerExecutionId) {
    state.pendingBrokerExecution = { ...state.pendingBrokerExecution, status: 'running',
      interruptedAt: new Date().toISOString() };
    saveState(state);
  }
  const mins = Math.round((Date.now() - dying.startedMs) / 60_000);
  dying.transcript?.append('INTERRUPTED', 'bridge process received SIGTERM');
  const notices = [
    sendText(dying.replyTo, dying.brokerExecutionId
      ? `⚠️ The bridge restarted during an approved order run (${mins}m in). It will resume automatically and reconcile live broker state before any action.`
      : `⚠️ The bridge stopped unexpectedly — "${dying.prompt.slice(0, 60)}" (${mins}m in) was interrupted. Its partial execution log is attached; resend after /status confirms recovery.`),
  ];
  if (dying.transcript && messenger.sendFile) {
    notices.push(messenger.sendFile(dying.replyTo, dying.transcript.path, 'Partial agent execution log'));
  }
  Promise.race([
    Promise.allSettled(notices),
    new Promise((r) => setTimeout(r, 4000)),
  ]).finally(() => process.exit(0));
});

logEvent('startup', { provider: PROVIDER, mode: messenger.mode });
const expiredImages = cleanupInboundImages(INBOUND_MEDIA_DIR);
if (expiredImages) logEvent('inbound_image_cleanup', { removed: expiredImages });
if (migratePendingTicketSet()) logEvent('report_tickets_migrated', { ticket_set: state.pendingTicketSet.id,
  tickets: state.pendingTicketSet.tickets.map((ticket) => ticket.number) });
if (repairFalseCompletedBrokerExecution()) logEvent('broker_execution_false_completion_repaired', {
  execution_id: state.pendingBrokerExecution.id,
});
if (reconcileFinishedBrokerExecution()) logEvent('broker_execution_reconciled', {
  execution_id: state.pendingBrokerExecution.id,
});
migrateLastHandoffChoice();
armAvailabilityRecovery();
armTemporaryResetDiscovery();
server.listen(PORT, '127.0.0.1', () => {
  log(`bridge control listening on http://127.0.0.1:${PORT} — provider: ${PROVIDER}`);
});
if (messenger.start) messenger.start();

function recoverInterruptedBrokerExecution() {
  const pending = state.pendingBrokerExecution;
  if (!pending || pending.status !== 'running' || !pending.replyTo || !Array.isArray(pending.tickets)) return;
  const ageMs = Date.now() - Date.parse(pending.approvedAt || 0);
  if (!Number.isFinite(ageMs) || ageMs > BROKER_RECOVERY_WINDOW_MS || Number(pending.recoveryAttempts || 0) >= 1) {
    pending.status = 'needs_reconfirmation';
    saveState(state);
    sendText(pending.replyTo, `The bridge recovered an interrupted approved order run, but the approval is now stale.\n${pending.tickets.map((ticket) => `${ticket.number}. ${ticket.description}`).join('\n')}\nReply “resume execution” to reconfirm, or name the ticket(s).`).catch(() => {});
    logEvent('broker_execution_reconfirmation_required', { execution_id: pending.id, age_ms: ageMs });
    return;
  }
  pending.recoveryAttempts = Number(pending.recoveryAttempts || 0) + 1;
  pending.recoveredAt = new Date().toISOString();
  saveState(state);
  sendText(pending.replyTo, '♻️ Recovering the interrupted approved order run. Live broker state will be reconciled before any action, so completed orders are not duplicated.').catch(() => {});
  enqueue(`broker-recovery-${pending.id}-${pending.recoveryAttempts}`, ALLOWED_SENDER,
    pending.userText || 'resume execution', pending.replyTo, null, [], { brokerExecution: pending });
  logEvent('broker_execution_recovery_started', { execution_id: pending.id, attempt: pending.recoveryAttempts });
}

setTimeout(recoverInterruptedBrokerExecution, 2000);
