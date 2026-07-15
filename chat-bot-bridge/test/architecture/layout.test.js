import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const bridgeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOMAINS = ['agents', 'broker', 'control', 'delivery', 'reports', 'runtime'];

test('bridge source and tests use the documented domain layout', () => {
  for (const domain of DOMAINS) {
    const source = path.join(bridgeRoot, 'src', domain);
    const tests = path.join(bridgeRoot, 'test', domain);
    assert.equal(fs.statSync(source).isDirectory(), true, `missing source domain ${domain}`);
    assert.equal(fs.statSync(tests).isDirectory(), true, `missing test domain ${domain}`);
    assert.equal(
      fs.readdirSync(tests).some((file) => file.endsWith('.test.js')),
      true,
      `missing discovered test in ${domain}`,
    );
  }

  assert.equal(fs.existsSync(path.join(bridgeRoot, 'server.js')), true);
  assert.equal(fs.existsSync(path.join(bridgeRoot, 'src', 'app', 'bridge-server.js')), true);
  assert.equal(fs.existsSync(path.join(bridgeRoot, 'agent-routing.js')), false);
  assert.equal(fs.existsSync(path.join(bridgeRoot, 'src', 'reliability')), false);
  assert.equal(fs.existsSync(path.resolve(bridgeRoot, '..', 'runtime', 'self-healing')), false);

  const app = fs.readFileSync(path.join(bridgeRoot, 'src', 'app', 'bridge-server.js'), 'utf8');
  assert.doesNotMatch(app, /selfHeal|self-heal|faultAdjudication|\/heal\b/);

  const pkg = JSON.parse(fs.readFileSync(path.join(bridgeRoot, 'package.json'), 'utf8'));
  assert.match(pkg.scripts.test, /test\/\*\/\*\.test\.js/);
});
