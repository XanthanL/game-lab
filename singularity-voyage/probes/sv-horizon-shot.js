// 视界形态渲染验证：截 3 张图（引力透镜 + 吸积盘 / 子弹弯曲弹道 / 吞噬瞬间）
// 运行： node probes/sv-horizon-shot.js
const puppeteer = require('puppeteer-core');
const http = require('http'); const fs = require('fs'); const path = require('path');
const CHROME = require('./probe-lib').chrome;
const ROOT = path.resolve(__dirname, '..'); const PORT = 8629;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${PORT}/index.html`;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  });
  const errs = [];
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 520 });
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)); });

  // ⚠️ 不开 god：god 模式下 hurtPlayer 第一行就 return，视界灼烧测不到；
  //    这里只是截图，但保持一致免得误判。
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', { timeout: 20000 });
  await page.evaluate(() => { startGame(); });
  await page.waitForFunction(() => window.__dbg.state === 'play', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 300));

  const shot = async (file, kind) => await page.evaluate((kind) => new Promise(async (resolve) => {
    const d = window.__dbg, G = d.G;
    const frame = () => new Promise(r => requestAnimationFrame(r));
    // 进第 6 段（视界）
    d.clearEnemies(); G.spawnQueue.length = 0; G.boss = null; G.bossPending = null;
    G.pickups.length = 0; G.ebullets.length = 0; G.bullets.length = 0; G.parts.length = 0;
    G.banner = null; G.fx.length = 0;
    d.setPos(900, 900); G.vx = 0; G.vy = 0;
    startWave(6);
    for (let i = 0; i < 10; i++) { G.hitstop = 0; await frame(); }
    G.banner = null;

    if (kind === 'bend') {
      // 弹道弯曲：玩家**原地不动**（相机跟玩家，瞬移会让相机漂出奇点），
      // 以奇点当前位置为基准，从它左侧视口内发一梭子，让引力把弹掰弯。
      for (let i = G.enemies.length - 1; i >= 0; i--) G.enemies.splice(i, 1);
      G.spawnQueue.length = 0;
      for (let i = 0; i < 40; i++) { G.hitstop = 0; await frame(); }   // 等奇点公转稳定
      const sx = G.sing.x, sy = G.sing.y;
      G.vx = 0; G.vy = 0;
      for (let k = 0; k < 20; k++) {
        pBullet(sx - 240, sy - 120 + k * 5, 0, 300, 10, { life: 3 });
      }
      // 40 帧后弹群排成一道下垂的弧线（再久就被吸进视界黑盘里）。
      // 每帧帧前后都清怪：updateWave 可能在帧内直接 spawn，挡在弹道上。
      for (let i = 0; i < 40; i++) {
        G.spawnQueue.length = 0;
        for (let j = G.enemies.length - 1; j >= 0; j--) G.enemies.splice(j, 1);
        G.hitstop = 0; G.banner = null; await frame();
        G.spawnQueue.length = 0;
        for (let j = G.enemies.length - 1; j >= 0; j--) G.enemies.splice(j, 1);
      }
      G.banner = null;
    } else if (kind === 'devour') {
      // 吞噬瞬间：把一圈敌人摆到奇点旁边，等它们被吸进去
      for (let i = G.enemies.length - 1; i >= 0; i--) G.enemies.splice(i, 1);
      G.spawnQueue.length = 0;
      const s = G.sing;
      for (let k = 0; k < 7; k++) {
        const a = k / 7 * Math.PI * 2;
        d.spawn('bastion', s.x + Math.cos(a) * 78, s.y + Math.sin(a) * 78);
      }
      G.px = s.x + 40; G.py = s.y + 210; G.vx = 0; G.vy = 0;
      for (let i = 0; i < 26; i++) { G.hitstop = 0; G.spawnQueue.length = 0; await frame(); }
    } else {
      // 静置：让奇点自己长一会儿，看吸积盘与透镜环
      for (let i = 0; i < 60; i++) { G.hitstop = 0; await frame(); }
      G.banner = null;
    }
    resolve({ r: +G.sing.r.toFixed(1), tier: G.sing.tier, enemies: G.enemies.length,
              bullets: G.bullets.length, kills: G.kills, hud: G.waveT.toFixed(1) });
  }), kind).then(async info => {
    await page.screenshot({ path: 'probes/' + file });
    console.log(file.padEnd(26), JSON.stringify(info));
  });

  await shot('horizon-core.png', 'idle');
  await shot('horizon-bend.png', 'bend');
  await shot('horizon-devour.png', 'devour');

  console.log(errs.length ? '❌ 错误：\n' + errs.join('\n') : '✅ 零 JS 错误');
  await browser.close(); server.close();
})();
