import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRemoteRunView,
  finishRemoteRunView,
  formatPhoneHelp,
  formatRemoteRunView,
  parseRemoteControl,
  updateRemoteRunView,
} from '../../src/control/remote-control.js';

test('help lists every supported phone command and important alias', () => {
  const help = formatPhoneHelp();
  for (const command of [
    '/status', '/steer TEXT', '/stop', '/run', '/interrupt', '/start', '/new', '/agent',
    '/agent N', '/agent codex', '/agent claude', '/decide N', '/decide TEXT', '/models',
    '/decide claude MODEL', '/decide codex MODEL', '/mode', '/mode manual', '/mode semi',
    '/mode full', '/help', '/commands',
  ]) assert.match(help, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(help, /normal messages queue/i);
  assert.match(help, /Trade approvals are normal replies/i);
  assert.match(help, /ok to execute/i);
  assert.match(help, /automatic availability switching remains enabled/i);
});

test('parses remote run controls without capturing normal prompts', () => {
  assert.deepEqual(parseRemoteControl('/run'), { action: 'status' });
  assert.deepEqual(parseRemoteControl('/stop'), { action: 'stop' });
  assert.deepEqual(parseRemoteControl('/interrupt'), { action: 'stop' });
  assert.deepEqual(parseRemoteControl('/steer focus on tests'), { action: 'steer', prompt: 'focus on tests' });
  assert.deepEqual(parseRemoteControl('/steer'), { action: 'steer', prompt: '' });
  assert.equal(parseRemoteControl('run the report'), null);
});

test('renders a compact live run card from structured events', () => {
  const view = createRemoteRunView('Fix the remote bridge', 0);
  updateRemoteRunView(view, 'started', { agent: 'codex', model: 'gpt-test' });
  updateRemoteRunView(view, 'execution', { phase: 'started', tool: 'command', summary: 'npm test' });
  const text = formatRemoteRunView(view, 65_000);
  assert.match(text, /^WORKING · Codex · gpt-test/);
  assert.match(text, /Elapsed: 1m 5s/);
  assert.match(text, /Progress: Running command — npm test/);
  assert.match(text, /You: No action needed\. Redirect: \/steer TEXT · Stop: \/stop/);
  assert.doesNotMatch(text, /Latest:|DONE:|\/run/);
  assert.ok(text.split('\n').length <= 5);
  updateRemoteRunView(view, 'execution', { phase: 'completed', ok: true, tool: 'command' });
  assert.match(formatRemoteRunView(view, 65_000), /Command finished successfully; the agent is continuing\./i);
  finishRemoteRunView(view, 'done');
  const complete = formatRemoteRunView(view, 66_000);
  assert.match(complete, /^COMPLETE ·/);
  assert.match(complete, /Result: Delivered below\./);
  assert.doesNotMatch(complete, /Progress:|Controls:/);
});

test('makes paused, stopped, and failed runs explicit about user action', () => {
  const waiting = createRemoteRunView('Choose a model', 0);
  finishRemoteRunView(waiting, 'paused');
  assert.match(formatRemoteRunView(waiting, 1_000), /^WAITING FOR YOU ·/);
  assert.match(formatRemoteRunView(waiting, 1_000), /Reply to the decision message below/);

  const stopped = createRemoteRunView('Long task', 0);
  finishRemoteRunView(stopped, 'interrupted');
  assert.match(formatRemoteRunView(stopped, 1_000), /^STOPPED ·/);
  assert.match(formatRemoteRunView(stopped, 1_000), /completed changes are preserved/);

  const failed = createRemoteRunView('Broken task', 0);
  finishRemoteRunView(failed, 'failed');
  assert.match(formatRemoteRunView(failed, 1_000), /^FAILED ·/);
  assert.match(formatRemoteRunView(failed, 1_000), /resend your request/);
});
