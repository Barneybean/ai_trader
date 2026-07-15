// Agent-domain helpers for availability and fallback classification.
// Keep this module side-effect free so the smoke gate can regression-test it.

export const CODEX_UNAVAILABLE_RE = /rate.?limit|usage limit|quota|too many requests|\b429\b|limit reached|reached (?:your|the).{0,40}limit|try again later|not logged in|authentication|unauthorized|ENOENT|not found/i;

const BROKER_INTENT_RE = /\b(?:approve|broker|buy|cancel|execute|order|orders|portfolio|position|positions|quote|report|replace|robinhood|sell|trade)\b/i;
const BROKER_UNAVAILABLE_RE = /(?:broker|robinhood).{0,80}(?:auth(?:orization)?|connection|mcp|status|tools?).{0,80}(?:pending|unavailable|cannot|can't|not available|not verified)|(?:live broker status unavailable|pending broker auth)/i;
const BROKER_ACTION_RE = /(?:\bapprove(?:\s+all|\s+(?:ticket\s*)?\d)|\byes\s+to\s+\d|\bconfirm\s+(?:ticket\s*)?\d|\bok(?:ay)?\s+to\s+execute\b|\bexecute\s+(?:all|the\s+recommendations|[A-Z]{1,6})\b|\b(?:cancel|execute|place|replace|submit)\b.*\b(?:order|ticket|trade|it|this)\b|\b(?:buy|sell)\s+\d+(?:\.\d+)?\s+(?:shares?\s+(?:of\s+)?)?[A-Z]{1,6}\b|\b(?:do it|go ahead|take action)\b)/i;
const BROKER_STATUS_RE = /(?:\b(?:live|current|real)[ -]?(?:status|quote|price|position|positions|portfolio|orders?)\b|\b(?:open|pending|filled|cancelled|canceled)\s+orders?\b|\b(?:order|broker|robinhood)\s+status\b|\b(?:show|check|get|refresh|verify)\b.{0,40}\b(?:quote|price|position|positions|portfolio|orders?|broker|robinhood)\b)/i;

export function brokerRequestKind(prompt, history = []) {
  const text = String(prompt || '').trim();
  if (BROKER_ACTION_RE.test(text)) return 'action';
  if (BROKER_STATUS_RE.test(text)) return 'status';
  if (/^(?:yes|confirm|approved?|proceed)$/i.test(text)) {
    const recent = Array.isArray(history) ? history.slice(-4) : [];
    const pendingTicket = recent.some((item) => item?.role === 'assistant'
      && /\b(?:ticket|order)\b/i.test(String(item?.text || ''))
      && /\b(?:approve|confirm|reply yes)\b/i.test(String(item?.text || '')));
    if (pendingTicket) return 'action';
  }
  return null;
}

export function prioritizeBrokerAgent(order, brokerAgent, brokerKind) {
  const current = Array.isArray(order) ? order.filter(Boolean) : [];
  if (!brokerKind || !brokerAgent) return [...current];
  return [brokerAgent, ...current.filter((name) => name !== brokerAgent)];
}

export function preferredAgentOrder(preferred, available = ['codex', 'claude']) {
  const unique = [...new Set((Array.isArray(available) ? available : []).filter(Boolean))];
  if (!unique.length) return [];
  const first = unique.includes(preferred) ? preferred : unique[0];
  return [first, ...unique.filter((name) => name !== first)];
}

function agentDisplayName(agent) {
  if (agent === 'codex') return 'Codex';
  if (agent === 'claude') return 'Claude';
  return String(agent || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function createManualAgentChoice({
  agents = [], current = null, models = {}, modelChoices = {}, nowMs = Date.now(), ttlMs = 5 * 60_000,
} = {}) {
  const choices = [...new Set(agents.map((agent) => String(agent || '').trim()).filter(Boolean))]
    .map((agent) => ({
      agent,
      label: agentDisplayName(agent),
      model: String(models[agent] || ''),
      models: (Array.isArray(modelChoices[agent]) ? modelChoices[agent] : [])
        .slice(0, 4)
        .map((item) => typeof item === 'string'
          ? { model: item, label: item, availability: 'available' }
          : {
              model: String(item?.model || ''),
              label: String(item?.label || item?.model || ''),
              availability: String(item?.availability || 'available'),
              ...(item?.detail ? { detail: String(item.detail) } : {}),
            })
        .filter((item) => item.model),
      current: agent === current,
    }));
  // Keep the grouped view for phone readability, but give every visible
  // model its own stable number.  A phone user is choosing an exact runtime,
  // not merely a provider heading.
  const modelOptions = choices.flatMap((choice) => (choice.models.length
    ? choice.models
    : [{ model: choice.model, label: choice.model || 'No model catalog', availability: 'unknown' }])
    .filter((model) => model.model)
    .map((model) => ({
      agent: choice.agent,
      agentLabel: choice.label,
      model: model.model,
      label: model.label,
      availability: model.availability,
      ...(model.detail ? { detail: model.detail } : {}),
      current: choice.current && model.model === choice.model,
    })));
  return {
    choices,
    modelOptions,
    current,
    requestedAt: new Date(nowMs).toISOString(),
    expiresAtMs: nowMs + Math.max(30_000, Number(ttlMs) || 5 * 60_000),
  };
}

function manualModelOptions(pending) {
  if (Array.isArray(pending?.modelOptions) && pending.modelOptions.length) return pending.modelOptions;
  const choices = Array.isArray(pending?.choices) ? pending.choices : [];
  return choices.flatMap((choice) => (choice.models || [])
    .filter((model) => model?.model)
    .map((model) => ({
      agent: choice.agent,
      agentLabel: choice.label,
      model: model.model,
      label: model.label || model.model,
      availability: model.availability || 'available',
      ...(model.detail ? { detail: model.detail } : {}),
      current: choice.current && model.model === choice.model,
    })));
}

export function formatManualAgentChoiceForPhone(pending) {
  const choices = Array.isArray(pending?.choices) ? pending.choices : [];
  const modelOptions = manualModelOptions(pending);
  let number = 0;
  const rows = choices.flatMap((choice) => {
    const heading = `${choice.label}${choice.current ? ' (current)' : ''}`;
    const models = (choice.models || []).map((model) => {
      const option = modelOptions.find((item) => item.agent === choice.agent && item.model === model.model);
      const itemNumber = option ? modelOptions.indexOf(option) + 1 : ++number;
      const isDefault = choice.current && choice.model && model.model === choice.model;
      return `${itemNumber}. ${model.label} — ${model.availability}${isDefault ? ' · default' : ''}${model.detail ? ` · ${model.detail}` : ''}`;
    });
    return [heading, ...(models.length ? models : [`${++number}. ${choice.model || 'No model catalog'} — availability unknown`])];
  });
  return [
    'Select the default agent and model',
    ...rows,
    modelOptions.length ? `Reply /agent 1-${modelOptions.length}, /agent codex|claude, or a bare number within 5 minutes.` : 'No configured agents are available.',
    'This changes future runs only. Automatic availability switching remains enabled.',
  ].join('\n');
}

export function resolveManualAgentChoice(pending, answer, nowMs = Date.now()) {
  if (!pending || nowMs > Number(pending.expiresAtMs || 0)) return null;
  const choices = Array.isArray(pending.choices) ? pending.choices : [];
  const modelOptions = manualModelOptions(pending);
  const value = String(answer || '').trim().toLowerCase().replace(/^\/agent\s+/, '');
  const number = Number(value);
  if (Number.isInteger(number)) {
    const choice = modelOptions[number - 1];
    return choice ? { ...choice, explicitModel: true } : null;
  }
  const agent = choices.find((choice) => choice.agent === value);
  return agent ? {
    agent: agent.agent,
    agentLabel: agent.label,
    model: agent.model,
    label: agent.model,
    explicitModel: false,
  } : null;
}

export function implicitManualAgentChoice(state, text, nowMs = Date.now()) {
  if (!/^\d+$/.test(String(text || '').trim())) return null;
  if (state?.pendingModelSwitch || state?.pendingDecision) return null;
  return resolveManualAgentChoice(state?.pendingAgentChoice, text, nowMs);
}

export function availabilityFailure(text) {
  return CODEX_UNAVAILABLE_RE.test(String(text || ''));
}

export function shouldFallbackForBroker(prompt, reply) {
  return BROKER_INTENT_RE.test(String(prompt || '')) && BROKER_UNAVAILABLE_RE.test(String(reply || ''));
}

export function claudeRateLimitBlocked(info) {
  const status = String(info?.status || '').toLowerCase();
  return Boolean(status) && !status.startsWith('allowed');
}

export function createRunCircuitBreaker(options = {}) {
  const maxToolCalls = Math.max(1, Number(options.maxToolCalls || 120));
  const maxIdenticalToolCalls = Math.max(1, Number(options.maxIdenticalToolCalls || 6));
  const maxOutputTokens = Math.max(1, Number(options.maxOutputTokens || 64_000));
  let toolCalls = 0;
  let outputTokens = 0;
  const repeated = new Map();

  return {
    observeTool(signature) {
      toolCalls++;
      const key = String(signature || 'unknown').slice(0, 4000);
      const count = (repeated.get(key) || 0) + 1;
      repeated.set(key, count);
      if (toolCalls > maxToolCalls) return `tool-call limit exceeded (${toolCalls}/${maxToolCalls})`;
      if (count > maxIdenticalToolCalls) {
        return `identical tool call repeated too many times (${count}/${maxIdenticalToolCalls})`;
      }
      return null;
    },
    observeOutputTokens(tokens) {
      outputTokens += Math.max(0, Number(tokens) || 0);
      return outputTokens > maxOutputTokens
        ? `streamed output-token limit exceeded (${outputTokens}/${maxOutputTokens})`
        : null;
    },
    snapshot() { return { toolCalls, outputTokens }; },
  };
}

export function codexAvailabilityError(ev) {
  // Availability is an agent/runtime property. A failed command is a tool
  // error inside a healthy Codex run; its ENOENT/"not found" output must not
  // trigger an agent switch or availability warning.
  const eventError = ['error', 'turn.failed'].includes(ev?.type)
    ? [ev.message, ev.error?.message, ev.detail].filter(Boolean).join(' ')
    : '';
  if (eventError && CODEX_UNAVAILABLE_RE.test(eventError)) return eventError;
  return null;
}
