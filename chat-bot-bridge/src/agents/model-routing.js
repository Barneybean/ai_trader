// Agent-domain model catalog and phone-choice helpers.

export const DEFAULT_CLAUDE_MODELS = ['fable', 'opus', 'sonnet', 'haiku'];

export function shouldAutoModelFallback(mode, explicitlyRequested = false) {
  return explicitlyRequested === true || String(mode || '').toLowerCase() === 'full';
}

export async function executeAvailabilityPlan({
  plan = [],
  prompt = '',
  runAttempt,
  handoffPrompt = (_last, _choice, original) => original,
  onSwitch = () => {},
  onAttempt = () => {},
} = {}) {
  if (typeof runAttempt !== 'function') throw new TypeError('runAttempt is required');
  let last = { ok: false, fallbackEligible: false, text: 'No automatic fallback model is configured.' };
  let firstAvailabilityFailure = null;
  for (let index = 0; index < plan.length; index++) {
    const choice = plan[index];
    if (index > 0) await onSwitch(last, choice, index);
    await onAttempt(choice, index, last);
    const routedPrompt = index === 0 ? prompt : handoffPrompt(last, choice, prompt);
    last = await runAttempt(choice, routedPrompt, index);
    if (last.ok) {
      return { last, attempts: index + 1, firstAvailabilityFailure, exhausted: false };
    }
    if (!last.fallbackEligible) {
      return { last, attempts: index + 1, firstAvailabilityFailure, exhausted: false };
    }
    if (!firstAvailabilityFailure) {
      firstAvailabilityFailure = {
        agent: last.agent || choice.agent,
        model: last.model || choice.model,
        resetAtMs: last.resetAtMs || null,
      };
    }
  }
  // An empty plan means the availability ledger filtered every configured
  // candidate. That is still an exhausted route, not a configuration error.
  return { last, attempts: plan.length, firstAvailabilityFailure, exhausted: true };
}

function uniqueModels(models = []) {
  const seen = new Set();
  return models.filter((item) => {
    const model = String(item?.model || item?.slug || item || '').trim();
    if (!model || seen.has(model.toLowerCase())) return false;
    seen.add(model.toLowerCase());
    return true;
  });
}

function claudeFamily(model) {
  const value = String(model || '').toLowerCase();
  return ['fable', 'opus', 'sonnet', 'haiku'].find((name) => value.includes(name)) || value;
}

export function buildPreferredAgentModelPlan({
  preferredAgent = 'claude',
  defaultClaudeModel,
  defaultCodexModel,
  claudeModels = DEFAULT_CLAUDE_MODELS,
  codexModels = [],
  maxPerAgent = 3,
} = {}) {
  const limit = Math.max(1, Math.min(3, Number(maxPerAgent) || 3));
  const claudeSeen = new Set();
  const claude = uniqueModels([defaultClaudeModel, ...claudeModels].map((model) => ({
    model: String(model || ''), label: String(model || ''),
  }))).filter((item) => {
    const family = claudeFamily(item.model);
    if (!family || claudeSeen.has(family)) return false;
    claudeSeen.add(family);
    return true;
  }).slice(0, limit).map((item) => ({ agent: 'claude', ...item }));
  const codex = uniqueModels([
    defaultCodexModel ? { model: defaultCodexModel, label: defaultCodexModel } : null,
    ...codexModels,
  ]).slice(0, limit).map((item) => ({ agent: 'codex', ...item }));
  const preferred = preferredAgent === 'codex' ? codex : claude;
  const alternative = preferredAgent === 'codex' ? claude : codex;
  // Try eligible sibling models before paying the higher context/session cost
  // of crossing to another provider.
  return [...preferred, ...alternative];
}

// Compatibility alias for downstream adapters using the former name.
export const buildInterleavedModelPlan = buildPreferredAgentModelPlan;

export function parseCodexModelCatalog(raw, fallbackModel) {
  try {
    const parsed = JSON.parse(String(raw || ''));
    const models = uniqueModels((parsed.models || [])
      .filter((item) => item?.visibility === 'list' && item?.slug)
      .sort((a, b) => Number(a.priority ?? 999) - Number(b.priority ?? 999))
      .map((item) => ({ model: item.slug, label: item.display_name || item.slug })));
    return models.length ? models : (fallbackModel ? [{ model: fallbackModel, label: fallbackModel }] : []);
  } catch {
    return fallbackModel ? [{ model: fallbackModel, label: fallbackModel }] : [];
  }
}

export function buildModelChoices({
  failedAgent,
  failedModel,
  claudeModels = DEFAULT_CLAUDE_MODELS,
  codexModels = [],
  maxCurrentAgent = 3,
  maxOtherAgent = 3,
} = {}) {
  const claude = uniqueModels(claudeModels.map((model) => ({ model: String(model), label: String(model) })));
  const codex = uniqueModels(codexModels);
  const failed = String(failedModel || '').toLowerCase();
  const sameAgent = failedAgent === 'claude'
    ? claude.filter((item) => claudeFamily(item.model) !== claudeFamily(failedModel))
    : codex.filter((item) => item.model.toLowerCase() !== failed);
  const otherAgent = failedAgent === 'claude' ? codex : claude;
  return [
    ...sameAgent.slice(0, maxCurrentAgent).map((item) => ({ agent: failedAgent, ...item })),
    ...otherAgent.slice(0, maxOtherAgent).map((item) => ({ agent: failedAgent === 'claude' ? 'codex' : 'claude', ...item })),
  ];
}

function choiceKey(choice) {
  return `${choice.agent}:${String(choice.model).toLowerCase()}`;
}

export function buildModelChoiceSet(options = {}) {
  const choices = buildModelChoices(options);
  const shown = new Set(choices.map(choiceKey));
  const remainingChoices = buildModelChoices({
    ...options,
    maxCurrentAgent: Number.MAX_SAFE_INTEGER,
    maxOtherAgent: Number.MAX_SAFE_INTEGER,
  }).filter((choice) => !shown.has(choiceKey(choice)));
  return { choices, remainingChoices };
}

export function isMoreModelsRequest(text) {
  return /^(?:(?:show\s+)?more(?:\s+available)?(?:\s+(?:agent\s+)?models?)?|other\s+models?|\/more|\/models|\/decide\s+more)$/i
    .test(String(text || '').trim());
}

export function nextModelChoicePage(pending, maxPerAgent = 3) {
  const remaining = Array.isArray(pending?.remainingChoices) ? pending.remainingChoices : [];
  if (!remaining.length) return null;
  const current = remaining.filter((choice) => choice.agent === pending.failedAgent).slice(0, maxPerAgent);
  const alternative = remaining.filter((choice) => choice.agent !== pending.failedAgent).slice(0, maxPerAgent);
  const choices = [...current, ...alternative];
  const shown = new Set(choices.map(choiceKey));
  return {
    ...pending,
    choices,
    remainingChoices: remaining.filter((choice) => !shown.has(choiceKey(choice))),
    page: Number(pending.page || 1) + 1,
  };
}

export function formatModelChoiceForPhone(pending) {
  const options = pending.choices
    .map((choice, index) => `${index + 1}. ${choice.agent === 'claude' ? 'Claude' : 'Codex'} — ${choice.label || choice.model}`)
    .join('\n');
  return [
    'Model choice needed',
    `${pending.failedAgent === 'claude' ? 'Claude' : 'Codex'} model ${pending.failedModel} is unavailable. Choose how to continue:`,
    options,
    `Reply 1-${pending.choices.length}, type claude/codex MODEL${pending.remainingChoices?.length ? ', or reply more for more models' : ''}.`,
  ].join('\n\n');
}

export function resolveModelChoice(pending, answer) {
  const text = String(answer || '').trim();
  const number = Number(text);
  if (Number.isInteger(number)) return pending.choices[number - 1] || null;
  const explicit = text.match(/^(claude|codex)\s*[: ]\s*(\S+)$/i);
  if (explicit) return { agent: explicit[1].toLowerCase(), model: explicit[2], label: explicit[2] };
  if (/^claude-/i.test(text) || /^(?:fable|opus|sonnet|haiku)$/i.test(text)) {
    return { agent: 'claude', model: text, label: text };
  }
  if (/^(?:gpt-|o\d|codex-)/i.test(text)) return { agent: 'codex', model: text, label: text };
  return null;
}

export function implicitModelChoiceAnswer(pending, text) {
  const answer = String(text || '').trim();
  if (!pending || !answer || answer.startsWith('/')) return null;
  return resolveModelChoice(pending, answer) ? answer : null;
}

export function modelHandoffPrompt(pending, choice) {
  return [
    `Resume the unfinished phone task using ${choice.agent} model ${choice.model}.`,
    `The previous ${pending.failedAgent} model ${pending.failedModel} became unavailable: ${pending.reason}.`,
    'Continue from the last completed step. Preserve completed filesystem work and do not repeat finished analysis unless needed to recover context.',
    pending.recentContext ? `Recent phone context:\n${pending.recentContext}` : '',
    `Original prompt:\n${pending.prompt}`,
  ].filter(Boolean).join('\n\n');
}

export function automaticModelHandoffPrompt({
  last,
  choice,
  prompt,
  runLabel = 'automatic run',
  reconcileBroker = false,
  recentContext = '',
} = {}) {
  const prior = `${last?.agent || 'agent'}${last?.model ? ` (${last.model})` : ''}`;
  const next = `${choice?.agent || 'agent'}${choice?.model ? ` (${choice.model})` : ''}`;
  return [
    `Automatic ${runLabel} handoff to ${next}.`,
    `The previous ${prior} became unavailable: ${String(last?.switchReason || last?.text || 'availability failure').replace(/\s+/g, ' ').slice(0, 500)}.`,
    'Continue from the last completed step. Inspect and preserve completed filesystem work; do not restart finished research or report construction.',
    reconcileBroker
      ? 'Before any broker action, refresh live positions, open orders, and recent fills. Reconcile what the previous agent may already have executed, and never duplicate an order or action.'
      : '',
    recentContext ? `Recent phone context:\n${recentContext}` : '',
    `Original objective:\n${prompt || ''}`,
  ].filter(Boolean).join('\n\n');
}
