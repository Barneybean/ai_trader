import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildScheduledPrompt,
  isDuplicateScheduledRun,
  localCalendarDay,
  scheduledLabel,
} from './scheduled-task.js';

test('scheduled runs are idempotent per kind and calendar day', () => {
  assert.equal(isDuplicateScheduledRun(null, '2026-07-13', { kind: 'postmarket' }), false);
  assert.equal(isDuplicateScheduledRun('2026-07-13', '2026-07-13', { kind: 'postmarket' }), true);
  assert.equal(isDuplicateScheduledRun('2026-07-13', '2026-07-14', { kind: 'postmarket' }), false);
  assert.equal(isDuplicateScheduledRun('2026-07-13', '2026-07-13', {
    kind: 'postmarket', force: true,
  }), false);
  assert.equal(isDuplicateScheduledRun('2026-07-13', '2026-07-13', { kind: 'test' }), false);
  assert.equal(localCalendarDay(new Date(2026, 6, 13, 23, 59)), '2026-07-13');
});

test('builds decision-grade premarket prompt with active mode', () => {
  const prompt = buildScheduledPrompt('premarket', 'semi', new Date('2026-07-13T12:45:00Z'));
  assert.match(prompt, /PRE-MARKET complete daily report/);
  assert.match(prompt, /SEMI-AUTO/);
  assert.match(prompt, /bilingual HTML report/);
  assert.match(prompt, /bridge attaches every finished report HTML automatically/);
  assert.match(prompt, /distinct scheduled report run/);
  assert.doesNotMatch(prompt, /FILE:/);
  assert.match(prompt, /MANDATORY SCHEDULED-REPORT BROKER PREFLIGHT/);
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
