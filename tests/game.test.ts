import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, targets } from '../src/game.ts';

const slotOf = (game: Game, kind: number) => game.slots.findIndex(slot => slot.kind === kind && slot.hp > 0 && slot.cooldown === 0);
const smash = (game: Game, index: number) => { let last = null; while (game.slots[index].hp > 0) last = game.hit(index); return last!; };
const advance = (game: Game, seconds: number, step = .05) => { for (let t = 0; t < seconds - 1e-9; t += step) game.tick(Math.min(step, seconds - t)); };

test('initial layout alternates the three target kinds and starts in ready', () => {
  const game = new Game();
  assert.equal(game.phase, 'ready');
  assert.deepEqual(game.slots.map(slot => slot.kind), [0, 1, 2, 0, 1, 2]);
  assert.deepEqual(game.slots.map(slot => slot.hp), [1, 2, 3, 1, 2, 3]);
  assert.equal(game.hit(0), null, 'hits are ignored before start');
});

test('timer only runs after the first hit, then ends the round at 45 seconds', () => {
  const game = new Game(); game.start();
  advance(game, 10);
  assert.equal(game.elapsed, 0);
  assert.equal(game.phase, 'playing');
  game.hit(0);
  advance(game, 44.9);
  assert.equal(game.phase, 'playing');
  advance(game, .2);
  assert.equal(game.phase, 'finale');
  assert.equal(game.elapsed, 45);
});

test('README example: two meetings and one printer with four hits totals 850 after timeout', () => {
  const game = new Game(); game.start();
  smash(game, 0); smash(game, 3); smash(game, 1);
  assert.equal(game.score, 200 + 250);
  assert.equal(game.rage, 4 * 2 + 3 * 4);
  assert.equal(game.destroyed, 3);
  advance(game, 46);
  assert.equal(game.phase, 'finale');
  assert.equal(game.score, 850);
});

test('combo multiplier steps at 5 and 10 and resets after 1.2 seconds of silence', () => {
  const game = new Game(); game.start();
  const step = (index: number, combo: number, score: number) => { assert.ok(game.hit(index), `hit on slot ${index}`); assert.equal(game.combo, combo); assert.equal(game.score, score); advance(game, .4); };
  step(1, 1, 0); step(4, 2, 0); step(2, 3, 0); step(5, 4, 0);   // printers and desks absorb hits without breaking
  step(0, 5, 150);                                             // meeting breaks at combo 5 => 100 x 1.5
  step(2, 6, 150); step(5, 7, 150);
  step(3, 8, 300);                                             // still x1.5 in the 5-9 band
  step(0, 9, 300);                                             // slot 0 respawned as a printer
  step(1, 10, 800);                                            // printer breaks at combo 10 => 250 x 2
  assert.equal(game.maxCombo, 10);
  advance(game, 1.3);
  assert.equal(game.combo, 0, 'combo display resets after 1.2s');
  step(4, 1, 1050);                                            // restart at 1 => 250 x 1
  assert.equal(game.maxCombo, 10);
});

test('destroyed slot ignores input during cooldown and respawns as the next kind', () => {
  const game = new Game(); game.start();
  const event = game.hit(0);
  assert.deepEqual(event, { broken: true, points: 100, kind: 0, index: 0 });
  assert.equal(game.slots[0].cooldown, .35);
  assert.equal(game.hit(0), null);
  advance(game, .3);
  assert.equal(game.hit(0), null);
  advance(game, .1);
  assert.equal(game.slots[0].kind, 1);
  assert.equal(game.slots[0].hp, 2);
  assert.equal(game.slots[0].generation, 1);
  assert.equal(game.hit(0)?.broken, false);
});

test('rage caps at 100 and unlocks the manual finale exactly once', () => {
  const game = new Game(); game.start();
  assert.equal(game.finish(), false, 'cannot fire below 100');
  let guard = 0;
  while (game.rage < 100 && guard++ < 200) { for (let i = 0; i < 6; i++) if (game.slots[i].hp > 0 && game.slots[i].cooldown === 0) game.hit(i); advance(game, .4); }
  assert.equal(game.rage, 100);
  const before = game.score;
  assert.equal(game.finish(), true);
  assert.equal(game.phase, 'finale');
  assert.equal(game.score, before + 2000);
  assert.equal(game.finish(), false, 'second fire is ignored');
  assert.equal(game.finish(true), false, 'timeout after fire is ignored');
  assert.equal(game.hit(0), null, 'input locked during finale');
  assert.equal(game.score, before + 2000);
  advance(game, 4.1);
  assert.equal(game.phase, 'result');
});

test('timeout below 100 rage still reaches the finale with proportional bonus', () => {
  const game = new Game(); game.start();
  game.hit(0);
  advance(game, 46);
  assert.equal(game.phase, 'finale');
  assert.equal(game.score, 100 + 6 * 20);
});

test('pause freezes the timer and resume continues it', () => {
  const game = new Game(); game.start(); game.hit(0);
  advance(game, 5);
  game.pause(); advance(game, 20);
  assert.equal(game.phase, 'paused');
  assert.equal(game.hit(1), null);
  assert.ok(Math.abs(game.elapsed - 5) < 1e-6);
  game.resume(); advance(game, 5);
  assert.ok(Math.abs(game.elapsed - 10) < 1e-6);
});

test('reset returns to a fresh round and ignores bad delta times', () => {
  const game = new Game(); game.start(); smash(game, 2);
  game.reset();
  assert.equal(game.phase, 'ready'); assert.equal(game.score, 0); assert.equal(game.rage, 0); assert.equal(game.destroyed, 0);
  game.start(); game.hit(0); game.tick(NaN); game.tick(-1); game.tick(Infinity);
  assert.equal(game.elapsed, 0);
});

test('rank thresholds follow the plan', () => {
  const game = new Game();
  for (const [score, rank] of [[0, '오늘도 참은 사람'], [2999, '오늘도 참은 사람'], [3000, '회의실의 재앙'], [6000, '정시 퇴근 수호자'], [10000, '전설의 퇴사자']] as const) { game.score = score; assert.equal(game.rank, rank); }
  assert.equal(targets.length, 3);
});
