import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildScheduledPrompt,
  isDuplicateScheduledRun,
  scheduledLabel,
} from '../../src/runtime/scheduled-task.js';

test('scheduled runs debounce only near-simultaneous double-fires', () => {
  const now = Date.parse('2026-07-13T20:00:00Z');
  assert.equal(isDuplicateScheduledRun(null, now, { kind: 'postmarket' }), false);
  assert.equal(isDuplicateScheduledRun('2026-07-13T19:59:00Z', now, { kind: 'postmarket' }), true);
  assert.equal(isDuplicateScheduledRun('2026-07-13T19:50:00Z', now, { kind: 'postmarket' }), false);
  assert.equal(isDuplicateScheduledRun('2026-07-13T19:59:00Z', now, {
    kind: 'postmarket', force: true,
  }), false);
  assert.equal(isDuplicateScheduledRun('2026-07-13T19:59:00Z', now, { kind: 'test' }), false);
  assert.equal(isDuplicateScheduledRun('not-a-date', now, { kind: 'postmarket' }), false);
});

test('builds decision-grade premarket prompt with active mode', () => {
  const prompt = buildScheduledPrompt('premarket', 'semi', new Date('2026-07-13T12:45:00Z'));
  assert.match(prompt, /PRE-MARKET complete daily report/);
  assert.match(prompt, /SEMI-AUTO/);
  assert.match(prompt, /bilingual HTML report/);
  assert.match(prompt, /bridge attaches every finished report HTML automatically/);
  assert.match(prompt, /distinct scheduled report run/);
  assert.match(prompt, /-rerun-HHMMSS/);
  assert.match(prompt, /without --force/);
  assert.doesNotMatch(prompt, /FILE:/);
  assert.match(prompt, /MANDATORY SCHEDULED-REPORT BROKER PREFLIGHT/);
  assert.match(prompt, /get_accounts exactly once/);
  assert.match(prompt, /Do not poll, retry, re-read/i);
  assert.match(prompt, /Mon, Jul 13, 2026 PT/);
});

test('builds a decision-grade midmarket update tied to the morning plan', () => {
  const prompt = buildScheduledPrompt('midmarket', 'semi', new Date('2026-07-14T16:30:00Z'));
  assert.match(prompt, /MID-MARKET intraday update/);
  assert.match(prompt, /NOT a from-scratch re-underwrite/);
  assert.match(prompt, /recall today's pre-market report/);
  assert.match(prompt, /SEMI-AUTO/);
  assert.match(prompt, /bilingual HTML report/);
  assert.equal(scheduledLabel('midmarket'), 'Mid-market');
});

test('keeps plumbing test cheap and validates kinds', () => {
  assert.equal(buildScheduledPrompt('test', 'manual'), 'This is a scheduled-run plumbing test. Reply with exactly: scheduled-run test ok');
  assert.equal(scheduledLabel('postmarket'), 'Post-market');
  assert.throws(() => buildScheduledPrompt('unknown', 'manual'), /unknown scheduled kind/);
});

test('full scheduled mode remains validate-only', () => {
  const prompt = buildScheduledPrompt('postmarket', 'full', new Date('2026-07-13T20:00:00Z'));
  assert.match(prompt, /FULL SHADOW/);
  assert.match(prompt, /Never place an order/);
  assert.doesNotMatch(prompt, /execute playbook-compliant tickets/);
});
