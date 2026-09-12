// Daily "time to leave" reminders over Web Push. Subscriptions live in /data/push.json, VAPID keys in /data/vapid.json.
import webpush from 'web-push';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const MESSAGES = [
  '퇴근 30초 전. 오늘 스트레스 아직 안 부쉈어요 💥',
  '오늘 회의 몇 개였어요? 15초면 다 날려요.',
  '퇴근 도장 찍기 전에, 회사 한 번 터뜨리고 가요.',
  '오늘의 랭킹이 자정에 리셋돼요. 지금이 기회!',
  '야근 책상 세 대만 부수고 퇴근합시다.',
];

export const clampTime = value => { const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value ?? '')); return m ? `${m[1]}:${m[2]}` : null; };
export const clampOffset = value => { const n = Number(value); return Number.isInteger(n) && n >= -840 && n <= 840 ? n : null; };

// Local calendar date and HH:MM for a subscriber whose UTC offset (minutes, as JS getTimezoneOffset) is `offset`.
export function localClock(now, offset) {
  const local = new Date(now - offset * 60000);
  const date = local.toISOString().slice(0, 10); const time = local.toISOString().slice(11, 16);
  return { date, time };
}
// A reminder is due when the local clock has reached the chosen time today and we have not sent one today.
export function isDue(sub, now) {
  const { date, time } = localClock(now, sub.offset);
  if (sub.lastSent === date) return false;
  const minutes = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const at = minutes(time); const want = minutes(sub.time);
  return at >= want && at <= Math.min(want + 20, 23 * 60 + 59); // a 20-minute window absorbs restarts and slow ticks
}

export function createPush({ dataDir, subject, log = console }) {
  const FILE = join(dataDir, 'push.json'); const KEYS = join(dataDir, 'vapid.json');
  let subs = []; let keys = null; let saving = Promise.resolve();
  async function load() {
    try { subs = JSON.parse(await readFile(FILE, 'utf8')); if (!Array.isArray(subs)) subs = []; } catch { subs = []; }
    try { keys = JSON.parse(await readFile(KEYS, 'utf8')); } catch { keys = null; }
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    if (!keys?.publicKey || !keys?.privateKey) { keys = webpush.generateVAPIDKeys(); await mkdir(dataDir, { recursive: true }); await writeFile(KEYS, JSON.stringify(keys)); log.log('Generated new VAPID keys'); }
    webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  }
  function persist() {
    const snapshot = JSON.stringify(subs);
    saving = saving.then(async () => { await mkdir(dataDir, { recursive: true }); await writeFile(`${FILE}.tmp`, snapshot); await rename(`${FILE}.tmp`, FILE); }).catch(error => log.error('Could not save subscriptions', error));
    return saving;
  }
  function upsert(subscription, time, offset, name) {
    const existing = subs.find(sub => sub.endpoint === subscription.endpoint);
    const entry = { endpoint: subscription.endpoint, keys: subscription.keys, time, offset, name: String(name ?? '').slice(0, 12), lastSent: existing?.lastSent ?? '', createdAt: existing?.createdAt ?? Date.now() };
    if (existing) Object.assign(existing, entry); else subs.push(entry);
    if (subs.length > 5000) subs.shift();
    return persist();
  }
  function remove(endpoint) { const before = subs.length; subs = subs.filter(sub => sub.endpoint !== endpoint); if (subs.length !== before) return persist(); return Promise.resolve(); }
  async function send(sub, payload) {
    try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), { TTL: 3600 }); return true; }
    catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) { subs = subs.filter(s => s !== sub); await persist(); }
      else log.error('Push failed', error.statusCode || error.message);
      return false;
    }
  }
  async function tick(now = Date.now()) {
    let sent = 0;
    for (const sub of [...subs]) {
      if (!isDue(sub, now)) continue;
      sub.lastSent = localClock(now, sub.offset).date;
      const message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      if (await send(sub, { title: `${sub.name ? sub.name + '님, ' : ''}회사 터뜨릴 시간`, body: message, tag: 'boom-daily' })) sent++;
    }
    if (sent) { await persist(); log.log(`Sent ${sent} reminder(s)`); }
    else await persist();
    return sent;
  }
  return {
    load, upsert, remove, tick,
    get publicKey() { return keys?.publicKey ?? ''; },
    get count() { return subs.length; },
    find: endpoint => subs.find(sub => sub.endpoint === endpoint) ?? null,
    test: endpoint => { const sub = subs.find(s => s.endpoint === endpoint); return sub ? send(sub, { title: '알림 테스트 성공 ✅', body: '이 시간에 매일 퇴근 알림이 와요. 회사 터뜨리러 가요!', tag: 'boom-test' }) : Promise.resolve(false); },
    start: () => setInterval(() => tick().catch(error => log.error(error)), 30000),
  };
}
