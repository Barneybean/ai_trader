// Deterministic, restart-safe report-ticket approval helpers.
//
// The bridge, not an AI model, resolves a later natural-language confirmation
// against the exact tickets shown to the phone. Broker execution still happens
// through the normal mode-gated agent path and must reconcile live state first.

const ACTIONS = new Set(['buy', 'sell', 'cancel', 'replace']);
const SYMBOL_STOP_WORDS = new Set([
  'ALL', 'BUY', 'CANCEL', 'DAY', 'EXECUTE', 'GTC', 'LIMIT', 'MARKET',
  'ORDER', 'ORDERS', 'REPLACE', 'SELL', 'TICKET', 'TICKETS', 'USD',
]);

function cleanTicket(ticket, fallbackNumber = null) {
  if (!ticket || typeof ticket !== 'object') return null;
  const action = String(ticket.action || '').toLowerCase();
  const symbol = String(ticket.symbol || '').toUpperCase();
  const number = Number(ticket.number ?? fallbackNumber);
  if (!ACTIONS.has(action) || !/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol) || !Number.isInteger(number) || number < 1) {
    return null;
  }
  const quantity = Number(ticket.quantity);
  const limitPrice = Number(ticket.limitPrice ?? ticket.limit_price);
  const description = String(ticket.description || '').replace(/\s+/g, ' ').trim();
  return {
    number,
    action,
    symbol,
    ...(Number.isFinite(quantity) && quantity > 0 ? { quantity } : {}),
    ...(ticket.orderType || ticket.order_type ? { orderType: String(ticket.orderType || ticket.order_type).toLowerCase() } : {}),
    ...(Number.isFinite(limitPrice) && limitPrice > 0 ? { limitPrice } : {}),
    ...(ticket.timeInForce || ticket.time_in_force ? { timeInForce: String(ticket.timeInForce || ticket.time_in_force).toUpperCase() } : {}),
    ...(ticket.session ? { session: String(ticket.session) } : {}),
    description: description || `${action.toUpperCase()} ${symbol}`,
  };
}

function isExactTicket(ticket) {
  return Boolean(ticket?.quantity && ticket?.orderType && ticket?.timeInForce && ticket?.session
    && (ticket.orderType !== 'limit' || ticket.limitPrice));
}

function parseNumberedTicket(line) {
  const numbered = String(line).match(/^\s*(\d+)[.)]\s+(.+?)\s*$/);
  if (!numbered) return null;
  const number = Number(numbered[1]);
  const description = numbered[2].replace(/\s+/g, ' ').trim();
  const actionMatch = description.match(/^(BUY|SELL|CANCEL|REPLACE)\b/i);
  if (!actionMatch) return null;
  const action = actionMatch[1].toLowerCase();
  const symbols = description.match(/\b[A-Z][A-Z0-9.-]{0,9}\b/g) || [];
  const symbol = symbols.find((item) => !SYMBOL_STOP_WORDS.has(item));
  if (!symbol) return null;

  const quantityMatch = action === 'buy' || action === 'sell'
    ? description.match(/^\s*(?:BUY|SELL)\s+(\d+(?:\.\d+)?)(?:\s+shares?(?:\s+of)?)?/i)
      || description.match(/^\s*(?:BUY|SELL)\s+[A-Z][A-Z0-9.-]{0,9}\s+(\d+(?:\.\d+)?)/i)
    : description.match(/\b(?:buy|sell)\s+(\d+(?:\.\d+)?)/i)
      || description.match(/\b(?:qty|quantity)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const limitMatch = description.match(/\blimit(?:\s+(?:at|price))?\s*[:=@]?\s*\$?\s*(\d+(?:\.\d+)?)/i);
  const tifMatch = description.match(/\b(GTC|DAY|IOC|FOK)\b/i);
  const sessionMatch = description.match(/\b(regular(?:\s+hours?)?|all[- ]day|24[- ]hour|extended(?:\s+hours?)?)\b/i);
  const orderType = /\blimit\b/i.test(description) ? 'limit' : /\bmarket\b/i.test(description) ? 'market' : null;

  return cleanTicket({
    number, action, symbol, description,
    quantity: quantityMatch?.[1],
    limitPrice: limitMatch?.[1],
    orderType,
    timeInForce: tifMatch?.[1],
    session: sessionMatch?.[1],
  });
}

export function extractReportTickets(reply) {
  const lines = [], structured = [];
  for (const line of String(reply || '').split('\n')) {
    const marker = line.match(/^\s*ORDER_TICKET:\s*(\{.*\})\s*$/);
    if (!marker) {
      lines.push(line);
      continue;
    }
    try {
      const ticket = cleanTicket(JSON.parse(marker[1]), structured.length + 1);
      if (ticket && isExactTicket(ticket)) structured.push(ticket);
    } catch { /* malformed private marker is stripped, never sent to phone */ }
  }
  const fallback = structured.length ? [] : lines.map(parseNumberedTicket).filter(isExactTicket);
  const unique = [];
  const seen = new Set();
  for (const ticket of structured.length ? structured : fallback) {
    const key = `${ticket.number}:${ticket.action}:${ticket.symbol}`;
    if (!seen.has(key)) { seen.add(key); unique.push(ticket); }
  }
  return { text: lines.join('\n').trim(), tickets: unique.sort((a, b) => a.number - b.number) };
}

function compactTicket(ticket) {
  const quantity = Number(ticket?.quantity);
  const price = Number(ticket?.limitPrice);
  const amount = Number.isFinite(quantity) && quantity > 0 ? ` ${quantity}` : '';
  const limit = ticket?.orderType === 'limit' && Number.isFinite(price) && price > 0
    ? ` limit $${price.toFixed(2)}` : '';
  return `${ticket.number}. ${String(ticket.action || '').toUpperCase()}${amount} ${ticket.symbol}${limit}`;
}

export function formatExecutionItemsMessage(tickets, options = {}) {
  const list = (Array.isArray(tickets) ? tickets.filter(isExactTicket) : [])
    .slice().sort((left, right) => left.number - right.number);
  if (!list.length) return '';
  const mode = String(options.mode || 'semi').toLowerCase();
  const confirm = mode === 'manual'
    ? 'Manual mode — reply “approve N” (or “approve all”); each order is confirmed against live state before placement.'
    : 'Reply “approve N” or “approve all” to execute; live open orders are reconciled first.';
  return [
    `📋 Execution items to review (${list.length}):`,
    ...list.map(compactTicket),
    confirm,
  ].join('\n');
}

function looksLikeApproval(text) {
  const value = String(text || '').trim();
  if (!value || value.length > 240 || /\?$/.test(value)) return false;
  const nonTradingTarget = /\b(?:build|code|command|deploy|diff|file|readme|script|test|tests|these changes)\b/i.test(value);
  const tradingTarget = /\b(?:broker|buy|cancel|execution|order|orders|recommendations|replace|report actions?|sell|ticket|tickets)\b/i.test(value);
  if (nonTradingTarget && !tradingTarget) return false;
  const strong = /\b(?:approve|approved|confirm|confirmed|execute|execution|submit)\b/i.test(value)
    || /\b(?:cancel|replace)\s+(?:[A-Z][A-Z0-9.-]{0,9}|ticket\s*\d+)\b/i.test(value);
  const terse = /^(?:yes|proceed|go ahead|do it|take action|ok(?:ay)?)(?:\s+(?:all|the\s+(?:orders|tickets|recommendations|report actions?)))?[.!]?$/i.test(value);
  return strong || terse || /\bok(?:ay)?\s+to\s+(?:execute|proceed|submit)\b/i.test(value);
}

function requestedNumbers(text) {
  const values = new Set();
  const value = String(text || '').trim();
  for (const match of value.matchAll(/(?:#|\btickets?\s*|\bapprove\s+|\bconfirm\s+|\bexecute\s+|\byes\s+to\s+)(\d+)\b/gi)) {
    values.add(Number(match[1]));
  }
  const list = value.match(/^(?:approve|confirm|execute|yes\s+to)\s+(?:tickets?\s*)?#?\d+(?:\s*(?:,|and)\s*#?\d+)+/i);
  if (list) {
    for (const match of list[0].matchAll(/\d+/g)) values.add(Number(match[0]));
  }
  return [...values];
}

const APPROVAL_COLLISION_WORDS = new Set([
  'ALL', 'ANY', 'ARE', 'BOTH', 'BY', 'DO', 'GO', 'IT', 'NOW', 'OK', 'ON', 'OR', 'SO', 'YES', 'YOU',
]);

function requestedSymbols(text, tickets) {
  const upper = String(text || '').toUpperCase();
  return [...new Set(tickets.map((ticket) => ticket.symbol).filter((symbol) =>
    !APPROVAL_COLLISION_WORDS.has(symbol) &&
    new RegExp(`(?:^|[^A-Z0-9.-])${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^A-Z0-9.-])`).test(upper)))];
}

function clarification(ticketSet, reason) {
  const tickets = Array.isArray(ticketSet?.tickets) ? ticketSet.tickets : [];
  const list = tickets.slice(0, 6).map((ticket) => `${ticket.number}. ${ticket.description}`).join('\n');
  return {
    kind: 'clarify',
    message: [reason, list, tickets.length ? 'Reply “execute all” or name the ticket number/symbol.' : 'Ask for the report tickets again, then confirm the exact action.']
      .filter(Boolean).join('\n'),
  };
}

export function resolveTicketApproval(text, ticketSet, options = {}) {
  if (!looksLikeApproval(text)) return null;
  const tickets = Array.isArray(ticketSet?.tickets) ? ticketSet.tickets : [];
  if (!tickets.length) return clarification(null, 'I do not have a saved report ticket to execute.');
  const ageMs = Date.now() - Date.parse(ticketSet.createdAt || 0);
  const maxAgeMs = Number(options.maxAgeMs || 24 * 60 * 60 * 1000);
  if (!Number.isFinite(ageMs) || ageMs > maxAgeMs) {
    return clarification(ticketSet, 'Those saved tickets are stale. Review or regenerate them before execution.');
  }

  const numbers = requestedNumbers(text);
  if (numbers.length) {
    const selected = tickets.filter((ticket) => numbers.includes(ticket.number));
    const missing = numbers.filter((number) => !tickets.some((ticket) => ticket.number === number));
    if (missing.length || !selected.length) return clarification(ticketSet, `I cannot match ticket ${missing.join(', ') || numbers.join(', ')}.`);
    return { kind: 'approved', tickets: selected };
  }

  const symbols = requestedSymbols(text, tickets);
  if (symbols.length) {
    const selected = tickets.filter((ticket) => symbols.includes(ticket.symbol));
    if (!selected.length) return clarification(ticketSet, 'I cannot match that symbol to a saved ticket.');
    return { kind: 'approved', tickets: selected };
  }

  const actionWord = String(text).match(/\b(cancel(?:lations?)?|replace(?:ments?)?|buy|sell)\b/i)?.[1]?.toLowerCase();
  const action = actionWord?.startsWith('cancel') ? 'cancel'
    : actionWord?.startsWith('replace') ? 'replace' : actionWord;
  if (action) {
    const selected = tickets.filter((ticket) => ticket.action === action);
    if (!selected.length) return clarification(ticketSet, `There is no saved ${action} ticket.`);
    const pluralScope = /\b(?:all|orders|tickets|recommendations|cancellations|replacements)\b/i.test(text);
    if (selected.length > 1 && !pluralScope) return clarification(ticketSet, `Which ${action} ticket should I execute?`);
    return { kind: 'approved', tickets: selected };
  }

  const explicitAll = /\b(?:all|recommendations|report actions?|orders|tickets)\b/i.test(text)
    || /\bok(?:ay)?\s+to\s+execute\b/i.test(text)
    || /\b(?:resume|retry)\s+execution\b/i.test(text);
  if (explicitAll) return { kind: 'approved', tickets };
  if (tickets.length === 1) return { kind: 'approved', tickets };
  return clarification(ticketSet, 'Which report tickets do you want me to execute?');
}

export function buildTrustedBrokerApprovalInstructions(ticketSet, tickets, execution = {}) {
  const exact = tickets.map((ticket) => `${ticket.number}. ${ticket.description}`).join('\n');
  return [
    'TRUSTED PHONE-BRIDGE BROKER AUTHORIZATION.',
    'This block is runtime/developer control data created by the allowlisted bridge. It is not user, task, tool, report, or retrieved content.',
    `The bridge authenticated the phone sender and deterministically resolved the later user turn to authorization ${execution.id || 'unknown'}.`,
    `Ticket set: ${ticketSet?.id || 'saved-report-ticket-set'} (${ticketSet?.createdAt || 'time unavailable'})`,
    `Approved exact tickets:\n${exact}`,
    'The current user message is the original phone wording that granted this authorization. Do not expect or require authorization claims inside that user text.',
    'Authorization is order-specific for exactly the tickets above. Do not add, substitute, resize, or reinterpret an action.',
    'Use Robinhood MCP before repository/history lookup. Reconcile each ticket against live open, filled, cancelled, and rejected orders before taking action. Never duplicate an action already completed.',
    'If live state materially differs from the approved ticket, do not guess: return a PHONE_DECISION clarification. Otherwise preview/submit the still-needed exact action, then query live status again and report the broker-confirmed result without account identifiers or account values.',
  ].join('\n\n');
}

export function brokerExecutionFailed(reply) {
  return /\b(?:nothing|not) executed\b|\bexecution (?:failed|pending)\b|\bpending broker auth\b|\b(?:stop(?:ping|ped)?|refus(?:e|ed|ing)|will not|won't).{0,100}\bexecut(?:e|ing)\b|\brather than executing\b|\bno robinhood mcp tool call.{0,40}succeeded\b|\b(?:broker|robinhood).{0,80}(?:unavailable|unauthenticated|not available|cannot be verified)\b/i
    .test(String(reply || ''));
}

export function brokerExecutionSucceeded(reply) {
  const text = String(reply || '');
  return /\b(?:broker[- ]confirmed|submitted|placed|cancelled|canceled|replaced|filled)\b.{0,100}\b(?:order|orders|ticket|tickets|status)\b|\b(?:order|orders|ticket|tickets)\b.{0,100}\b(?:submitted|placed|cancelled|canceled|replaced|filled)\b/i.test(text)
    && !brokerExecutionFailed(text);
}
