import { scheduledBrokerPreflightPrompt } from './broker-preflight.js';

export const SCHEDULE_KINDS = ['premarket', 'postmarket', 'test'];

const MODE_TASK = {
  full: 'FULL SHADOW: validate each proposed ticket with scripts/execution/gateway.py and report VALIDATED PROPOSAL or BLOCKED with reasons. Never place an order.',
  semi: 'SEMI-AUTO: end with numbered proposed tickets so the user can reply "approve N".',
  manual: 'MANUAL: advise only; no tickets are executed from this run.',
};

export function scheduledLabel(kind) {
  return kind === 'premarket' ? 'Pre-market' : kind === 'postmarket' ? 'Post-market' : 'Test';
}

export function isDuplicateScheduledRun(lastRunDay, today, { force = false, kind = '' } = {}) {
  if (force || kind === 'test') return false;
  return Boolean(lastRunDay) && String(lastRunDay) === String(today);
}

export function localCalendarDay(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildScheduledPrompt(kind, mode, now = new Date()) {
  if (!SCHEDULE_KINDS.includes(kind)) throw new Error(`unknown scheduled kind: ${kind}`);
  if (kind === 'test') return 'This is a scheduled-run plumbing test. Reply with exactly: scheduled-run test ok';
  const common = `${scheduledBrokerPreflightPrompt()}\n\n${MODE_TASK[mode] || MODE_TASK.manual}\nThis is a distinct scheduled report run: preserve earlier reports, create a collision-safe new artifact, then build the matching bilingual HTML and commit it per repo convention. The bridge attaches every finished report HTML automatically. Reply with the TLDR only.`;
  if (kind === 'premarket') {
    return `Scheduled PRE-MARKET complete daily report (${now.toDateString()}). "Daily" means the full decision-grade SKILL.md pipeline, not a summary: cover the portfolio, open decisions/orders, alerts/levels, material watchlist changes and qualified outside opportunities; recall history first; collect enough fresh dated data and supporting evidence; run all relevant roles, engines, debates and gates; build the full bilingual HTML report. Include overnight/pre-market moves, today's catalyst calendar and execution-ready plan. ${common}`;
  }
  return `Scheduled POST-MARKET complete daily report (${now.toDateString()}). "Daily" means the full decision-grade SKILL.md pipeline, not a summary: cover every holding and actionable candidate with enough fresh dated data and supporting evidence, recall history first, run all relevant roles, engines, debates and gates, and build the full bilingual HTML report. Review how the book and today's plan printed, score resolved calls, explain key closes/after-hours moves, and set tomorrow's levels and execution-ready plan. ${common}`;
}
