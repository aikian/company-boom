import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayStart, since, positionOf, insert, validate } from '../server/scores.mjs';

test('the daily board resets at midnight KST', () => {
  const kstMidnight = Date.UTC(2026, 8, 13) - 9 * 3600e3; // 2026-09-13 00:00 KST
  assert.equal(dayStart(kstMidnight), kstMidnight);
  assert.equal(dayStart(kstMidnight + 5 * 3600e3), kstMidnight, 'still the same KST day at 05:00');
  assert.equal(dayStart(kstMidnight + 23.9 * 3600e3), kstMidnight, 'just before the next midnight');
  assert.equal(dayStart(kstMidnight + 24 * 3600e3), kstMidnight + 86400e3, 'next day');
  assert.equal(dayStart(kstMidnight - 1), kstMidnight - 86400e3, 'previous day');
});

test('today board ranks only entries from today and reports a position', () => {
  const now = Date.now(); const start = dayStart(now);
  const old = { ...validate({ name: 'old', score: 9999 })!, at: start - 1000 };
  const mine = validate({ name: 'me', score: 3000 })!; const better = validate({ name: 'you', score: 5000 })!;
  let list = insert([], old).list; list = insert(list, better).list; list = insert(list, mine).list;
  assert.equal(positionOf(list, mine), 3, 'all-time position counts yesterday');
  const today = since(list, start);
  assert.deepEqual(today.map(e => e.name), ['you', 'me']);
  assert.equal(positionOf(today, mine), 2, 'daily position ignores yesterday');
});
