// 星区主题截图：五个区各一张，每张都要**把那条机制拍进去**。
//   ① 碎屑带 = 漂移块（拍块在移动轴上偏离格位的样子）
//   ② 星云   = EMP 冲击瞬间（环 + 被定住的敌人）
//   ③ 熔炉   = 喷口喷发 + 留下的火场
//   ④ 奇点   = 折射带 + 一发正在被掰弯的弹
//   ⑤ 结晶   = 晶壁反弹（弹贴着墙往回走）
// 无断言，改视觉先拍再看；跑断言的是 sv-zone-check.js。
const puppeteer = require('puppeteer-core');
const http = require('http'); const fs = require('fs'); const path = require('path');
const CHROME = require('./probe-lib').chrome;
const ROOT = path.resolve(__dirname, '..'); const PORT = 8642;
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

  await page.goto(BASE + '?god=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', { timeout: 20000 });
  await page.evaluate(() => { startGame(); });
  await page.waitForFunction(() => window.__dbg.state === 'play', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 300));

  const shot = async (file, kind) => await page.evaluate((kind) => new Promise(async (resolve) => {
    const d = window.__dbg, G = d.G;
    const frame = () => new Promise(r => requestAnimationFrame(r));
    const clear = () => {
      G.enemies.length = 0; G.ebullets.length = 0; G.bullets.length = 0;
      G.parts.length = 0; G.pickups.length = 0;
      while (G.spawnQueue.length < 3) G.spawnQueue.push('seeker');
    };
    const run = async n => { for (let i = 0; i < n; i++) { clear(); G.hitstop = 0; await frame(); } };
    // ⚠️ 测弹道的几张**不能**用 run：它每帧把 G.bullets 清空，
    //    拍出来就是「打了一梭子却一发不剩」—— 折射弧线和晶壁反弹全都看不见。
    const runKeep = async n => { for (let i = 0; i < n; i++) { while (G.spawnQueue.length < 3) G.spawnQueue.push('seeker'); G.hitstop = 0; await frame(); } };
    const park = (x, y) => { d.setPos(x, y); G.vx = 0; G.vy = 0; };

    if (kind === 'drift') {
      d.gotoWave(3); await run(3);
      // 站在一块漂移块旁边，让它扫过视野；撒几只敌人在柱间
      const m = G.terr.filter(b => b.mov)[0] || G.terr[0];
      park(m ? m.x - 120 : 640, m ? m.y : 380);
      await run(30);
      for (let i = 0; i < 5; i++) d.spawn('seeker', G.px + Math.cos(i) * 110, G.py + Math.sin(i * 1.7) * 70);
      await run(20);
    } else if (kind === 'emp') {
      d.gotoWave(5); await run(3);
      park(700, 400);
      G.enemies.length = 0;
      for (let i = 0; i < 6; i++) d.spawn('seeker', G.px + Math.cos(i * 1.1) * 150, G.py + Math.sin(i * 1.1) * 110);
      for (let i = 0; i < 14; i++) d.ebullet(G.px + 180, G.py + (i - 7) * 16, Math.PI + Math.sin(i) * .3, 190, 4, '#ff3355');
      // 逼脉冲在**这一帧**发生：截的是环刚炸开、敌人身上冒电感的那一下
      G.hz.next = 0.01;
      for (let i = 0; i < 3; i++) { while (G.spawnQueue.length < 3) G.spawnQueue.push('seeker'); G.hitstop = 0; await frame(); }
    } else if (kind === 'forge') {
      d.gotoWave(7); await run(3);
      const v = G.terr.filter(b => b.kind === 'vent')[0];
      if (v) {
        park(v.x - 80, v.y + 70);
        // 让全场喷口一起进喷发段：拍出来才像「熔炉」，不是「一口小烟囱」
        for (const b of G.terr) if (b.kind === 'vent') { b.ph = 2; b.t = 0.32; b.tick = 0; }
        for (let i = 0; i < 4; i++) d.addFire && d.addFire(v.x + i * 40 - 60, v.y + 40, 30);
        await run(6);
      }
      for (let i = 0; i < 4; i++) d.spawn('seeker', G.px + Math.cos(i) * 130, G.py + Math.sin(i) * 90);
      await run(10);
    } else if (kind === 'lens') {
      d.gotoWave(10); await run(3); G.fires.length = 0;
      const b = G.hz && G.hz.bands ? G.hz.bands[0] : null;
      if (b) {
        park(b.x - Math.cos(b.a) * 130, b.y - Math.sin(b.a) * 130);
        // 沿带发一串弹：拍出「整排弹被掰成弧线」，这是折射带唯一说得清的图
        await run(3);
        G.bullets.length = 0;
        for (let i = 0; i < 9; i++) {
          pBullet(b.x - Math.cos(b.a) * 100, b.y - Math.sin(b.a) * 100 + (i - 4) * 14, b.a, 300, 8, { r: 3 });
        }
        await runKeep(9);
      }
    } else if (kind === 'crystal') {
      d.gotoWave(13); await run(3); G.fires.length = 0;
      // ⚠️ 用手动摆墙，别在 maze 布局里就近找墙：回廊墙太密，
      //    弹的出生点经常落在另一块 core 里，一出生就被结算掉（拍到「一发不剩」）。
      d.terrClear(); park(500, 500); await run(2);
      d.terrPut('core', 700, 316, 48, 96);
      for (const b of G.terr) if (b.kind === 'core') b.bounce = 1;
      park(620, 364); await run(2);
      G.bullets.length = 0;
      for (let i = 0; i < 5; i++) {
        pBullet(660, 340 + i * 12, 0, 300, 8, { r: 3 });
      }
      await runKeep(13);   // 12 帧后第一排弹刚从墙弹回来（~660 附近），拖尾朝反方向
      for (let i = 0; i < 2; i++) d.spawn('seeker', G.px + 170, G.py + (i - 0.5) * 90);
      for (let i = 0; i < 4; i++) { while (G.spawnQueue.length < 3) G.spawnQueue.push('seeker'); G.hitstop = 0; await frame(); }
    }

    G.banners.length = 0; G.toasts.length = 0; G.fx.length = 0; G.parts.length = 0;
    const [l, t, r, bb] = d.viewRect;
    let seen = 0;
    for (const o of d.terr()) if (o.x < r && o.x + o.w > l && o.y < bb && o.y + o.h > t) seen++;
    resolve({
      zone: d.zoneName(G.zone), layout: G.layout, haz: G.hz ? G.hz.kind : null,
      terr: G.terr.length, onScreen: seen, bullets: G.bullets.length, fires: G.fires.length,
    });
  }), kind).then(async info => {
    await page.screenshot({ path: 'probes/' + file });
    console.log(file.padEnd(22), JSON.stringify(info));
  });

  await shot('zone-1-drift.png', 'drift');
  await shot('zone-2-emp.png', 'emp');
  await shot('zone-3-forge.png', 'forge');
  await shot('zone-4-lens.png', 'lens');
  await shot('zone-5-crystal.png', 'crystal');

  console.log(errs.length ? '错误：\n' + errs.join('\n') : '零 JS 错误');
  await browser.close(); server.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
