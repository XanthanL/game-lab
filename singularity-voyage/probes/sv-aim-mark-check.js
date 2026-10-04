// singularity-voyage 验证：手机版「悬浮瞄准标」解耦 + 拖动 + 开火沿瞄准标
// 自包含：自己起静态服务 + 拉起本地 Chrome，跑完收尾。
// 运行： NODE_PATH=<node-workspace>/node_modules CHROME_EXE=<chrome> node probes/sv-aim-mark-check.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8622;
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.mp3': 'audio/mpeg' };

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

const URL = process.env.SV_URL || `http://127.0.0.1:${PORT}/index.html?god=1`;
const log = (...a) => console.log(...a);
const norm = a => Math.atan2(Math.sin(a), Math.cos(a));

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  log('[cp] server up on ' + PORT);
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  });
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)); });

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', null, { timeout: 20000 });
  await page.evaluate(() => { window.__dbg.setTouchMode(true); startGame(); });
  await page.waitForFunction(() => window.__dbg.state === 'play', null, { timeout: 10000 });
  await page.waitForTimeout(400);

  const R = await page.evaluate(() => new Promise(async resolve => {
    const out = { _watchdog: false };
    const wd = setTimeout(() => { out._watchdog = true; resolve(out); }, 60000);
    try {
      const d = window.__dbg, G = d.G;
      const frame = () => new Promise(r => requestAnimationFrame(r));
      const norm = a => Math.atan2(Math.sin(a), Math.cos(a));

      d.clearEnemies(); d.clearMods(); d.resetStats();
      d.setPos(G.px, G.py);

      // Phase A：解耦 —— 摇杆把船体转到 0，炮口应保持瞄准标 PI
      d.setAim(Math.PI);
      G.ang = 0; G.aim = 0; G.vx = 0; G.vy = 0; G.hitstop = 0; G.shake = 0;
      await frame(); await frame();
      d.setJoy(1, 0, true);
      for (let i = 0; i < 40; i++) await frame();
      out.phaseA_ang = +norm(G.ang).toFixed(3);
      out.phaseA_aim = +norm(G.aim).toFixed(3);
      d.setJoy(0, 0, false);

      // Phase B：松手后船体回摆到瞄准标
      for (let i = 0; i < 60; i++) await frame();
      out.phaseB_ang = +norm(G.ang).toFixed(3);
      out.phaseB_aim = +norm(G.aim).toFixed(3);

      // Phase C：拖动悬浮标（合成 Touch 事件，右半屏 上 vs 下）
      const fireTouch = (type, id, x, y) => {
        const t = new Touch({ identifier: id, target: document.getElementById('wrap'), clientX: x, clientY: y, pageX: x, pageY: y });
        const ev = new TouchEvent(type, { cancelable: true, bubbles: true,
          touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t] });
        document.getElementById('wrap').dispatchEvent(ev);
      };
      const vw = window.innerWidth, vh = window.innerHeight;
      const xR = Math.round(vw * 0.82);
      const yTop = Math.round(vh * 0.30), yBot = Math.round(vh * 0.72);
      fireTouch('touchstart', 1, xR, yTop); fireTouch('touchmove', 1, xR, yTop - 40);
      for (let i = 0; i < 8; i++) await frame();
      out.aimTop = +norm(d.aim).toFixed(3);
      fireTouch('touchend', 1, xR, yTop - 40);
      fireTouch('touchstart', 2, xR, yBot); fireTouch('touchmove', 2, xR, yBot + 40);
      for (let i = 0; i < 8; i++) await frame();
      out.aimBot = +norm(d.aim).toFixed(3);
      fireTouch('touchend', 2, xR, yBot + 40);

      // Phase D：开火沿瞄准标方向（先等一帧让 G.aim 同步到 touchAim，再开火）
      d.setAim(0); G.bullets.length = 0; await frame(); await frame();
      d.fire(); await frame();
      const b = G.bullets[G.bullets.length - 1];
      out.bulletAng = b ? +norm(b.ang).toFixed(3) : null;

      clearTimeout(wd);
    } catch (e) { out.fatal = e.message + ' | ' + (e.stack || '').split('\n')[1]; clearTimeout(wd); }
    resolve(out);
  }));

  log('Phase A  船体 ang=', R.phaseA_ang, ' 炮口 aim=', R.phaseA_aim, '  (期望: 船体≈0, 炮口≈π → 解耦)');
  log('Phase B  松手后 ang=', R.phaseB_ang, ' 炮口 aim=', R.phaseB_aim, '  (期望: 都≈π)');
  log('Phase C  上拖 aimTop=', R.aimTop, ' 下拖 aimBot=', R.aimBot, '  (期望: 都不≈π, 且 aimTop<aimBot, 均朝右 cos>0)');
  log('Phase D  开火方向 bulletAng=', R.bulletAng, '  (期望: ≈0 向右)');
  log('pageErrors =', errs.length ? errs : 'none');

  const decoupled = Math.abs(R.phaseA_ang) < 0.2
    && Math.abs(norm(Math.PI - R.phaseA_aim)) < 0.1
    && Math.abs(norm(R.phaseA_ang - R.phaseA_aim)) > 2.5;
  const returns = Math.abs(norm(R.phaseB_ang - Math.PI)) < 0.2
    && Math.abs(norm(R.phaseB_ang - R.phaseB_aim)) < 0.1;
  const dragWorks = Math.abs(norm(R.aimTop - Math.PI)) > 0.3
    && Math.abs(norm(R.aimBot - Math.PI)) > 0.3
    && R.aimTop < R.aimBot
    && Math.cos(R.aimTop) > 0 && Math.cos(R.aimBot) > 0;
  const firesRight = R.bulletAng !== null && Math.abs(R.bulletAng) < 0.2;

  const pass = decoupled && returns && dragWorks && firesRight && !R.fatal && !R._watchdog && errs.length === 0;
  log('\n' + (pass ? 'PASS ✅ 悬浮瞄准标：解耦 / 回摆 / 拖动 / 开火沿瞄准 全部通过'
                 : 'FAIL ❌'),
       { decoupled, returns, dragWorks, firesRight });

  await browser.close();
  server.close();
  process.exit(pass ? 0 : 1);
})();
