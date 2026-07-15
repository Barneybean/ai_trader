import test from 'node:test';
import assert from 'node:assert/strict';
import {
  automaticModelHandoffPrompt,
  buildModelChoices,
  buildModelChoiceSet,
  buildInterleavedModelPlan,
  buildPreferredAgentModelPlan,
  executeAvailabilityPlan,
  formatModelChoiceForPhone,
  implicitModelChoiceAnswer,
  isMoreModelsRequest,
  modelHandoffPrompt,
  nextModelChoicePage,
  parseCodexModelCatalog,
  resolveModelChoice,
  shouldAutoModelFallback,
} from '../../src/agents/model-routing.js';

const codex = [
  { model: 'gpt-best', label: 'GPT Best' },
  { model: 'gpt-next', label: 'GPT Next' },
  { model: 'gpt-third', label: 'GPT Third' },
  { model: 'gpt-fourth', label: 'GPT Fourth' },
];

test('parses and ranks the visible Codex catalog', () => {
  const raw = JSON.stringify({ models: [
    { slug: 'gpt-second', display_name: 'Second', visibility: 'list', priority: 2 },
    { slug: 'hidden', visibility: 'hide', priority: 0 },
    { slug: 'gpt-first', display_name: 'First', visibility: 'list', priority: 1 },
  ] });
  assert.deepEqual(parseCodexModelCatalog(raw, 'fallback').map((item) => item.model), ['gpt-first', 'gpt-second']);
});

test('tries preferred-agent models before crossing to another agent', () => {
  const plan = buildPreferredAgentModelPlan({
    preferredAgent: 'claude',
    defaultClaudeModel: 'claude-fable-5',
    defaultCodexModel: 'gpt-5.6-sol',
    claudeModels: ['fable', 'claude-opus-4-8', 'claude-sonnet-next', 'haiku'],
    codexModels: [
      { model: 'gpt-5.6-sol', label: 'Sol' },
      { model: 'gpt-5.6-terra', label: 'Terra' },
      { model: 'gpt-next', label: 'Next' },
      { model: 'gpt-fourth', label: 'Fourth' },
    ],
  });
  assert.deepEqual(plan.map((item) => [item.agent, item.model]), [
    ['claude', 'claude-fable-5'],
    ['claude', 'claude-opus-4-8'],
    ['claude', 'claude-sonnet-next'],
    ['codex', 'gpt-5.6-sol'],
    ['codex', 'gpt-5.6-terra'],
    ['codex', 'gpt-next'],
  ]);
  assert.deepEqual(buildInterleavedModelPlan({
    preferredAgent: 'claude',
    defaultClaudeModel: 'fable',
    defaultCodexModel: 'gpt-one',
    claudeModels: ['fable'],
    codexModels: [{ model: 'gpt-one' }],
  }), buildPreferredAgentModelPlan({
    preferredAgent: 'claude',
    defaultClaudeModel: 'fable',
    defaultCodexModel: 'gpt-one',
    claudeModels: ['fable'],
    codexModels: [{ model: 'gpt-one' }],
  }));
});

test('uses Codex alternatives first when Codex is preferred', () => {
  const plan = buildPreferredAgentModelPlan({
    preferredAgent: 'codex',
    defaultClaudeModel: 'opus',
    defaultCodexModel: 'gpt-one',
    claudeModels: ['opus', 'sonnet'],
    codexModels: [{ model: 'gpt-one' }, { model: 'gpt-two' }],
  });
  assert.deepEqual(plan.map((item) => [item.agent, item.model]), [
    ['codex', 'gpt-one'], ['codex', 'gpt-two'], ['claude', 'opus'], ['claude', 'sonnet'],
  ]);
});

test('automatic fallback is enabled for scheduled requests and full mode only', () => {
  assert.equal(shouldAutoModelFallback('full', false), true);
  assert.equal(shouldAutoModelFallback('semi', true), true);
  assert.equal(shouldAutoModelFallback('semi', false), false);
  assert.equal(shouldAutoModelFallback('manual', false), false);
});

test('availability plan advances only on availability failures and preserves handoff order', async () => {
  const plan = [
    { agent: 'claude', model: 'fable' },
    { agent: 'codex', model: 'sol' },
    { agent: 'claude', model: 'opus' },
  ];
  const calls = [];
  const switches = [];
  const responses = [
    { ok: false, fallbackEligible: true, agent: 'claude', model: 'fable', resetAtMs: 123 },
    { ok: false, fallbackEligible: true, agent: 'codex', model: 'sol' },
    { ok: true, fallbackEligible: false, agent: 'claude', model: 'opus', text: 'done' },
  ];
  const result = await executeAvailabilityPlan({
    plan,
    prompt: 'original',
    handoffPrompt: (last, choice) => `handoff ${last.model} to ${choice.model}`,
    onSwitch: (last, choice) => { switches.push(`${last.model}->${choice.model}`); },
    runAttempt: async (choice, prompt, index) => {
      calls.push([choice.model, prompt]);
      return responses[index];
    },
  });
  assert.deepEqual(calls, [
    ['fable', 'original'],
    ['sol', 'handoff fable to sol'],
    ['opus', 'handoff sol to opus'],
  ]);
  assert.deepEqual(switches, ['fable->sol', 'sol->opus']);
  assert.equal(result.attempts, 3);
  assert.equal(result.last.ok, true);
  assert.deepEqual(result.firstAvailabilityFailure, {
    agent: 'claude', model: 'fable', resetAtMs: 123,
  });
});

test('availability plan stops on an ordinary task failure', async () => {
  let attempts = 0;
  const result = await executeAvailabilityPlan({
    plan: [{ agent: 'codex', model: 'sol' }, { agent: 'claude', model: 'opus' }],
    runAttempt: async () => {
      attempts++;
      return { ok: false, fallbackEligible: false, text: 'tests failed' };
    },
  });
  assert.equal(attempts, 1);
  assert.equal(result.attempts, 1);
  assert.equal(result.exhausted, false);
});

test('an empty availability plan is reported as exhausted', async () => {
  const result = await executeAvailabilityPlan({
    plan: [],
    runAttempt: async () => ({ ok: true }),
  });
  assert.equal(result.attempts, 0);
  assert.equal(result.exhausted, true);
  assert.match(result.last.text, /No automatic fallback model is configured/);
});

test('automatic full-mode handoff requires live broker reconciliation', () => {
  const prompt = automaticModelHandoffPrompt({
    last: { agent: 'claude', model: 'fable', switchReason: 'rate limit' },
    choice: { agent: 'codex', model: 'gpt-next' },
    prompt: 'execute the approved ticket',
    runLabel: 'full-auto run',
    reconcileBroker: true,
    recentContext: 'User approved ticket 2.',
  });
  assert.match(prompt, /Automatic full-auto run handoff to codex \(gpt-next\)/);
  assert.match(prompt, /refresh live positions, open orders, and recent fills/i);
  assert.match(prompt, /never duplicate an order or action/i);
  assert.match(prompt, /User approved ticket 2/);
  assert.match(prompt, /execute the approved ticket/);
});

test('offers at most three current-agent and three alternative-agent models', () => {
  const choices = buildModelChoices({
    failedAgent: 'claude', failedModel: 'claude-fable-5',
    claudeModels: ['fable', 'opus', 'sonnet'], codexModels: codex,
  });
  assert.deepEqual(choices.map((item) => [item.agent, item.model]), [
    ['claude', 'opus'], ['claude', 'sonnet'],
    ['codex', 'gpt-best'], ['codex', 'gpt-next'], ['codex', 'gpt-third'],
  ]);
});

test('pages through additional available models on request', () => {
  const set = buildModelChoiceSet({
    failedAgent: 'claude', failedModel: 'fable',
    claudeModels: ['fable', 'opus', 'sonnet', 'haiku'], codexModels: codex,
  });
  assert.deepEqual(set.choices.map((item) => item.model), ['opus', 'sonnet', 'haiku', 'gpt-best', 'gpt-next', 'gpt-third']);
  const next = nextModelChoicePage({ failedAgent: 'claude', page: 1, ...set });
  assert.deepEqual(next.choices.map((item) => item.model), ['gpt-fourth']);
  assert.equal(next.remainingChoices.length, 0);
  assert.equal(isMoreModelsRequest('more models'), true);
  assert.equal(isMoreModelsRequest('show more available agent models'), true);
  assert.equal(isMoreModelsRequest('/models'), true);
  assert.equal(isMoreModelsRequest('/decide more'), true);
});

test('resolves numbered and typed custom model choices', () => {
  const pending = { choices: [{ agent: 'claude', model: 'opus', label: 'opus' }] };
  assert.deepEqual(resolveModelChoice(pending, '1'), pending.choices[0]);
  assert.deepEqual(resolveModelChoice(pending, 'codex gpt-custom'), { agent: 'codex', model: 'gpt-custom', label: 'gpt-custom' });
  assert.deepEqual(resolveModelChoice(pending, 'sonnet'), { agent: 'claude', model: 'sonnet', label: 'sonnet' });
  assert.equal(resolveModelChoice(pending, 'something ambiguous'), null);
  assert.equal(implicitModelChoiceAnswer(pending, '1'), '1');
  assert.equal(implicitModelChoiceAnswer(pending, 'codex gpt-custom'), 'codex gpt-custom');
  assert.equal(implicitModelChoiceAnswer(pending, 'new unrelated request'), null);
});

test('formats a phone decision and continuation prompt', () => {
  const pending = {
    failedAgent: 'claude', failedModel: 'fable', reason: 'usage limit', prompt: 'finish report',
    recentContext: 'Assistant: research complete', choices: [{ agent: 'codex', model: 'gpt-best', label: 'GPT Best' }],
  };
  const phoneText = formatModelChoiceForPhone(pending);
  assert.match(phoneText, /1\. Codex — GPT Best/);
  assert.match(phoneText, /Reply 1-1, type claude\/codex MODEL/);
  assert.match(modelHandoffPrompt(pending, pending.choices[0]), /Continue from the last completed step/);
});
