import './style.css';
import { BONUS, Game, ROUND, targets } from './game';
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
  <div class="header-actions"><button id="install-open" class="subtle">${icon('install')}<span>앱 설치</span></button><button id="sound" class="icon-button" aria-label="소리 끄기" aria-pressed="true">${icon('sound')}</button><button id="settings" class="icon-button" aria-label="게임 설정">⚙</button></div>
</header>
<main class="shell">
  <section class="intro" id="intro">
    <div class="eyebrow"><span></span> 15초 스트레스 해소</div>
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
    <div id="combo" class="combo" hidden><strong>0</strong><span>COMBO</span><i class="combo-bar"><b id="combo-bar"></b></i></div>
    <div class="scene-caption" id="scene-caption"><span class="mini-tag">100% 가상 회사</span><p>주식회사 내일부터</p><small>업무는 무한. 당신의 인내심은 유한.</small></div>
    <div id="play-bottom" class="play-bottom" hidden><p id="quip">사무용품을 터치하면 15초가 시작돼요.</p><div class="rage-label"><span>${icon('bolt')} 분노 게이지</span><strong id="rage-value">0%</strong></div><div class="rage-track"><div id="rage-fill"></div></div><button id="fire" class="primary fire-button" disabled>${icon('bolt')}<span>퇴사빔 충전 중</span><small>0 / 100</small></button></div>
    <div id="finale-caption" class="finale-caption" hidden><small>ULTIMATE RELEASE</small><h2>퇴사빔.</h2><p>업무 종료. 내 인생 시작.</p></div>
    <div id="pause-panel" class="pause-panel" hidden><span>Ⅱ</span><h2>잠깐 쉬어가요.</h2><p>스트레스도, 타이머도 멈췄어요.</p><button id="resume" class="primary">계속하기 ${icon('arrow')}</button><button id="quit" class="subtle">처음으로</button></div>
    <div id="scene-error" class="pause-panel" hidden><h2>3D 화면을 열 수 없어요.</h2><p>최신 Safari나 Chrome에서 다시 시도해 주세요.</p><button id="reload" class="primary">다시 불러오기</button></div>
  </section>
  <section class="ranking" id="ranking-panel" aria-label="랭킹"><div class="ranking-head"><h2>${icon('trophy')} 실시간 랭킹</h2><span id="ranking-total"></span></div><ol id="ranking" class="ranking-list"><li class="ranking-empty">랭킹을 불러오는 중…</li></ol><div class="record">내 최고 기록 <strong id="best-score">0</strong><small>PT</small></div></section>
</main>
<dialog id="install-dialog" class="install-dialog"><button id="install-close" class="dialog-close icon-button" aria-label="설치 안내 닫기">${icon('close')}</button><div class="app-icon">${icon('bolt')}</div><div class="eyebrow">YOUR POCKET-SIZED ESCAPE</div><h2>퇴근 버튼을<br>홈 화면에.</h2><p class="dialog-description">앱으로 설치하면 더 빠르고, 더 몰입감 있게.<br>한 번 준비하면 오프라인에서도 즐길 수 있어요.</p><div id="install-help" class="install-help"></div><button id="install-action" class="primary" hidden>${icon('install')} 앱 설치하기</button><button id="install-later" class="later-button">지금은 웹으로 플레이</button><small class="install-free">무료 · 회원가입 없음 · 앱스토어 없이 설치</small></dialog>
<dialog id="settings-dialog"><button class="dialog-close icon-button" id="settings-close" aria-label="설정 닫기">${icon('close')}</button><div class="eyebrow">MAKE YOURSELF COMFORTABLE</div><h2>내 취향대로.</h2><label class="setting-row">움직임 줄이기 <input id="reduced" type="checkbox"></label><p class="muted">카메라 흔들림과 파편 효과를 줄여요.</p><button id="settings-save" class="primary">적용하기</button></dialog>
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
function renderRanking(top: Entry[], total: number) {
  $('ranking-total').textContent = total ? `${total.toLocaleString()}명 참여` : '';
  $('ranking').innerHTML = top.length
    ? top.map((entry, i) => `<li${entry.name === playerName() && entry.score === best ? ' class="mine"' : ''}><span class="place">${['🥇', '🥈', '🥉'][i] || i + 1}</span><span class="who">${escape(smashed(entry.name, entry.company || '주식회사 내일부터'))}<small>${escape(entry.rank)}</small></span><b>${entry.score.toLocaleString()}</b></li>`).join('')
    : '<li class="ranking-empty">아직 아무도 없어요. 첫 번째 퇴사자가 되어 보세요!</li>';
}
async function loadRanking() {
  try { const data = await (await fetch(`${API}scores`, { cache: 'no-store' })).json(); renderRanking(data.top, data.total); }
  catch { $('ranking').innerHTML = '<li class="ranking-empty">랭킹을 불러올 수 없어요. 게임은 그대로 즐길 수 있어요.</li>'; }
}
async function submitScore() {
  const body = { name: playerName(), score: game.score, combo: game.maxCombo, destroyed: game.destroyed, rank: game.rank, company: companyName() };
  const response = await fetch(`${API}scores`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as { position: number; total: number; top: Entry[] };
}
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
  $('score').textContent = game.score.toLocaleString(); $('rage-value').textContent = `${game.rage}%`; $('rage-fill').style.width = `${game.rage}%`;
  const fire = $<HTMLButtonElement>('fire'); fire.disabled = game.rage < 100 || game.phase !== 'playing'; fire.classList.toggle('charged', game.rage === 100);
  fire.querySelector('span')!.textContent = game.rage === 100 ? '퇴사빔 발사! 전부 부수기 +1,000' : `퇴사빔 충전 중${game.beams ? ` · ${game.beams}회 발사` : ''}`; fire.querySelector('small')!.textContent = `${game.rage} / 100`;
  $('combo').hidden = game.combo < 2 || game.phase !== 'playing'; $('combo').querySelector('strong')!.textContent = String(game.combo);
  $('combo').classList.toggle('hot', game.combo >= 10); $('combo-bar').style.width = `${game.comboLeft / 1.2 * 100}%`;
  anchors.forEach((button, i) => {
    const slot = game.slots[i]; button.hidden = game.phase !== 'playing' || slot.hp <= 0; button.classList.toggle('bonus', slot.kind === BONUS);
    button.setAttribute('aria-label', `${i + 1}번 ${targets[slot.kind].name} · 체력 ${slot.hp}${slot.kind === BONUS ? ` · ${Math.ceil(slot.expires)}초 남음` : ''}`);
    button.innerHTML = `<small>${'●'.repeat(Math.max(0, slot.hp))}</small>${slot.kind === BONUS ? `<em>${slot.expires.toFixed(1)}s</em>` : ''}`;
  });
}
function begin() {
  if (!scene) return;
  writeStore('boom-name', nameInput.value.trim()); writeStore('boom-company', companyInput.value.trim()); applyCompany();
  game.reset(); scene.reset(); game.start(); boomPlayed = false; rageReady = false; goldenShown = false; captured = ''; sound.unlock(); sync();
  $('quip').textContent = `사무용품을 터치하면 ${ROUND}초가 시작돼요.`;
  $('arena').scrollIntoView({ behavior: 'instant', block: 'start' });
}
function home() { game.reset(); scene?.reset(); sync(); void loadRanking(); window.scrollTo({ top: 0, behavior: 'instant' }); }
$('enter').addEventListener('submit', event => { event.preventDefault(); if (!$<HTMLButtonElement>('start').disabled) begin(); });
$('fire').addEventListener('click', () => {
  const strike = game.fire(); if (!strike) return;
  sound.unlock(); sound.zap(); scene?.strike(strike.cleared); buzz([60, 40, 60, 40, 120]);
  float(`+${strike.gained.toLocaleString()}`, '50%', '38%', true); $('quip').textContent = `퇴사빔! 표적 ${strike.cleared.length}개를 한 번에 날렸어요.`;
  rageReady = false; sync();
});
$('pause').addEventListener('click', () => { game.pause(); sync(); });
$('resume').addEventListener('click', () => { lastTime = performance.now(); game.resume(); sound.unlock(); sync(); });
$('quit').addEventListener('click', home);
$('sound').addEventListener('click', () => { sound.muted = !sound.muted; writeStore('boom-muted', sound.muted ? 'yes' : 'no'); sound.unlock(); soundUI(); });
const settings = $<HTMLDialogElement>('settings-dialog');
$('settings').addEventListener('click', () => { game.pause(); sync(); settings.showModal(); });
$('settings-close').addEventListener('click', () => settings.close());
$('settings-save').addEventListener('click', () => {
  writeStore('boom-reduced', String(reduced.checked)); document.body.classList.toggle('reduced-motion', reduced.checked);
  if (scene) scene.reduced = reduced.checked;
  settings.close();
});
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
  sound.celebrate(); result.showModal();
  submitScore().then(data => { $('result-position').innerHTML = `전체 <b>${data.position}위</b> / ${data.total.toLocaleString()}명`; renderRanking(data.top, data.total); })
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
setupPwa(notify);
sync(); void loadRanking();
try {
  scene = new OfficeScene($('scene'), hit); scene.reduced = reduced.checked; document.body.classList.toggle('reduced-motion', reduced.checked);
  scene.onEvent = event => { if (event === 'crash') { sound.crash(); buzz(40); } };
  applyCompany();
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
    if (game.phase === 'finale' && lastPhase !== 'finale') { sound.charge(); $('finale-caption').querySelector('h2')!.textContent = game.rage >= 100 ? '퇴사빔.' : '오늘은 여기까지.'; }
    if (game.phase === 'finale' && game.finaleTime >= .9 && !boomPlayed) { sound.boom(); buzz([80, 30, 120]); boomPlayed = true; }
    scene?.update(dt, game, anchors);
    if (game.phase === 'result' && lastPhase !== 'result') showResult();
    if (game.phase !== 'ready') sync();
    lastPhase = game.phase;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
