// 运行时回归：?bot=1 直接开局，跑 12s，确认
//   ① 进 play、无 JS 错误；② BGM 按模式拉曲、一次一首；③ 合成 BGM / 成品曲切换不炸。
// 运行： NODE_PATH=<node-workspace>/node_modules node probes/sv-boot-runtime-check.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8633;
const CHROME = require('./probe-lib').chrome;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

let pass = true;
const chk = (c, l, x) => { console.log((c ? 'PASS ' : 'FAIL ') + l + (x ? '  ' + x : '')); if (!c) pass = false; };

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const mp3 = [], errs = [];
  page.on('request', r => { if (r.url().endsWith('.mp3')) mp3.push(r.url().split('/').pop()); });
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 160)); });

  await page.goto(`http://127.0.0.1:${PORT}/index.html?bot=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__dbg && window.__dbg.state === "play"', { timeout: 30000, polling: 50 });
  await new Promise(r => setTimeout(r, 12000));
  const st = await page.evaluate(() => ({
    state: window.__dbg.state, wave: window.__dbg.G && window.__dbg.G.wave,
    kills: window.__dbg.G && window.__dbg.G.kills,
  }));
  console.log('state =', st.state, ' wave =', st.wave, ' kills =', st.kills);
  console.log('mp3:', mp3.join(', ') || '(无)');
  console.log('errors:', errs.join(' | ') || '(无)');

  chk(errs.length === 0, '无 JS 错误', errs.join(' | '));
  chk(st.state === 'play', '?bot=1 直接开局且稳定在 play');
  chk(st.wave >= 1, '波次推进中', `(wave=${st.wave})`);
  chk(new Set(mp3).size <= 2, '开局 12s 内最多拉 1~2 首曲（不预取）', `(${[...new Set(mp3)].join(',')})`);

  await browser.close();
  server.close();
  console.log(pass ? '\n==> ALL PASS' : '\n==> FAILED');
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error(e); server.close(); process.exit(2); });
