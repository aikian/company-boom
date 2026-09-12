import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const files = [];
async function walk(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) await walk(path);
    else if (item.name !== 'sw.js') files.push(path.replaceAll('\\', '/').replace(/^dist/, ''));
  }
}
await walk('dist');
const hash = createHash('sha256');
for (const path of files.sort()) hash.update(await readFile(`dist${path}`));
const version = hash.digest('hex').slice(0, 12);
await writeFile('dist/sw.js', `const CACHE = 'company-boom-${version}';
const FILES = ${JSON.stringify(files)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('company-boom-') && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(cache => cache.match('/index.html')).then(hit => hit || fetch(event.request)));
    return;
  }
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request)).then(hit => hit || fetch(event.request)));
});
`);
console.log(`Offline cache: ${files.length} assets, version ${version}`);
