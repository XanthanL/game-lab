// 三形态系统渲染验证：截 4 张图（终形态模型 / 狱卒炮塔 / 棱镜幻影 / 星蚀黑幕）
// 运行： node probes/sv-boss3-shot.js
const puppeteer = require('puppeteer-core');
const http = require('http'); const fs = require('fs'); const path = require('path');
const CHROME = require('./probe-lib').chrome;
const ROOT = path.resolve(__dirname, '..'); const PORT = 8627;
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

  // 把某只巨像打到第三形态并截图
  const shot = async (id, file, extra) => await page.evaluate((id, extra) => new Promise(async (resolve) => {
    const d = window.__dbg, G = d.G;
    const frame = () => new Promise(r => requestAnimationFrame(r));
    d.clearEnemies(); G.spawnQueue.length = 0; G.boss = null; G.bossPending = null;
    G.phantoms.length = 0; G.blackout = 0; G.ebullets.length = 0; G.fx.length = 0; G.banner = null;
    d.setPos(600, 400); G.vx = 0; G.vy = 0;
    spawnBoss(id);
    const e = G.boss;
    for (let i = 0; i < 260 && e && e.entering; i++) { G.hitstop = 0; await frame(); }
    e.hp = e.maxHp * 0.18; await frame(); await frame();
    // 演完变身演出（冲击波 + banner），不然 banner 糊在船身上
    for (let i = 0; i < 200 && (e.cmpT || 0) > 0; i++) { G.hitstop = 0; await frame(); }
    for (let i = 0; i < 40; i++) { G.hitstop = 0; await frame(); }
    if (extra === 'blackout') {   // 星蚀：等它真的熄下来再截
      for (let i = 0; i < 400 && G.blackout <= 0; i++) { G.hitstop = 0; await frame(); }
      for (let i = 0; i < 6; i++) { G.hitstop = 0; await frame(); }
    }
    resolve({ spr: e.spr, form: e.form, blackout: +G.blackout.toFixed(2),
              turrets: G.enemies.filter(x => x.turret).length, phantoms: G.phantoms.length });
  }), id, extra).then(async info => {
    await page.screenshot({ path: 'probes/' + file });
    console.log(file.padEnd(24), JSON.stringify(info));
  });

  await shot('motherrock', 'boss3-motherrock.png');
  await shot('warden', 'boss3-warden.png');
  await shot('prism', 'boss3-prism.png');
  await shot('eclipse', 'boss3-eclipse.png', 'blackout');
  await shot('forge', 'boss3-forge.png');

  console.log(errs.length ? '❌ 错误：\n' + errs.join('\n') : '✅ 零 JS 错误');
  await browser.close(); server.close();
})();
