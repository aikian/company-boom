export type Phase = 'ready' | 'playing' | 'paused' | 'finale' | 'result';
export const ROUND = 15;          // seconds, counted from the first hit
export const COMBO_WINDOW = 1.2;  // seconds between hits to keep the combo alive
export const RESPAWN = .35;       // seconds before a destroyed slot refills
export const BEAM_RESPAWN = .5;   // slightly longer after the beam clears everything
export const BEAM_BONUS = 1000;   // flat bonus per beam, on top of every target's points
export const BONUS_EVERY = 7;     // every Nth destruction queues a golden target
export const BONUS_LIFE = 4;      // seconds the golden target stays before vanishing
export const BOSS_LIFE = 6;       // seconds the boss stays; it shows once per round after a fever beam
export const BOSS_COMBO = 20;     // fire the beam at this combo or higher to summon the boss
export const RAGE_HIT = 3; export const RAGE_BREAK = 5; // a steady player fills the gauge in 7-8 s
export const targets = [
  { name: '월요일 회의', hp: 1, points: 100, color: 0xffdc8b, quip: '이 회의는 메일로 끝났습니다.' },
  { name: '무한 수정 프린터', hp: 2, points: 250, color: 0xb8afff, quip: '최종_진짜최종_폭발.pdf' },
  { name: '야근 책상', hp: 3, points: 450, color: 0x86daca, quip: '오늘은 정시 퇴근입니다.' },
  { name: '긴급 수정 요청', hp: 2, points: 800, color: 0xffd84d, quip: '마감 전에 마감을 없앴습니다.' },
  { name: '사장님 결재판', hp: 5, points: 3000, color: 0xff665a, quip: '결재 완료. 사장님도 퇴근하세요.' },
];
export const BONUS = 3; // index of the golden target in `targets`
export const BOSS = 4;  // hidden target: summoned by a fever beam, once per round
export const RANKS: [number, string][] = [[22000, '전설의 퇴사자'], [12000, '정시 퇴근 수호자'], [5000, '회의실의 재앙'], [0, '오늘도 참은 사람']];
export const multiplier = (combo: number) => combo >= 20 ? 3 : combo >= 10 ? 2 : combo >= 5 ? 1.5 : 1;
export interface Slot { kind: number; cycle: number; hp: number; cooldown: number; expires: number; generation: number }
export class Game {
  phase: Phase = 'ready';
  score = 0; rage = 0; combo = 0; maxCombo = 0; destroyed = 0; beams = 0; bonusPending = false;
  bossPending = false; bossShown = false; bossKilled = false;
  elapsed = 0; finaleTime = 0; lastHit = -Infinity; started = false;
  slots: Slot[] = [];
  constructor() { this.reset(); }
  reset() {
    this.phase = 'ready'; this.score = this.rage = this.combo = this.maxCombo = this.destroyed = this.beams = this.elapsed = this.finaleTime = 0;
    this.lastHit = -Infinity; this.started = false; this.bonusPending = this.bossPending = this.bossShown = this.bossKilled = false;
    this.slots = Array.from({ length: 6 }, (_, i) => ({ kind: i % 3, cycle: i % 3, hp: targets[i % 3].hp, cooldown: 0, expires: 0, generation: 0 }));
  }
  start() { if (this.phase === 'ready') this.phase = 'playing'; }
  get comboLeft() { return this.combo ? Math.max(0, COMBO_WINDOW - (this.elapsed - this.lastHit)) : 0; }
  get timeLeft() { return Math.max(0, ROUND - this.elapsed); }
  private countBreak() { this.destroyed++; if (this.destroyed % BONUS_EVERY === 0) this.bonusPending = true; }
  hit(index: number) {
    const slot = this.slots[index];
    if (this.phase !== 'playing' || !slot || slot.cooldown > 0 || slot.hp <= 0) return null;
    this.started = true;
    this.combo = this.elapsed - this.lastHit <= COMBO_WINDOW ? this.combo + 1 : 1;
    this.lastHit = this.elapsed; this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.rage = Math.min(100, this.rage + RAGE_HIT); slot.hp--;
    const kind = slot.kind; const broken = slot.hp === 0;
    let points = 0;
    if (broken) {
      points = targets[kind].points * multiplier(this.combo);
      this.score += points; this.rage = Math.min(100, this.rage + RAGE_BREAK); slot.cooldown = RESPAWN; slot.expires = 0; this.countBreak();
      if (kind === BOSS) this.bossKilled = true;
    }
    return { broken, points, kind, index };
  }
  // The exit beam wipes every live target at the current multiplier, adds a flat bonus and resets rage. Play continues.
  fire() {
    if (this.phase !== 'playing' || this.rage < 100) return null;
    const mult = multiplier(this.combo); const cleared: number[] = []; let gained = BEAM_BONUS;
    for (const [i, slot] of this.slots.entries()) {
      if (slot.hp <= 0) continue;
      gained += targets[slot.kind].points * mult; slot.hp = 0; slot.cooldown = BEAM_RESPAWN; slot.expires = 0; cleared.push(i); this.countBreak();
    }
    this.score += gained; this.rage = 0; this.beams++; this.started = true; this.lastHit = this.elapsed;
    if (this.combo >= BOSS_COMBO && !this.bossShown) { this.bossPending = true; this.bossShown = true; }
    return { cleared, gained };
  }
  tick(dt: number) {
    if (!Number.isFinite(dt) || dt < 0) return;
    if (this.phase === 'playing') {
      if (this.started) this.elapsed = Math.min(ROUND, this.elapsed + dt);
      for (const slot of this.slots) {
        if (slot.cooldown > 0) {
          slot.cooldown = Math.max(0, slot.cooldown - dt);
          if (!slot.cooldown) {
            if (this.bossPending) { this.bossPending = false; slot.kind = BOSS; slot.expires = BOSS_LIFE; }
            else if (this.bonusPending) { this.bonusPending = false; slot.kind = BONUS; slot.expires = BONUS_LIFE; }
            else { slot.cycle = (slot.cycle + 1) % 3; slot.kind = slot.cycle; }
            slot.hp = targets[slot.kind].hp; slot.generation++;
          }
        } else if (slot.expires > 0 && slot.hp > 0) {
          slot.expires -= dt;
          if (slot.expires <= 0) { slot.expires = 0; slot.kind = slot.cycle; slot.hp = targets[slot.kind].hp; slot.generation++; }
        }
      }
      if (this.elapsed - this.lastHit > COMBO_WINDOW) this.combo = 0;
      if (this.elapsed >= ROUND) this.finish();
    } else if (this.phase === 'finale') {
      this.finaleTime += dt;
      if (this.finaleTime >= 4) this.phase = 'result';
    }
  }
  finish() {
    if (this.phase !== 'playing') return false;
    this.phase = 'finale'; this.score += this.rage * 20; this.finaleTime = 0; return true;
  }
  pause() { if (this.phase === 'playing') this.phase = 'paused'; }
  resume() { if (this.phase === 'paused') this.phase = 'playing'; }
  get rank() { return RANKS.find(([min]) => this.score >= min)![1]; }
}
