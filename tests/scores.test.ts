import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, insert, top, validate, MAX_ENTRIES } from '../server/scores.mjs';

test('names are trimmed, stripped of markup and capped at 12 characters', () => {
  assert.equal(cleanName('  동규 <b>🎂  '), '동규 b🎂');
  assert.equal(cleanName(''), '익명의 직장인');
  assert.equal(cleanName('가나다라마바사아자차카타파하'), '가나다라마바사아자차카타');
});

test('validate rejects impossible or malformed scores', () => {
  assert.equal(validate({ name: 'a', score: -1 }), null);
  assert.equal(validate({ name: 'a', score: 1.5 }), null);
  assert.equal(validate({ name: 'a', score: 999999 }), null);
  assert.equal(validate({ name: 'a', score: '850' }), null);
  assert.equal(validate(null), null);
  const ok = validate({ name: 'a', score: 850, combo: 4, destroyed: 3, rank: 'nope' });
  assert.equal(ok?.rank, '오늘도 참은 사람');
  assert.equal(validate({ score: 6000 })?.rank, '회의실의 재앙');
  assert.equal(validate({ score: 40000 })?.rank, '전설의 퇴사자');
});

test('insert keeps the list sorted, reports the position and caps the size', () => {
  let list: ReturnType<typeof validate>[] = [];
  for (const [i, score] of [500, 9000, 3000].entries()) list = insert(list, validate({ name: `p${i}`, score })!).list;
  assert.deepEqual(list.map(e => e!.score), [9000, 3000, 500]);
  const result = insert(list, validate({ name: 'new', score: 3000 })!);
  assert.equal(result.position, 3, 'ties rank behind the earlier entry');
  for (let i = 0; i < MAX_ENTRIES + 20; i++) list = insert(list, validate({ name: 'x', score: i })!).list;
  assert.equal(list.length, MAX_ENTRIES);
  assert.deepEqual(top(list, 2).map(e => e.score), [9000, 3000]);
  assert.ok(!('company' in top(list, 1)[0]));
});
