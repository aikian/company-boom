import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, targets, BONUS, BOSS, BOSS_LIFE, BONUS_EVERY, BONUS_LIFE, BEAM_BONUS, RAGE_BREAK, RAGE_HIT, ROUND, multiplier } from '../src/game.ts';

const smash = (game: Game, index: number) => { let last = null; while (game.slots[index].hp > 0) last = game.hit(index); return last!; };
const advance = (game: Game, seconds: number, step = .05) => { for (let t = 0; t < seconds - 1e-9; t += step) game.tick(Math.min(step, seconds - t)); };
const live = (game: Game) => game.slots.map((slot, i) => slot.hp > 0 && slot.cooldown === 0 ? i : -1).filter(i => i >= 0);
const chargeToFull = (game: Game) => { let guard = 0; while (game.rage < 100 && guard++ < 200) { for (const i of live(game)) game.hit(i); advance(game, .4); } };

test('initial layout alternates the three target kinds and starts in ready', () => {
  const game = new Game();
  assert.equal(game.phase, 'ready');
  assert.deepEqual(game.slots.map(slot => slot.kind), [0, 1, 2, 0, 1, 2]);
  assert.deepEqual(game.slots.map(slot => slot.hp), [1, 2, 3, 1, 2, 3]);
  assert.equal(game.hit(0), null, 'hits are ignored before start');
  assert.equal(game.fire(), null, 'beam is ignored before start');
});

test('timer only runs after the first hit, then ends the round at 15 seconds', () => {
  const game = new Game(); game.start();
  advance(game, 10);
  assert.equal(game.elapsed, 0); assert.equal(game.timeLeft, ROUND); assert.equal(ROUND, 15);
  assert.equal(game.phase, 'playing');
  game.hit(0);
  advance(game, ROUND - .1);
  assert.equal(game.phase, 'playing');
  advance(game, .2);
  assert.equal(game.phase, 'finale');
  assert.equal(game.elapsed, ROUND);
});

test('README example: two meetings and one printer with four hits, then timeout', () => {
  const game = new Game(); game.start();
  smash(game, 0); smash(game, 3); smash(game, 1);
  assert.equal(game.score, 200 + 250);
  assert.equal(game.rage, 4 * RAGE_HIT + 3 * RAGE_BREAK);
  assert.equal(game.destroyed, 3);
  advance(game, ROUND + 1);
  assert.equal(game.phase, 'finale');
  assert.equal(game.score, 450 + (4 * RAGE_HIT + 3 * RAGE_BREAK) * 20);
});

test('multiplier bands: x1 to 4, x1.5 at 5, x2 at 10, x3 at 20', () => {
  assert.deepEqual([1, 4, 5, 9, 10, 19, 20, 99].map(multiplier), [1, 1, 1.5, 1.5, 2, 2, 3, 3]);
});

test('combo multiplier applies to the breaking hit and resets after 1.2 seconds of silence', () => {
  const game = new Game(); game.start();
  const step = (index: number, combo: number, score: number) => { assert.ok(game.hit(index), `hit on slot ${index}`); assert.equal(game.combo, combo); assert.equal(game.score, score); advance(game, .4); };
  step(1, 1, 0); step(4, 2, 0); step(2, 3, 0); step(5, 4, 0);   // printers and desks absorb hits without breaking
  step(0, 5, 150);                                             // meeting breaks at combo 5 => 100 x 1.5
  step(2, 6, 150); step(5, 7, 150);
  step(3, 8, 300);                                             // still x1.5 in the 5-9 band
  step(0, 9, 300);                                             // slot 0 respawned as a printer
  step(1, 10, 800);                                            // printer breaks at combo 10 => 250 x 2
  assert.equal(game.maxCombo, 10);
  assert.ok(game.comboLeft > 0 && game.comboLeft < 1.2);
  advance(game, 1.3);
  assert.equal(game.combo, 0, 'combo display resets after 1.2s'); assert.equal(game.comboLeft, 0);
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

test('every 7th destruction queues a golden target that expires after 4 seconds', () => {
  const game = new Game(); game.start();
  for (let n = 0; n < BONUS_EVERY; n++) { smash(game, live(game)[0]); advance(game, .4); }
  assert.equal(game.destroyed, BONUS_EVERY);
  const golden = game.slots.findIndex(slot => slot.kind === BONUS);
  assert.ok(golden >= 0, 'a golden target spawned in the slot that respawned after the 7th break');
  assert.equal(game.slots[golden].hp, 2); assert.equal(game.slots[golden].expires, BONUS_LIFE);
  assert.equal(game.bonusPending, false);
  advance(game, BONUS_LIFE + .1);
  assert.notEqual(game.slots[golden].kind, BONUS, 'golden target vanished unclaimed');
  assert.equal(game.slots[golden].hp, targets[game.slots[golden].kind].hp, 'slot returned to its normal cycle at full health');
  // Claim one this time: it is worth 800 x multiplier and does not spawn another golden target.
  for (let n = 0; n < BONUS_EVERY; n++) { smash(game, live(game).find(i => game.slots[i].kind !== BONUS)!); advance(game, .4); }
  const again = game.slots.findIndex(slot => slot.kind === BONUS);
  assert.ok(again >= 0);
  advance(game, 1.5); const before = game.score; const combo = game.combo;
  const event = smash(game, again);
  assert.equal(event.kind, BONUS); assert.equal(event.points, 800 * multiplier(combo + 2));
  assert.equal(game.score, before + event.points);
  assert.equal(game.slots[again].expires, 0);
});

test('rage caps at 100, the beam clears every live target with a bonus and play continues', () => {
  const game = new Game(); game.start();
  assert.equal(game.fire(), null, 'cannot fire below 100');
  chargeToFull(game);
  assert.equal(game.rage, 100); assert.equal(game.phase, 'playing');
  advance(game, .5); // let cooldowns clear so all six are live
  const liveNow = live(game); const combo = game.combo; const before = game.score; const destroyed = game.destroyed;
  const expected = BEAM_BONUS + liveNow.reduce((sum, i) => sum + targets[game.slots[i].kind].points * multiplier(combo), 0);
  const strike = game.fire();
  assert.deepEqual(strike?.cleared, liveNow);
  assert.equal(strike?.gained, expected);
  assert.equal(game.score, before + expected);
  assert.equal(game.rage, 0); assert.equal(game.beams, 1); assert.equal(game.destroyed, destroyed + liveNow.length);
  assert.equal(game.phase, 'playing', 'the round keeps going');
  assert.equal(game.fire(), null, 'second fire needs a full gauge again');
  assert.ok(game.slots.every(slot => slot.hp === 0 && slot.cooldown === .5));
  advance(game, .6);
  assert.ok(game.slots.every(slot => slot.hp > 0), 'targets respawned after the beam');
});

test('timeout ends the round exactly once with the remaining rage as bonus', () => {
  const game = new Game(); game.start();
  game.hit(0);
  advance(game, ROUND + 1);
  assert.equal(game.phase, 'finale');
  assert.equal(game.score, 100 + (RAGE_HIT + RAGE_BREAK) * 20);
  assert.equal(game.finish(), false, 'finishing again is ignored');
  assert.equal(game.hit(0), null, 'input locked during finale'); assert.equal(game.fire(), null);
  advance(game, 4.1);
  assert.equal(game.phase, 'result');
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
  const game = new Game(); game.start(); smash(game, 2); chargeToFull(game); game.fire();
  game.reset();
  assert.equal(game.phase, 'ready'); assert.equal(game.score, 0); assert.equal(game.rage, 0); assert.equal(game.destroyed, 0); assert.equal(game.beams, 0); assert.equal(game.bonusPending, false);
  game.start(); game.hit(0); game.tick(NaN); game.tick(-1); game.tick(Infinity);
  assert.equal(game.elapsed, 0);
});

test('rank thresholds follow the plan', () => {
  const game = new Game();
  for (const [score, rank] of [[0, '오늘도 참은 사람'], [4999, '오늘도 참은 사람'], [5000, '회의실의 재앙'], [12000, '정시 퇴근 수호자'], [22000, '전설의 퇴사자']] as const) { game.score = score; assert.equal(game.rank, rank); }
  assert.equal(targets.length, 5);
});

test('a beam fired at 20+ combo summons the boss once; it is worth 3000 x multiplier and expires', () => {
  const game = new Game(); game.start();
  // Build a 20+ combo without breaking anything too fast: alternate printer/desk hits.
  let guard = 0;
  while (game.combo < 20 && guard++ < 100) { const i = live(game).find(i => game.slots[i].kind !== BONUS && game.slots[i].hp > 1) ?? live(game)[0]; game.hit(i); advance(game, .3); }
  assert.ok(game.combo >= 20);
  while (game.rage < 100) { game.hit(live(game)[0]); advance(game, .3); }
  assert.ok(game.combo >= 20, 'still in fever when firing');
  assert.ok(game.fire());
  assert.equal(game.bossPending, true); assert.equal(game.bossShown, true);
  advance(game, .6);
  const boss = game.slots.findIndex(slot => slot.kind === BOSS);
  assert.ok(boss >= 0, 'boss took the first respawned slot');
  assert.equal(game.slots[boss].hp, 5); assert.ok(game.slots[boss].expires > BOSS_LIFE - .7);
  const before = game.score; const combo = game.combo;
  const event = smash(game, boss);
  assert.equal(event.kind, BOSS); assert.equal(event.points, 3000 * multiplier(combo + 5)); assert.equal(game.score, before + event.points);
  assert.equal(game.bossKilled, true);
  chargeToFull(game); game.fire(); advance(game, .6);
  assert.equal(game.slots.findIndex(slot => slot.kind === BOSS), -1, 'only one boss per round');
  game.reset(); assert.equal(game.bossShown, false); assert.equal(game.bossKilled, false);
});

test('an unclaimed boss vanishes after 6 seconds and the slot returns to its cycle', () => {
  const game = new Game(); game.start();
  game.bossPending = true; game.hit(0); advance(game, .4);
  const boss = game.slots.findIndex(slot => slot.kind === BOSS); assert.ok(boss >= 0);
  advance(game, BOSS_LIFE + .1);
  assert.notEqual(game.slots[boss].kind, BOSS); assert.equal(game.bossKilled, false);
});
