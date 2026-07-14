import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAgentModelSelection,
  registeredAgentNames,
  selectedAgentModel,
  selectedRegisteredAgent,
} from './agent-registry.js';

test('orders only registered agents and keeps a future adapter discoverable', () => {
  assert.deepEqual(
    registeredAgentNames(['runner-b', 'missing', 'runner-a'], ['runner-a', 'runner-b', 'local-runner']),
    ['runner-b', 'runner-a', 'local-runner'],
  );
  assert.equal(
    selectedRegisteredAgent('local-runner', ['runner-a'], ['runner-a', 'local-runner']),
    'local-runner',
  );
  assert.equal(
    selectedRegisteredAgent('missing', ['runner-a'], ['runner-a', 'local-runner']),
    'runner-a',
  );
});

test('persists an exact pair without overwriting another agent model', () => {
  const before = {
    agentPreference: 'runner-a',
    agentModelPreferences: { 'runner-a': 'model-a', 'runner-b': 'model-b' },
  };
  const after = applyAgentModelSelection(
    before,
    { agent: 'runner-b', model: 'model-b2' },
    ['runner-a', 'runner-b'],
  );
  assert.deepEqual(after, {
    agentPreference: 'runner-b',
    agentModelPreferences: { 'runner-a': 'model-a', 'runner-b': 'model-b2' },
  });
  assert.equal(selectedAgentModel('runner-b', { 'runner-b': 'default-b' }, after.agentModelPreferences), 'model-b2');
  assert.equal(applyAgentModelSelection(before, { agent: 'missing', model: 'x' }, ['runner-a']), null);
});
