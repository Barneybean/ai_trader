import { scheduledBrokerPreflightPrompt } from '../broker/broker-preflight.js';
import { pacificDateLabel } from './clock.js';

export const SCHEDULE_KINDS = ['premarket', 'midmarket', 'postmarket', 'test'];

const MODE_TASK = {
  full: 'FULL SHADOW: validate each proposed ticket with scripts/execution/gateway.py and report VALIDATED PROPOSAL or BLOCKED with reasons. Never place an order.',
  semi: 'SEMI-AUTO: end with numbered proposed tickets so the user can reply "approve N".',
  manual: 'MANUAL: advise only; no tickets are executed from this run.',
};

export function scheduledLabel(kind) {
  return kind === 'premarket' ? 'Pre-market'
    : kind === 'midmarket' ? 'Mid-market'
    : kind === 'postmarket' ? 'Post-market'
    : 'Test';
}

// Intentional and recovery re-runs are allowed and receive collision-safe artifacts.
// Suppress only a near-simultaneous double-fire of the same schedule kind.
export const SCHEDULED_DEBOUNCE_MS = 5 * 60 * 1000;

export function isDuplicateScheduledRun(
  lastRunAtIso,
  nowMs,
  { force = false, kind = '', windowMs = SCHEDULED_DEBOUNCE_MS } = {},
) {
  if (force || kind === 'test') return false;
  const last = Date.parse(lastRunAtIso || '');
  if (!Number.isFinite(last) || !Number.isFinite(nowMs)) return false;
  const elapsed = nowMs - last;
  return elapsed >= 0 && elapsed < windowMs;
}

export function buildScheduledPrompt(kind, mode, now = new Date()) {
  if (!SCHEDULE_KINDS.includes(kind)) throw new Error(`unknown scheduled kind: ${kind}`);
  if (kind === 'test') return 'This is a scheduled-run plumbing test. Reply with exactly: scheduled-run test ok';
  const common = `${scheduledBrokerPreflightPrompt()}\n\n${MODE_TASK[mode] || MODE_TASK.manual}\nThis is a distinct scheduled report run: preserve every earlier report, use new_report.py without --force so a same-day collision gets its own -rerun-HHMMSS artifact, then build the matching bilingual HTML and commit it per repo convention. The bridge attaches every finished report HTML automatically. Reply with the TLDR only.`;
  if (kind === 'premarket') {
    return `Scheduled PRE-MARKET complete daily report (${pacificDateLabel(now)}). "Daily" means the full decision-grade SKILL.md pipeline, not a summary: cover the portfolio, open decisions/orders, alerts/levels, material watchlist changes and qualified outside opportunities; recall history first; collect enough fresh dated data and supporting evidence; run all relevant roles, engines, debates and gates; build the full bilingual HTML report. Include overnight/pre-market moves, today's catalyst calendar and execution-ready plan. ${common}`;
  }
  if (kind === 'midmarket') {
    return `Scheduled MID-MARKET intraday update (${pacificDateLabel(now)}), with the session live. This is a decision-grade midday check against the morning plan, NOT a from-scratch re-underwrite: recall today's pre-market report and open decisions/orders first, then reconcile the live book — which intraday levels, triggers, entries or stops have hit or are near, how each holding and the day's plan is printing so far, and any material catalyst/tape reaction since the open. Surface only what has changed or now needs action, run the roles/engines/gates that the changes warrant, and build the bilingual HTML report. End with an execution-ready plan: intraday adjustments, protective-stop or trigger changes, and any new must-act tickets. ${common}`;
  }
  return `Scheduled POST-MARKET complete daily report (${pacificDateLabel(now)}). "Daily" means the full decision-grade SKILL.md pipeline, not a summary: cover every holding and actionable candidate with enough fresh dated data and supporting evidence, recall history first, run all relevant roles, engines, debates and gates, and build the full bilingual HTML report. Review how the book and today's plan printed, score resolved calls, explain key closes/after-hours moves, and set tomorrow's levels and execution-ready plan. ${common}`;
}
