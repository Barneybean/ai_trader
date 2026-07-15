// Agent-domain helpers for availability and fallback classification.
// Keep this module side-effect free so the smoke gate can regression-test it.

export const CODEX_UNAVAILABLE_RE = /rate.?limit|usage limit|quota|too many requests|\b429\b|limit reached|\b(?:hit|reached)\b.{0,40}\blimits?\b|reached (?:your|the).{0,40}limit|not logged in|authentication|unauthorized/i;

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

// An explicit provider rate-limit event wins over a later final result. Some
// CLI versions emit both and do not reliably mark the final result as an error.
export function claudeAvailabilityOutcome({
  rateLimitEvent = false,
  rateLimitReason = null,
  resetAtMs = null,
  result = null,
} = {}) {
  const value = result?.result || result?.error || '';
  const unavailable = Boolean(rateLimitEvent)
    || Boolean(result?.is_error && availabilityFailure(value));
  return {
    unavailable,
    reason: unavailable
      ? String(rateLimitReason || value || 'usage limit reached').slice(0, 500)
      : null,
    resetAtMs: unavailable && Number.isFinite(Number(resetAtMs)) ? Number(resetAtMs) : null,
  };
}

function stableToolInput(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return `[${value.map(stableToolInput).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableToolInput(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function webSearchQuery(value) {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'string') {
    try { return webSearchQuery(JSON.parse(value)); }
    catch { return value; }
  }
  if (Array.isArray(value)) return value.length ? value : undefined;
  if (typeof value !== 'object') return undefined;
  return firstDefined(
    value.query,
    value.q,
    value.search_query,
    value.searchQuery,
    value.queries,
  );
}

// Codex may expose a web-search event without its query. Such an opaque event
// counts toward the whole-run budget but is not evidence that two calls were
// identical. Observable inputs receive stable, semantic fingerprints.
export function codexToolFingerprint(item = {}) {
  const type = String(item?.type || '');
  if (type === 'web_search') {
    const query = webSearchQuery(firstDefined(
      item.query,
      item.search_query,
      item.searchQuery,
      item.input,
      item.arguments,
    ));
    return query === undefined ? null : `web_search:${stableToolInput(query)}`;
  }
  if (type === 'command_execution') {
    return `command_execution:${stableToolInput(item.command)}`;
  }
  if (type === 'mcp_tool_call') {
    return `mcp_tool_call:${String(item.server || '')}:${String(item.tool || '')}:${stableToolInput(firstDefined(item.arguments, item.input))}`;
  }
  return `${type}:${stableToolInput(firstDefined(item.arguments, item.input, item.command))}`;
}

export function createRunCircuitBreaker(options = {}) {
  const limit = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : fallback;
  };
  // Successful, diverse tool work is progress rather than a loop. Production
  // defaults therefore have no count/token ceiling; explicit operator/test
  // values remain supported, and the time limit still bounds every attempt.
  const maxToolCalls = limit(options.maxToolCalls, Infinity);
  const maxIdenticalToolCalls = limit(options.maxIdenticalToolCalls, 6);
  const maxOutputTokens = limit(options.maxOutputTokens, Infinity);
  const maxIdenticalToolFailures = limit(options.maxIdenticalToolFailures, 3);
  const maxConsecutiveToolFailures = limit(options.maxConsecutiveToolFailures, 8);
  let toolCalls = 0;
  let outputTokens = 0;
  const repeated = new Map();
  const repeatedFailures = new Map();
  let consecutiveToolFailures = 0;

  const failureFingerprint = (value) => String(value || 'tool failed')
    .replace(/\b[0-9a-f]{8,}\b/gi, '#')
    .replace(/\b\d+\b/g, '#')
    .replace(/\s+/g, ' ').trim().slice(0, 800);

  return {
    observeTool(signature) {
      toolCalls++;
      if (Number.isFinite(maxToolCalls) && toolCalls > maxToolCalls) {
        return `tool-call limit exceeded (${toolCalls}/${maxToolCalls})`;
      }
      if (signature === null || signature === undefined) return null;
      const key = String(signature).slice(0, 4000);
      const count = (repeated.get(key) || 0) + 1;
      repeated.set(key, count);
      if (count > maxIdenticalToolCalls) {
        return `identical tool call repeated too many times (${count}/${maxIdenticalToolCalls})`;
      }
      return null;
    },
    observeToolResult({ signature = null, ok = true, error = null } = {}) {
      if (ok) {
        consecutiveToolFailures = 0;
        repeatedFailures.clear();
        return null;
      }
      consecutiveToolFailures++;
      const tool = signature === null || signature === undefined
        ? 'unknown-tool' : String(signature).slice(0, 4000);
      const key = `${tool}:${failureFingerprint(error)}`;
      const count = (repeatedFailures.get(key) || 0) + 1;
      repeatedFailures.set(key, count);
      if (count > maxIdenticalToolFailures) {
        return `identical tool failure repeated too many times (${count}/${maxIdenticalToolFailures})`;
      }
      if (consecutiveToolFailures > maxConsecutiveToolFailures) {
        return `consecutive tool failures without progress (${consecutiveToolFailures}/${maxConsecutiveToolFailures})`;
      }
      return null;
    },
    observeOutputTokens(tokens) {
      outputTokens += Math.max(0, Number(tokens) || 0);
      return Number.isFinite(maxOutputTokens) && outputTokens > maxOutputTokens
        ? `streamed output-token limit exceeded (${outputTokens}/${maxOutputTokens})`
        : null;
    },
    snapshot() { return { toolCalls, outputTokens, consecutiveToolFailures }; },
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
