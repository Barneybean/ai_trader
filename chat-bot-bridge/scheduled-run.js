#!/usr/bin/env node
/**
 * Thin launchd submitter. The always-on bridge owns serialization, messenger
 * delivery, session state, transcripts, and automatic model fallback.
 */

import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { SCHEDULE_KINDS } from './src/runtime/scheduled-task.js';

const BRIDGE_DIR = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.join(BRIDGE_DIR, 'logs', 'scheduler-token');

for (const line of (() => {
  try { return fs.readFileSync(path.join(BRIDGE_DIR, '.env'), 'utf8').split('\n'); }
  catch { return []; }
})()) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
}

const PORT = Number(process.env.PORT || 3000);

function submit(kind) {
  return new Promise((resolve, reject) => {
    let token;
    try { token = fs.readFileSync(TOKEN_FILE, 'utf8').trim(); }
    catch { return reject(new Error('bridge scheduler token is unavailable; confirm the phone bridge is running')); }
    const body = JSON.stringify({ kind, force: process.env.FORCE_RUN === '1' });
    const request = http.request({
      hostname: '127.0.0.1', port: PORT, path: '/internal/scheduled', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Scheduler-Token': token,
      },
      timeout: 15_000,
    }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        if (response.statusCode !== 202) return reject(new Error(`bridge rejected scheduled run (${response.statusCode}): ${raw.slice(0, 500)}`));
        resolve(raw.trim());
      });
    });
    request.on('timeout', () => request.destroy(new Error('bridge submission timed out')));
    request.on('error', reject);
    request.end(body);
  });
}

async function main() {
  const kind = process.argv[2];
  if (!SCHEDULE_KINDS.includes(kind)) throw new Error('usage: scheduled-run.js premarket|midmarket|postmarket|test');
  const dow = new Date().getDay();
  if (kind !== 'test' && process.env.FORCE_RUN !== '1' && (dow === 0 || dow === 6)) {
    console.log(`${new Date().toISOString()} weekend — skipping`);
    return;
  }
  const result = await submit(kind);
  console.log(`${new Date().toISOString()} ${result || `${kind} accepted by bridge`}`);
}

main().catch((error) => {
  console.error(`${new Date().toISOString()} scheduled submission failed: ${error.message}`);
  process.exit(1);
});
