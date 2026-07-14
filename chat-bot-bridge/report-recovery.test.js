import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReportRecoveryPrompt,
  hitToolCallLimit,
  isBrokerWriteTool,
  isReportRequest,
  reportRecoverySafetyInstructions,
  shouldRecoverReportRun,
} from './report-recovery.js';

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

test('recovers only an unfinished report that hit the tool-call limit', () => {
  assert.equal(hitToolCallLimit(capped), true);
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

test('recovery prompt is fresh, report-only, and clamps its tool budget', () => {
  const prompt = buildReportRecoveryPrompt({
    originalPrompt: 'Run a post market report', maxToolCalls: 500, scheduledKind: 'postmarket',
  });
  assert.match(prompt, /fresh session/i);
  assert.match(prompt, /at most 48 tool calls/i);
  assert.match(prompt, /Do not place, cancel, replace/i);
  assert.match(prompt, /read-only broker capability preflight/i);
  assert.match(prompt, /Run a post market report/);
});

test('safety gate blocks provider-neutral broker writes but permits reads', () => {
  assert.equal(isBrokerWriteTool('broker.place_equity_order'), true);
  assert.equal(isBrokerWriteTool('mcp__broker__cancel_order'), true);
  assert.equal(isBrokerWriteTool('broker.get_accounts'), false);
  assert.match(reportRecoverySafetyInstructions(), /Override any autonomous execution instruction/i);
});
