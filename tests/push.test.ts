import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampOffset, clampTime, isDue, localClock } from '../server/push.mjs';
import { summarize, kstDate } from '../server/plays.mjs';

test('reminder time and timezone offset are validated', () => {
  assert.equal(clampTime('17:50'), '17:50'); assert.equal(clampTime('7:5'), null); assert.equal(clampTime('24:00'), null); assert.equal(clampTime(null), null);
  assert.equal(clampOffset(-540), -540); assert.equal(clampOffset('x'), null); assert.equal(clampOffset(900), null);
});

test('a reminder is due once per local day inside a 20 minute window after the chosen time', () => {
  const kst = -540; // Asia/Seoul as getTimezoneOffset()
  const at = (h: number, m: number) => Date.UTC(2026, 8, 14, h - 9, m); // 2026-09-14 local KST
  const sub = { time: '17:50', offset: kst, lastSent: '' };
  assert.equal(localClock(at(17, 50), kst).time, '17:50');
  assert.equal(isDue(sub, at(17, 49)), false);
  assert.equal(isDue(sub, at(17, 50)), true);
  assert.equal(isDue(sub, at(18, 5)), true, 'still inside the window after a restart');
  assert.equal(isDue(sub, at(18, 11)), false, 'window closed');
  assert.equal(isDue({ ...sub, lastSent: '2026-09-14' }, at(17, 55)), false, 'already sent today');
  assert.equal(isDue({ ...sub, lastSent: '2026-09-13' }, at(17, 55)), true, 'yesterday does not count');
  assert.equal(isDue({ ...sub, time: '23:55' }, at(23, 59)), true, 'window is clamped at midnight');
});

test('play counter summarises today, this month and all time in KST', () => {
  const now = Date.UTC(2026, 8, 14, 2); // 11:00 KST on 2026-09-14
  assert.equal(kstDate(now), '2026-09-14');
  const buckets = { '2026-09-14': 3, '2026-09-01': 10, '2026-08-31': 7 };
  assert.deepEqual(summarize(buckets, now), { today: 3, month: 13, total: 20, monthLabel: '2026-09' });
});
