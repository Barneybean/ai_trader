import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  captureReportSnapshot,
  deliverReportArtifacts,
  generatedHtmlReports,
  reportFilesToDeliver,
} from '../../src/reports/report-delivery.js';

function write(filePath, body = '<!doctype html><html><body>Fixture</body></html>') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body);
}

test('finds only completed HTML reports built during the current run', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-report-'));
  write(path.join(root, 'archive', 'example-week', 'old.html'));
  const before = captureReportSnapshot(root);
  const runStartedMs = Date.now();
  write(path.join(root, 'report_today.html'));
  write(path.join(root, 'partial.html'), '<html><body>still building');

  assert.deepEqual(
    generatedHtmlReports(root, before, runStartedMs).map((item) => path.basename(item)),
    ['report_today.html'],
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('includes a rebuilt report but never resends an unchanged report', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-report-'));
  const report = path.join(root, 'report_today.html');
  write(report, '<html>old</html>');
  const before = captureReportSnapshot(root);
  const runStartedMs = Date.now();
  write(report, '<html>new report with materially different content</html>');

  assert.deepEqual(generatedHtmlReports(root, before, runStartedMs), [fs.realpathSync(report)]);
  assert.deepEqual(generatedHtmlReports(root, captureReportSnapshot(root), runStartedMs), []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('deduplicates explicit, automatic, and archived report copies', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-report-'));
  const before = captureReportSnapshot(root);
  const runStartedMs = Date.now();
  const report = path.join(root, 'report_today.html');
  write(report);
  write(path.join(root, 'archive', 'example-week', 'report_today.html'));

  assert.deepEqual(generatedHtmlReports(root, before, runStartedMs), [fs.realpathSync(report)]);
  assert.deepEqual(reportFilesToDeliver([report], [report]), [report]);
  fs.rmSync(root, { recursive: true, force: true });
});

test('automatically attaches a built report and records upload failure', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-report-'));
  const before = captureReportSnapshot(root);
  const runStartedMs = Date.now();
  const report = path.join(root, 'report_today.html');
  write(report);
  const attempts = [];
  const sent = await deliverReportArtifacts({
    reportsDir: root,
    before,
    runStartedMs,
    sendFile: async (filePath, caption) => { attempts.push({ filePath, caption }); return true; },
  });
  assert.equal(sent.delivered, 1);
  assert.deepEqual(attempts, [{ filePath: fs.realpathSync(report), caption: 'Desk report' }]);

  const failed = await deliverReportArtifacts({
    reportsDir: root,
    before,
    runStartedMs,
    explicitFiles: [report],
    sendFile: async () => false,
  });
  assert.equal(failed.outcomes.length, 1);
  assert.equal(failed.outcomes[0].status, 'failed');
  fs.rmSync(root, { recursive: true, force: true });
});
