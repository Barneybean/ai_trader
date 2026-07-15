import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { buildChangeReview, captureWorkspaceSnapshot, parseChangeReason } from '../../src/delivery/change-review.js';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'change-review-'));
  spawnSync('git', ['init', '-q'], { cwd: root });
  fs.writeFileSync(path.join(root, 'app.js'), 'export const value = 1;\n');
  fs.writeFileSync(path.join(root, '.env'), 'API_KEY=private\n');
  spawnSync('git', ['add', 'app.js'], { cwd: root });
  return root;
}

test('builds a mobile HTML review only for files changed during the interaction', () => {
  const root = fixture();
  const snapshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'change-snapshots-'));
  const snapshot = captureWorkspaceSnapshot(root, snapshotRoot, new Date('2026-07-12T12:00:00Z'));
  fs.writeFileSync(path.join(root, 'app.js'), 'export const value = 2;\n');
  fs.writeFileSync(path.join(root, 'app.test.js'), 'test("value", () => {});\n');
  fs.writeFileSync(path.join(root, '.env'), 'API_KEY=changed-private\n');
  const outputDir = path.join(root, 'chat-bot-bridge', 'logs', 'change-reviews');
  const report = buildChangeReview({
    root, snapshotDir: snapshot, outputDir, request: 'Change the value',
    outcome: 'Done', reason: { summary: 'Updates the value.', files: { 'app.js': 'Implements the new value.' } },
    now: new Date('2026-07-12T12:05:00Z'),
  });
  assert.equal(report.count, 2);
  assert.equal(path.dirname(report.path), outputDir);
  const html = fs.readFileSync(report.path, 'utf8');
  assert.match(html, /app\.js/);
  assert.match(html, /app\.test\.js/);
  assert.match(html, /Implements the new value/);
  assert.match(html, /class="add"/);
  assert.doesNotMatch(html, /changed-private|API_KEY/);
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(snapshotRoot, { recursive: true, force: true });
});

test('parses and strips concise rationale metadata', () => {
  const parsed = parseChangeReason('Fixed.\nCHANGE_REASON: {"summary":"Why","files":[{"path":"app.js","reason":"Needed"}]}');
  assert.equal(parsed.text, 'Fixed.');
  assert.deepEqual(parsed.changeReason, { summary: 'Why', files: { 'app.js': 'Needed' } });
  assert.equal(parseChangeReason('Done.\nCHANGE_REASON: malformed').text, 'Done.');
});
