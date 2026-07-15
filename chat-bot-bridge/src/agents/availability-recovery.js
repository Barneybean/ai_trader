// Agent-domain scheduling rules for retrying a model after a provider-supplied reset.

export const RECOVERY_RETRY_MS = [5, 15, 30, 60].map((minutes) => minutes * 60_000);

export function resetSecondsToMs(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : null;
}

export function recoveryNextAttemptAt(resetAtMs, attempts = 0, nowMs = Date.now()) {
  if (attempts <= 0) return Math.max(Number(resetAtMs) || 0, nowMs + 1000);
  const delay = RECOVERY_RETRY_MS[Math.min(attempts - 1, RECOVERY_RETRY_MS.length - 1)];
  return nowMs + delay;
}

export function shouldRunRecovery(recovery, defaultAgent, hasActiveRun) {
  return Boolean(recovery && !hasActiveRun && recovery.defaultAgent === defaultAgent);
}

export function temporaryChoiceForRun(choice, defaultAgent, brokerRequest = false) {
  if (!choice || brokerRequest || choice.defaultAgent !== defaultAgent || !choice.agent || !choice.model) return null;
  return choice;
}

export function handoffChoiceFromState({ recentHistory, lastRunView, defaultAgent, defaultModel, now } = {}) {
  const lastUser = [...(Array.isArray(recentHistory) ? recentHistory : [])]
    .reverse().find((item) => item?.role === 'user');
  const agent = String(lastRunView?.agent || '').toLowerCase();
  if (!/^\/decide\s+\d+$/i.test(String(lastUser?.text || '').trim()) ||
      lastRunView?.status !== 'DONE' || !['codex', 'claude'].includes(agent) ||
      !lastRunView?.model || agent === defaultAgent) return null;
  return {
    agent,
    model: lastRunView.model,
    defaultAgent,
    failedAgent: defaultAgent,
    failedModel: defaultModel,
    resetAtMs: null,
    selectedAt: (now || new Date()).toISOString(),
    migrated: true,
  };
}
