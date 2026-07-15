// Report-domain repair: a completed Markdown draft can be rendered by
// the local report builder without spending another model turn.

import fs from 'fs';
import path from 'path';

const DRAFT_GRACE_MS = 2_000;
const MAX_DRAFT_BYTES = 12 * 1024 * 1024;

function relativeTo(root, filePath) {
  const relative = path.relative(root, filePath).split(path.sep).join('/');
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) return null;
  return relative;
}

function listDrafts(root, current = path.join(root, '.build'), found = []) {
  let entries = [];
  try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return found; }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const filePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      listDrafts(root, filePath, found);
      continue;
    }
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.md') continue;
    try {
      const stat = fs.statSync(filePath);
      const relative = relativeTo(root, filePath);
      if (relative && stat.size > 0 && stat.size <= MAX_DRAFT_BYTES) {
        found.push({ path: filePath, relative, mtimeMs: stat.mtimeMs, size: stat.size });
      }
    } catch { /* a disappearing draft is not a bridge failure */ }
  }
  return found;
}

function safeDraft(reportsDir, candidate) {
  try {
    const realReports = fs.realpathSync(reportsDir);
    const realBuild = fs.realpathSync(path.join(reportsDir, '.build'));
    const realPath = fs.realpathSync(candidate.path);
    if (!realPath.startsWith(realBuild + path.sep) || !realPath.startsWith(realReports + path.sep)) return null;
    return realPath;
  } catch { return null; }
}

export function captureReportDraftSnapshot(reportsDir) {
  return Object.fromEntries(listDrafts(reportsDir).map((draft) => [draft.relative, {
    mtimeMs: draft.mtimeMs,
    size: draft.size,
  }]));
}

// Reject the long scaffold explicitly. A recovered report must contain the
// public report contract's action, recommendation/detail, source, and bilingual markers.
export function isCompletedReportDraft(markdown) {
  const body = String(markdown || '');
  const hasTitle = /^# Desk Run\b/m.test(body);
  const hasAction = /^## (?:Action|The call)\b/m.test(body);
  const hasDetail = /^## (?:Recommendations|The detail)\b/m.test(body);
  const hasSources = /^## Sources\b/m.test(body);
  const bilingual = body.includes('<!-- lang:zh -->');
  if (body.length < 6_000 || !hasTitle || !hasAction || !hasDetail || !hasSources || !bilingual) return false;
  if (/<(?:one-line dateline|TICKER|Decision-first|The one-line bottom line|Intro block|Optional editorial)/i.test(body)) return false;
  const placeholders = body.match(/<[A-Za-z][^>\n]{0,100}>/g) || [];
  return placeholders.length <= 4;
}

export function recoverableReportDrafts(reportsDir, before = {}, runStartedMs = Date.now()) {
  const earliest = Number(runStartedMs) - DRAFT_GRACE_MS;
  return listDrafts(reportsDir)
    .filter((draft) => {
      const prior = before[draft.relative];
      return (!prior || prior.mtimeMs !== draft.mtimeMs || prior.size !== draft.size)
        && draft.mtimeMs >= earliest;
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs || left.relative.localeCompare(right.relative))
    .map((draft) => ({ ...draft, realPath: safeDraft(reportsDir, draft) }))
    .filter((draft) => draft.realPath)
    .filter((draft) => {
      try { return isCompletedReportDraft(fs.readFileSync(draft.realPath, 'utf8')); }
      catch { return false; }
    });
}
