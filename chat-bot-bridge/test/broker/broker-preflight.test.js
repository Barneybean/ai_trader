import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBrokerPreflightTracker,
  isRobinhoodAccountProbe,
  scheduledBrokerCorrectionPrompt,
  scheduledBrokerPreflightPrompt,
} from '../../src/broker/broker-preflight.js';

test('tracks only an actual Robinhood get_accounts MCP call', () => {
  assert.equal(isRobinhoodAccountProbe({ tool: 'robinhood-trading.get_accounts' }), true);
  assert.equal(isRobinhoodAccountProbe({ tool: 'mcp__robinhood_trading__get_accounts' }), true);
  assert.equal(isRobinhoodAccountProbe({ tool: 'robinhood-trading.get_portfolio' }), false);
  const tracker = createBrokerPreflightTracker();
  tracker.observe('execution', { phase: 'started', tool: 'robinhood-trading.get_accounts' });
  assert.equal(tracker.attempted, true);
  assert.equal(tracker.completed, false);
  tracker.observe('execution', { phase: 'completed', ok: true, tool: 'robinhood-trading.get_accounts' });
  assert.equal(tracker.succeeded, true);
});

test('makes the scheduled preflight and correction explicit', () => {
  assert.match(scheduledBrokerPreflightPrompt(), /before any repository documents/i);
  assert.match(scheduledBrokerPreflightPrompt(), /Never infer that MCP is unavailable/i);
  assert.match(scheduledBrokerCorrectionPrompt(), /cannot be delivered yet/i);
});
