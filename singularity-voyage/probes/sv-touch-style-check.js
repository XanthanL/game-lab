// singularity-voyage 手机端触屏按钮「像素化」验证：把开火/超载/冲刺/暂停/全屏
// 在「开 / 就绪」态下单独高清截图，确认边缘是像素台阶而非平滑弧线。
// 运行： NODE_PATH=<ws>/node_modules CHROME_EXE=<chrome> node probes/sv-touch-style-check.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const PORT = 8626;
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const f = path.join(ROOT, rel);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const URL = `http://127.0.0.1:${PORT}/index.html?god=1`;
const out = n => path.join(ROOT, 'probes', n + '.png');
const log = (...a) => console.log(...a);

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  // 用横屏大视口：vw>vh 不触发强制旋转，#touch 轴对齐；放大让按钮像素更大便于核对
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 700 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', null, { timeout: 20000 });
  await page.evaluate(() => { startGame(); });
  await page.waitForFunction(() => window.__dbg.state === 'play', null, { timeout: 10000 });
  await page.evaluate(() => {
    const d = window.__dbg;
    for (const id of ['barrels', 'rapid', 'dmg', 'piercer', 'homing', 'spray', 'backshot', 'lance', 'blink', 'mine']) {
      try { d.grant(id, 2); } catch (e) {}
    }
    // 强制开火「开」态 + 超载「就绪」态，露全两种描边
    const wrap = document.getElementById('wrap');
    wrap.classList.add('fire-on');
    const od = document.getElementById('btn-od');
    if (od) od.classList.add('ready');
  });
  await page.waitForTimeout(800);

  // 先确认触屏层确实显示（否则下面截图全空）
  const touchInfo = await page.evaluate(() => {
    const w = document.getElementById('wrap');
    const t = document.getElementById('touch');
    return { wrapCls: w.className, touchDisplay: t ? getComputedStyle(t).display : 'NO #touch',
             fireRect: (() => { const e = document.getElementById('btn-fire'); const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })() };
  });
  log('  touchInfo:', JSON.stringify(touchInfo));

  // 用 getBoundingClientRect 自己算裁剪框，绕开 Playwright 对 clip-path 元素的「不可见」判定
  const clipShot = async (name, sel) => {
    const rect = await page.evaluate((s) => {
      const e = document.querySelector(s); if (!e) return null;
      const r = e.getBoundingClientRect();
      return { x: Math.max(0, r.x - 6), y: Math.max(0, r.y - 6), width: r.width + 12, height: r.height + 12 };
    }, sel);
    if (!rect) { log('  MISSING', sel); return; }
    await page.screenshot({ path: out(name), clip: rect });
    log('  shot', name, '->', sel);
  };

  // 右下动作簇（开火/冲刺/燃标）放大
  await clipShot('touch-fire', '#btn-fire');
  await clipShot('touch-dash', '.tb-dash');
  await clipShot('touch-od', '#btn-od');
  // 顶栏工具键
  await clipShot('touch-pause', '.tb-pause');
  await clipShot('touch-full', '.tb-full');

  // 整块 #wrap，确认整体排版没被 clip-path 破坏
  await (await page.$('#wrap')).screenshot({ path: out('touch-wrap') });
  log('  shot touch-wrap');

  log('\nJS 错误:', errs.length ? errs : '无');
  await browser.close();
  server.close();
  log('done');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
