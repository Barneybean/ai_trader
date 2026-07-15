// Report-domain artifact detection and delivery, independent of final wording.

import fs from 'fs';
import path from 'path';

const MAX_REPORT_BYTES = 45 * 1024 * 1024;
const REPORT_GRACE_MS = 2_000;

function normalizedRelative(root, filePath) {
  const relative = path.relative(root, filePath).split(path.sep).join('/');
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) return null;
  if (relative.split('/').some((part) => part.startsWith('.'))) return null;
  return relative;
}

function canonicalPath(filePath) {
  try { return fs.realpathSync(filePath); }
  catch { return path.resolve(filePath); }
}

function listHtmlReports(root, current = root, found = []) {
  let entries = [];
  try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return found; }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const filePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      // The organizer mirrors finished reports into archive; never send both copies.
      if (entry.name === 'archive') continue;
      listHtmlReports(root, filePath, found);
      continue;
    }
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.html') continue;
    const relative = normalizedRelative(root, filePath);
    if (!relative) continue;
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > 0 && stat.size <= MAX_REPORT_BYTES) {
        found.push({ path: filePath, relative, mtimeMs: stat.mtimeMs, size: stat.size });
      }
    } catch { /* a disappearing artifact is not a delivery error */ }
  }
  return found;
}

export function captureReportSnapshot(reportsDir) {
  return Object.fromEntries(listHtmlReports(reportsDir).map((item) => [item.relative, {
    mtimeMs: item.mtimeMs,
    size: item.size,
  }]));
}

function safeReportFile(reportsDir, candidate) {
  try {
    const realRoot = fs.realpathSync(reportsDir);
    const stat = fs.lstatSync(candidate.path);
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_REPORT_BYTES) return null;
    const realPath = fs.realpathSync(candidate.path);
    if (realPath !== realRoot && !realPath.startsWith(realRoot + path.sep)) return null;
    const body = fs.readFileSync(realPath, 'utf8');
    if (!/<html(?:\s|>)/i.test(body) || !/<\/html>\s*$/i.test(body)) return null;
    return realPath;
  } catch { return null; }
}

export function generatedHtmlReports(reportsDir, before = {}, runStartedMs = Date.now()) {
  const earliest = Number(runStartedMs) - REPORT_GRACE_MS;
  return listHtmlReports(reportsDir)
    .filter((item) => {
      const prior = before[item.relative];
      const changed = !prior || prior.mtimeMs !== item.mtimeMs || prior.size !== item.size;
      return changed && item.mtimeMs >= earliest;
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs || left.relative.localeCompare(right.relative))
    .map((item) => safeReportFile(reportsDir, item))
    .filter(Boolean);
}

export function reportFilesToDeliver(explicitFiles = [], generatedFiles = []) {
  const seen = new Set();
  return [...explicitFiles, ...generatedFiles].filter((filePath) => {
    const key = canonicalPath(filePath);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function deliverReportArtifacts({
  reportsDir,
  before = {},
  runStartedMs,
  explicitFiles = [],
  sendFile = null,
} = {}) {
  const generatedFiles = generatedHtmlReports(reportsDir, before, runStartedMs);
  const generated = new Set(generatedFiles.map(canonicalPath));
  const files = reportFilesToDeliver(explicitFiles, generatedFiles);
  const outcomes = [];
  for (const filePath of files) {
    const automaticReport = generated.has(canonicalPath(filePath));
    const caption = automaticReport ? 'Desk report' : path.basename(filePath);
    if (typeof sendFile !== 'function') {
      outcomes.push({ filePath, automaticReport, caption, status: 'unsupported' });
      continue;
    }
    try {
      const sent = await sendFile(filePath, caption);
      outcomes.push({ filePath, automaticReport, caption, status: sent ? 'sent' : 'failed' });
    } catch (error) {
      outcomes.push({
        filePath,
        automaticReport,
        caption,
        status: 'failed',
        error: error?.message || String(error),
      });
    }
  }
  return {
    discoveredReports: generatedFiles.length,
    delivered: outcomes.filter((item) => item.status === 'sent').length,
    outcomes,
  };
}
