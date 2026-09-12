type InstallEvent = Event & { prompt(): Promise<{ outcome: string }>; userChoice: Promise<{ outcome: string }> };
export function readStore(key: string, fallback = '') { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
export function writeStore(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* Private mode can deny storage. */ } }
export function installPlatform(userAgent: string, touchPoints: number) {
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && touchPoints > 1)) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'desktop';
}
export function setupPwa(notify: (text: string) => void) {
  let deferred: InstallEvent | null = null;
  const dialog = document.querySelector<HTMLDialogElement>('#install-dialog')!;
  const button = document.querySelector<HTMLButtonElement>('#install-action')!;
  const help = document.querySelector<HTMLElement>('#install-help')!;
  const launch = document.querySelector<HTMLButtonElement>('#install-open')!;
  const platform = installPlatform(navigator.userAgent, navigator.maxTouchPoints);
  const display = matchMedia('(display-mode: standalone)');
  const standalone = () => display.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const inApp = /KAKAOTALK|Instagram|FBAN|FBAV|NAVER|Line\//i.test(navigator.userAgent);
  const dismiss = () => { writeStore('boom-install-dismissed', String(Date.now())); dialog.close(); };
  function update() {
    if (standalone() || readStore('boom-installed') === 'yes') { launch.hidden = true; dialog.close(); return; }
    launch.hidden = false;
    button.hidden = !deferred;
    if (inApp) help.innerHTML = '<strong>기본 브라우저에서 열어 주세요</strong><p>현재 앱의 메뉴에서 “다른 브라우저로 열기”를 선택하세요. iPhone은 Safari, Android는 Chrome에서 설치할 수 있어요.</p>';
    else if (platform === 'ios') help.innerHTML = '<ol><li><span>1</span>Safari의 <b>공유 버튼 ↑</b>을 누르세요.</li><li><span>2</span><b>홈 화면에 추가 ⊞</b>를 선택하세요.</li><li><span>3</span>표시된다면 <b>웹 앱으로 열기</b>를 켜고 <b>추가</b>를 누르세요.</li></ol><p>공유 버튼이 안 보이면 메뉴(···)를 열어 주세요. 다른 브라우저에서는 Safari로 열면 안내대로 설치할 수 있어요.</p>';
    else if (deferred) help.innerHTML = '<p>아래 버튼을 누르고 브라우저의 설치 창에서 확인해 주세요. 홈 화면 아이콘으로 바로 플레이할 수 있어요.</p>';
    else if (platform === 'android') help.innerHTML = '<ol><li><span>1</span>Chrome 메뉴 <b>⋮</b>를 누르세요.</li><li><span>2</span><b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 선택하세요.</li></ol><p>설치가 준비되면 이 창에도 설치 버튼이 나타나요.</p>';
    else help.innerHTML = '<p>Chrome 또는 Edge의 주소창 설치 아이콘을 눌러 앱으로 추가하세요. 설치를 지원하지 않는 브라우저에서도 게임은 그대로 즐길 수 있어요.</p>';
  }
  function open() { update(); if (!launch.hidden && !dialog.open) dialog.showModal(); }
  launch.addEventListener('click', open);
  document.querySelector('#install-close')!.addEventListener('click', dismiss);
  document.querySelector('#install-later')!.addEventListener('click', dismiss);
  dialog.addEventListener('cancel', () => writeStore('boom-install-dismissed', String(Date.now())));
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); deferred = event as InstallEvent;
    writeStore('boom-installed', 'no'); update();
  });
  button.addEventListener('click', async () => {
    if (!deferred) return;
    const prompt = deferred; deferred = null; button.disabled = true;
    try {
      const choice = await prompt.prompt();
      if (choice.outcome === 'accepted') { dialog.close(); notify('설치를 요청했어요. 홈 화면에서 확인해 주세요.'); }
      else dismiss();
    } catch { notify('브라우저 메뉴에서 앱 설치를 선택해 주세요.'); }
    finally { button.disabled = false; update(); }
  });
  window.addEventListener('appinstalled', () => { deferred = null; writeStore('boom-installed', 'yes'); update(); notify('설치 완료! 홈 화면에서 만나요.'); });
  display.addEventListener('change', update);
  update();
  if (!standalone() && readStore('boom-installed') !== 'yes' && Date.now() - Number(readStore('boom-install-dismissed', '0')) > 7 * 86400000) open();
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      const ready = () => notify('오프라인 준비 완료 · 다음에는 인터넷 없이도 플레이해요.');
      if (registration.active) return;
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => { if (worker.state === 'activated') ready(); });
    }).catch(() => { notify('오프라인 저장을 사용할 수 없어요. 온라인으로 플레이할 수 있어요.'); });
  }
}
