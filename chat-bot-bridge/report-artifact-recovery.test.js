import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  captureReportDraftSnapshot,
  isCompletedReportDraft,
  recoverableReportDrafts,
} from './report-artifact-recovery.js';

function completeDraft() {
  return [
    '# Desk Run — Today',
    '## Action — what to do now',
    'A complete fictional decision with dated evidence and sizing.',
    '## Recommendations',
    'Detailed fictional evidence. '.repeat(350),
    '## Sources',
    '- Fictional fixture.',
    '<!-- lang:zh -->',
    '## Action',
    '中文示例。',
  ].join('\n\n');
}

function scaffoldDraft() {
  return [
    '# Desk Run — Today', '## Action', '<Decision-first: lead with the recommendation>',
    '## Recommendations', '<TICKER> <The one-line bottom line>', '## Sources',
    '<!-- lang:zh -->', 'x'.repeat(8_000),
  ].join('\n');
}

test('recognizes a completed public report draft but rejects its scaffold', () => {
  assert.equal(isCompletedReportDraft(completeDraft()), true);
  assert.equal(isCompletedReportDraft(scaffoldDraft()), false);
});

test('selects only completed Markdown changed during this run', () => {
  const reports = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-draft-'));
  const before = captureReportDraftSnapshot(reports);
  const start = Date.now();
  const root = path.join(reports, '.build', 'example-week');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'report_complete.md'), completeDraft());
  fs.writeFileSync(path.join(root, 'report_scaffold.md'), scaffoldDraft());

  assert.deepEqual(
    recoverableReportDrafts(reports, before, start).map((draft) => path.basename(draft.realPath)),
    ['report_complete.md'],
  );
  fs.rmSync(reports, { recursive: true, force: true });
});
