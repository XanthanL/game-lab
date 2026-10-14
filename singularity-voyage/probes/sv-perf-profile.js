// 性能探针：把游戏顶到高负载（高波次 + 满模块 + 巨像），用 CDP CPU profiler
// 抓 8 秒，按「自身耗时」排出最热的函数；同时统计 rAF 帧间隔与实体数量。
// 跑法： NODE_PATH=<node-workspace>/node_modules node probes/sv-perf-profile.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8651;
const CHROME = process.env.CHROME_EXE || 'C:\\Users\\www27\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`http://127.0.0.1:${PORT}/index.html?bot=1&god=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__dbg && window.__dbg.state === "play"', { timeout: 30000, polling: 50 });

  // 模拟手机 CPU：默认 4× 降速（可用 CPU=1 关掉）
  const cpu = +(process.env.CPU || 4);
  if (cpu > 1) {
    const c0 = await page.target().createCDPSession();
    await c0.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    console.log(`CPU 降速 ${cpu}×（模拟手机）`);
  }

  // 顶到高负载：**持续**补敌补弹（bot 会自己清场，一次性灌进去撑不过 3 秒）
  // game.js 是顶层 classic script，spawnEnemy / pBullet 这类名字在全局词法环境里可直接调用。
  await page.evaluate(() => {
    const G = window.__dbg.G;
    const kinds = ['seeker', 'dart', 'gunner', 'reaver', 'splitter', 'bastion', 'shifter'];
    window.__stress = setInterval(() => {
      if (!window.__dbg.G) return;
      const g = window.__dbg.G;
      while (g.enemies.length < 150) {
        const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 300;
        spawnEnemy(kinds[(Math.random() * kinds.length) | 0], g.px + Math.cos(a) * d, g.py + Math.sin(a) * d);
      }
      while (g.bullets.length < 220) {
        const a = Math.random() * Math.PI * 2;
        pBullet(g.px, g.py, a, 260, 6, { r: 3, life: 6, pierce: 3, homing: 1.6 });
      }
      while (g.ebullets.length < 400) {
        const a = Math.random() * Math.PI * 2;
        eShot(g.px + Math.cos(a) * 120, g.py + Math.sin(a) * 120, a + Math.PI, 90, 3, '#ff3355', { life: 6 });
      }
    }, 100);
  });
  await new Promise(r => setTimeout(r, 2500));
  try { await page.evaluate(() => window.__dbg.spawnBoss('motherrock')); } catch (e) {}
  await new Promise(r => setTimeout(r, 1500));

  // 帧间隔采样
  await page.evaluate(() => {
    window.__ft = [];
    let last = performance.now();
    const tick = () => { const n = performance.now(); window.__ft.push(n - last); last = n; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });

  const cdp = await page.target().createCDPSession();
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await new Promise(r => setTimeout(r, 8000));
  const { profile } = await cdp.send('Profiler.stop');

  const stats = await page.evaluate(() => {
    const G = window.__dbg.G;
    const ft = window.__ft.slice(30).sort((a, b) => a - b);
    const q = p => ft.length ? ft[Math.floor(ft.length * p)] : 0;
    return {
      frames: ft.length,
      p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +(ft[ft.length - 1] || 0).toFixed(2),
      enemies: G ? G.enemies.length : -1, bullets: G ? G.bullets.length : -1,
      ebullets: G ? G.ebullets.length : -1, parts: G ? G.parts.length : -1,
      fx: G ? G.fx.length : -1,
    };
  });

  // 聚合自身耗时
  const byId = new Map();
  for (const n of profile.nodes) byId.set(n.id, n);
  const self = new Map();
  const total = profile.samples.length;
  for (const s of profile.samples) {
    const n = byId.get(s); if (!n) continue;
    const f = n.callFrame;
    const key = (f.functionName || '(anonymous)') + '  ' + (f.url || '').split('/').pop() + ':' + (f.lineNumber + 1);
    self.set(key, (self.get(key) || 0) + 1);
  }
  const dur = (profile.endTime - profile.startTime) / 1000;   // ms
  const rows = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);

  console.log(`\n实体：敌 ${stats.enemies} / 我弹 ${stats.bullets} / 敌弹 ${stats.ebullets} / 粒子 ${stats.parts} / fx ${stats.fx}`);
  console.log(`帧间隔 ${stats.frames} 帧：p50=${stats.p50}ms  p95=${stats.p95}ms  max=${stats.max}ms  (≈${(1000 / stats.p50).toFixed(0)}fps)\n`);
  console.log('最热函数（自身耗时占比，采样 ' + total + ' 个 / ' + dur.toFixed(0) + 'ms）：');
  for (const [k, v] of rows) {
    console.log('  ' + (v / total * 100).toFixed(1).padStart(5) + '%  ' + k);
  }

  await browser.close();
  server.close();
})().catch(e => { console.error(e); server.close(); process.exit(2); });
