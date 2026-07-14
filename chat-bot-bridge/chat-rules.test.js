import test from 'node:test';
import assert from 'node:assert/strict';

import { chatRulesBase } from './chat-rules.js';

test('report lifecycle preserves prior artifacts and requires an explicit update target', () => {
  const rules = chatRulesBase();
  assert.match(rules, /fresh report request, rerun, or scheduled run is a NEW report/);
  assert.match(rules, /Preserve existing reports/);
  assert.match(rules, /explicit request to update, revise, or correct a named existing report/);
  assert.match(rules, /If the target is ambiguous, ask which report/);
});

test('automatic report delivery does not weaken file boundaries', () => {
  const rules = chatRulesBase();
  assert.match(rules, /attached to the phone automatically/);
  assert.match(rules, /Only non-hidden files inside the ai-trader-toolbox repo/);
  assert.match(rules, /outside the bridge runtime directory/);
});
