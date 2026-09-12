import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, sep } from 'node:path';
// Must match `base` in vite.config.ts so cached URLs line up with the served ones.
const base = (process.env.BASE_PATH || '/boomcompany/').replace(/\/?$/, '/');
const files = [];
async function walk(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) await walk(path);
    else if (item.name !== 'sw.js') files.push(path.split(sep).join('/').replace(/^dist\//, ''));
  }
}
await walk('dist');
const hash = createHash('sha256');
for (const path of files.sort()) hash.update(await readFile(`dist/${path}`));
const version = hash.digest('hex').slice(0, 12);
await writeFile('dist/sw.js', `const CACHE = 'company-boom-${version}';
const BASE = ${JSON.stringify(base)};
const FILES = ${JSON.stringify(files.map(path => base + path))};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('message', event => { if (event.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('company-boom-') && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
  for (const client of await self.clients.matchAll({ type: 'window' })) client.postMessage({ type: 'activated', version: '${version}' });
})()));
self.addEventListener('push', event => {
  let data = { title: '회사 터뜨리기', body: '퇴근 전에 한 판 어때요?', tag: 'boom' };
  try { data = { ...data, ...event.data.json() }; } catch { /* keep defaults */ }
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, tag: data.tag, icon: BASE + 'icon-192.png', badge: BASE + 'icon-192.png', data: { url: BASE }, vibrate: [60, 30, 60] }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(BASE, self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(client => client.url.startsWith(target));
    return open ? open.focus() : self.clients.openWindow(target);
  }));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(BASE + 'index.html')).then(hit => hit || fetch(event.request)));
    return;
  }
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request)).then(hit => hit || fetch(event.request)));
});
`);
console.log(`Offline cache: ${files.length} assets under ${base}, version ${version}`);
