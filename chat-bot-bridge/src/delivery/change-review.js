// Delivery-domain workspace snapshots and mobile-friendly code-change reviews.
// Runtime snapshots and finished HTML live under ignored bridge logs. Reviews
// are operational artifacts, not investment reports, and contain only
// privacy-sanitized source diffs.

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { sanitizeChangeReviewText } from './phone-output.js';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_CHANGED_FILES = 60;
const MAX_DIFF_BYTES = 500 * 1024;
const SNAPSHOT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const ALLOWED_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.sh', '.md', '.json', '.toml',
  '.yaml', '.yml', '.html', '.css', '.scss', '.sql', '.plist', '.xml', '.txt', '.gitignore',
]);
const EXCLUDED_PREFIXES = [
  '.git/', 'node_modules/', 'reports/', 'journal/', 'logs/', 'chat-bot-bridge/logs/',
  'skills/private/', '__pycache__/',
];
const SENSITIVE_PATH_RE = /(?:^|\/)(?:\.env(?:\.|$)|state\.json$|config\.local(?:\.|$)|secrets?(?:\.|$)|credentials?(?:\.|$))/i;

function safeRelative(value) {
  const rel = String(value || '').replaceAll('\\', '/').replace(/^\.\//, '');
  if (!rel || rel.startsWith('/') || rel.split('/').includes('..')) return null;
  return rel;
}

function reviewablePath(value) {
  const rel = safeRelative(value);
  if (!rel || EXCLUDED_PREFIXES.some((prefix) => rel.startsWith(prefix)) || SENSITIVE_PATH_RE.test(rel)) return false;
  const base = path.posix.basename(rel);
  if (base === 'Dockerfile' || base === 'Makefile' || base === 'AGENTS.md' || base === 'SKILL.md') return true;
  return ALLOWED_EXTENSIONS.has(path.posix.extname(rel).toLowerCase()) || base === '.gitignore';
}

function workspaceFiles(root) {
  const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root, encoding: 'utf8', maxBuffer: 12 * 1024 * 1024,
  });
  if (result.status !== 0) return [];
  return result.stdout.split('\0').map(safeRelative).filter((rel) => rel && reviewablePath(rel));
}

function readableFile(root, rel) {
  const absolute = path.join(root, rel);
  try {
    const stat = fs.lstatSync(absolute);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return null;
    const content = fs.readFileSync(absolute);
    if (content.includes(0)) return null;
    return content;
  } catch { return null; }
}

function writePrivate(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, content, { mode: 0o600 });
}

export function captureWorkspaceSnapshot(root, snapshotRoot, now = new Date()) {
  try {
    for (const entry of fs.readdirSync(snapshotRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(snapshotRoot, entry.name);
      if (now.getTime() - fs.statSync(candidate).mtimeMs > SNAPSHOT_RETENTION_MS) {
        fs.rmSync(candidate, { recursive: true, force: true });
      }
    }
  } catch { /* first run or cleanup failure must not block a snapshot */ }
  const id = `${now.toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}`;
  const dir = path.join(snapshotRoot, id);
  const files = [];
  for (const rel of workspaceFiles(root)) {
    const content = readableFile(root, rel);
    if (content === null) continue;
    writePrivate(path.join(dir, 'before', rel), content);
    files.push(rel);
  }
  writePrivate(path.join(dir, 'manifest.json'), JSON.stringify({ createdAt: now.toISOString(), files }, null, 2));
  return dir;
}

function loadManifest(snapshotDir) {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'manifest.json'), 'utf8'));
    return Array.isArray(value.files) ? value.files.filter(reviewablePath) : [];
  } catch { return []; }
}

function changedWorkspaceFiles(root, snapshotDir) {
  const before = new Set(loadManifest(snapshotDir));
  const after = new Set(workspaceFiles(root));
  const candidates = [...new Set([...before, ...after])].sort();
  const changed = [];
  for (const rel of candidates) {
    const oldPath = path.join(snapshotDir, 'before', rel);
    const oldContent = fs.existsSync(oldPath) ? fs.readFileSync(oldPath) : null;
    const newContent = after.has(rel) ? readableFile(root, rel) : null;
    if (oldContent?.equals(newContent || Buffer.alloc(0)) && newContent !== null) continue;
    if (oldContent === null && newContent === null) continue;
    changed.push({ rel, oldContent, newContent });
  }
  return changed.slice(0, MAX_CHANGED_FILES);
}

function unifiedDiff(snapshotDir, item) {
  const oldPath = path.join(snapshotDir, 'before', item.rel);
  const newPath = path.join(snapshotDir, 'after', item.rel);
  if (item.oldContent === null) writePrivate(oldPath, '');
  if (item.newContent === null) writePrivate(newPath, '');
  else writePrivate(newPath, item.newContent);
  const result = spawnSync('diff', [
    '-u', '--label', `a/${item.rel}`, '--label', `b/${item.rel}`, oldPath, newPath,
  ], { encoding: 'utf8', maxBuffer: MAX_DIFF_BYTES + 64 * 1024 });
  const raw = String(result.stdout || '').slice(0, MAX_DIFF_BYTES);
  return sanitizeChangeReviewText(raw).text;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function diffHtml(diff) {
  return String(diff || '').split('\n').map((line) => {
    const cls = line.startsWith('+++') || line.startsWith('---') ? 'meta'
      : line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del'
        : line.startsWith('@@') ? 'hunk' : 'ctx';
    return `<span class="${cls}">${escapeHtml(line || ' ')}</span>`;
  }).join('\n');
}

function defaultReason(rel, summary, request) {
  if (/\.test\.[cm]?js$|_test\.py$|\/tests?\//i.test(rel)) return 'Adds regression coverage for the requested behavior.';
  if (rel.startsWith('docs/') || rel.endsWith('.md')) return 'Keeps documentation aligned with the implemented behavior.';
  if (/package\.json$|\.toml$|\.ya?ml$/i.test(rel)) return 'Updates configuration needed by the feature.';
  return summary || `Implements the request: ${String(request || '').replace(/\s+/g, ' ').slice(0, 180)}`;
}

export function parseChangeReason(reply) {
  const lines = String(reply || '').split('\n');
  let changeReason = null;
  const kept = [];
  for (const line of lines) {
    if (!/^\s*CHANGE_REASON:/i.test(line)) { kept.push(line); continue; }
    const match = line.match(/^\s*CHANGE_REASON:\s*(\{.*\})\s*$/i);
    if (!match || changeReason) continue;
    try {
      const value = JSON.parse(match[1]);
      const summary = String(value.summary || '').trim().slice(0, 600);
      const files = {};
      for (const item of Array.isArray(value.files) ? value.files.slice(0, MAX_CHANGED_FILES) : []) {
        const rel = safeRelative(item?.path);
        const reason = String(item?.reason || '').trim().slice(0, 600);
        if (rel && reason && reviewablePath(rel)) files[rel] = reason;
      }
      changeReason = { summary, files };
    } catch { /* internal metadata never belongs in the phone reply */ }
  }
  return { text: kept.join('\n').trim(), changeReason };
}

export function buildChangeReview({ root, snapshotDir, outputDir, request, outcome, reason = {}, now = new Date() }) {
  if (!snapshotDir || !fs.existsSync(snapshotDir)) return null;
  const changes = changedWorkspaceFiles(root, snapshotDir);
  if (!changes.length) { fs.rmSync(snapshotDir, { recursive: true, force: true }); return null; }
  const safeRequest = sanitizeChangeReviewText(request).text.slice(0, 1200);
  const safeOutcome = sanitizeChangeReviewText(outcome).text.slice(0, 1800);
  const safeSummary = sanitizeChangeReviewText(reason.summary || '').text.slice(0, 600);
  const fileCards = changes.map((item) => {
    const diff = unifiedDiff(snapshotDir, item);
    const supplied = reason.files?.[item.rel] || '';
    const why = sanitizeChangeReviewText(supplied || defaultReason(item.rel, safeSummary, safeRequest)).text;
    const status = item.oldContent === null ? 'Added' : item.newContent === null ? 'Deleted' : 'Modified';
    return `<details open><summary><span>${escapeHtml(item.rel)}</span><em>${status}</em></summary>`
      + `<p class="why"><b>Why</b> ${escapeHtml(why)}</p><pre>${diffHtml(diff)}</pre></details>`;
  }).join('\n');
  const title = `Code change review · ${now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<title>${escapeHtml(title)}</title><style>`
    + `:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#111;color:#eee;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}`
    + `main{max-width:980px;margin:auto;padding:22px 14px 60px}h1{font-size:25px;margin:0 0 6px}.sub{color:#aaa;margin:0 0 22px}`
    + `.card,details{background:#1b1b1d;border:1px solid #343438;border-radius:14px;margin:12px 0;overflow:hidden}.card{padding:14px 16px}.label{color:#9aa0a6;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.card p{margin:4px 0 12px}`
    + `summary{display:flex;justify-content:space-between;gap:12px;padding:14px 16px;cursor:pointer;font-weight:650}summary em{color:#8ab4f8;font-size:13px;font-style:normal}.why{padding:0 16px 12px;margin:0;color:#d6d6d6}.why b{color:#f5c26b;margin-right:6px}`
    + `pre{margin:0;padding:12px 0 18px;overflow:auto;background:#0c0d0e;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}.ctx,.add,.del,.hunk,.meta{display:block;padding:0 14px;white-space:pre}.add{background:#12351f;color:#b7f7c5}.del{background:#421b20;color:#ffc1c7}.hunk{color:#8ab4f8}.meta{color:#aaa}`
    + `@media(max-width:600px){h1{font-size:22px}summary{font-size:14px}pre{font-size:11px}.ctx,.add,.del,.hunk,.meta{padding:0 10px}}`
    + `</style></head><body><main><h1>${escapeHtml(title)}</h1><p class="sub">${changes.length} file${changes.length === 1 ? '' : 's'} changed in this interaction</p>`
    + `<section class="card"><div class="label">Request</div><p>${escapeHtml(safeRequest)}</p><div class="label">Outcome and rationale</div><p>${escapeHtml(safeSummary || safeOutcome || 'Changes completed.')}</p></section>`
    + fileCards + `</main></body></html>`;
  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `change-review_${stamp}.html`);
  fs.writeFileSync(outputPath, html, { mode: 0o600 });
  fs.rmSync(snapshotDir, { recursive: true, force: true });
  return { path: outputPath, files: changes.map((item) => item.rel), count: changes.length };
}

export function discardChangeSnapshot(snapshotDir) {
  if (snapshotDir) fs.rmSync(snapshotDir, { recursive: true, force: true });
}
