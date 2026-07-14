// Pure agent registry and preference rules. Runtime adapters stay in server.js;
// this module keeps ordering and exact agent/model selection deterministic.

export function registeredAgentNames(priority = [], registered = []) {
  const supported = [...new Set((Array.isArray(registered) ? registered : [])
    .map((item) => String(item || '').trim()).filter(Boolean))];
  const preferred = (Array.isArray(priority) ? priority : [])
    .map((item) => String(item || '').trim()).filter((item) => supported.includes(item));
  return [...new Set([...preferred, ...supported])];
}

export function selectedRegisteredAgent(preference, priority, registered) {
  const choices = registeredAgentNames(priority, registered);
  const wanted = String(preference || '').trim();
  return choices.includes(wanted) ? wanted : (choices[0] || null);
}

export function selectedAgentModel(agent, modelDefaults = {}, modelPreferences = {}) {
  const saved = modelPreferences && typeof modelPreferences === 'object'
    ? modelPreferences[agent] : null;
  if (typeof saved === 'string' && saved.trim()) return saved.trim();
  const configured = modelDefaults && typeof modelDefaults === 'object'
    ? modelDefaults[agent] : null;
  return typeof configured === 'string' ? configured.trim() : '';
}

export function applyAgentModelSelection(state = {}, choice = {}, registered = []) {
  const agent = String(choice.agent || '').trim();
  const model = String(choice.model || '').trim();
  if (!registeredAgentNames([], registered).includes(agent) || !model) return null;
  return {
    ...state,
    agentPreference: agent,
    agentModelPreferences: { ...(state.agentModelPreferences || {}), [agent]: model },
  };
}
