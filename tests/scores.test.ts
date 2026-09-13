import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, insert, page, top, validate, MAX_ENTRIES, PAGE_SIZE } from '../server/scores.mjs';

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
  assert.equal(top(list, 1)[0].company, '');
});

test('page slices the board 20 at a time and clamps out-of-range pages', () => {
  let list: ReturnType<typeof validate>[] = [];
  for (let i = 0; i < 45; i++) list = insert(list, validate({ name: `p${i}`, score: i * 10 })!).list;
  assert.equal(PAGE_SIZE, 20);
  assert.equal(top(list).length, 20, 'top defaults to one page');
  const first = page(list, 1);
  assert.deepEqual([first.page, first.pages, first.total, first.entries.length], [1, 3, 45, 20]);
  assert.equal(first.entries[0].score, 440);
  const last = page(list, 3);
  assert.deepEqual([last.entries.length, last.entries[0].score], [5, 40]);
  assert.equal(page(list, 99).page, 3, 'too-large page clamps to the last page');
  assert.equal(page(list, -4).page, 1);
  assert.equal(page(list, NaN).page, 1);
  assert.deepEqual([page([], 1).pages, page([], 1).entries.length], [1, 0]);
});
