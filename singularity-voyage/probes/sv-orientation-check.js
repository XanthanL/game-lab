// singularity-voyage 验证：移动端「直接横屏」—— 不再靠手机物理朝向（不读 orientation、
// 不弹「请横屏」、不调 screen.orientation.lock），触屏竖屏视口下由 fit() 把舞台转 90°。
// 自包含：自己起静态服务 + 拉起本地 Chrome，跑完收尾。
// 运行： NODE_PATH=<node-workspace>/node_modules CHROME_EXE=<chrome> node probes/sv-orientation-check.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8612;
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };
const W = 480, H = 270;

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.writeHead(404); res.end('nf'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

const log = (...a) => console.log(...a);

async function pass(browser, vp, label) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)); });
  // 在 page 脚本跑起来之前就钉住 screen.orientation.lock 的探针
  await page.addInitScript(() => {
    window.__lockCalled = false;
    try { if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock = function () { window.__lockCalled = true; return Promise.reject(); };
    } } catch (e) {}
  });
  await page.goto(`http://127.0.0.1:${PORT}/index.html?god=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', null, { timeout: 20000 });
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  await page.evaluate(() => { startGame(); });
  await page.waitForFunction(() => window.__dbg.state === 'play', null, { timeout: 10000 });
  // 触发一次 resize，让 fit() 用「当前视口 + 已置位的 touchMode」重算 rot
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(250);

  const R = await page.evaluate((WH) => {
    const d = window.__dbg;
    const wrap = document.getElementById('wrap');
    const tf = wrap.style.transform || '';
    const rotated = /rotate\(90deg\)/.test(tf);
    const [offX, offY] = d.off, s = d.scale;
    const toG = (sx, sy) => (typeof toGame === 'function' ? toGame(sx, sy) : [NaN, NaN]);
    // 游戏中心 / 四个角 → 期望屏幕落点 → 再逆变换回来，比对
    const center = rotated
      ? [offX - (WH.H / 2) * s, offY + (WH.W / 2) * s]
      : [offX + (WH.W / 2) * s, offY + (WH.H / 2) * s];
    const c1 = rotated ? [offX, offY] : [offX, offY];                       // 游戏 (0,0)
    const c2 = rotated
      ? [offX - WH.H * s, offY + WH.W * s]                                  // 游戏 (W,H)
      : [offX + WH.W * s, offY + WH.H * s];
    const gCenter = toG(center[0], center[1]);
    const gC1 = toG(c1[0], c1[1]);
    const gC2 = toG(c2[0], c2[1]);
    return {
      rotated, touchMode: d.touchMode,
      lockCalled: window.__lockCalled,
      rotateEl: !!document.getElementById('rotate'),
      scale: s,
      centerErr: Math.hypot(gCenter[0] - WH.W / 2, gCenter[1] - WH.H / 2),
      c1Err: Math.hypot(gC1[0] - 0, gC1[1] - 0),
      c2Err: Math.hypot(gC2[0] - WH.W, gC2[1] - WH.H),
      transform: tf,
    };
  }, { W, H });

  R.label = label;
  R.coarse = coarse;
  await page.screenshot({ path: path.join(ROOT, 'probes', 'sv-orientation-' + label + '.png') });
  await ctx.close();
  R.errs = errs;
  return R;
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: CHROME, headless: true,
      args: ['--no-sandbox', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
    });
    const portrait = await pass(browser, { width: 390, height: 844 }, 'portrait');
    const landscape = await pass(browser, { width: 844, height: 390 }, 'landscape');

    for (const R of [portrait, landscape]) {
      log('=== ' + R.label + ' ===');
      log('  coarse / touchMode      : ' + R.coarse + ' / ' + R.touchMode);
      log('  #wrap 含 rotate(90deg)  : ' + R.rotated + (R.rotated ? '  (强制横屏生效)' : '  (不旋转)'));
      log('  #rotate 元素已移除      : ' + (R.rotateEl === false));
      log('  screen.orientation.lock : ' + (R.lockCalled ? '被调用 ❌' : '未调用 ✔'));
      log('  scale                   : ' + R.scale.toFixed(3));
      log('  toGame(中心) 误差       : ' + R.centerErr.toFixed(3) + ' px');
      log('  toGame(角0,0) 误差      : ' + R.c1Err.toFixed(3) + ' px');
      log('  toGame(角W,H) 误差      : ' + R.c2Err.toFixed(3) + ' px');
      log('  JS 错误                 : ' + (R.errs.length ? R.errs.slice(0, 5).join(' | ') : '无'));
    }

    const ok =
      portrait.rotated === true && landscape.rotated === false &&
      portrait.rotateEl === false && landscape.rotateEl === false &&
      portrait.lockCalled === false && landscape.lockCalled === false &&
      portrait.centerErr < 1 && portrait.c1Err < 1 && portrait.c2Err < 1 &&
      landscape.centerErr < 1 && landscape.c1Err < 1 && landscape.c2Err < 1 &&
      portrait.errs.length === 0 && landscape.errs.length === 0;
    log('\n结论 : ' + (ok ? '✔ 移动端直接横屏，零朝向检测、坐标逆变换正确' : '❌ 有项未通过，见上'));
    process.exitCode = ok ? 0 : 1;
  } catch (e) {
    console.error('FATAL', e);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})();
