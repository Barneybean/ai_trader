// Delivery-domain run telemetry and transcript formatting.
import fs from 'fs';
import path from 'path';
import { sanitizeExecutionLogText } from './phone-output.js';

function slug(value) {
  return String(value || 'run').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'run';
}

export function createRunTranscript(logDir, prompt, now = new Date()) {
  fs.mkdirSync(logDir, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(logDir, `${stamp}-${slug(prompt)}.txt`);
  const startedMs = now.getTime();
  fs.writeFileSync(filePath, `Agent execution transcript\nStarted: ${now.toISOString()}\nRequest: ${sanitizeExecutionLogText(prompt, 800).text}\n\n`, { mode: 0o600 });
  return {
    path: filePath,
    append(kind, detail = '') {
      const elapsed = Math.max(0, Math.round((Date.now() - startedMs) / 1000));
      const safe = sanitizeExecutionLogText(detail, 4000);
      fs.appendFileSync(filePath, `[+${elapsed}s] ${String(kind).toUpperCase()}${safe.text ? `  ${safe.text}` : ''}\n`);
      return safe;
    },
  };
}

export function toolEventLine(detail = {}) {
  const phase = detail.phase === 'completed' ? (detail.ok === false ? 'FAIL' : 'DONE') : 'RUN';
  const agent = String(detail.agent || 'agent').toUpperCase();
  const tool = String(detail.tool || detail.kind || 'tool');
  const summary = String(detail.summary || '').replace(/\s+/g, ' ').trim().slice(0, 900);
  return { kind: `${agent} ${phase}`, text: `${tool}${summary ? ` — ${summary}` : ''}` };
}

export function parseDecisionRequest(reply) {
  const source = String(reply || '');
  const lines = source.split('\n');
  let decision = null;
  const kept = [];
  for (const line of lines) {
    const match = line.match(/^\s*PHONE_DECISION:\s*(\{.*\})\s*$/);
    if (!match || decision) { kept.push(line); continue; }
    try {
      const value = JSON.parse(match[1]);
      const question = String(value.question || '').trim();
      const options = Array.isArray(value.options)
        ? value.options.map((item) => String(item).trim()).filter(Boolean).slice(0, 5) : [];
      if (!question || options.length < 2) { kept.push(line); continue; }
      decision = { question: question.slice(0, 1200), options, context: String(value.context || '').trim().slice(0, 1200) };
    } catch { kept.push(line); }
  }
  return { text: kept.join('\n').trim(), decision };
}

export function formatDecisionForPhone(decision) {
  const options = decision.options.map((value, index) => `${index + 1}. ${value}`).join('\n');
  return `Decision needed\n\n${decision.question}\n\n${options}\n\nReply 1-${decision.options.length}, /decide N, or describe your choice after /decide.`;
}

export function decisionContinuation(decision, answer) {
  return [
    'The user has answered the pending phone decision. Continue the prior task from the paused decision point; do not restart completed work.',
    `Pending question: ${decision.question}`,
    `Options: ${decision.options.map((value, index) => `${index + 1}=${value}`).join('; ')}`,
    decision.context ? `Context: ${decision.context}` : '',
    `User answer: ${answer}`,
  ].filter(Boolean).join('\n');
}
