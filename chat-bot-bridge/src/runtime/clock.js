// Runtime-domain canonical bridge-time helpers (ADR-0031).
// Record machine events in UTC; render human-facing schedule times in Pacific
// with an explicit zone label.

const PACIFIC_TZ = 'America/Los_Angeles';

export function utcNowIso(now = new Date()) {
  return (now instanceof Date ? now : new Date(now)).toISOString();
}

export function pacificLabel(when = new Date(), opts = {}) {
  const date = when instanceof Date ? when : new Date(when);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TZ,
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZoneName: 'short',
    ...opts,
  }).format(date);
}

export function pacificDateLabel(when = new Date()) {
  const date = when instanceof Date ? when : new Date(when);
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TZ,
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).format(date);
  return `${day} PT`;
}
