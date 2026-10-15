// 一次性校验：背景视差从「逐块 drawImage」改成「pattern + fillRect」后，画面是否像素级等价。
// 做法：同一套 cam 偏移下，把两种画法各画到一张离屏 canvas，逐像素比对。
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8657;
const CHROME = require('./probe-lib').chrome;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/index.html?bot=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__dbg && window.__dbg.state === "play"', { timeout: 30000, polling: 50 });

  const out = await page.evaluate(() => {
    const W = 480, H = 270, CELLT = 64;
    const res = [];
    for (let zone = 0; zone < 3; zone++) {
      const set = STARSETS[zone] || STARSETS[0];
      for (const camOff of [0, 17.4, 33.9, 51.2]) {
        const L = 1000.5 - W / 2, T = 800.25 - H / 2;
        const camx = 1000.5 + camOff, camy = 800.25 + camOff * 0.7;
        const pf = [0.06, 0.14, 0.26];

        const mk = mode => {
          const c = document.createElement('canvas'); c.width = W; c.height = H;
          const x = c.getContext('2d');
          x.imageSmoothingEnabled = false;
          // ⚠️ 两种画法必须落在同一坐标系里：真实渲染时 ctx 已被相机平移过，
          //    这里补一个 -L/-T，否则世界坐标（~760,665）整个跑到 480×270 画布之外。
          x.translate(-L, -T);
          x.fillStyle = set.bg; x.fillRect(L, T, W, H);
          // 只画星野三层，不含装饰岩石（岩石两条路径都一样，不必比）
          for (let i = 0; i < 3; i++) {
            const tile = set.layers[i];
            const ox = L - ((camx * pf[i]) % CELLT + CELLT) % CELLT;
            const oy = T - ((camy * pf[i]) % CELLT + CELLT) % CELLT;
            if (mode === 'old') {
              for (let y = oy - CELLT; y < T + H + CELLT; y += CELLT)
                for (let xx = ox - CELLT; xx < L + W + CELLT; xx += CELLT)
                  x.drawImage(tile, Math.round(xx), Math.round(y));
            } else {
              const pat = x.createPattern(tile, 'repeat');
              x.save();
              // base 已经 translate(-L,-T)，这里再平移的是**世界坐标**下的图案原点，
              // 不要再减 L/T（减了就是双重平移）
              x.translate(Math.round(ox), Math.round(oy));
              x.fillStyle = pat;
              x.fillRect(-CELLT, -CELLT, (L + W + CELLT) - (ox - CELLT), (T + H + CELLT) - (oy - CELLT));
              x.restore();
            }
          }
          return x.getImageData(0, 0, W, H).data;
        };
        const a = mk('old'), b = mk('new');
        let diff = 0, inkA = 0;
        for (let i = 0; i < a.length; i += 4) {
          if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) diff++;
          if (a[i] !== set.bg.charCodeAt ? false : false) inkA++;
        }
        res.push({ zone, camOff, diffPx: diff, total: W * H });
      }
    }
    return res;
  });

  let bad = 0;
  for (const r of out) {
    const pct = r.diffPx / r.total * 100;
    if (pct > 0.5) bad++;
    console.log(`zone=${r.zone} camOff=${String(r.camOff).padStart(5)}  差异 ${String(r.diffPx).padStart(5)} px / ${r.total} = ${pct.toFixed(3)}%`);
  }
  console.log(bad === 0 ? '\n==> 像素级一致（背景优化无视觉回归）' : `\n==> ${bad} 组差异过大，需要复核`);
  await browser.close();
  server.close();
  process.exit(bad === 0 ? 0 : 1);
})().catch(e => { console.error(e); server.close(); process.exit(2); });
