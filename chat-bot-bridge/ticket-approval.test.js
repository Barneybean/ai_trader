import test from 'node:test';
import assert from 'node:assert/strict';
import {
  brokerExecutionFailed,
  brokerExecutionSucceeded,
  buildTrustedBrokerApprovalInstructions,
  extractReportTickets,
  formatExecutionItemsMessage,
  resolveTicketApproval,
} from './ticket-approval.js';

const createdAt = new Date().toISOString();
const report = [
  '1. CANCEL SOFI buy 14, GTC limit $17, regular hours.',
  '2. CANCEL NVDA buy 1, GTC limit $180, all-day hours.',
  '',
  'Reply approve 1, approve 2, or approve all.',
].join('\n');

test('extracts exact numbered report tickets without changing phone text', () => {
  const parsed = extractReportTickets(report);
  assert.equal(parsed.text, report);
  assert.deepEqual(parsed.tickets.map(({ number, action, symbol, quantity, limitPrice }) =>
    ({ number, action, symbol, quantity, limitPrice })), [
    { number: 1, action: 'cancel', symbol: 'SOFI', quantity: 14, limitPrice: 17 },
    { number: 2, action: 'cancel', symbol: 'NVDA', quantity: 1, limitPrice: 180 },
  ]);
});

test('structured ticket markers are stripped and preferred', () => {
  const parsed = extractReportTickets('Ready.\nORDER_TICKET: {"number":1,"action":"buy","symbol":"NKE","quantity":5,"orderType":"limit","limitPrice":40.1,"timeInForce":"GTC","session":"regular hours","description":"BUY 5 NKE limit $40.10 GTC regular hours"}');
  assert.equal(parsed.text, 'Ready.');
  assert.equal(parsed.tickets[0].symbol, 'NKE');
});

test('parses Markdown-formatted TLDR tickets so scheduled reports retain execution items', () => {
  const reply = [
    '**Proposed ticket — SEMI (reply "approve 1"):**',
    '1. **SELL 5 OKLO · limit $46.50 · GTC · all-day (24h).** Optional de-risk.',
  ].join('\n');
  const parsed = extractReportTickets(reply);
  assert.deepEqual(parsed.tickets.map(({ number, action, symbol, quantity, limitPrice, orderType, timeInForce }) =>
    ({ number, action, symbol, quantity, limitPrice, orderType, timeInForce })), [
    { number: 1, action: 'sell', symbol: 'OKLO', quantity: 5, limitPrice: 46.5, orderType: 'limit', timeInForce: 'GTC' },
  ]);
  assert.match(formatExecutionItemsMessage(parsed.tickets), /1\. SELL 5 OKLO limit \$46\.50/);
});

test('ok to execute approves all saved report tickets', () => {
  const ticketSet = { id: 'set-1', createdAt, tickets: extractReportTickets(report).tickets };
  const resolved = resolveTicketApproval('Ok to execute', ticketSet);
  assert.equal(resolved.kind, 'approved');
  assert.deepEqual(resolved.tickets.map((ticket) => ticket.number), [1, 2]);
});

test('lists every exact execution item in a review-and-confirm follow-up', () => {
  const tickets = extractReportTickets(report).tickets;
  const message = formatExecutionItemsMessage(tickets);
  assert.match(message, /Execution items to review \(2\)/);
  assert.match(message, /1\. CANCEL 14 SOFI limit \$17\.00/);
  assert.match(message, /2\. CANCEL 1 NVDA limit \$180\.00/);
  assert.match(formatExecutionItemsMessage(tickets, { mode: 'manual' }), /Manual mode/);
  assert.equal(formatExecutionItemsMessage([{ number: 1, action: 'buy', symbol: 'XYZ' }]), '');
});

test('a trailing word does not drop the last ticket number', () => {
  const ticketSet = { id: 'set-1', createdAt, tickets: extractReportTickets(report).tickets };
  assert.deepEqual(
    resolveTicketApproval('approve 1 and 2 now', ticketSet).tickets.map((ticket) => ticket.number),
    [1, 2],
  );
  assert.deepEqual(
    resolveTicketApproval('execute 1, 2 please', ticketSet).tickets.map((ticket) => ticket.number),
    [1, 2],
  );
});

test('approval words that resemble symbols do not shrink approve-all', () => {
  const collision = [
    '1. BUY 10 GO limit $20, GTC, regular hours.',
    '2. BUY 3 XYZ limit $18, GTC, regular hours.',
  ].join('\n');
  const ticketSet = { id: 'set-1', createdAt, tickets: extractReportTickets(collision).tickets };
  assert.deepEqual(
    resolveTicketApproval('execute all', ticketSet).tickets.map((ticket) => ticket.number),
    [1, 2],
  );
  assert.deepEqual(
    resolveTicketApproval('approve XYZ', ticketSet).tickets.map((ticket) => ticket.number),
    [2],
  );
});

test('natural symbol and numbered confirmations select exact tickets', () => {
  const ticketSet = { id: 'set-1', createdAt, tickets: extractReportTickets(report).tickets };
  assert.deepEqual(resolveTicketApproval('execute SOFI only', ticketSet).tickets.map((ticket) => ticket.number), [1]);
  assert.deepEqual(resolveTicketApproval('approve 2', ticketSet).tickets.map((ticket) => ticket.number), [2]);
  assert.deepEqual(resolveTicketApproval('approve 1 and 2', ticketSet).tickets.map((ticket) => ticket.number), [1, 2]);
  assert.deepEqual(resolveTicketApproval('resume execution', ticketSet).tickets.map((ticket) => ticket.number), [1, 2]);
});

test('order quantities and prices are not mistaken for ticket numbers', () => {
  const ticketSet = { id: 'set-1', createdAt, tickets: extractReportTickets(report).tickets };
  const resolved = resolveTicketApproval('cancel SOFI at $17', ticketSet);
  assert.deepEqual(resolved.tickets.map((ticket) => ticket.number), [1]);
});

test('non-trading execution wording is not captured as a report approval', () => {
  const ticketSet = { id: 'set-1', createdAt, tickets: extractReportTickets(report).tickets };
  assert.equal(resolveTicketApproval('execute the tests', ticketSet), null);
  assert.equal(resolveTicketApproval('proceed with the README changes', ticketSet), null);
});

test('does not persist underspecified numbered actions as executable tickets', () => {
  assert.deepEqual(extractReportTickets('1. BUY NKE\n2. CANCEL SOFI').tickets, []);
});

test('ambiguous bare confirmation asks before running an agent', () => {
  const ticketSet = { id: 'set-1', createdAt, tickets: extractReportTickets(report).tickets };
  const resolved = resolveTicketApproval('yes', ticketSet);
  assert.equal(resolved.kind, 'clarify');
  assert.match(resolved.message, /execute all/);
});

test('approval prompt is exact and recovery requires live reconciliation', () => {
  const ticketSet = { id: 'set-1', createdAt, tickets: extractReportTickets(report).tickets };
  const prompt = buildTrustedBrokerApprovalInstructions(ticketSet, ticketSet.tickets, { id: 'approval-1' });
  assert.match(prompt, /^TRUSTED PHONE-BRIDGE BROKER AUTHORIZATION/);
  assert.match(prompt, /runtime\/developer control data/);
  assert.match(prompt, /1\. CANCEL SOFI/);
  assert.match(prompt, /Never duplicate/);
  assert.doesNotMatch(prompt, /Ok to execute|resume as|sonnet/i);
});

test('recognizes broker-unavailable execution replies', () => {
  assert.equal(brokerExecutionFailed('Nothing executed. Broker tools are unavailable.'), true);
  assert.equal(brokerExecutionFailed("I'm stopping this one rather than executing anything. No Robinhood MCP tool call has actually succeeded."), true);
  assert.equal(brokerExecutionFailed('Cancelled both orders; live status is cancelled.'), false);
  assert.equal(brokerExecutionSucceeded('Cancelled both orders; live status is cancelled.'), true);
  assert.equal(brokerExecutionSucceeded('I reviewed the request and have details.'), false);
});
