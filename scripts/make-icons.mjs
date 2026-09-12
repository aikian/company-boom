// Renders the PWA icons and the social preview from inline SVG/HTML with headless Chromium.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const bolt = (fill = '#d5fc71') => `<path d="m278 64-126 202h91l-28 182 155-230H269z" fill="${fill}"/><path d="m108 102 26 43M381 104l-37 41M104 344l44-17M383 346l-36-20" stroke="#a7a0ff" stroke-width="16" stroke-linecap="round"/>`;
const icon = (size, radius, pad) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><rect width="512" height="512" rx="${radius}" fill="#14171c"/><g transform="translate(256 256) scale(${1 - pad}) translate(-256 -256)">${bolt()}</g></svg>`;
const social = `<!doctype html><meta charset="utf-8"><body style="margin:0;width:1200px;height:630px;background:#14171c;font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#f1f0e9;position:relative;overflow:hidden">
<div style="position:absolute;inset:0;opacity:.25;background-image:linear-gradient(#b8cfbd22 1px,transparent 1px),linear-gradient(90deg,#b8cfbd22 1px,transparent 1px);background-size:48px 48px;mask-image:radial-gradient(#000,transparent 75%)"></div>
<div style="position:absolute;left:84px;top:80px;display:flex;align-items:center;gap:18px"><svg width="64" height="64" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#d5fc71"/>${bolt('#1d2920')}</svg><div style="font-weight:800;font-size:28px;letter-spacing:-1px">회사 터뜨리기<div style="font-size:12px;letter-spacing:4px;color:#989d9e;margin-top:4px">COMPANY BOOM</div></div></div>
<div style="position:absolute;left:84px;top:230px;font-size:92px;font-weight:900;line-height:1.15;letter-spacing:-5px">오늘의 스트레스,<br><span style="color:#d5fc71">여기서 끝.</span></div>
<div style="position:absolute;left:88px;top:472px;font-size:28px;color:#a4a8a6;letter-spacing:-.5px">끝없는 회의, 쌓이는 야근. 딱 45초만, 시원하게 날려버려요.</div>
<div style="position:absolute;right:84px;bottom:64px;font-size:18px;letter-spacing:3px;color:#7f8a7b">FREE · NO SIGN-UP · MOBILE & PC</div>
<div style="position:absolute;right:-60px;top:-40px;font-size:420px;color:#b8a6e4;opacity:.18;transform:rotate(12deg)">✳</div>
</body>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function shot(html, width, height, file) {
  await page.setViewportSize({ width, height });
  await page.setContent(html.startsWith('<svg') ? `<body style="margin:0;background:transparent">${html}</body>` : html);
  await page.evaluate(() => document.fonts.ready);
  await writeFile(file, await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width, height } }));
  console.log('wrote', file);
}
await shot(icon(192, 42, 0), 192, 192, 'public/icon-192.png');
await shot(icon(512, 112, 0), 512, 512, 'public/icon-512.png');
await shot(icon(512, 0, .2), 512, 512, 'public/icon-maskable.png');
await shot(icon(180, 0, 0), 180, 180, 'public/apple-touch-icon.png');
await shot(social, 1200, 630, 'public/social.png');
await browser.close();
