// Broker-domain rule: a daily report must establish capability from an actual MCP call,
// never from the model name, a stale transcript, or a configuration guess.

export function isRobinhoodAccountProbe(detail = {}) {
  const tool = String(detail.tool || '').toLowerCase();
  return /robinhood/.test(tool) && /get[_-]?accounts/.test(tool);
}

export function createBrokerPreflightTracker() {
  return {
    attempted: false,
    completed: false,
    succeeded: false,
    observe(kind, detail) {
      if (kind !== 'execution' || !isRobinhoodAccountProbe(detail)) return;
      if (detail.phase === 'completed') {
        this.attempted = true;
        this.completed = true;
        this.succeeded = detail.ok !== false;
      } else {
        this.attempted = true;
      }
    },
  };
}

export function scheduledBrokerPreflightPrompt() {
  return [
    'MANDATORY SCHEDULED-REPORT BROKER PREFLIGHT — complete this before any repository documents, reports, journal history, or local registries.',
    'Use Robinhood MCP to call get_accounts, then read the live portfolio, positions, open equity/option orders, and needed quotes/tradability for the report.',
    'Never infer that MCP is unavailable from the active model, a prior report, or a runtime message. Say unavailable only after an actual MCP call fails, name the failure class, and then use the local fallback.',
    'Respect phone privacy: use account roles in the report and do not expose account identifiers or account dollar values in the phone TLDR.',
  ].join('\n');
}

export function scheduledBrokerCorrectionPrompt() {
  return [
    'The scheduled report cannot be delivered yet: its telemetry shows no Robinhood MCP get_accounts preflight.',
    scheduledBrokerPreflightPrompt(),
    'Continue this same task now. Reconcile the report against the live broker state, correct any false statement that MCP is unavailable, rebuild the bilingual HTML, and commit the correction per repository convention.',
  ].join('\n\n');
}
