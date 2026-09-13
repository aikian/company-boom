import './style.css';
import { BONUS, BOSS, Game, ROUND, targets } from './game';
import { themes, themeById } from './themes';
import { createNotify } from './notify';
import { BADGES, loadStats, recordRound, saveStats, sparkline } from './stats';
import { OfficeScene } from './scene';
import { Sound } from './audio';
import { readStore, setupPwa, writeStore } from './pwa';

const icon = (name: string) => {
  const paths: Record<string, string> = {
    bolt: '<path d="m13 2-8 12h7l-1 8 8-12h-7z"/>',
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    sound: '<path d="m11 5-6 4H2v6h3l6 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    install: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    chart: '<path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/>',
    trophy: '<path d="M7 3h10v7a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 15v5m-4 1h8"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    share: '<path d="M12 16V3m-5 5 5-5 5 5M5 13v8h14v-8"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.bolt}</svg>`;
};

document.querySelector('#app')!.innerHTML = `
<header class="header">
  <a class="brand" href="${import.meta.env.BASE_URL}" aria-label="회사 터뜨리기 홈"><span class="brand-mark">${icon('bolt')}</span><span>회사 터뜨리기<small>COMPANY BOOM</small></span></a>
  <div class="header-actions"><button id="install-open" class="subtle">${icon('install')}<span>앱 설치</span></button><button id="stats-open" class="icon-button" aria-label="내 기록">${icon('chart')}</button><button id="sound" class="icon-button" aria-label="소리 끄기" aria-pressed="true">${icon('sound')}</button><button id="settings" class="icon-button" aria-label="게임 설정">⚙</button></div>
</header>
<main class="shell">
  <section class="intro" id="intro">
    <div class="eyebrow"><span></span> <span id="greeting">15초 스트레스 해소</span></div>
    <h1>회사를<br><em>터뜨려라.</em><span class="title-star">✳</span></h1>
    <p class="lead">딱 15초. 부수고, 날리고, 퇴근.<br>오늘 쌓인 거, 여기서 다 털어요.</p>
    <form class="enter" id="enter"><label class="visually-hidden" for="player-name">닉네임</label><input id="player-name" maxlength="12" placeholder="닉네임 입력 (랭킹에 올라가요)" autocomplete="nickname" enterkeyhint="next"><label class="visually-hidden" for="company-name">부술 회사 이름 (선택)</label><input id="company-name" maxlength="16" placeholder="부술 회사 이름 (선택) · 기본: 주식회사 내일부터" autocomplete="organization" enterkeyhint="go"><button id="start" class="primary start-button" type="submit" disabled><span id="start-label">사무실 준비 중…</span>${icon('arrow')}</button></form>
    <div class="start-note"><span>가입 없이 바로</span><i>·</i><span>모바일 & PC</span><i>·</i><span>소리 켜고 하세요 🔊</span></div>
    <details class="rules"><summary>게임 규칙 보기</summary><ul>
      <li><b>15초</b> — 첫 타격부터 시작. 끝나면 건물이 무너져요. 쉬지 말고 두드리세요.</li>
      <li><b>탭 = 1대</b> — 회의 자료 1대 100점 · 프린터 2대 250점 · 야근 책상 3대 450점.</li>
      <li><b>콤보</b> — 1.2초 안에 계속 치면 유지. 5콤보 ×1.5 · 10콤보 ×2 · 20콤보 ×3.</li>
      <li><b>퇴사빔</b> — 분노 100%면 발사! 화면의 모든 표적을 한 번에 부수고 <b>+1,000</b>. 콤보 높을 때 쏘면 더 커요. 게임은 계속.</li>
      <li><b>긴급 수정 요청</b> — 7개 부술 때마다 황금 표적 등장. 4초 안에 부수면 <b>800점</b>.</li>
      <li><b>종료 보너스</b> — 남은 분노 × 20점.</li>
    </ul></details>
  </section>
  <section class="arena" id="arena" aria-label="게임 플레이 영역">
    <div class="arena-grid"></div><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
    <div class="scene-top"><div><span class="live-dot"></span><span id="scene-label">오늘의 철거 대상</span></div><span class="edition">OFFICE / 001</span></div>
    <div class="hud" id="hud" hidden><div><small>남은 시간</small><strong id="timer">15<span>s</span></strong></div><div class="hud-score"><small>SCORE</small><strong id="score">0</strong></div><button id="pause" class="icon-button" aria-label="일시정지">${icon('pause')}</button></div>
    <div id="scene" class="scene"><div id="loading" class="loading"><span></span>당신의 회사를 준비하고 있어요</div><div class="target-layer" id="target-layer"></div></div>
    <div id="flash" class="flash" aria-hidden="true"></div><div id="combo" class="combo" hidden><strong>0</strong><span>COMBO</span><i class="combo-bar"><b id="combo-bar"></b></i></div>
    <div class="scene-caption" id="scene-caption"><span class="mini-tag">100% 가상 회사</span><p>주식회사 내일부터</p><small>업무는 무한. 당신의 인내심은 유한.</small></div>
    <div id="play-bottom" class="play-bottom" hidden><p id="quip">사무용품을 터치하면 15초가 시작돼요.</p><div class="rage-label"><span>${icon('bolt')} 분노 게이지</span><strong id="rage-value">0%</strong></div><div class="rage-track"><div id="rage-fill"></div></div><button id="fire" class="primary fire-button" disabled>${icon('bolt')}<span>퇴사빔 충전 중</span><small>0 / 100</small></button></div>
    <div id="finale-caption" class="finale-caption" hidden><small>ULTIMATE RELEASE</small><h2>퇴사빔.</h2><p>업무 종료. 내 인생 시작.</p></div>
    <div id="pause-panel" class="pause-panel" hidden><span>Ⅱ</span><h2>잠깐 쉬어가요.</h2><p>스트레스도, 타이머도 멈췄어요.</p><button id="resume" class="primary">계속하기 ${icon('arrow')}</button><button id="quit" class="subtle">처음으로</button></div>
    <div id="scene-error" class="pause-panel" hidden><h2>3D 화면을 열 수 없어요.</h2><p>최신 Safari나 Chrome에서 다시 시도해 주세요.</p><button id="reload" class="primary">다시 불러오기</button></div>
  </section>
  <section class="ranking" id="ranking-panel" aria-label="랭킹"><div class="ranking-head"><h2>${icon('trophy')} 실시간 랭킹</h2><div class="ranking-tabs" role="tablist"><button id="tab-today" class="selected" role="tab" aria-selected="true">오늘</button><button id="tab-all" role="tab" aria-selected="false">전체</button></div></div><span id="ranking-total" class="ranking-total"></span><ol id="ranking" class="ranking-list"><li class="ranking-empty">랭킹을 불러오는 중…</li></ol><nav id="ranking-pager" class="ranking-pager" aria-label="랭킹 페이지" hidden></nav><div class="record">내 최고 기록 <strong id="best-score">0</strong><small>PT</small></div><div class="streak" id="streak" hidden></div></section>
  <footer class="plays" id="plays"><span>이번 달 플레이 <b id="plays-month">–</b>판</span><i>·</i><span>오늘 <b id="plays-today">–</b>판</span><i>·</i><span>누적 <b id="plays-total">–</b>판</span><small class="version">v${__APP_VERSION__}</small></footer>
</main>
<dialog id="install-dialog" class="install-dialog"><button id="install-close" class="dialog-close icon-button" aria-label="설치 안내 닫기">${icon('close')}</button><div class="app-icon">${icon('bolt')}</div><div class="eyebrow">YOUR POCKET-SIZED ESCAPE</div><h2>퇴근 버튼을<br>홈 화면에.</h2><p class="dialog-description">앱으로 설치하면 더 빠르고, 더 몰입감 있게.<br>한 번 준비하면 오프라인에서도 즐길 수 있어요.</p><div id="install-help" class="install-help"></div><button id="install-action" class="primary" hidden>${icon('install')} 앱 설치하기</button><button id="install-later" class="later-button">지금은 웹으로 플레이</button><small class="install-free">무료 · 회원가입 없음 · 앱스토어 없이 설치</small></dialog>
<dialog id="settings-dialog" class="settings-dialog"><button class="dialog-close icon-button" id="settings-close" aria-label="설정 닫기">${icon('close')}</button><div class="eyebrow">SETTINGS</div><h2>내 취향대로.</h2>
  <section class="setting-group"><label class="setting-row">소리 <input id="setting-sound" type="checkbox"></label><label class="setting-row">움직임 줄이기 <input id="reduced" type="checkbox"></label><p class="muted">카메라 흔들림·슬로모션·파편 효과를 줄여요.</p></section>
  <section class="setting-group"><h3>사무실 테마</h3><div class="theme-grid" id="theme-grid" role="radiogroup" aria-label="사무실 테마"></div></section>
  <section class="setting-group"><h3>퇴근 알림</h3><label class="setting-row">매일 정한 시간에 알림 받기 <input id="notify-toggle" type="checkbox"></label>
    <div id="notify-consent" class="consent" hidden><p><b>퇴근 알림을 켤까요?</b></p><ul><li>하루 <b>한 번</b>, 정한 시간에만 보내요.</li><li>내용은 "회사 터뜨리러 갈 시간" 같은 한 줄이에요.</li><li>닉네임 외에 다른 정보는 저장하지 않고, 언제든 여기서 끌 수 있어요.</li><li>다음 화면에서 브라우저가 알림 권한을 물어봐요.</li></ul><div class="row"><button id="notify-agree" class="primary">동의하고 켜기</button><button id="notify-cancel" class="subtle">취소</button></div></div>
    <label class="setting-inline">알림 시간 <input id="notify-time" type="time" value="17:50" step="300"></label><div id="notify-body" class="row" hidden><button id="notify-test" class="subtle">테스트 알림 보내기</button></div>
    <p class="muted" id="notify-status">브라우저 알림 권한이 필요해요. iPhone은 홈 화면에 설치한 앱에서 켤 수 있어요.</p></section>
  <section class="setting-group setting-foot"><button id="check-update" class="subtle">업데이트 확인</button><small class="version">v${__APP_VERSION__}</small></section>
  <button id="settings-save" class="primary">닫기</button></dialog>
<dialog id="stats-dialog" class="stats-dialog"><button class="dialog-close icon-button" id="stats-close" aria-label="기록 닫기">${icon('close')}</button><div class="eyebrow">MY RECORD</div><h2 id="stats-title">내 기록</h2><div id="stats-body"></div><button id="stats-done" class="primary">닫기</button></dialog>
<dialog id="result-dialog" class="result-dialog"><div class="eyebrow">MISSION COMPLETE</div><div class="result-emblem">✳</div><p id="result-greeting">오늘도 수고했어요.</p><h2 id="result-rank"></h2><div class="result-score"><strong id="result-score">0</strong><span>POINTS</span></div><p id="result-position" class="result-position"></p><div class="result-stats"><div><b id="result-destroyed">0</b><span>부순 스트레스</span></div><div><b id="result-combo">0</b><span>최대 콤보</span></div><div><b id="result-beams">0</b><span>퇴사빔</span></div><div><b id="result-best">0</b><span>최고 기록</span></div></div><p id="new-record" class="new-record" hidden>NEW BEST · 오늘의 나를 뛰어넘었어요!</p><button id="replay" class="primary">${icon('refresh')} 한 번 더 터뜨리기</button><div class="result-actions"><button id="save-card" class="subtle">${icon('install')} 카드 저장</button><button id="share" class="subtle">${icon('share')} 링크 공유</button></div><button id="result-home" class="later-button">처음으로</button></dialog>
<div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const API = `${import.meta.env.BASE_URL}api/`;
const game = new Game(); const sound = new Sound();
sound.muted = readStore('boom-muted', 'no') === 'yes';
let scene: OfficeScene | undefined; let lastPhase = game.phase; let lastTime = performance.now(); let boomPlayed = false; let rageReady = false; let goldenShown = false;
let best = Number(readStore('boom-best', '0')) || 0; let toastTimer: ReturnType<typeof setTimeout>; let captured = '';
const notify = (text: string) => { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4200); };
const buzz = (pattern: number | number[]) => { try { navigator.vibrate?.(pattern); } catch { /* Optional haptics. */ } };
const nameInput = $<HTMLInputElement>('player-name'); nameInput.value = readStore('boom-name', '');
const playerName = () => nameInput.value.trim().slice(0, 12) || '익명의 직장인';
const companyInput = $<HTMLInputElement>('company-name'); companyInput.value = readStore('boom-company', '');
const companyName = () => companyInput.value.trim().slice(0, 16) || '주식회사 내일부터';
// Korean object particle: 을 after a final consonant, 를 otherwise; non-Hangul endings get both.
const eul = (word: string) => { const code = word.charCodeAt(word.length - 1); return code >= 0xac00 && code <= 0xd7a3 ? ((code - 0xac00) % 28 ? '을' : '를') : '을(를)'; };
const smashed = (name: string, company: string) => `${name}님이 회사 ${company}${eul(company)} 부쉈습니다`;
function applyCompany() { const company = companyName(); scene?.setName(company); $('scene-caption').querySelector('p')!.textContent = company; }
companyInput.addEventListener('change', () => { writeStore('boom-company', companyInput.value.trim()); applyCompany(); });
const notifier = createNotify(API, playerName);
const stats = loadStats();
let theme = themeById(readStore('boom-theme', 'default'));
// Time-of-day greeting so the landing page feels alive for daily players.
function greeting() {
  const now = new Date(); const h = now.getHours(); const day = now.getDay();
  if (day === 1 && h < 12) return '월요일이네요. 부수고 시작하죠.';
  if (day === 5 && h >= 15) return '불금! 회사는 두고 가요.';
  if (h < 5 || h >= 23) return '야근 중이신가요… 15초만 쉬어요.';
  if (h < 10) return '좋은 아침. 출근 전에 한 판?';
  if (h < 14) return '점심시간 파괴 타임 🍱';
  if (h < 18) return '오후 회의, 끝났나요?';
  return '퇴근하셨어요? 마무리 한 방.';
}
$('greeting').textContent = greeting();
async function loadPlays() {
  try { const p = await (await fetch(`${API}plays`, { cache: 'no-store' })).json(); $('plays-month').textContent = p.month.toLocaleString(); $('plays-today').textContent = p.today.toLocaleString(); $('plays-total').textContent = p.total.toLocaleString(); }
  catch { /* the counter is decoration */ }
}
const anchors = Array.from({ length: 6 }, (_, i) => {
  const button = document.createElement('button'); button.className = 'target'; button.dataset.index = String(i);
  button.addEventListener('click', () => hit(i)); $('target-layer').append(button); return button;
});
function soundUI() { $('sound').setAttribute('aria-label', sound.muted ? '소리 켜기' : '소리 끄기'); $('sound').setAttribute('aria-pressed', String(!sound.muted)); $('sound').classList.toggle('muted-sound', sound.muted); }
soundUI(); $('best-score').textContent = best.toLocaleString();
const reduced = $('reduced') as HTMLInputElement;
reduced.checked = readStore('boom-reduced', String(matchMedia('(prefers-reduced-motion: reduce)').matches)) === 'true';
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
type Entry = { name: string; score: number; rank: string; company?: string };
type Board = { top: Entry[]; total: number; today: Entry[]; todayTotal: number };
type Page = { entries: Entry[]; page: number; pages: number; total: number };
const PAGE_SIZE = 20; const MAX_SHOWN = 100;
let board: Board = { top: [], total: 0, today: [], todayTotal: 0 }; let tab: 'today' | 'all' = 'today';
// Bulletin-board style paging: page 1 comes with the board itself, later pages are fetched on demand and cached per tab.
const pageNo: Record<'today' | 'all', number> = { today: 1, all: 1 };
const pageCache = new Map<string, Page>();
let pageRequest = 0;
function firstPage(data: Board, which: 'today' | 'all'): Page {
  const total = which === 'today' ? data.todayTotal : data.total;
  return { entries: which === 'today' ? data.today : data.top, page: 1, pages: Math.max(1, Math.ceil(Math.min(total, MAX_SHOWN) / PAGE_SIZE)), total };
}
function renderRanking(data: Board) {
  board = data; pageCache.clear(); pageNo.today = 1; pageNo.all = 1;
  renderPage(firstPage(data, tab));
}
function renderPage(current: Page) {
  const total = current.total; const offset = (current.page - 1) * PAGE_SIZE;
  $('tab-today').classList.toggle('selected', tab === 'today'); $('tab-all').classList.toggle('selected', tab === 'all');
  $('tab-today').setAttribute('aria-selected', String(tab === 'today')); $('tab-all').setAttribute('aria-selected', String(tab === 'all'));
  $('ranking-total').textContent = total ? `${tab === 'today' ? '오늘' : '전체'} ${total.toLocaleString()}명 참여` : '';
  $('ranking').innerHTML = current.entries.length
    ? current.entries.map((entry, i) => `<li${entry.name === playerName() && entry.score === best ? ' class="mine"' : ''}><span class="place">${['🥇', '🥈', '🥉'][offset + i] || offset + i + 1}</span><span class="who">${escape(smashed(entry.name, entry.company || '주식회사 내일부터'))}<small>${escape(entry.rank)}</small></span><b>${entry.score.toLocaleString()}</b></li>`).join('')
    : `<li class="ranking-empty">${tab === 'today' ? '오늘 아직 아무도 안 부쉈어요. 첫 퇴사자가 되어 보세요!' : '아직 아무도 없어요. 첫 번째 퇴사자가 되어 보세요!'}</li>`;
  renderPager(current);
}
function renderPager({ page, pages }: Page) {
  const pager = $('ranking-pager'); pager.hidden = pages <= 1; if (pages <= 1) return;
  const from = Math.max(1, Math.min(page - 2, pages - 4)); const to = Math.min(pages, from + 4);
  const numbers = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  pager.innerHTML = `<button data-page="${page - 1}"${page <= 1 ? ' disabled' : ''} aria-label="이전 페이지">‹</button>`
    + (from > 1 ? `<button data-page="1">1</button>${from > 2 ? '<i>…</i>' : ''}` : '')
    + numbers.map(n => `<button data-page="${n}"${n === page ? ' class="selected" aria-current="page"' : ''}>${n}</button>`).join('')
    + (to < pages ? `${to < pages - 1 ? '<i>…</i>' : ''}<button data-page="${pages}">${pages}</button>` : '')
    + `<button data-page="${page + 1}"${page >= pages ? ' disabled' : ''} aria-label="다음 페이지">›</button>`;
}
async function showPage(number: number) {
  pageNo[tab] = number; const key = `${tab}:${number}`;
  if (number === 1) return renderPage(firstPage(board, tab));
  const cached = pageCache.get(key); if (cached) return renderPage(cached);
  const request = ++pageRequest; $('ranking').classList.add('loading');
  try {
    const data = (await (await fetch(`${API}scores?board=${tab}&page=${number}`, { cache: 'no-store' })).json()) as Page;
    pageCache.set(key, data); if (request === pageRequest) { pageNo[tab] = data.page; renderPage(data); }
  } catch { if (request === pageRequest) notify('랭킹 페이지를 불러올 수 없어요.'); }
  finally { $('ranking').classList.remove('loading'); }
}
$('tab-today').addEventListener('click', () => { tab = 'today'; void showPage(pageNo.today); });
$('tab-all').addEventListener('click', () => { tab = 'all'; void showPage(pageNo.all); });
$('ranking-pager').addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-page]'); if (!button || button.disabled) return;
  void showPage(Number(button.dataset.page)); $('ranking-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
// Daily streak: one stamp per local calendar day you played.
const today = () => new Date().toLocaleDateString('sv-SE');
function computeStreak() {
  let days: string[] = []; try { days = JSON.parse(readStore('boom-days', '[]')); } catch { days = []; }
  const set = new Set(days); let streak = 0; const cursor = new Date();
  if (!set.has(today())) cursor.setDate(cursor.getDate() - 1);
  while (set.has(cursor.toLocaleDateString('sv-SE'))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  return { streak, set };
}
const currentStreak = () => computeStreak().streak;
function renderStreak() {
  const { streak, set } = computeStreak();
  const plays = Number(readStore('boom-plays', '0')) || 0;
  $('streak').hidden = !plays;
  $('streak').innerHTML = `${streak > 1 ? `🔥 <b>${streak}일</b> 연속 퇴근 중` : set.has(today()) ? '✅ 오늘 출근 도장 완료' : '🕘 오늘 아직 안 부쉈어요'} · 총 <b>${plays}</b>판`;
}
function stampToday() {
  let days: string[] = []; try { days = JSON.parse(readStore('boom-days', '[]')); } catch { days = []; }
  if (!days.includes(today())) days.push(today());
  writeStore('boom-days', JSON.stringify(days.slice(-400))); writeStore('boom-plays', String((Number(readStore('boom-plays', '0')) || 0) + 1)); renderStreak();
}
renderStreak();
async function loadRanking() {
  try { renderRanking(await (await fetch(`${API}scores`, { cache: 'no-store' })).json()); }
  catch { $('ranking').innerHTML = '<li class="ranking-empty">랭킹을 불러올 수 없어요. 게임은 그대로 즐길 수 있어요.</li>'; }
}
async function submitScore() {
  const body = { name: playerName(), score: game.score, combo: game.maxCombo, destroyed: game.destroyed, rank: game.rank, company: companyName() };
  const response = await fetch(`${API}scores`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as Board & { position: number; todayPosition: number };
}
function screenFlash(color: string) {
  const el = $('flash'); el.style.background = color; el.classList.add('on');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('on')));
}
function callout(text: string, cls = '') {
  const el = document.createElement('div'); el.className = `callout ${cls}`; el.textContent = text; $('arena').append(el); setTimeout(() => el.remove(), 1200);
}
let shownScore = 0; let feverOn = false;
function float(text: string, left: string, top: string, big = false) {
  const points = document.createElement('span'); points.className = big ? 'floating-points big' : 'floating-points'; points.textContent = text;
  points.style.left = left; points.style.top = top; $('target-layer').append(points); setTimeout(() => points.remove(), big ? 1300 : 850);
}
function hit(index: number) {
  if (document.querySelector('dialog[open]')) return;
  const event = game.hit(index); if (!event) return;
  sound.unlock(); sound.hit(event.kind, event.broken, game.combo); scene?.hit(index, event.broken, event.kind); buzz(event.broken ? [30, 20, 40] : 12);
  $('quip').textContent = event.broken ? targets[event.kind].quip : ['좋아요, 한 번 더!', '부숴! 부숴!', '아직 안 부서졌어요.', '거의 다 왔어요!'][Math.floor(Math.random() * 4)];
  if (event.points) float(`+${event.points.toLocaleString()}`, anchors[index].style.left, anchors[index].style.top, event.kind === BONUS);
  if (event.broken) screenFlash(event.kind === BONUS ? 'rgba(255,216,77,.34)' : event.kind === BOSS ? 'rgba(255,102,90,.5)' : 'rgba(255,244,219,.16)');
  if (event.broken && event.kind === BOSS) { callout('결재 완료! 사장님 퇴근 👋', 'fever'); sound.milestone(2); buzz([80, 40, 120]); }
  if (game.combo === 5) { callout('5 COMBO! ×1.5'); sound.milestone(0); }
  else if (game.combo === 10) { callout('10 COMBO 🔥 ×2', 'hot'); sound.milestone(1); buzz([15, 20, 30]); }
  else if (game.combo === 20) { callout('20 COMBO ⚡ FEVER ×3', 'fever'); sound.milestone(2); buzz([20, 20, 20, 20, 80]); }
  else if (game.combo > 20 && game.combo % 10 === 0) callout(`${game.combo} COMBO ⚡`, 'fever');
  const combo = $('combo'); combo.classList.remove('pop'); void combo.offsetWidth; combo.classList.add('pop');
  sync();
}
function sync() {
  const playing = game.phase === 'playing' || game.phase === 'paused';
  document.body.classList.toggle('is-playing', game.phase !== 'ready');
  $('hud').hidden = !playing; $('play-bottom').hidden = !playing;
  $('scene-caption').hidden = game.phase !== 'ready'; $('scene-label').textContent = game.phase === 'ready' ? '오늘의 철거 대상' : 'STRESS RELEASE IN PROGRESS';
  $('pause-panel').hidden = game.phase !== 'paused'; $('finale-caption').hidden = game.phase !== 'finale';
  $('timer').innerHTML = `${Math.ceil(game.timeLeft)}<span>s</span>`;
  $('timer').classList.toggle('urgent', game.started && game.timeLeft <= 5);
  shownScore = Math.abs(game.score - shownScore) < 2 || game.phase === 'result' ? game.score : shownScore + (game.score - shownScore) * .22;
  $('score').textContent = Math.round(shownScore).toLocaleString(); $('rage-value').textContent = `${game.rage}%`; $('rage-fill').style.width = `${game.rage}%`;
  document.querySelector('.rage-track')!.classList.toggle('hot', game.rage >= 70);
  $('arena').classList.toggle('hot', game.phase === 'playing' && game.combo >= 10); $('arena').classList.toggle('fever', game.phase === 'playing' && game.combo >= 20);
  const wantFever = game.phase === 'playing' && game.combo >= 10 && !sound.muted;
  if (wantFever !== feverOn) { feverOn = wantFever; sound.fever(feverOn); }
  const fire = $<HTMLButtonElement>('fire'); fire.disabled = game.rage < 100 || game.phase !== 'playing'; fire.classList.toggle('charged', game.rage === 100);
  fire.querySelector('span')!.textContent = game.rage === 100 ? '퇴사빔 발사! 전부 부수기 +1,000' : `퇴사빔 충전 중${game.beams ? ` · ${game.beams}회 발사` : ''}`; fire.querySelector('small')!.textContent = `${game.rage} / 100`;
  $('combo').hidden = game.combo < 2 || game.phase !== 'playing'; $('combo').querySelector('strong')!.textContent = String(game.combo);
  $('combo').classList.toggle('hot', game.combo >= 10); $('combo-bar').style.width = `${game.comboLeft / 1.2 * 100}%`;
  anchors.forEach((button, i) => {
    const slot = game.slots[i]; button.hidden = game.phase !== 'playing' || slot.hp <= 0; button.classList.toggle('bonus', slot.kind === BONUS); button.classList.toggle('boss', slot.kind === BOSS); button.dataset.kind = String(slot.kind);
    button.setAttribute('aria-label', `${i + 1}번 ${targets[slot.kind].name} · 체력 ${slot.hp}${slot.kind === BONUS ? ` · ${Math.ceil(slot.expires)}초 남음` : ''}`);
    button.innerHTML = `<small>${'●'.repeat(Math.max(0, slot.hp))}</small>${slot.kind === BONUS ? `<em>${slot.expires.toFixed(1)}s</em>` : ''}`;
  });
}
function begin() {
  if (!scene) return;
  writeStore('boom-name', nameInput.value.trim()); writeStore('boom-company', companyInput.value.trim()); applyCompany();
  game.reset(); scene.reset(); game.start(); boomPlayed = false; rageReady = false; goldenShown = false; bossSeen = false; captured = ''; shownScore = 0; sound.unlock(); sync(); stampToday();
  fetch(`${API}plays`, { method: 'POST' }).then(r => r.json()).then(p => { $('plays-month').textContent = p.month.toLocaleString(); $('plays-today').textContent = p.today.toLocaleString(); $('plays-total').textContent = p.total.toLocaleString(); }).catch(() => {});
  $('quip').textContent = `사무용품을 터치하면 ${ROUND}초가 시작돼요.`;
  $('arena').scrollIntoView({ behavior: 'instant', block: 'start' });
}
function home() { game.reset(); scene?.reset(); sync(); void loadRanking(); void loadPlays(); void loadPlays(); $('greeting').textContent = greeting(); window.scrollTo({ top: 0, behavior: 'instant' }); applyUpdate(); }
let bossSeen = false;
// A new build swaps in silently while you are on the landing page; mid-round it waits until you are back home.
let pendingUpdate: (() => void) | null = null;
setInterval(() => applyUpdate(), 2000);
function applyUpdate() {
  if (!pendingUpdate || game.phase !== 'ready' || document.querySelector('dialog[open]')) return;
  const apply = pendingUpdate; pendingUpdate = null; notify('새 버전으로 업데이트하는 중…'); setTimeout(apply, 600);
}
try { if (sessionStorage.getItem('boom-updated')) { sessionStorage.removeItem('boom-updated'); setTimeout(() => notify(`업데이트 완료 · v${__APP_VERSION__}`), 800); } } catch { /* optional */ }
$('enter').addEventListener('submit', event => { event.preventDefault(); if (!$<HTMLButtonElement>('start').disabled) begin(); });
$('fire').addEventListener('click', () => {
  const strike = game.fire(); if (!strike) return;
  sound.unlock(); sound.zap(); scene?.strike(strike.cleared); buzz([60, 40, 60, 40, 120]); screenFlash('rgba(213,252,113,.5)'); callout('퇴사빔!!', 'fever');
  float(`+${strike.gained.toLocaleString()}`, '50%', '38%', true); $('quip').textContent = `퇴사빔! 표적 ${strike.cleared.length}개를 한 번에 날렸어요.`;
  rageReady = false; sync();
});
$('pause').addEventListener('click', () => { game.pause(); sync(); });
$('resume').addEventListener('click', () => { lastTime = performance.now(); game.resume(); sound.unlock(); sync(); });
$('quit').addEventListener('click', home);
$('sound').addEventListener('click', () => { sound.muted = !sound.muted; writeStore('boom-muted', sound.muted ? 'yes' : 'no'); if (sound.muted) { sound.fever(false); feverOn = false; } sound.unlock(); soundUI(); });
const settings = $<HTMLDialogElement>('settings-dialog');
const soundSetting = $<HTMLInputElement>('setting-sound');
function applyTheme(next: typeof theme) {
  theme = next; writeStore('boom-theme', theme.id); scene?.setTheme(theme);
  $('scene-caption').querySelector('.mini-tag')!.textContent = `${theme.emoji} ${theme.name}`;
  for (const button of $('theme-grid').querySelectorAll('button')) { const on = button.dataset.theme === theme.id; button.classList.toggle('selected', on); button.setAttribute('aria-checked', String(on)); }
}
$('theme-grid').innerHTML = themes.map(t => `<button type="button" role="radio" data-theme="${t.id}" aria-checked="false"><span class="theme-emoji">${t.emoji}</span><b>${t.name}</b><small>${t.desc}</small></button>`).join('');
$('theme-grid').addEventListener('click', event => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-theme]'); if (button) { applyTheme(themeById(button.dataset.theme!)); sound.unlock(); sound.milestone(0); } });
const notifyToggle = $<HTMLInputElement>('notify-toggle'); const notifyTime = $<HTMLInputElement>('notify-time');
async function refreshNotify(extra?: string) {
  const state = await notifier.state();
  notifyToggle.checked = state.enabled; notifyToggle.disabled = !state.supported; notifyTime.disabled = !state.supported; if (!state.enabled) notifyTime.value = notifyTime.value || state.time; else notifyTime.value = state.time;
  $('notify-body').hidden = !state.enabled; $('notify-consent').hidden = true;
  $('notify-status').textContent = extra ?? (state.enabled ? `매일 ${state.time}에 알림이 와요 ✅ (이 기기 기준)` : state.reason ?? (state.permission === 'denied' ? '브라우저에서 알림이 차단돼 있어요. 주소창 자물쇠 → 알림 허용 후 다시 켜 주세요.' : '켜면 하루 한 번, 정한 시간에 "회사 터뜨리러 갈 시간" 알림을 보내요.'));
}
notifyToggle.addEventListener('change', async () => {
  if (notifyToggle.checked) { notifyToggle.checked = false; $('notify-consent').hidden = false; $('notify-consent').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  else { notifyToggle.disabled = true; try { await notifier.disable(); await refreshNotify('알림을 껐어요.'); } finally { notifyToggle.disabled = false; } }
});
$('notify-cancel').addEventListener('click', () => { $('notify-consent').hidden = true; });
$('notify-agree').addEventListener('click', async () => {
  const button = $<HTMLButtonElement>('notify-agree'); button.disabled = true; $('notify-status').textContent = '브라우저 권한을 확인하는 중…';
  try { const state = await notifier.enable(notifyTime.value || '17:50'); await refreshNotify(state.enabled ? `켰어요! 매일 ${state.time}에 알림이 와요 ✅ 테스트 알림으로 확인해 보세요.` : state.reason); if (state.enabled) notify('퇴근 알림을 켰어요 🔔'); }
  catch { await refreshNotify('알림 등록에 실패했어요. 잠시 후 다시 시도해 주세요.'); }
  finally { button.disabled = false; }
});
notifyTime.addEventListener('change', async () => { if (!notifyToggle.checked) return; try { const state = await notifier.enable(notifyTime.value); await refreshNotify(state.enabled ? `알림 시간을 ${state.time}으로 바꿨어요 ✅` : state.reason); } catch { await refreshNotify('시간 변경에 실패했어요.'); } });
$('notify-test').addEventListener('click', async () => { const b = $<HTMLButtonElement>('notify-test'); b.disabled = true; try { $('notify-status').textContent = (await notifier.test()) ? '테스트 알림을 보냈어요. 몇 초 안에 도착해요 📬' : '먼저 알림을 켜 주세요.'; } catch { $('notify-status').textContent = '테스트 발송에 실패했어요.'; } finally { b.disabled = false; } });
$('check-update').addEventListener('click', async () => {
  const registration = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
  if (!registration) { notify('설치된 앱이 아니면 새로고침으로 최신 버전을 받아요.'); return; }
  await registration.update().catch(() => {});
  setTimeout(() => { if (pendingUpdate) { settings.close(); home(); } else notify(`이미 최신 버전이에요 · v${__APP_VERSION__}`); }, 1500);
});
$('settings').addEventListener('click', () => { game.pause(); sync(); soundSetting.checked = !sound.muted; void refreshNotify(); settings.showModal(); });
$('settings-close').addEventListener('click', () => settings.close());
soundSetting.addEventListener('change', () => { sound.muted = !soundSetting.checked; writeStore('boom-muted', sound.muted ? 'yes' : 'no'); if (sound.muted) { sound.fever(false); feverOn = false; } sound.unlock(); soundUI(); });
reduced.addEventListener('change', () => { writeStore('boom-reduced', String(reduced.checked)); document.body.classList.toggle('reduced-motion', reduced.checked); if (scene) scene.reduced = reduced.checked; });
$('settings-save').addEventListener('click', () => settings.close());
// Stats dialog
const statsDialog = $<HTMLDialogElement>('stats-dialog');
function renderStats() {
  const s = stats; const streak = currentStreak(); const avg = s.history.length ? Math.round(s.history.reduce((a, r) => a + r.score, 0) / s.history.length) : 0;
  $('stats-title').textContent = `${playerName()}님의 기록`;
  $('stats-body').innerHTML = `
    <div class="stat-grid"><div><b>${s.plays.toLocaleString()}</b><span>총 판수</span></div><div><b>${s.destroyed.toLocaleString()}</b><span>부순 스트레스</span></div><div><b>${s.beams.toLocaleString()}</b><span>퇴사빔</span></div><div><b>${s.bestScore.toLocaleString()}</b><span>최고 점수</span></div><div><b>${s.bestCombo}</b><span>최고 콤보</span></div><div><b>${streak}</b><span>연속 일수</span></div></div>
    ${s.percentile ? `<p class="stat-line">전체 플레이어 중 <b>상위 ${s.percentile}%</b> (마지막 판 기준)</p>` : ''}
    ${s.history.length >= 2 ? `<div class="spark">${sparkline(s.history)}<small>최근 ${Math.min(30, s.history.length)}판 · 평균 ${avg.toLocaleString()}점</small></div>` : '<p class="stat-line">두 판 이상 하면 점수 그래프가 생겨요.</p>'}
    <h3 class="stat-h">칭호 ${s.badges.length}/${Object.keys(BADGES).length}</h3>
    <ul class="badges">${Object.entries(BADGES).map(([id, b]) => `<li class="${s.badges.includes(id) ? 'got' : ''}"><b>${s.badges.includes(id) ? '🏅' : '🔒'} ${b.name}</b><small>${b.hint}</small></li>`).join('')}</ul>`;
}
$('stats-open').addEventListener('click', () => { renderStats(); statsDialog.showModal(); });
$('stats-close').addEventListener('click', () => statsDialog.close()); $('stats-done').addEventListener('click', () => statsDialog.close());
$('reload').addEventListener('click', () => location.reload());
const result = $<HTMLDialogElement>('result-dialog');
function showResult() {
  const isBest = game.score > best; best = Math.max(best, game.score); writeStore('boom-best', String(best));
  $('result-greeting').textContent = `${smashed(playerName(), companyName())}.`;
  $('result-rank').textContent = game.rank; $('result-score').textContent = game.score.toLocaleString();
  $('result-destroyed').textContent = String(game.destroyed); $('result-combo').textContent = String(game.maxCombo); $('result-beams').textContent = String(game.beams); $('result-best').textContent = best.toLocaleString();
  $('new-record').hidden = !isBest; $('best-score').textContent = best.toLocaleString();
  $('result-position').textContent = '랭킹 등록 중…';
  try { captured = scene?.capture() || ''; } catch { captured = ''; }
  const earned = recordRound(stats, { at: Date.now(), score: game.score, combo: game.maxCombo, destroyed: game.destroyed, beams: game.beams, boss: game.bossKilled, rank: game.rank }, currentStreak());
  if (earned.length) setTimeout(() => notify(`🏅 칭호 획득: ${earned.map(id => BADGES[id].name).join(', ')}`), 900);
  sound.celebrate(); result.showModal();
  submitScore().then(data => { $('result-position').innerHTML = `오늘 <b>${data.todayPosition}위</b> / ${data.todayTotal.toLocaleString()}명 · 전체 <b>${data.position}위</b> / ${data.total.toLocaleString()}명`; renderRanking(data); stats.percentile = Math.max(1, Math.round(data.position / Math.max(1, data.total) * 100)); saveStats(stats); })
    .catch(() => { $('result-position').textContent = '랭킹 서버에 연결하지 못했어요. 기록은 이 기기에 남아요.'; });
}
$('replay').addEventListener('click', () => { result.close(); begin(); });
$('result-home').addEventListener('click', () => { result.close(); home(); });
result.addEventListener('cancel', () => home());
$('share').addEventListener('click', async () => {
  const url = new URL(import.meta.env.BASE_URL, location.origin).href;
  try {
    if (navigator.share) await navigator.share({ title: '회사 터뜨리기', text: `${smashed(playerName(), companyName())}. ${game.score.toLocaleString()}점. 이겨볼래?`, url });
    else { await navigator.clipboard.writeText(url); notify('게임 링크를 복사했어요. 친구에게 보내주세요!'); }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') { const input = document.createElement('input'); input.value = url; input.readOnly = true; input.className = 'copy-link'; $('result-dialog').append(input); input.select(); notify('아래 주소를 선택해 복사해 주세요.'); }
  }
});
$('save-card').addEventListener('click', async () => {
  const button = $<HTMLButtonElement>('save-card'); button.disabled = true;
  try {
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350; const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#14171c'; ctx.fillRect(0, 0, 1080, 1350);
    ctx.fillStyle = '#d5fc71'; ctx.font = 'bold 25px sans-serif'; ctx.fillText('COMPANY BOOM  /  MISSION COMPLETE', 75, 105);
    ctx.fillStyle = '#f3f1e8'; ctx.font = '800 62px "Malgun Gothic", sans-serif'; ctx.fillText(game.rank, 75, 220, 930);
    ctx.fillStyle = '#a8aaa4'; ctx.font = '28px "Malgun Gothic", sans-serif'; ctx.fillText(`${smashed(playerName(), companyName())}.`, 75, 285, 930);
    ctx.fillText('오늘도 수고했어요. 이제 내 시간이에요.', 75, 330, 930);
    if (captured) { const image = new Image(); image.src = captured; await image.decode(); const ratio = Math.min(1000 / image.width, 610 / image.height); const w = image.width * ratio; const h = image.height * ratio; ctx.drawImage(image, (1080 - w) / 2, 370, w, h); }
    else { ctx.fillStyle = '#d5fc71'; ctx.font = '220px sans-serif'; ctx.fillText('✳', 430, 680); }
    ctx.fillStyle = '#d5fc71'; ctx.font = '900 136px sans-serif'; ctx.fillText(game.score.toLocaleString(), 75, 1060);
    ctx.fillStyle = '#a8aaa4'; ctx.font = '28px "Malgun Gothic", sans-serif'; ctx.fillText(`부순 스트레스 ${game.destroyed}  ·  최대 콤보 ${game.maxCombo}  ·  퇴사빔 ${game.beams}회`, 80, 1130);
    ctx.fillStyle = '#f3f1e8'; ctx.font = 'bold 32px "Malgun Gothic", sans-serif'; ctx.fillText('오늘의 스트레스, 여기서 끝.', 75, 1260); ctx.font = '20px sans-serif'; ctx.fillText(location.host + import.meta.env.BASE_URL, 75, 1304);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Image encoding failed')), 'image/png'));
    const file = new File([blob], 'company-boom.png', { type: 'image/png' });
    if (/iPhone|iPad|iPod/.test(navigator.userAgent) && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
    else { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'company-boom.png'; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 10000); notify('결과 카드를 저장했어요!'); }
  } catch (error) { if ((error as Error).name !== 'AbortError') notify('카드 저장이 어려워요. 화면 캡처 또는 링크 공유를 이용해 주세요.'); }
  finally { button.disabled = false; }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { game.pause(); sync(); void sound.context?.suspend(); } lastTime = performance.now(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && game.phase === 'playing') { game.pause(); sync(); } });
setupPwa(notify, apply => { pendingUpdate = apply; applyUpdate(); });
sync(); void loadRanking(); void loadPlays();
// QA hook: ?debug exposes the game state so scripted tests can force rare states (boss, fever) deterministically.
if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __boom: Game }).__boom = game;
try {
  scene = new OfficeScene($('scene'), hit); scene.reduced = reduced.checked; document.body.classList.toggle('reduced-motion', reduced.checked);
  scene.onEvent = event => { if (event === 'crash') { sound.crash(); buzz(40); } };
  applyTheme(theme); applyCompany();
  $('loading').hidden = true; $<HTMLButtonElement>('start').disabled = false; $('start-label').textContent = '터뜨리러 가기';
  scene.renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); game.pause(); sync(); notify('그래픽 연결이 끊겼어요. 복구를 기다려 주세요.'); });
  scene.renderer.domElement.addEventListener('webglcontextrestored', () => { location.reload(); });
} catch (error) { console.error('Unable to initialize game graphics', error); $('loading').hidden = true; $('scene-error').hidden = false; $('start-label').textContent = '3D 지원 브라우저가 필요해요'; }
function frame(now: number) {
  const dt = Math.max(0, (now - lastTime) / 1000); lastTime = now;
  if (!document.hidden) {
    game.tick(dt);
    if (game.phase === 'playing' && game.rage === 100 && !rageReady) { rageReady = true; sound.charged(); buzz([20, 30, 20, 30, 60]); $('quip').textContent = '분노 100%! 퇴사빔으로 전부 날려요!'; }
    const golden = game.phase === 'playing' && game.slots.some(slot => slot.kind === BONUS && slot.hp > 0);
    if (golden && !goldenShown) { sound.bonus(); buzz(25); $('quip').textContent = '⚡ 긴급 수정 요청 등장! 4초 안에 부수면 800점!'; }
    goldenShown = golden;
    const boss = game.phase === 'playing' && game.slots.some(slot => slot.kind === BOSS && slot.hp > 0);
    if (boss && !bossSeen) { bossSeen = true; sound.boss(); buzz([40, 30, 40, 30, 90]); callout('👔 사장님 등장!!', 'fever'); $('quip').textContent = '사장님 결재판! 5대 치면 3,000점 × 배율. 6초 안에!'; screenFlash('rgba(255,102,90,.35)'); }
    if (game.phase === 'finale' && lastPhase !== 'finale') { sound.charge(); $('finale-caption').querySelector('h2')!.textContent = game.rage >= 100 ? '퇴사빔.' : '오늘은 여기까지.'; }
    if (game.phase === 'finale' && game.finaleTime >= .9 && !boomPlayed) { sound.boom(); buzz([80, 30, 120]); boomPlayed = true; screenFlash('rgba(213,252,113,.6)'); }
    scene?.update(dt, game, anchors);
    if (game.phase === 'result' && lastPhase !== 'result') showResult();
    if (game.phase !== 'ready') sync();
    lastPhase = game.phase;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
