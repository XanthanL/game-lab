// singularity-voyage 验证：子弹从模型炮口（机首）出膛 + 普通子弹临终减速 + 尾焰锚在机尾
// 自包含：自己起静态服务 + 拉起本地 Chrome，跑完收尾。
// 运行： NODE_PATH=<node-workspace>/node_modules CHROME_EXE=<chrome> node probes/sv-muzzle-decel.js
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
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.writeHead(404); res.end('nf'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

const log = (...a) => console.log(...a);

(async () => {
  await new Promise(r => server.listen(PORT, r));
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: CHROME, headless: true,
      args: ['--no-sandbox', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
    });
    const errs = [];
    const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
    page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)); });

    await page.goto(`http://127.0.0.1:${PORT}/index.html?god=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', null, { timeout: 20000 });
    await page.evaluate(() => { startGame(); });
    await page.waitForFunction(() => window.__dbg.state === 'play', null, { timeout: 10000 });
    await page.waitForTimeout(300);

    const R = await page.evaluate(async () => {
      const d = window.__dbg, G = d.G;
      const out = { fatal: null, hull: G.S.hull, nose: 0, tail: 0 };
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const dist = (x, y) => Math.hypot(x - G.px, y - G.py);
      try {
        out.nose = hullNose();
        out.tail = hullTail();

        // ---- ① 子弹从机首炮口出膛（不是船心） ----
        G.bullets.length = 0;
        G.ang = 0; G.aim = 0;
        d.fire(0);                         // 机首朝右（+x）开一枪
        const spawn = G.bullets.map(b => ({
          d: dist(b.x, b.y),
          ang: Math.atan2(b.y - G.py, b.x - G.px),
        }));
        out.spawn = spawn;
        // 期望：每发都在机首附近（≈nose），且明显大于旧的固定 11px
        out.spawnOk = spawn.length > 0 && spawn.every(s => s.d >= out.nose - 2 && s.d <= out.nose + 8 && s.d > 12);

        // ---- ② 普通子弹临终减速：初速快，剩余寿命 < BDECEL_T 时明显变慢 ----
        d.clearEnemies();
        G.bullets.length = 0;
        G.ang = 0; G.aim = 0;
        d.fire(0);
        const b = G.bullets[0];
        const sp0 = Math.hypot(b.vx, b.vy);
        let lateSp = sp0, lateFrac = 1, sawLate = false;
        for (let k = 0; k < 50; k++) {
          await wait(40);
          if (!G.bullets.includes(b)) break;     // 已消失
          const f = b.life / b.life0;
          if (f < 0.4) { sawLate = true; const s = Math.hypot(b.vx, b.vy); if (s < lateSp) lateSp = s; lateFrac = Math.min(lateFrac, f); }
        }
        out.decel = { sp0: +sp0.toFixed(1), lateSp: +lateSp.toFixed(1), lateFrac: +lateFrac.toFixed(2), sawLate, ratio: +(lateSp / sp0).toFixed(2) };
        out.decelOk = sawLate && lateSp < sp0 * 0.9;

        // ---- ③ 尾焰锚在机尾：tail 锚点明显大于旧的 9，且画面上机尾后方确实有火焰像素 ----
        out.tailMovedOut = out.tail > 11;   // 旧锚点是 9，机尾伸出量应明显更大
        d.clearEnemies();
        G.bullets.length = 0;
        d.hold('KeyW', true);              // 持续推进 → G.thrust=true
        let maxRear = 0;
        for (let k = 0; k < 8; k++) {
          G.ang = 0; G.aim = 0;           // 机首朝右，尾焰朝左（屏幕后方）
          await wait(40);
          G.ang = 0; G.aim = 0;
          const cv = document.getElementById('game');
          const data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
          const [sx, sy] = worldToView(G.px, G.py);          // 船体屏幕中心
          // 火焰色 #ffcd75 ≈ (255,205,117)；只统计船尾后方（屏幕 x < sx，且贴近中轴）
          for (let y = Math.max(0, sy - 14); y < Math.min(cv.height, sy + 14); y++) {
            for (let x = 0; x < sx; x++) {
              const i = (y * cv.width + x) * 4;
              const r = data[i], g = data[i + 1], bl = data[i + 2];
              if (r > 230 && g > 175 && g < 235 && bl > 80 && bl < 160) {
                const rear = sx - x;        // 距船心的后方距离
                if (rear > maxRear) maxRear = rear;
              }
            }
          }
        }
        d.hold('KeyW', false);
        out.flameRearPx = +maxRear.toFixed(1);
        // 旧锚点 9 + 火焰最长 ~13 ≈ 22；尾锚后火焰至少应推到 24 以外
        out.flameOk = maxRear > 23;

        // ---- ④ 尾炮从机尾出膛、散射从机首出膛 ----
        G.bullets.length = 0;
        G.ang = 0; G.aim = 0;
        d.clearMods();
        d.grant('backshot', 1); d.grant('spray', 1);
        d.fire(0);
        const rear = G.bullets.filter(b => b.kind === 'rear').map(b => dist(b.x, b.y));
        const spray = G.bullets.filter(b => b.kind === 'spray').map(b => dist(b.x, b.y));
        out.rearSpawn = rear; out.spraySpawn = spray;
        // 尾炮应在机尾附近（≈tail，朝后所以 distance≈tail），散射应在机首附近（≈nose）
        out.rearOk = rear.length > 0 && rear.every(x => x >= out.tail - 3 && x <= out.tail + 8);
        out.sprayOk = spray.length > 0 && spray.every(x => x >= out.nose - 3 && x <= out.nose + 8);
      } catch (e) { out.fatal = e.message + '\n' + (e.stack || ''); }
      return out;
    });

    log('hull        =', R.hull);
    log('nose (px)   =', R.nose, ' tail (px) =', R.tail);
    log('spawn       =', JSON.stringify(R.spawn));
    log('spawnOk     =', R.spawnOk);
    log('decel       =', JSON.stringify(R.decel));
    log('decelOk     =', R.decelOk);
    log('tailMovedOut=', R.tailMovedOut, ' flameRearPx =', R.flameRearPx, ' flameOk =', R.flameOk);
    log('rearSpawn  =', JSON.stringify(R.rearSpawn), ' rearOk =', R.rearOk);
    log('spraySpawn =', JSON.stringify(R.spraySpawn), ' sprayOk =', R.sprayOk);
    log('pageErrors  =', errs.length ? errs : 'none');
    log('FATAL       =', R.fatal || 'none');

    const pass = R.spawnOk && R.decelOk && R.tailMovedOut && R.flameOk && R.rearOk && R.sprayOk && !R.fatal && errs.length === 0;
    log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
    process.exitCode = pass ? 0 : 1;
  } catch (e) {
    log('HARNESS ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})();
