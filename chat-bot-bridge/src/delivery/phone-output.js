// Delivery-domain last-mile policy for text leaving the phone bridge.
// Prompt instructions remain the first line of defense; this module prevents a
// formatting or privacy miss from being forwarded unchanged to a messenger.

import path from 'path';

const MONEY_RE = /(?:\$\s*\d[\d,]*(?:\.\d+)?(?:\s*[kmb])?|\bUSD\s+\d[\d,]*(?:\.\d+)?(?:\s*[kmb])?)/gi;
const ACCOUNT_VALUE_RE = /\b(?:account\s+value|balance|buying\s+power|cash\s+available|cost\s+basis|(?:portfolio|book|closing|net|total|market)\s+value|profit(?:\s+and\s+loss)?|p\s*&\s*l|pnl|order\s+(?:value|size)|total\s+(?:cash|equity|value)|net\s*liq(?:uidation)?|net\s+worth|\bnav\b|(?:total|whole)\s+account|account\s+total|harvested|realized|unrealized)\b/i;
const ACCOUNT_CONTEXT_RE = /\b(?:account|acct|portfolio|cash|settled|free\s+cash|dry\s+powder|powder|\bbook\b)\b/i;

function isPerShareOrLevel(line, offset, token) {
  const before = line.slice(Math.max(0, offset - 20), offset);
  const after = line.slice(offset + token.length, offset + token.length + 12);
  if (/^\s*(?:\/|\s*per\s+)?sh(?:are|s)?\b/i.test(after)) return true;
  if (/\b(?:limit|stop|entry|target|strike)\b/i.test(after)) return true;
  return /(?:\b(?:limit|stop|entry|target|strike|avg|average|cost|filled?|fill|bid|ask|last|price|at)\b\s*[:=]?\s*|@\s*)$/i.test(before);
}
const ACCOUNT_ID_RE = /\b(?:account|acct)(?:[ \t]+(?:id|number|no\.?|#|ending(?:[ \t]+in)?))?[ \t]*[:#-]?[ \t]*(?:[xX*•-]{2,}[ \t]*)?\d[\d xX*•-]{2,}\b/gi;
const STRUCTURED_ACCOUNT_ID_RE = /["']?(?:account|acct)[_ -]?(?:id|number|no)?["']?\s*[:=]\s*["']?(?:[xX*•-]{2,}\s*)?\d[\d xX*•-]{2,}["']?/gi;
const SECRET_PATTERNS = [
  /\b(?:api[_ -]?key|access[_ -]?token|auth[_ -]?token|secret|password)\s*[:=]\s*\S+/gi,
  /["']?(?:api[_ -]?key|access[_ -]?token|auth[_ -]?token|secret|password)["']?\s*[:=]\s*["'][^"'\r\n]+["']/gi,
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\b\d{6,12}:[A-Za-z0-9_-]{20,}\b/g,
];

function stripMarkdown(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const clean = [];
  for (let line of lines) {
    if (/^\s*```/.test(line)) continue;
    line = line
      .replace(/^\s{0,3}#{1,6}\s+/, '')
      .replace(/^\s*>\s?/, '')
      .replace(/^\s*[-*+]\s+/, '')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/<https?:\/\/[^>]+>/gi, '[link omitted]')
      .replace(/https?:\/\/\S+/gi, '[link omitted]')
      .replace(/<[^>]+>/g, '')
      .replace(/(\*\*|__|~~|`)/g, '')
      .trim();
    if (/^\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?$/.test(line)) continue;
    if (line.includes('|')) line = line.replace(/^\||\|$/g, '').split('|').map((part) => part.trim()).filter(Boolean).join(' · ');
    clean.push(line);
  }
  return clean.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function redactPrivateData(text) {
  let redactions = 0;
  let out = String(text);
  const redact = (pattern, replacement) => {
    out = out.replace(pattern, () => { redactions++; return replacement; });
  };
  for (const pattern of SECRET_PATTERNS) redact(pattern, '[private credential removed]');
  redact(ACCOUNT_ID_RE, 'the account');
  redact(STRUCTURED_ACCOUNT_ID_RE, 'the account');

  out = out.split('\n').map((line) => {
    // Limit prices are allowed only on an actual order-ticket line. Any line
    // containing account-value language remains private, even if it also looks
    // like an order.
    const isOrderTicket = /\b(?:ticket|order)\b/i.test(line)
      && /\b(?:buy|sell)\b/i.test(line)
      && /\b(?:qty|quantity)\s*[:=]?\s*\d+|\b(?:buy|sell)\s+\d+/i.test(line)
      && /\blimit(?:\s+price)?\s*[:=@]?\s*\$/i.test(line);
    const privateValue = ACCOUNT_VALUE_RE.test(line)
      || (ACCOUNT_CONTEXT_RE.test(line) && MONEY_RE.test(line) && !isOrderTicket);
    MONEY_RE.lastIndex = 0;
    if (!privateValue || isOrderTicket) return line;
    return line.replace(MONEY_RE, (match, offset) => {
      if (isPerShareOrLevel(line, offset, match)) return match;
      redactions++;
      return '[private account value]';
    });
  }).join('\n');
  return { text: out, redactions };
}

function limitContentLines(text, maxLines) {
  if (!maxLines) return { text, shortened: false };
  const content = String(text).split('\n').map((line) => line.trim()).filter(Boolean);
  if (content.length <= maxLines) return { text: content.join('\n\n'), shortened: false };
  return { text: content.slice(0, maxLines).join('\n\n'), shortened: true };
}

function limitCharacters(text, maxChars, shortened = false) {
  const suffix = 'Details on request.';
  if (String(text).length <= maxChars && !shortened) return { text, shortened: false };
  if (String(text).length <= maxChars - suffix.length - 2) {
    return { text: `${String(text).trim()}\n\n${suffix}`, shortened: true };
  }
  const room = Math.max(0, maxChars - suffix.length - 2);
  let head = String(text).slice(0, room).trimEnd();
  const boundary = Math.max(head.lastIndexOf('\n'), head.lastIndexOf(' '));
  if (boundary > room * 0.7) head = head.slice(0, boundary).trimEnd();
  return { text: `${head}\n\n${suffix}`.slice(0, maxChars), shortened: true };
}

export function sanitizePhoneText(text, options = {}) {
  const maxChars = Math.max(80, Math.min(1500, Number(options.maxChars || 1500)));
  const maxLines = options.maxLines ? Math.max(1, Number(options.maxLines)) : null;
  const plain = stripMarkdown(text);
  const privateSafe = redactPrivateData(plain);
  const lineLimited = limitContentLines(privateSafe.text, maxLines);
  const limited = limitCharacters(lineLimited.text, maxChars, lineLimited.shortened);
  return {
    text: limited.text,
    redactions: privateSafe.redactions,
    shortened: limited.shortened,
  };
}

// Execution transcripts are attached as owner-only text files. Preserve their
// terminal-like line structure while applying the same credential/account gate.
export function sanitizeExecutionLogText(text, maxChars = 4000) {
  const plain = stripMarkdown(text);
  const privateSafe = redactPrivateData(plain);
  const limit = Math.max(80, Math.min(20_000, Number(maxChars) || 4000));
  return {
    text: privateSafe.text.slice(0, limit),
    redactions: privateSafe.redactions,
    shortened: privateSafe.text.length > limit,
  };
}

// Change-review HTML keeps code formatting, so apply only the privacy gate.
// The renderer performs HTML escaping and its own size limits.
export function sanitizeChangeReviewText(text) {
  return redactPrivateData(String(text || ''));
}

const SECRET_SEND_RE = /(?:^|\/)\.env(?:\.|$)|(?:^|\/)config\.local\.toml$|\.local\.(?:txt|toml|json|env|ini)$/i;

// The caller passes canonical, symlink-resolved paths. A file may leave the
// workstation only when it is inside the desk, outside the bridge runtime
// directory, visible, and not a local secret/configuration file.
export function forbiddenSendPath(realPath, deskDir, bridgeDir) {
  if (!realPath || !deskDir) return true;
  const sep = path.sep;
  const inDesk = realPath === deskDir || realPath.startsWith(deskDir + sep);
  const inBridge = Boolean(bridgeDir)
    && (realPath === bridgeDir || realPath.startsWith(bridgeDir + sep));
  const relative = inDesk ? realPath.slice(deskDir.length) : realPath;
  const hidden = relative.split(sep).some((segment) => segment.startsWith('.'));
  return !inDesk || inBridge || hidden || SECRET_SEND_RE.test(realPath);
}
