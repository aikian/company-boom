export type Phase = 'ready' | 'playing' | 'paused' | 'finale' | 'result';
export const targets = [
  { name: '월요일 회의', hp: 1, points: 100, color: 0xffdc8b, quip: '이 회의는 메일로 끝났습니다.' },
  { name: '무한 수정 프린터', hp: 2, points: 250, color: 0xb8afff, quip: '최종_진짜최종_폭발.pdf' },
  { name: '야근 책상', hp: 3, points: 450, color: 0x86daca, quip: '오늘은 정시 퇴근입니다.' },
];
export interface Slot { kind: number; hp: number; cooldown: number; generation: number }
export class Game {
  phase: Phase = 'ready';
  score = 0; rage = 0; combo = 0; maxCombo = 0; destroyed = 0;
  elapsed = 0; finaleTime = 0; lastHit = -Infinity; started = false;
  slots: Slot[] = [];
  constructor() { this.reset(); }
  reset() {
    this.phase = 'ready'; this.score = this.rage = this.combo = this.maxCombo = this.destroyed = this.elapsed = this.finaleTime = 0;
    this.lastHit = -Infinity; this.started = false;
    this.slots = Array.from({ length: 6 }, (_, i) => ({ kind: i % 3, hp: targets[i % 3].hp, cooldown: 0, generation: 0 }));
  }
  start() { if (this.phase === 'ready') this.phase = 'playing'; }
  hit(index: number) {
    const slot = this.slots[index];
    if (this.phase !== 'playing' || !slot || slot.cooldown > 0 || slot.hp <= 0) return null;
    this.started = true;
    this.combo = this.elapsed - this.lastHit <= 1.2 ? this.combo + 1 : 1;
    this.lastHit = this.elapsed; this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.rage = Math.min(100, this.rage + 2); slot.hp--;
    const kind = slot.kind; const broken = slot.hp === 0;
    let points = 0;
    if (broken) {
      points = targets[kind].points * (this.combo >= 10 ? 2 : this.combo >= 5 ? 1.5 : 1);
      this.score += points; this.destroyed++; this.rage = Math.min(100, this.rage + 4); slot.cooldown = .35;
    }
    return { broken, points, kind, index };
  }
  tick(dt: number) {
    if (!Number.isFinite(dt) || dt < 0) return;
    if (this.phase === 'playing') {
      if (this.started) this.elapsed = Math.min(45, this.elapsed + dt);
      for (const slot of this.slots) if (slot.cooldown > 0) {
        slot.cooldown = Math.max(0, slot.cooldown - dt);
        if (!slot.cooldown) { slot.kind = (slot.kind + 1) % 3; slot.hp = targets[slot.kind].hp; slot.generation++; }
      }
      if (this.elapsed - this.lastHit > 1.2) this.combo = 0;
      if (this.elapsed >= 45) this.finish(true);
    } else if (this.phase === 'finale') {
      this.finaleTime += dt;
      if (this.finaleTime >= 4) this.phase = 'result';
    }
  }
  finish(timeout = false) {
    if (this.phase !== 'playing' || (!timeout && this.rage < 100)) return false;
    this.phase = 'finale'; this.score += this.rage * 20; this.finaleTime = 0; return true;
  }
  pause() { if (this.phase === 'playing') this.phase = 'paused'; }
  resume() { if (this.phase === 'paused') this.phase = 'playing'; }
  get rank() { return this.score >= 10000 ? '전설의 퇴사자' : this.score >= 6000 ? '정시 퇴근 수호자' : this.score >= 3000 ? '회의실의 재앙' : '오늘도 참은 사람'; }
}
