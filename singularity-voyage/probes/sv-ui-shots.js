// singularity-voyage UI 截图台：把各个界面按 3 倍像素拍下来，用于排版迭代。
// 运行： NODE_PATH=<ws>/node_modules CHROME_EXE=<chrome> node probes/sv-ui-shots.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const PORT = 8624;
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
const out = n => path.join(ROOT, 'probes', 'ui-' + n + '.png');
const log = (...a) => console.log(...a);

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  log('[cp] server up on', PORT);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  log('[cp] browser launched');

  // 桌面：1280x720 → #wrap 放大到 2 倍多一点，截图给 3x 设备像素，足够看清 12px 像素字
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', null, { timeout: 20000 });
  log('[cp] booted');

  const shot = async (name, sel) => {
    const el = sel ? await page.$(sel) : null;
    await (el || page).screenshot({ path: out(name) });
    log('  shot', name);
  };
  // 只拍 #wrap 那一块（480x270 的逻辑画布），避免 1280 的大片黑边
  const shotWrap = async (name) => { await (await page.$('#wrap')).screenshot({ path: out(name) }); log('  shot', name); };

  // ---- 1. 标题 ----
  await page.waitForTimeout(400);
  await shotWrap('01-title');

  // ---- 2. 机库 ----
  await page.click('[data-act="hangar"]');
  await page.waitForTimeout(500);
  await shotWrap('02-hangar');

  // ---- 3. 图鉴 ----
  await page.click('#hangar [data-act="title"]');
  await page.waitForTimeout(300);
  await page.click('#title [data-act="codex"]');
  await page.waitForTimeout(400);
  await shotWrap('03-codex');

  // ---- 4. 升级选卡 ----
  await page.click('#codex [data-act="codexback"]');
  await page.waitForTimeout(300);
  await page.evaluate(() => { startGame(); });
  await page.waitForFunction(() => window.__dbg.state === 'play', null, { timeout: 10000 });
  await page.evaluate(() => { window.__dbg.giveXp(40); });
  await page.waitForFunction(() => window.__dbg.state === 'upgrade', null, { timeout: 10000 });
  await page.waitForTimeout(500);
  await shotWrap('04-cards');

  // ---- 5. HUD（满装配 + 巨像 + 主动技能）----
  await page.evaluate(() => {
    const d = window.__dbg;
    // 先随便选一张把升级面板关掉
    window.choose(0, false);
  });
  await page.waitForFunction(() => window.__dbg.state === 'play', null, { timeout: 10000 });
  await page.evaluate(() => {
    const d = window.__dbg;
    for (const id of ['barrels', 'rapid', 'dmg', 'piercer', 'homing', 'spray', 'backshot', 'lance', 'blink', 'mine', 'shield', 'coil']) {
      try { d.grant(id, 2); } catch (e) {}
    }
    d.spawnBoss('gate');
  });
  await page.waitForTimeout(1400);          // 让弹幕 / 尾焰 / 粒子都跑起来
  await shotWrap('05-hud');

  // ---- 6. 暂停 ----
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await shotWrap('06-pause');

  // ---- 7. 结算 ----
  await page.evaluate(() => { window.__dbg.state === 'pause' && window.togglePause(); });
  await page.waitForTimeout(200);
  await page.evaluate(() => { window.gameOver(); });
  await page.waitForTimeout(600);
  await shotWrap('07-over');

  // ---- 8. 手机端 HUD（竖屏视口，看强制横屏后的排版）----
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const mp = await mctx.newPage();
  mp.on('pageerror', e => errs.push('mobile: ' + e.message));
  await mp.goto(URL, { waitUntil: 'load' });
  await mp.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', null, { timeout: 20000 });
  await mp.evaluate(() => { startGame(); });
  await mp.waitForFunction(() => window.__dbg.state === 'play', null, { timeout: 10000 });
  await mp.evaluate(() => {
    const d = window.__dbg;
    for (const id of ['barrels', 'rapid', 'dmg', 'piercer', 'homing', 'spray', 'backshot', 'lance', 'blink', 'mine']) {
      try { d.grant(id, 2); } catch (e) {}
    }
    d.spawnBoss('warden');
  });
  await mp.waitForTimeout(1400);
  await (await mp.$('#wrap')).screenshot({ path: out('08-mobile-hud') });
  log('  shot 08-mobile-hud');

  log('\nJS 错误:', errs.length ? errs : '无');
  await browser.close();
  server.close();
  log('done');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
