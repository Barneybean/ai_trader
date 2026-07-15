import test from 'node:test';
import assert from 'node:assert/strict';
import { forbiddenSendPath, sanitizeChangeReviewText, sanitizePhoneText } from '../../src/delivery/phone-output.js';

const DESK = '/workspace/toolbox';
const BRIDGE = `${DESK}/chat-bot-bridge`;

test('FILE guard blocks secrets and path escapes but permits a report', () => {
  assert.equal(forbiddenSendPath(`${DESK}/reports/report_today.html`, DESK, BRIDGE), false);
  assert.equal(forbiddenSendPath(`${DESK}/config.local.toml`, DESK, BRIDGE), true);
  assert.equal(forbiddenSendPath(`${DESK}/scripts/ops/denylist.local.txt`, DESK, BRIDGE), true);
  assert.equal(forbiddenSendPath(`${BRIDGE}/.env`, DESK, BRIDGE), true);
  assert.equal(forbiddenSendPath(`${DESK}/reports/.build/draft.html`, DESK, BRIDGE), true);
  assert.equal(forbiddenSendPath('/outside/secret.txt', DESK, BRIDGE), true);
  assert.equal(forbiddenSendPath(null, DESK, BRIDGE), true);
});

test('converts common markdown constructs to plain text', () => {
  const input = '# Verdict\n\n- **WAIT** at [current levels](https://example.com)\n```\nsecret block\n```\n| A | B |\n|---|---|\n| 1 | 2 |';
  const { text } = sanitizePhoneText(input);
  assert.equal(text, 'Verdict\n\nWAIT at current levels\nsecret block\nA · B\n1 · 2');
  assert.doesNotMatch(text, /[#*`|]|https?:\/\//);
});

test('redacts account identifiers, account dollar values, and credentials', () => {
  const input = 'Account ending in **1234**\nJoint account: $50k\nBuying power: $12,345.67\nP&L USD 240\nAPI_KEY=topsecret';
  const { text, redactions } = sanitizePhoneText(input);
  assert.ok(redactions >= 5);
  assert.doesNotMatch(text, /1234|50k|12,345|240|topsecret/);
  assert.match(text, /private account value/);
});

test('preserves market prices and an order-ticket limit', () => {
  const input = 'NVDA is $180.\n1. Ticket 1: BUY NVDA qty 2, limit $175, day session for the configured execution account.';
  const { text, redactions } = sanitizePhoneText(input);
  assert.equal(redactions, 0);
  assert.match(text, /\$180/);
  assert.match(text, /^1\. Ticket/m);
  assert.match(text, /limit \$175/);
});

test('redacts aggregate account dollars while preserving percentages and price levels', () => {
  const input = [
    'Book unrealized gain $52.60 (+4.9%); closing value $2,037.51.',
    'EXAMPLE exit filled $45.90; loss harvested $18. Cash now 45% ($916; $686 settled).',
    'EXAMPLE 3 shares at an average price $42.10.',
  ].join('\n');
  const { text } = sanitizePhoneText(input, { maxChars: 4000 });
  assert.doesNotMatch(text, /\$52\.60|\$2,037\.51|\$18\b|\$916|\$686/);
  assert.match(text, /\+4\.9%/);
  assert.match(text, /45%/);
  assert.match(text, /filled \$45\.90/);
  assert.match(text, /average price \$42\.10/);
});

test('redacts structured credentials and account identifiers in code reviews', () => {
  const input = '{"api_key":"topsecret","account_id":"12345678"}';
  const { text, redactions } = sanitizeChangeReviewText(input);
  assert.ok(redactions >= 2);
  assert.doesNotMatch(text, /topsecret|12345678/);
});

test('enforces final-reply line and character limits with a disclosure', () => {
  const input = Array.from({ length: 8 }, (_, i) => `Line ${i + 1} ${'x'.repeat(400)}`).join('\n');
  const result = sanitizePhoneText(input, { maxLines: 5, maxChars: 500 });
  assert.ok(result.shortened);
  assert.ok(result.text.length <= 500);
  assert.ok(result.text.endsWith('Details on request.'));
  assert.ok(result.text.split('\n').filter(Boolean).length <= 5);
});
