// Per-device play history and badges. Lives in localStorage; the server only ever sees scores.
import { readStore, writeStore } from './pwa';

export interface Round { at: number; score: number; combo: number; destroyed: number; beams: number; boss: boolean; rank: string }
export interface Stats { plays: number; destroyed: number; beams: number; bestScore: number; bestCombo: number; bossKills: number; history: Round[]; badges: string[]; percentile?: number }
export const BADGES: Record<string, { name: string; hint: string }> = {
  first: { name: '첫 출근', hint: '첫 판을 마쳤어요.' },
  combo20: { name: '20 콤보 클럽', hint: '한 판에 20콤보 이상.' },
  combo50: { name: '손가락 발전소', hint: '한 판에 50콤보 이상.' },
  beam2: { name: '퇴사빔 2연발', hint: '한 판에 퇴사빔 2회.' },
  boss: { name: '사장님 잡은 사람', hint: '20콤보 이상에서 퇴사빔을 쏘면 사장님이 나타나요. 잡아보세요.' },
  legend: { name: '전설의 퇴사자', hint: '22,000점 이상.' },
  streak7: { name: '개근 7일', hint: '7일 연속 플레이.' },
  plays30: { name: '한 달 치 야근', hint: '30판 플레이.' },
};
const KEY = 'boom-stats';
export function loadStats(): Stats {
  try { const value = JSON.parse(readStore(KEY, 'null')); if (value && typeof value === 'object') return { badges: [], history: [], ...value }; } catch { /* fall through */ }
  return { plays: 0, destroyed: 0, beams: 0, bestScore: 0, bestCombo: 0, bossKills: 0, history: [], badges: [] };
}
export function saveStats(stats: Stats) { writeStore(KEY, JSON.stringify(stats)); }
// Returns the badges earned by this round so the UI can announce them.
export function recordRound(stats: Stats, round: Round, streak: number) {
  stats.plays++; stats.destroyed += round.destroyed; stats.beams += round.beams;
  stats.bestScore = Math.max(stats.bestScore, round.score); stats.bestCombo = Math.max(stats.bestCombo, round.combo);
  if (round.boss) stats.bossKills++;
  stats.history = [...stats.history, round].slice(-60);
  const earned: string[] = [];
  const award = (id: string, ok: boolean) => { if (ok && !stats.badges.includes(id)) { stats.badges.push(id); earned.push(id); } };
  award('first', true); award('combo20', round.combo >= 20); award('combo50', round.combo >= 50); award('beam2', round.beams >= 2);
  award('boss', round.boss); award('legend', round.score >= 22000); award('streak7', streak >= 7); award('plays30', stats.plays >= 30);
  saveStats(stats);
  return earned;
}
export function sparkline(history: Round[], width = 320, height = 64) {
  const points = history.slice(-30).map(r => r.score);
  if (points.length < 2) return '';
  const max = Math.max(...points, 1); const step = width / (points.length - 1);
  const path = points.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(height - 4 - (v / max) * (height - 8)).toFixed(1)}`).join(' ');
  const last = points.length - 1;
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><path d="${path}" fill="none" stroke="#d5fc71" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${(last * step).toFixed(1)}" cy="${(height - 4 - (points[last] / max) * (height - 8)).toFixed(1)}" r="4" fill="#d5fc71"/></svg>`;
}
