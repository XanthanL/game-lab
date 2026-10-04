// singularity-voyage 验证：触屏摇杆「推向哪就立刻转向哪」
// 自包含：自己起静态服务 + 拉起本地 Chrome，跑完收尾。
// 运行： NODE_PATH=<node-workspace>/node_modules CHROME_EXE=<chrome> node probes/sv-touch-turn-check.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8621;
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };

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
  log('[cp] page loaded');
  await page.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', null, { timeout: 20000 });
  log('[cp] booted, state=', await page.evaluate(() => window.__dbg.state));
  await page.evaluate(() => { window.__dbg.setTouchMode(true); startGame(); });
  await page.waitForFunction(() => window.__dbg.state === 'play', null, { timeout: 10000 });
  log('[cp] in play');
  await page.waitForTimeout(500);

  // 看门狗：页内测量若卡住（某一步 await 死等），60s 后带着已算出的部分返回，
  // 免得整个探针无声挂住、连「卡在哪一步」都看不到。
  const R = await page.evaluate(() => new Promise(async resolve => {
    const out = { _watchdog: false };
    const wd = setTimeout(() => { out._watchdog = true; resolve(out); }, 60000);
    try {
    const d = window.__dbg, G = d.G;
    const frame = () => new Promise(r => requestAnimationFrame(r));

    d.clearEnemies(); d.clearMods(); d.resetStats();
    d.setPos(G.px, G.py);
    G.ang = 0; G.aim = 0; G.vx = 0; G.vy = 0; G.hitstop = 0; G.shake = 0;
    const norm = a => Math.atan2(Math.sin(a), Math.cos(a));

    // 从 ang 出发，把摇杆推向 want 方向，量「误差降到 2° 以内」用了多久
    async function turnTo(from, want, joyMag) {
      d.setPos(G.px, G.py);
      G.ang = from; G.aim = from; G.vx = 0; G.vy = 0;
      await frame(); await frame();
      d.setJoy(Math.cos(want) * joyMag, Math.sin(want) * joyMag, true);
      const t0 = G.t;
      let tHit = -1, maxErr = Math.abs(norm(want - from));
      for (let i = 0; i < 240 && tHit < 0; i++) {
        await frame();
        const e = Math.abs(norm(want - G.ang));
        if (e > maxErr) maxErr = e;
        if (e < 0.035) { tHit = G.t - t0; break; }
      }
      d.setJoy(0, 0, false);
      return { tHit: +tHit.toFixed(3), maxErrDeg: +(maxErr * 57.3).toFixed(1), settled: +norm(want - G.ang).toFixed(4) };
    }

    out.flip180 = await turnTo(0, Math.PI, 1);          // 满舵掉头
    out.turn90 = await turnTo(0, Math.PI / 2, 1);       // 满舵 90°
    out.turn180light = await turnTo(0, Math.PI, 0.18);  // 刚出死区（最慢档）
    out.turn180tiny = await turnTo(0, Math.PI, 0.1);    // 死区内 → 应当不动
    out.tinyMoved = Math.abs(norm(Math.PI - G.ang));

    // 死区内松手漂移：连续 30 帧朝向必须完全不动
    d.setPos(G.px, G.py);
    G.ang = 1.234; G.aim = 1.234; G.vx = 0; G.vy = 0;
    d.setJoy(0.05, 0.05, true);
    let drift = 0;
    for (let i = 0; i < 30; i++) { await frame(); drift = Math.max(drift, Math.abs(norm(1.234 - G.ang))); }
    d.setJoy(0, 0, false);
    out.deadzoneDriftDeg = +(drift * 57.3).toFixed(3);

    // 满速行驶中掉头：机头瞬转后，**速度方向**多久跟上（不侧滑）
    d.setPos(G.px, G.py);
    G.ang = 0; G.aim = 0;
    d.setJoy(1, 0, true);
    for (let i = 0; i < 90; i++) await frame();          // 加速到接近满速
    out.speedBefore = +Math.hypot(G.vx, G.vy).toFixed(1);
    d.setJoy(0, 1, true);                                 // 瞬间推向正上方
    const vAng0 = Math.atan2(G.vy, G.vx);
    let tAlign = -1;
    const t1 = G.t;
    for (let i = 0; i < 180 && tAlign < 0; i++) {
      await frame();
      const vAng = Math.atan2(G.vy, G.vx);
      if (Math.abs(norm(Math.PI / 2 - vAng)) < 0.25) tAlign = G.t - t1;
    }
    out.velAlignS = +tAlign.toFixed(3);
    out.velDirDegOff = +(norm(Math.PI / 2 - Math.atan2(G.vy, G.vx)) * 57.3).toFixed(1);
    d.setJoy(0, 0, false);

    // 松手后：船体应回摆到「悬浮瞄准标」方向（新设计），而非停在最后一帧朝向
    d.setAim(0.5);
    G.ang = 2.0; G.aim = 0.5; G.vx = 0; G.vy = 0;
    d.setJoy(0, 0, false);
    for (let i = 0; i < 60; i++) await frame();
    out.afterReleaseDeg = +(norm(0.5 - G.ang) * 57.3).toFixed(2);   // 应≈0：已回到瞄准标 0.5

    out.spdMul = G.S.spd; out.turnMul = G.S.turn;
    clearTimeout(wd);
    } catch (e) { out.fatal = e.message + ' | ' + (e.stack || '').split('\n')[1]; clearTimeout(wd); }
    resolve(out);
  }));

  log('满舵掉头 180°   ', R.flip180.tHit, 's   最大偏差', R.flip180.maxErrDeg, '°   残差', R.flip180.settled);
  log('满舵转 90°      ', R.turn90.tHit, 's');
  log('轻推(0.18)掉头  ', R.turn180light.tHit, 's');
  log('死区内(0.1)不动 ', R.tinyMoved, 'rad  (≈π 即完全没转)');
  log('死区漂移 30 帧 ', R.deadzoneDriftDeg, '°  (应≈0)');
  log('满速', R.speedBefore, '→ 速度方向跟上机头', R.velAlignS, 's   残差', R.velDirDegOff, '°');
  log('松手后 30 帧转角', R.afterReleaseDeg, '°  (应≈0)');
  log('S.spd/turn =', R.spdMul, '/', R.turnMul);
  log('pageErrors =', errs.length ? errs : 'none');

  // 判定：满舵 180° ≤ 0.2s；轻推 ≤ 0.35s；死区内完全不动；松手不转
  // ⚠️ 死区那一项读的是 out.tinyMoved（不是 turn180tiny.tinyMoved）——
  //    后者根本不存在，早先写成 undefined 让本该 PASS 的用例报 FAIL。
  const pass = R.flip180.tHit > 0 && R.flip180.tHit <= 0.20
    && R.turn180light.tHit > 0 && R.turn180light.tHit <= 0.35
    && R.tinyMoved > 3.0            // 摇杆没出死区 → 180° 误差原封不动（≈π）
    && R.deadzoneDriftDeg < 0.01
    && R.afterReleaseDeg < 0.01
    && !R.fatal && !R._watchdog && errs.length === 0;
  log('\n' + (pass ? 'PASS ✅ 摇杆转向「推向哪转向哪」' : 'FAIL ❌'));

  await browser.close();
  server.close();
  process.exit(pass ? 0 : 1);
})();
