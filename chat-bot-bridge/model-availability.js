// Pure observed-availability ledger. The server owns persistence and probes.

const INTERRUPTED_RESPONSE_RE = /connection closed mid-response|response above may be incomplete/i;

function modelFamily(agent, value, aliasesByAgent = {}) {
  const normalized = String(value || '').trim().toLowerCase();
  const families = aliasesByAgent?.[agent];
  if (!normalized || !families || typeof families !== 'object') return null;
  for (const [family, markers] of Object.entries(families)) {
    const candidates = [family, ...(Array.isArray(markers) ? markers : [markers])]
      .map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
    if (candidates.some((marker) => normalized === marker || normalized.includes(marker))) return family;
  }
  return null;
}

export function sameAgentModel(agent, left, right, aliasesByAgent = {}) {
  const a = String(left || '').trim().toLowerCase();
  const b = String(right || '').trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  const leftFamily = modelFamily(agent, a, aliasesByAgent);
  return Boolean(leftFamily && leftFamily === modelFamily(agent, b, aliasesByAgent));
}

export function retryDateStartMs(value) {
  const day = String(value || '').match(/^\d{4}-\d{2}-\d{2}$/)?.[0];
  const parsed = day ? new Date(`${day}T00:00:00`).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function explicitFutureResetAtMs(value, nowMs = Date.now()) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > nowMs ? parsed : null;
}

export function availabilityRecordIsCurrent(record, nowMs = Date.now()) {
  if (!record) return false;
  // A dropped response stream is transport evidence, not model-availability evidence.
  if (INTERRUPTED_RESPONSE_RE.test(String(record.reason || ''))) return false;
  if (explicitFutureResetAtMs(record.resetAtMs, nowMs)) return true;
  const retryAtMs = retryDateStartMs(record.retryDate);
  if (retryAtMs && retryAtMs > nowMs) return true;
  const expiresAtMs = Number(record.expiresAtMs);
  return Number.isFinite(expiresAtMs) && expiresAtMs > nowMs;
}

export function findAvailabilityFailure(
  records,
  agent,
  model,
  nowMs = Date.now(),
  aliasesByAgent = {},
) {
  const list = Array.isArray(records) ? records : [];
  return [...list].reverse().find((item) =>
    item?.agent === agent
    && sameAgentModel(agent, item?.model, model, aliasesByAgent)
    && availabilityRecordIsCurrent(item, nowMs)) || null;
}

export function filterAvailableModels(
  records,
  agent,
  models = [],
  nowMs = Date.now(),
  aliasesByAgent = {},
) {
  return (Array.isArray(models) ? models : []).filter((model) => !findAvailabilityFailure(
    records,
    agent,
    typeof model === 'string' ? model : model?.model,
    nowMs,
    aliasesByAgent,
  ));
}

export function recordAvailabilityFailure(
  records,
  agent,
  model,
  details = {},
  nowMs = Date.now(),
  aliasesByAgent = {},
) {
  const list = Array.isArray(records) ? records : [];
  const existing = [...list].reverse().find((item) =>
    item?.agent === agent && sameAgentModel(agent, item?.model, model, aliasesByAgent));
  const resetAtMs = explicitFutureResetAtMs(details.resetAtMs, nowMs)
    || explicitFutureResetAtMs(existing?.resetAtMs, nowMs);
  const existingRetryDate = retryDateStartMs(existing?.retryDate) > nowMs
    ? existing.retryDate : null;
  const retryDate = details.retryDate || existingRetryDate || null;
  const next = {
    agent,
    model,
    reason: String(details.reason || existing?.reason || 'availability failure')
      .replace(/\s+/g, ' ').slice(0, 300),
    observedAtMs: nowMs,
    ...(resetAtMs ? { resetAtMs } : {}),
    ...(retryDate ? { retryDate } : {}),
    ...(!resetAtMs && !retryDate ? { expiresAtMs: nowMs + 4 * 60 * 60_000 } : {}),
  };
  return [
    ...list.filter((item) => !(item?.agent === agent
      && sameAgentModel(agent, item?.model, model, aliasesByAgent))),
    next,
  ].slice(-32);
}

export function clearAvailabilityFailure(records, agent, model, aliasesByAgent = {}) {
  const list = Array.isArray(records) ? records : [];
  return list.filter((item) => !(item?.agent === agent
    && sameAgentModel(agent, item?.model, model, aliasesByAgent)));
}

export function availabilityRetryLabel(failure, nowMs = Date.now()) {
  const resetAtMs = Number(failure?.resetAtMs);
  if (Number.isFinite(resetAtMs) && resetAtMs > nowMs) {
    return `retry after ${new Date(resetAtMs).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })}`;
  }
  const retryDate = String(failure?.retryDate || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(retryDate)) {
    return `retry on ${new Date(`${retryDate}T12:00:00`).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
    })} (provider reset date)`;
  }
  return String(failure?.reason || '').includes('usage limit')
    ? 'usage-limited; retry later' : 'recent availability failure';
}
