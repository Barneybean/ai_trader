import test from 'node:test';
import assert from 'node:assert/strict';
import {
  availabilityFailure,
  brokerRequestKind,
  claudeAvailabilityOutcome,
  codexAvailabilityError,
  codexToolFingerprint,
  createRunCircuitBreaker,
  createManualAgentChoice,
  formatManualAgentChoiceForPhone,
  implicitManualAgentChoice,
  preferredAgentOrder,
  prioritizeBrokerAgent,
  resolveManualAgentChoice,
} from '../../src/agents/agent-routing.js';

test('classifies explicit execution and live-status requests', () => {
  assert.equal(brokerRequestKind('approve 2'), 'action');
  assert.equal(brokerRequestKind('Ok to execute'), 'action');
  assert.equal(brokerRequestKind('execute SOFI'), 'action');
  assert.equal(brokerRequestKind('yes to 2'), 'action');
  assert.equal(brokerRequestKind('cancel the open NKE order'), 'action');
  assert.equal(brokerRequestKind('buy 2 NVDA shares'), 'action');
  assert.equal(brokerRequestKind('check my open orders'), 'status');
  assert.equal(brokerRequestKind('get the live quote for NKE'), 'status');
});

test('puts the MCP-capable broker agent ahead of sticky research routing', () => {
  assert.deepEqual(prioritizeBrokerAgent(['codex', 'claude'], 'claude', 'action'), ['claude', 'codex']);
  assert.deepEqual(prioritizeBrokerAgent(['codex'], 'claude', 'status'), ['claude', 'codex']);
  assert.deepEqual(prioritizeBrokerAgent(['codex', 'claude'], 'claude', null), ['codex', 'claude']);
});

test('agent choice sets the default while retaining available alternatives', () => {
  assert.deepEqual(preferredAgentOrder('codex', ['codex', 'claude']), ['codex', 'claude']);
  assert.deepEqual(preferredAgentOrder('claude', ['codex', 'claude']), ['claude', 'codex']);
  assert.deepEqual(preferredAgentOrder('auto', ['codex', 'claude']), ['codex', 'claude']);
});

test('manual agent picker supports numbered, named, and short-lived bare replies', () => {
  const pending = createManualAgentChoice({
    agents: ['codex', 'claude'], current: 'codex',
    models: { codex: 'gpt-test', claude: 'sonnet-test' }, nowMs: 1_000, ttlMs: 300_000,
    modelChoices: {
      codex: [
        { model: 'gpt-test', availability: 'available' },
        { model: 'gpt-next', availability: 'unavailable', detail: 'rate limited' },
        'gpt-third', 'gpt-fourth', 'gpt-fifth',
      ],
      claude: ['sonnet-test', 'opus-test'],
    },
  });
  const phone = formatManualAgentChoiceForPhone(pending);
  assert.match(phone, /Codex \(current\)/);
  assert.match(phone, /1\. gpt-test — available · default/);
  assert.match(phone, /2\. gpt-next — unavailable · rate limited/);
  assert.match(phone, /Claude/);
  assert.match(phone, /5\. sonnet-test — available/);
  assert.doesNotMatch(phone, /gpt-fifth/);
  assert.deepEqual(resolveManualAgentChoice(pending, '/agent 2', 2_000), {
    agent: 'codex', agentLabel: 'Codex', model: 'gpt-next', label: 'gpt-next',
    availability: 'unavailable', detail: 'rate limited', current: false, explicitModel: true,
  });
  assert.deepEqual(resolveManualAgentChoice(pending, 'codex', 2_000), {
    agent: 'codex', agentLabel: 'Codex', model: 'gpt-test', label: 'gpt-test', explicitModel: false,
  });
  assert.equal(resolveManualAgentChoice(pending, '1', 302_000), null);
  assert.deepEqual(implicitManualAgentChoice({ pendingAgentChoice: pending }, '5', 2_000), {
    agent: 'claude', agentLabel: 'Claude', model: 'sonnet-test', label: 'sonnet-test',
    availability: 'available', current: false, explicitModel: true,
  });
  assert.equal(implicitManualAgentChoice({ pendingAgentChoice: pending, pendingModelSwitch: {} }, '2', 2_000), null);
  assert.equal(implicitManualAgentChoice({ pendingAgentChoice: pending, pendingDecision: {} }, '2', 2_000), null);
});

test('manual picker keeps its model-numbering contract for a future registered agent', () => {
  const pending = createManualAgentChoice({
    agents: ['codex', 'local-runner'], current: 'local-runner',
    models: { codex: 'gpt-test', 'local-runner': 'local-fast' },
    modelChoices: { codex: ['gpt-test'], 'local-runner': ['local-fast', 'local-deep'] },
    nowMs: 1_000,
  });
  const phone = formatManualAgentChoiceForPhone(pending);
  assert.match(phone, /Local Runner \(current\)/);
  assert.match(phone, /2\. local-fast — available · default/);
  assert.deepEqual(resolveManualAgentChoice(pending, '3', 2_000), {
    agent: 'local-runner', agentLabel: 'Local Runner', model: 'local-deep', label: 'local-deep',
    availability: 'available', current: false, explicitModel: true,
  });
});

test('recognizes synthetic usage-limit replies as fallback eligible', () => {
  assert.equal(availabilityFailure("You've reached your Fable 5 limit. Run /usage-credits to continue."), true);
  assert.equal(availabilityFailure("You've hit your weekly limit. It resets tonight."), true);
  assert.equal(availabilityFailure('rate limit reached; try again later'), true);
  assert.equal(availabilityFailure('Report completed normally.'), false);
});

test('an explicit Claude rate-limit event wins over an ambiguous final result', () => {
  assert.deepEqual(claudeAvailabilityOutcome({
    rateLimitEvent: true,
    rateLimitReason: 'usage limit: rejected — resets 7:00 PM PT',
    resetAtMs: 1_234_567,
    result: { is_error: false, result: "You've hit your weekly limit." },
  }), {
    unavailable: true,
    reason: 'usage limit: rejected — resets 7:00 PM PT',
    resetAtMs: 1_234_567,
  });
  assert.deepEqual(claudeAvailabilityOutcome({
    result: { is_error: true, error: 'report input was invalid' },
  }), { unavailable: false, reason: null, resetAtMs: null });
});

test('does not classify failed command output as Codex unavailability', () => {
  const npmEnoent = {
    type: 'item.completed',
    item: {
      type: 'command_execution', status: 'failed', exit_code: 254,
      stderr: 'npm error code ENOENT: package.json not found',
    },
  };
  assert.equal(codexAvailabilityError(npmEnoent), null);
  assert.match(codexAvailabilityError({ type: 'turn.failed', error: { message: 'rate limit 429' } }), /429/);
});

test('uses recent ticket context for a bare confirmation', () => {
  const history = [{ role: 'assistant', text: 'Ticket 1 is ready. Reply yes to confirm this order.' }];
  assert.equal(brokerRequestKind('yes', history), 'action');
});

test('does not mistake research questions for execution', () => {
  assert.equal(brokerRequestKind('Should I buy NKE after earnings?'), null);
  assert.equal(brokerRequestKind('Explain the order execution methodology'), null);
});

test('a zero-tool diagnostic ceiling stops the first attempted tool', () => {
  const guard = createRunCircuitBreaker({
    maxToolCalls: 0, maxIdenticalToolCalls: 0, maxOutputTokens: 100,
  });
  assert.match(guard.observeTool('any tool'), /1\/0/);
});

test('progress-aware budgets permit diverse successful research by default', () => {
  const guard = createRunCircuitBreaker({ maxIdenticalToolCalls: 10 });
  for (let index = 0; index < 300; index++) {
    const signature = `web_search:${index}`;
    assert.equal(guard.observeTool(signature), null);
    assert.equal(guard.observeToolResult({ signature, ok: true }), null);
    assert.equal(guard.observeOutputTokens(1_000), null);
  }
  assert.deepEqual(guard.snapshot(), {
    toolCalls: 300, outputTokens: 300_000, consecutiveToolFailures: 0,
  });
});

test('progress guard stops repeated or sustained failures and resets after success', () => {
  const repeated = createRunCircuitBreaker({
    maxIdenticalToolCalls: 10,
    maxIdenticalToolFailures: 2,
    maxConsecutiveToolFailures: 8,
  });
  for (let index = 0; index < 2; index++) {
    assert.equal(repeated.observeTool('mcp:get_accounts'), null);
    assert.equal(repeated.observeToolResult({
      signature: 'mcp:get_accounts', ok: false, error: `connection refused ${5_001 + index}`,
    }), null);
  }
  assert.equal(repeated.observeTool('mcp:get_accounts'), null);
  assert.match(repeated.observeToolResult({
    signature: 'mcp:get_accounts', ok: false, error: 'connection refused 5003',
  }), /identical tool failure repeated/);

  const stalled = createRunCircuitBreaker({
    maxIdenticalToolCalls: 10,
    maxIdenticalToolFailures: 10,
    maxConsecutiveToolFailures: 2,
  });
  for (let index = 0; index < 2; index++) {
    const signature = `web:${index}`;
    assert.equal(stalled.observeTool(signature), null);
    assert.equal(stalled.observeToolResult({
      signature, ok: false, error: 'network unavailable',
    }), null);
  }
  assert.equal(stalled.observeTool('web:success'), null);
  assert.equal(stalled.observeToolResult({ signature: 'web:success', ok: true }), null);
  for (let index = 2; index < 4; index++) {
    const signature = `web:${index}`;
    assert.equal(stalled.observeTool(signature), null);
    assert.equal(stalled.observeToolResult({
      signature, ok: false, error: 'network unavailable',
    }), null);
  }
  assert.equal(stalled.observeTool('web:4'), null);
  assert.match(stalled.observeToolResult({
    signature: 'web:4', ok: false, error: 'network unavailable',
  }), /consecutive tool failures without progress/);
});

test('Codex fingerprints observable tool inputs without merging opaque searches', () => {
  const opaqueSearch = { type: 'web_search', id: 'item-1' };
  assert.equal(codexToolFingerprint(opaqueSearch), null);
  assert.equal(codexToolFingerprint({ type: 'web_search', arguments: {} }), null);
  assert.equal(
    codexToolFingerprint({ type: 'web_search', query: 'EXAMPLE earnings news' }),
    'web_search:"EXAMPLE earnings news"',
  );
  assert.equal(
    codexToolFingerprint({ type: 'web_search', arguments: { q: 'EXAMPLE earnings news' } }),
    'web_search:"EXAMPLE earnings news"',
  );
  assert.equal(
    codexToolFingerprint({
      type: 'mcp_tool_call', server: 'broker', tool: 'get_orders', arguments: { a: 1, b: 2 },
    }),
    codexToolFingerprint({
      type: 'mcp_tool_call', server: 'broker', tool: 'get_orders', arguments: { b: 2, a: 1 },
    }),
  );

  const guard = createRunCircuitBreaker({ maxToolCalls: 10, maxIdenticalToolCalls: 2 });
  for (let i = 0; i < 6; i++) {
    assert.equal(guard.observeTool(codexToolFingerprint(opaqueSearch)), null);
  }
  assert.equal(guard.snapshot().toolCalls, 6);
  const repeated = codexToolFingerprint({ type: 'web_search', query: 'same query' });
  assert.equal(guard.observeTool(repeated), null);
  assert.equal(guard.observeTool(repeated), null);
  assert.match(guard.observeTool(repeated), /identical tool call repeated/);
});
