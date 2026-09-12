// Serves the built game and a tiny JSON leaderboard. No dependencies: node:http, node:fs, node:zlib.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { createGzip } from 'node:zlib';
import { dayStart, insert, positionOf, since, top, validate } from './scores.mjs';
import { clampOffset, clampTime, createPush } from './push.mjs';
import { createPlays } from './plays.mjs';

const PORT = Number(process.env.PORT || 80);
const ROOT = resolve(process.env.STATIC_DIR || 'dist');
const DATA_DIR = resolve(process.env.DATA_DIR || '/data');
const BASE = (process.env.BASE_PATH || '/boomcompany/').replace(/\/?$/, '/');
const FILE = join(DATA_DIR, 'scores.json');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };

const PUBLIC_URL = process.env.PUBLIC_URL || 'https://sub.uxo.kr/boomcompany/';
const push = createPush({ dataDir: DATA_DIR, subject: PUBLIC_URL });
const plays = createPlays({ dataDir: DATA_DIR });
await push.load(); await plays.load(); push.start(); plays.start();

let scores = [];
let saving = Promise.resolve();
try { scores = JSON.parse(await readFile(FILE, 'utf8')); if (!Array.isArray(scores)) scores = []; } catch { scores = []; }
function persist() {
  const snapshot = JSON.stringify(scores);
  saving = saving.then(async () => { await mkdir(DATA_DIR, { recursive: true }); await writeFile(`${FILE}.tmp`, snapshot); await rename(`${FILE}.tmp`, FILE); }).catch(error => console.error('Could not save scores', error));
  return saving;
}

const hits = new Map(); // ip -> timestamps; 10 submissions a minute is plenty for one person.
function limited(ip) {
  const now = Date.now(); const list = (hits.get(ip) || []).filter(t => now - t < 60000);
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 10;
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req, res) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { chunks.push(chunk); size += chunk.length; if (size > 8192) { json(res, 413, { error: 'too large' }); return undefined; } }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { json(res, 400, { error: 'invalid json' }); return undefined; }
}

async function api(req, res, path) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (path === 'plays') {
    if (req.method === 'GET') return json(res, 200, plays.summary());
    if (req.method === 'POST') { if (limited(ip)) return json(res, 429, { error: 'too many' }); return json(res, 201, plays.record()); }
    return json(res, 405, { error: 'method not allowed' });
  }
  if (path === 'push/key') return json(res, 200, { key: push.publicKey, subscribers: push.count });
  if (path === 'push/subscribe' && req.method === 'POST') {
    if (limited(ip)) return json(res, 429, { error: 'too many' });
    const body = await readJson(req, res); if (body === undefined) return;
    const sub = body?.subscription; const time = clampTime(body?.time); const offset = clampOffset(body?.offset);
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth || !time || offset === null || !/^https:\/\//.test(sub.endpoint)) return json(res, 400, { error: 'invalid subscription' });
    await push.upsert(sub, time, offset, body?.name);
    return json(res, 201, { ok: true, time, subscribers: push.count });
  }
  if (path === 'push/unsubscribe' && req.method === 'POST') {
    const body = await readJson(req, res); if (body === undefined) return;
    if (typeof body?.endpoint !== 'string') return json(res, 400, { error: 'invalid' });
    await push.remove(body.endpoint); return json(res, 200, { ok: true });
  }
  if (path === 'push/test' && req.method === 'POST') {
    if (limited(ip)) return json(res, 429, { error: 'too many' });
    const body = await readJson(req, res); if (body === undefined) return;
    const ok = typeof body?.endpoint === 'string' && await push.test(body.endpoint);
    return json(res, ok ? 200 : 404, { ok });
  }
  if (path !== 'scores') return json(res, 404, { error: 'not found' });
  if (req.method === 'GET') { const today = since(scores, dayStart()); return json(res, 200, { top: top(scores, 10), total: scores.length, today: top(today, 10), todayTotal: today.length }); }
  if (req.method === 'DELETE') {
    // Admin reset: DELETE /api/scores with 'Authorization: Bearer <ADMIN_TOKEN>' (env). Disabled when no token is set.
    const token = process.env.ADMIN_TOKEN;
    if (!token || req.headers.authorization !== `Bearer ${token}`) return json(res, 403, { error: 'forbidden' });
    scores = []; await persist(); return json(res, 200, { top: [], total: 0 });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  if (limited(ip)) return json(res, 429, { error: 'too many submissions' });
  const body = await readJson(req, res); if (body === undefined) return;
  const entry = validate(body);
  if (!entry) return json(res, 400, { error: 'invalid score' });
  const result = insert(scores, entry); scores = result.list; await persist();
  const today = since(scores, dayStart());
  return json(res, 201, { position: result.position, total: scores.length, top: top(scores, 10), todayPosition: positionOf(today, entry), todayTotal: today.length, today: top(today, 10) });
}

function serve(req, res, path) {
  if (path === '' || path.endsWith('/')) path += 'index.html';
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
    // Unknown routes fall back to the app shell; missing assets are a real 404.
    if (extname(path)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    return serve(req, res, 'index.html');
  }
  const type = TYPES[extname(file)] || 'application/octet-stream';
  const headers = {
    'Content-Type': type,
    'Cache-Control': path.startsWith('assets/') ? 'public, max-age=31536000, immutable' : path === 'sw.js' ? 'no-store' : 'no-cache',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
  const compress = /^(text\/|application\/(javascript|json|manifest))/.test(type) && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
  if (compress) { headers['Content-Encoding'] = 'gzip'; headers.Vary = 'Accept-Encoding'; }
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  const stream = createReadStream(file);
  stream.on('error', () => res.destroy());
  if (compress) stream.pipe(createGzip()).pipe(res); else stream.pipe(res);
}

createServer((req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === BASE.slice(0, -1)) { res.writeHead(301, { Location: BASE }); return res.end(); }
    path = path.startsWith(BASE) ? path.slice(BASE.length) : path.replace(/^\/+/, '');
    if (path.startsWith('api/')) return void api(req, res, path.slice(4)).catch(error => { console.error(error); json(res, 500, { error: 'server error' }); });
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    serve(req, res, path);
  } catch { res.writeHead(400); res.end(); }
}).listen(PORT, () => console.log(`company-boom on :${PORT}, base ${BASE}, static ${ROOT}, data ${DATA_DIR}`));
