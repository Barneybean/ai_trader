// Side-effect-free helpers for the messenger-native remote run view.

function oneLine(value, max = 120) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function parseRemoteControl(text) {
  const value = String(text || '').trim();
  if (/^\/run$/i.test(value)) return { action: 'status' };
  if (/^\/(?:stop|interrupt)$/i.test(value)) return { action: 'stop' };
  const steer = value.match(/^\/steer(?:\s+([\s\S]+))?$/i);
  if (steer) return { action: 'steer', prompt: String(steer[1] || '').trim() };
  return null;
}

export function formatPhoneHelp() {
  return [
    'Phone command reference',
    '',
    'RUN CONTROL',
    '/status — show the active run; when idle, show bridge, agent, mode, and sessions',
    '/steer TEXT — interrupt and redirect the active turn in the same saved session',
    '/stop — stop the active turn; preserve its session and completed file changes',
    'Aliases: /run = /status · /interrupt = /stop · /start = idle status',
    '',
    'SESSION & AGENT',
    '/new — clear both agent conversations and start fresh sessions',
    '/agent — open a numbered picker; every visible agent/model pair has its own number',
    '/agent N — select that exact agent and model; a bare N also works for 5 minutes',
    '/agent codex or /agent claude — show that agent’s model menu and availability',
    'Manual selection changes future runs; automatic availability switching remains enabled',
    '',
    'MODEL OR DECISION HANDOFF',
    '/decide N — answer a numbered pending decision and resume',
    '/decide TEXT — answer a pending decision in your own words',
    '/models — show more available models during a model handoff',
    '/decide claude MODEL or /decide codex MODEL — choose an explicit model',
    'Aliases while waiting: bare N · more · more models · /decide more',
    '',
    'TRADING AUTHORITY',
    '/mode — show the current trading mode',
    '/mode manual — require confirmation for every exact order; kill switch',
    '/mode semi — execute only specifically approved numbered tickets',
    '/mode full — validate autonomous proposals without placing broker orders',
    '',
    'HELP',
    '/help — show this reference',
    'Aliases: /commands · help · /',
    '',
    'Normal text starts a request. During an active run, normal messages queue; /steer redirects immediately.',
    'Trade approvals are normal replies, not slash commands. After a report you can say “ok to execute”, “execute all”, “approve 2”, or “execute SOFI”. If the target is unclear, the bridge asks before contacting an agent.',
  ].join('\n');
}

export function createRemoteRunView(prompt, startedMs = Date.now()) {
  return {
    status: 'STARTING',
    prompt: oneLine(prompt, 92),
    startedMs,
    agent: 'Agent',
    model: '',
    actionCount: 0,
    recent: [],
    current: 'Preparing the session',
    result: '',
  };
}

export function updateRemoteRunView(view, kind, detail = {}) {
  if (!view) return view;
  if (kind === 'started') {
    view.status = 'WORKING';
    view.agent = detail.agent === 'codex' ? 'Codex' : detail.agent === 'claude' ? 'Claude' : 'Agent';
    view.model = oneLine(detail.model, 42);
    view.current = 'Agent is working on your request.';
  } else if (kind === 'execution') {
    if (detail.phase !== 'completed') view.actionCount++;
    const tool = oneLine(detail.tool || detail.kind || 'task', 44);
    const summary = oneLine(detail.summary, 88);
    if (detail.phase !== 'completed') {
      view.current = `Running ${tool}${summary ? ` — ${summary}` : ''}`;
    } else if (detail.ok === false) {
      view.current = `${tool} failed; the agent is handling it.`;
    } else {
      view.current = `${tool} finished successfully; the agent is continuing.`;
    }
    view.recent = [...(view.recent || []), view.current].slice(-3);
  } else if (kind === 'trouble') {
    view.current = `An issue occurred; the agent is retrying or working around it: ${oneLine(detail, 70)}`;
    view.recent = [...(view.recent || []), view.current].slice(-3);
  } else if (kind === 'circuit_breaker') {
    view.status = 'STOPPED';
    view.current = oneLine(detail.reason || detail, 100) || 'Safety limit reached.';
  }
  return view;
}

export function finishRemoteRunView(view, status, result = '') {
  if (!view) return view;
  const lifecycle = {
    done: 'COMPLETE',
    paused: 'WAITING FOR YOU',
    interrupted: 'STOPPED',
    failed: 'FAILED',
  };
  const requested = String(status || 'done').toLowerCase();
  view.status = lifecycle[requested] || String(status || 'COMPLETE').toUpperCase();
  view.endedMs = Date.now();
  view.result = oneLine(result, 110);
  if (view.status === 'COMPLETE') view.current = 'Final reply delivered below.';
  if (view.status === 'STOPPED') view.current = view.result || 'Turn stopped; session preserved.';
  if (view.status === 'FAILED') view.current = view.result || 'Run failed';
  if (view.status === 'WAITING FOR YOU') view.current = view.result || 'Waiting for your choice.';
  return view;
}

export function formatRemoteRunView(view, nowMs = Date.now()) {
  if (!view) return 'No run is active.';
  const elapsed = Math.max(0, Math.round(((view.endedMs || nowMs) - view.startedMs) / 1000));
  const clock = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
  const who = `${view.agent}${view.model ? ` · ${view.model}` : ''}`;
  const working = ['STARTING', 'WORKING', 'RUNNING'].includes(view.status);
  let finalLine = '';
  if (working) finalLine = 'You: No action needed. Redirect: /steer TEXT · Stop: /stop';
  else if (view.status === 'WAITING FOR YOU' || view.status === 'PAUSED') finalLine = 'You: Reply to the decision message below.';
  else if (view.status === 'COMPLETE' || view.status === 'DONE') finalLine = 'Result: Delivered below.';
  else if (view.status === 'STOPPED' || view.status === 'INTERRUPTED') finalLine = 'Result: Stopped; session and completed changes are preserved.';
  else if (view.status === 'FAILED') finalLine = 'You: Review the error below, then resend your request.';
  return [
    `${view.status} · ${who}`,
    `Request: ${view.prompt}`,
    `Elapsed: ${clock}`,
    working ? `Progress: ${view.current}` : '',
    finalLine,
  ].filter(Boolean).join('\n');
}
