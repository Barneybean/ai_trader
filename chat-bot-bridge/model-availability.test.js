import test from 'node:test';
import assert from 'node:assert/strict';
import {
  availabilityRecordIsCurrent,
  availabilityRetryLabel,
  clearAvailabilityFailure,
  explicitFutureResetAtMs,
  filterAvailableModels,
  findAvailabilityFailure,
  recordAvailabilityFailure,
  sameAgentModel,
} from './model-availability.js';

const aliases = {
  'runner-a': {
    fast: ['fast', 'fast-v2'],
    deep: ['deep', 'deep-v3'],
  },
};

test('model aliases are configurable per registered agent', () => {
  assert.equal(sameAgentModel('runner-a', 'fast-v2', 'fast', aliases), true);
  assert.equal(sameAgentModel('runner-a', 'fast', 'deep', aliases), false);
  assert.equal(sameAgentModel('runner-b', 'fast-v2', 'fast', aliases), false);
});

test('requires an explicit future reset', () => {
  const now = 1_000_000;
  assert.equal(explicitFutureResetAtMs(null, now), null);
  assert.equal(explicitFutureResetAtMs('', now), null);
  assert.equal(explicitFutureResetAtMs(now, now), null);
  assert.equal(explicitFutureResetAtMs(now + 1, now), now + 1);
});

test('persists a reset across configured aliases and reports it readably', () => {
  const now = Date.parse('2026-07-13T12:00:00-07:00');
  const resetAtMs = Date.parse('2026-07-15T19:00:00-07:00');
  const records = recordAvailabilityFailure([], 'runner-a', 'fast-v2', {
    reason: 'usage limit: rejected', resetAtMs,
  }, now, aliases);
  const failure = findAvailabilityFailure(records, 'runner-a', 'fast', now + 1, aliases);
  assert.equal(failure?.model, 'fast-v2');
  assert.match(availabilityRetryLabel(failure, now + 1), /Jul 15/);
  assert.equal(availabilityRecordIsCurrent(failure, resetAtMs + 1), false);
});

test('generic failures expire and a successful run clears them early', () => {
  const now = 1_000_000;
  const records = recordAvailabilityFailure(
    [], 'runner-b', 'model-1', { reason: 'authentication failure' }, now,
  );
  assert.ok(findAvailabilityFailure(records, 'runner-b', 'model-1', now + 1));
  assert.equal(findAvailabilityFailure(records, 'runner-b', 'model-1', now + 4 * 60 * 60_000 + 1), null);
  assert.deepEqual(clearAvailabilityFailure(records, 'runner-b', 'model-1'), []);
});

test('an interrupted stream never quarantines a model', () => {
  const now = 1_000_000;
  const records = recordAvailabilityFailure([], 'runner-a', 'deep', {
    reason: 'Connection closed mid-response. The response above may be incomplete.',
  }, now, aliases);
  assert.equal(findAvailabilityFailure(records, 'runner-a', 'deep', now + 1, aliases), null);
  assert.deepEqual(
    filterAvailableModels(records, 'runner-a', ['fast', 'deep'], now + 1, aliases),
    ['fast', 'deep'],
  );
});

test('new observations replace one alias-family record without unbounded growth', () => {
  const first = recordAvailabilityFailure(
    [], 'runner-a', 'fast', { reason: 'usage limit' }, 1_000, aliases,
  );
  const replaced = recordAvailabilityFailure(
    first,
    'runner-a',
    'fast-v2',
    { reason: 'usage limit', retryDate: '2026-07-15' },
    2_000,
    aliases,
  );
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].model, 'fast-v2');
});
