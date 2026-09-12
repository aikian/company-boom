// Daily reminder over Web Push. The server keeps the subscription and sends one notification a day at the chosen time.
import { readStore, writeStore } from './pwa';

export type NotifyState = { supported: boolean; permission: NotificationPermission | 'unsupported'; enabled: boolean; time: string; reason?: string };
const KEY = 'boom-notify';
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

export function createNotify(api: string, getName: () => string) {
  const stored = (): { time: string } | null => { try { return JSON.parse(readStore(KEY, 'null')); } catch { return null; } };
  const supported = () => 'Notification' in window && 'PushManager' in window && 'serviceWorker' in navigator && import.meta.env.PROD;
  async function subscription() {
    if (!supported()) return null;
    const registration = await navigator.serviceWorker.getRegistration(); return registration ? registration.pushManager.getSubscription() : null;
  }
  async function state(): Promise<NotifyState> {
    const saved = stored(); const time = saved?.time ?? '17:50';
    if (!supported()) return { supported: false, permission: 'unsupported', enabled: false, time, reason: isIOS() && !standalone() ? 'iPhone은 Safari 공유 → 홈 화면에 추가로 설치한 뒤 앱에서 켤 수 있어요.' : '이 브라우저는 푸시 알림을 지원하지 않아요.' };
    const sub = await subscription().catch(() => null);
    return { supported: true, permission: Notification.permission, enabled: !!(saved && sub && Notification.permission === 'granted'), time };
  }
  async function enable(time: string): Promise<NotifyState> {
    if (!supported()) return state();
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { writeStore(KEY, ''); return { ...(await state()), enabled: false, reason: permission === 'denied' ? '브라우저에서 알림이 차단됐어요. 주소창의 자물쇠(또는 설정 → 알림)에서 허용으로 바꿔 주세요.' : '알림 권한을 허용해야 켤 수 있어요.' }; }
    const registration = await navigator.serviceWorker.ready;
    const { key } = await (await fetch(`${api}push/key`)).json();
    let sub = await registration.pushManager.getSubscription();
    if (!sub) sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
    const response = await fetch(`${api}push/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON(), time, offset: new Date().getTimezoneOffset(), name: getName() }) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    writeStore(KEY, JSON.stringify({ time }));
    return state();
  }
  async function disable() {
    const sub = await subscription().catch(() => null);
    if (sub) { await fetch(`${api}push/unsubscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
    writeStore(KEY, '');
    return state();
  }
  async function test() {
    const sub = await subscription().catch(() => null);
    if (!sub) return false;
    const response = await fetch(`${api}push/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    return response.ok;
  }
  return { state, enable, disable, test, stored };
}
