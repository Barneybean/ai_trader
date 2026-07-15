import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  createRunTranscript,
  decisionContinuation,
  formatDecisionForPhone,
  parseDecisionRequest,
  toolEventLine,
} from '../../src/delivery/run-telemetry.js';

test('builds a private terminal-like transcript with redaction', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-run-'));
  const run = createRunTranscript(dir, 'fix the bridge', new Date('2026-07-12T10:00:00Z'));
  run.append('CODEX RUN', 'Bash — API_KEY=topsecret');
  const text = fs.readFileSync(run.path, 'utf8');
  assert.match(text, /Agent execution transcript/);
  assert.match(text, /CODEX RUN/);
  assert.doesNotMatch(text, /topsecret/);
  assert.equal(fs.statSync(run.path).mode & 0o777, 0o600);
  fs.rmSync(dir, { recursive: true });
});

test('formats tool lifecycle events readably', () => {
  assert.deepEqual(toolEventLine({ agent: 'codex', phase: 'started', tool: 'Bash', summary: 'git status' }),
    { kind: 'CODEX RUN', text: 'Bash — git status' });
  assert.equal(toolEventLine({ agent: 'claude', phase: 'completed', ok: false, tool: 'MCP' }).kind, 'CLAUDE FAIL');
});

test('extracts a structured decision and strips its control line', () => {
  const reply = 'Work paused.\nPHONE_DECISION: {"question":"Deploy now?","options":["Deploy","Wait"],"context":"Tests passed"}';
  const parsed = parseDecisionRequest(reply);
  assert.equal(parsed.text, 'Work paused.');
  assert.deepEqual(parsed.decision.options, ['Deploy', 'Wait']);
  assert.match(formatDecisionForPhone(parsed.decision), /Reply 1-2, \/decide N/);
  assert.match(decisionContinuation(parsed.decision, '1'), /User answer: 1/);
});

test('ignores malformed or one-option decision markers', () => {
  assert.equal(parseDecisionRequest('PHONE_DECISION: nope').decision, null);
  assert.equal(parseDecisionRequest('PHONE_DECISION: {"question":"Q","options":["only"]}').decision, null);
});
