import test from 'node:test';
import assert from 'node:assert/strict';
import { utcNowIso, pacificLabel, pacificDateLabel } from '../../src/runtime/clock.js';

test('utcNowIso records an ISO-8601 UTC instant with a Z suffix', () => {
  assert.equal(utcNowIso(new Date('2026-07-14T16:53:39.439Z')), '2026-07-14T16:53:39.439Z');
  assert.match(utcNowIso(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
});

test('pacificLabel renders DST-correct Pacific clock time with its zone', () => {
  assert.match(pacificLabel(new Date('2026-07-14T16:30:00Z')), /9:30.*AM PDT/);
  assert.match(pacificLabel(new Date('2026-01-14T17:30:00Z')), /9:30.*AM PST/);
  assert.match(pacificLabel(Date.parse('2026-07-14T16:30:00Z')), /9:30.*AM PDT/);
});

test('pacificDateLabel uses the Pacific calendar day and labels it PT', () => {
  assert.equal(pacificDateLabel(new Date('2026-07-14T16:30:00Z')), 'Tue, Jul 14, 2026 PT');
  assert.equal(pacificDateLabel(new Date('2026-07-15T05:30:00Z')), 'Tue, Jul 14, 2026 PT');
});
