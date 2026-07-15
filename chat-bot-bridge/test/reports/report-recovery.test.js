import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLoopRecoveryPrompt,
  buildReportRecoveryPrompt,
  hitToolCallLimit,
  isBrokerWriteTool,
  isReportRequest,
  reportRecoverySafetyInstructions,
  shouldRecoverLoopedRun,
  shouldRecoverReportRun,
} from '../../src/reports/report-recovery.js';

const capped = {
  ok: false,
  text: 'Circuit breaker stopped the runner: tool-call limit exceeded (121/120).',
};

test('recognizes manual and scheduled report requests', () => {
  assert.equal(isReportRequest('Run a post market report'), true);
  assert.equal(isReportRequest('Please update the named report'), true);
  assert.equal(isReportRequest('Explain the execution methodology'), false);
  assert.equal(isReportRequest('anything', { scheduledKind: 'postmarket' }), true);
  assert.equal(isReportRequest('anything', { scheduledKind: 'test' }), false);
});

test('recovers only an unfinished report stopped by a tool circuit guard', () => {
  assert.equal(hitToolCallLimit(capped), true);
  assert.equal(hitToolCallLimit({
    ok: false,
    text: 'Circuit breaker stopped the runner: identical tool failure repeated too many times (4/3).',
  }), true);
  assert.equal(hitToolCallLimit({
    ok: false,
    text: 'Circuit breaker stopped the runner: consecutive tool failures without progress (9/8).',
  }), true);
  assert.equal(shouldRecoverReportRun({ result: capped, prompt: 'Run a post market report' }), true);
  assert.equal(shouldRecoverReportRun({
    result: capped, prompt: 'Run a post market report', brokerExecution: true,
  }), false);
  assert.equal(shouldRecoverReportRun({
    result: capped, prompt: 'Run a post market report', alreadyRecovered: true,
  }), false);
  assert.equal(shouldRecoverReportRun({
    result: capped, prompt: 'Run a post market report', reportAlreadyBuilt: true,
  }), false);
  assert.equal(shouldRecoverReportRun({ result: capped, prompt: 'Check a symbol' }), false);
});

test('recovery prompt is fresh, report-only, and permits no second recovery', () => {
  const prompt = buildReportRecoveryPrompt({
    originalPrompt: 'Run a post market report', scheduledKind: 'postmarket',
  });
  assert.match(prompt, /fresh session/i);
  assert.match(prompt, /second recovery is not allowed/i);
  assert.doesNotMatch(prompt, /at most \d+ tool calls/i);
  assert.match(prompt, /Do not place, cancel, replace/i);
  assert.match(prompt, /read-only broker capability preflight/i);
  assert.match(prompt, /Do not repeat broker reads or restart broad web research/i);
  assert.match(prompt, /Run a post market report/);
});

test('recovery reuses an already-verified scheduled broker snapshot', () => {
  const prompt = buildReportRecoveryPrompt({
    originalPrompt: 'Run the scheduled report',
    scheduledKind: 'premarket',
    brokerSnapshotCaptured: true,
  });
  assert.match(prompt, /already completed the read-only broker snapshot/i);
  assert.match(prompt, /Do not call any broker tool again/i);
  assert.doesNotMatch(prompt, /Perform the scheduled run's required read-only broker capability preflight/i);
  assert.match(
    reportRecoverySafetyInstructions({ brokerSnapshotCaptured: true }),
    /Do not call any broker tool again/i,
  );
});

test('a looped non-report conversation recovers once for any agent', () => {
  const looped = {
    ok: false,
    text: 'Circuit breaker stopped the runner: identical tool call repeated too many times (7/6).',
  };
  assert.equal(shouldRecoverLoopedRun({ result: looped, prompt: 'What should I do?' }), true);
  assert.equal(shouldRecoverLoopedRun({ result: looped, prompt: 'Run a post market report' }), false);
  assert.equal(shouldRecoverLoopedRun({ result: looped, prompt: 'What now?', brokerExecution: true }), false);
  assert.equal(shouldRecoverLoopedRun({ result: looped, prompt: 'What now?', alreadyRecovered: true }), false);
  assert.equal(shouldRecoverLoopedRun({ result: { ok: false, text: 'rate limited' }, prompt: 'What now?' }), false);
});

test('loop recovery gets one progress-aware pass and preserves the original message', () => {
  const prompt = buildLoopRecoveryPrompt({ originalPrompt: 'Why change ticket 2?' });
  assert.match(prompt, /looped or stalled on tool calls/i);
  assert.match(prompt, /one recovery pass/i);
  assert.doesNotMatch(prompt, /at most \d+ tool calls/i);
  assert.match(prompt, /do not repeat the call/i);
  assert.match(prompt, /active approval mode/i);
  assert.match(prompt, /Why change ticket 2\?/);
});

test('safety gate blocks provider-neutral broker writes but permits reads', () => {
  assert.equal(isBrokerWriteTool('broker.place_equity_order'), true);
  assert.equal(isBrokerWriteTool('mcp__broker__cancel_order'), true);
  assert.equal(isBrokerWriteTool('broker.get_accounts'), false);
  assert.match(reportRecoverySafetyInstructions(), /Override any autonomous execution instruction/i);
});
