// 地形渲染验证：截 5 张图
//   ① pillars 柱林  ② maze 回廊  ③ cells 蜂室  ④ cross 四象限  ⑤ ring 环带
//   ⑥ vent 喷口喷发 + 岩块被打裂
// 只看画面对不对（块是否真的画出来了、纹理有没有方格纸接缝、喷口有没有喷）。
// 跑断言的探针是 sv-terrain-check.js。
const puppeteer = require('puppeteer-core');
const http = require('http'); const fs = require('fs'); const path = require('path');
const CHROME = require('./probe-lib').chrome;
const ROOT = path.resolve(__dirname, '..'); const PORT = 8637;
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
      G.parts.length = 0; G.pickups.length = 0; G.fx.length = 0;
      while (G.spawnQueue.length < 3) G.spawnQueue.push('seeker');
    };
    const run = async n => { for (let i = 0; i < n; i++) { clear(); G.hitstop = 0; await frame(); } };

    d.gotoWave(1);
    await run(2);

    if (kind === 'vent') {
      // 喷口：把玩家停在喷口旁边（不站正中心 —— 站上去会一直掉血），
      //   把相位推到喷发中段截图。
      d.terrClear(); d.setTerrainLayout('pillars'); await run(2);
      const v = G.terr.filter(b => b.kind === 'vent')[0];
      if (v) {
        d.setPos(v.x - 60, v.y + 60);
        v.ph = 2; v.t = 0.35; v.tick = 0;
        // 旁边再摆一块被打到半血的岩，好把裂纹一起拍进去
        d.terrPut('rock', v.x + 90, v.y - 30, 96, 48);
        const rk = G.terr.filter(b => b.kind === 'rock')[0];
        if (rk) rk.hp = rk.maxHp * 0.28;
        await run(6);
      }
    } else {
      d.setTerrainLayout(kind);
      // 站到布局最有代表性的位置：柱林/蜂室看中央，回廊看缺口，四象限看十字交点，环带看核心旁
      const at = { pillars: [640, 380], maze: [480, 300], cells: [700, 300], cross: [640, 320], ring: [560, 300] }[kind] || [700, 400];
      d.setPos(at[0], at[1]);
      await run(20);
      // 撒几只敌人在掩体之间：地形要读起来是「可以绕进去打」的，不是纯布景
      for (let i = 0; i < 5; i++) {
        d.spawn('seeker', G.px + Math.cos(i) * 90, G.py + Math.sin(i * 1.7) * 60);
      }
      await run(14);
    }
    G.banner = null;
    let seen = 0;
    const [l, t, r, b] = d.viewRect;
    for (const o of d.terr()) if (o.x < r && o.x + o.w > l && o.y < b && o.y + o.h > t) seen++;
    resolve({ layout: G.layout, terr: G.terr.length, onScreen: seen, enemies: G.enemies.length });
  }), kind).then(async info => {
    await page.screenshot({ path: 'probes/' + file });
    console.log(file.padEnd(24), JSON.stringify(info));
  });

  await shot('terrain-pillars.png', 'pillars');
  await shot('terrain-maze.png', 'maze');
  await shot('terrain-cells.png', 'cells');
  await shot('terrain-cross.png', 'cross');
  await shot('terrain-ring.png', 'ring');
  await shot('terrain-vent.png', 'vent');

  console.log(errs.length ? '❌ 错误：\n' + errs.join('\n') : '✅ 零 JS 错误');
  await browser.close(); server.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
