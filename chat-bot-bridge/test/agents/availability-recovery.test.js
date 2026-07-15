import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recoveryNextAttemptAt,
  handoffChoiceFromState,
  resetSecondsToMs,
  shouldRunRecovery,
  temporaryChoiceForRun,
} from '../../src/agents/availability-recovery.js';

test('uses a provider reset time first, then increasing retry delays', () => {
  assert.equal(resetSecondsToMs(1_800_000_000), 1_800_000_000_000);
  assert.equal(resetSecondsToMs('nope'), null);
  assert.equal(recoveryNextAttemptAt(20_000, 0, 10_000), 20_000);
  assert.equal(recoveryNextAttemptAt(20_000, 1, 10_000), 310_000);
  assert.equal(recoveryNextAttemptAt(20_000, 5, 10_000), 3_610_000);
});

test('keeps a selected handoff model sticky until recovery or manual default change', () => {
  const choice = { agent: 'codex', model: 'gpt-test', defaultAgent: 'claude' };
  assert.equal(temporaryChoiceForRun(choice, 'claude', false), choice);
  assert.equal(temporaryChoiceForRun(choice, 'codex', false), null);
  assert.equal(temporaryChoiceForRun(choice, 'claude', true), null);
});

test('migrates the last completed numbered handoff after bridge activation', () => {
  const choice = handoffChoiceFromState({
    recentHistory: [{ role: 'user', text: '/decide 4' }],
    lastRunView: { status: 'DONE', agent: 'Codex', model: 'gpt-selected' },
    defaultAgent: 'claude', defaultModel: 'claude-default', now: new Date('2026-07-12T20:00:00Z'),
  });
  assert.deepEqual([choice.agent, choice.model, choice.failedModel], ['codex', 'gpt-selected', 'claude-default']);
  assert.equal(handoffChoiceFromState({
    recentHistory: [{ role: 'user', text: 'normal request' }],
    lastRunView: { status: 'DONE', agent: 'Codex', model: 'gpt-selected' },
    defaultAgent: 'claude', defaultModel: 'claude-default',
  }), null);
});

test('does not run a recovery after a manual default change or during work', () => {
  const recovery = { defaultAgent: 'claude' };
  assert.equal(shouldRunRecovery(recovery, 'claude', false), true);
  assert.equal(shouldRunRecovery(recovery, 'codex', false), false);
  assert.equal(shouldRunRecovery(recovery, 'claude', true), false);
});
