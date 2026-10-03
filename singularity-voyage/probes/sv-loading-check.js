// 验证：① 手机端在 game.js 加载前就已横屏（内联脚本，无竖屏加载闪屏）；
//       ② 修复后 game.js 的 fit() 在首帧 boot 也会横屏（不再等 resize）；
//       ③ 主题化「跃迁」加载动画在手机/桌面都渲染；
//       ④ 动画播完（~2.2s）后自动切到标题页。
// 运行： NODE_PATH=<node-workspace>/node_modules CHROME_EXE=<chrome> node probes/sv-loading-check.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8619;
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

const log = (...a) => console.log(...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const results = {};

  // ---------- (A) 手机端：拦截 game.js（让它不运行），验证内联脚本已提前横屏 ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
    await page.route('**/src/game.js', r => r.abort());   // game.js 永不运行
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
    await sleep(200);
    const early = await page.evaluate(() => ({
      tf: document.getElementById('wrap').style.transform || '',
      coarse: document.documentElement.classList.contains('coarse'),
      hasLd: !!document.querySelector('#loading .ld'),
      rotateHint: getComputedStyle(document.querySelector('.ld-rotate')).display,
      status: (document.querySelector('.ld-status') || {}).textContent || '',
    }));
    await page.screenshot({ path: path.join(ROOT, 'probes', 'sv-loading-mobile.png') });
    results.mobileEarly = { early, errs };
    await ctx.close();
  }

  // ---------- (B) 手机端：完整加载，验证 fit() 首帧即横屏 + 动画后切标题 ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)); });
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__dbg && window.__dbg.state === 'title', null, { timeout: 15000 });
    const later = await page.evaluate(() => ({
      state: window.__dbg.state,
      touchMode: window.__dbg.touchMode,
      rotated: /rotate\(90deg\)/.test(document.getElementById('wrap').style.transform),
    }));
    results.mobileFull = { later, errs };
    await ctx.close();
  }

  // ---------- (C) 桌面端：不横屏，但同样有主题化加载 ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)); });
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
    await sleep(300);
    const early = await page.evaluate(() => ({
      tf: document.getElementById('wrap').style.transform || '(none)',
      coarse: document.documentElement.classList.contains('coarse'),
      hasLd: !!document.querySelector('#loading .ld'),
      rotateHint: getComputedStyle(document.querySelector('.ld-rotate')).display,
    }));
    await page.screenshot({ path: path.join(ROOT, 'probes', 'sv-loading-desktop.png') });
    await page.waitForFunction(() => window.__dbg && window.__dbg.state === 'title', null, { timeout: 15000 });
    const later = await page.evaluate(() => ({ state: window.__dbg.state }));
    results.desktop = { early, later, errs };
    await ctx.close();
  }

  await browser.close();
  server.close();

  let pass = true;
  const chk = (cond, label) => { log((cond ? 'PASS ' : 'FAIL ') + label); if (!cond) pass = false; };
  const mE = results.mobileEarly, mF = results.mobileFull, d = results.desktop;

  log('--- (A) 手机端：game.js 被拦截，仅内联脚本 ---');
  log('  transform =', JSON.stringify(mE.early.tf));
  log('  coarse =', mE.early.coarse, ' rotateHint =', mE.early.rotateHint, ' status =', mE.early.status);
  chk(/rotate\(90deg\)/.test(mE.early.tf), '手机端在 game.js 之前就已 rotate(90deg)（无竖屏加载闪屏）');
  chk(mE.early.coarse === true, '手机端 html.coarse 已置位 → 显示「已进入横屏模式」');
  chk(mE.early.rotateHint === 'block', '手机端横屏提示可见');
  chk(mE.early.hasLd === true, '主题化加载 DOM 存在');
  chk(mE.errs.length === 0, '无 JS 错误' + (mE.errs.length ? ' -> ' + mE.errs.join(' | ') : ''));

  log('--- (B) 手机端：完整加载 ---');
  log('  state =', mF.later.state, ' touchMode =', mF.later.touchMode, ' rotated =', mF.later.rotated);
  chk(mF.later.state === 'title', '动画播完后进入标题页');
  chk(mF.later.touchMode === true, 'touchMode 已置位');
  chk(mF.later.rotated === true, 'fit() 首帧即横屏（不再等 resize）');
  chk(mF.errs.length === 0, '无 JS 错误' + (mF.errs.length ? ' -> ' + mF.errs.join(' | ') : ''));

  log('--- (C) 桌面端 ---');
  log('  transform =', JSON.stringify(d.early.tf), ' coarse =', d.early.coarse, ' rotateHint =', d.early.rotateHint);
  chk(!/rotate\(90deg\)/.test(d.early.tf), '桌面端不横屏（保持原样）');
  chk(d.early.coarse === false, '桌面端不挂 coarse');
  chk(d.early.rotateHint === 'none', '桌面端不显示横屏提示');
  chk(d.early.hasLd === true, '桌面端同样有主题化加载动画');
  chk(d.later.state === 'title', '桌面端动画播完后进入标题页');
  chk(d.errs.length === 0, '无 JS 错误' + (d.errs.length ? ' -> ' + d.errs.join(' | ') : ''));

  log('\n截图：probes/sv-loading-mobile.png / probes/sv-loading-desktop.png');
  log(pass ? '\n==> ALL PASS' : '\n==> FAILED');
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
