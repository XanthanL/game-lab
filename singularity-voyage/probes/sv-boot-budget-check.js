// 首屏预算回归（2026-10-13）
// 断言：① 未发生任何用户手势前，一个 mp3 字节都不许下（19MB 不许进关键路径）
//       ② 首次手势之后才开始拉成品曲，且一次只拉当前那一首
//       ③ 字体走子集版（< 120KB）且中文真的渲染出来了（不是豆腐块）
//       ④ 加载页仍能正常进标题、无 JS 错误
// 运行： NODE_PATH=<node-workspace>/node_modules node probes/sv-boot-budget-check.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8631;
const CHROME = process.env.CHROME_EXE || 'C:\\Users\\www27\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Content-Length': fs.statSync(fp).size });
  fs.createReadStream(fp).pipe(res);
});

let pass = true;
const chk = (c, label, extra) => { console.log((c ? 'PASS ' : 'FAIL ') + label + (extra ? '  ' + extra : '')); if (!c) pass = false; };

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.emulate({
    viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  const mp3 = [], fonts = [], errs = [];
  page.on('request', r => {
    if (r.url().endsWith('.mp3')) mp3.push({ url: r.url().split('/').pop(), t: Date.now() });
    if (r.url().endsWith('.woff2')) fonts.push({ url: r.url().split('/').pop(), t: Date.now() });
  });
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 160)); });

  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('!!window.__dbg', { timeout: 60000, polling: 50 });
  await page.waitForFunction('window.__dbg && window.__dbg.state === "title"', { timeout: 60000, polling: 50 });
  const tTitle = Date.now() - t0;

  // 手势前静置 3s：这期间不许有 mp3
  await new Promise(r => setTimeout(r, 3000));
  const mp3Before = mp3.length;

  // 首次手势
  await page.touchscreen.tap(200, 500);
  await new Promise(r => setTimeout(r, 4000));
  const mp3After = mp3.slice();

  // ⚠️ 中英文宽度不能用来判断有没有用上 FP —— CJK 在两个字体里都是全角 12px，宽度必然一样。
  //    要比就比**栅格化出来的像素**：FP 是像素字体，笔画落点跟系统 monospace 完全不同。
  const fontInfo = await page.evaluate(async () => {
    const sample = '奇点旅途选择船体';
    const raster = fam => {
      const c = document.createElement('canvas'); c.width = 200; c.height = 20;
      const x = c.getContext('2d');
      x.fillStyle = '#000'; x.fillRect(0, 0, 200, 20);
      x.fillStyle = '#fff'; x.font = '12px ' + fam; x.textBaseline = 'top';
      x.fillText(sample, 0, 2);
      return x.getImageData(0, 0, 200, 20).data.join(',');
    };
    await document.fonts.load('12px FP', sample);
    await document.fonts.ready;
    return {
      loaded: document.fonts.check('12px FP'),
      fp: raster('FP, monospace'), mono: raster('monospace'),
      inkFP: raster('FP, monospace').split(',').filter(v => v !== '0').length,
      title: (document.querySelector('#title .t1') || {}).textContent,
    };
  });

  const fontBytes = fs.statSync(path.join(ROOT, 'assets', 'fusion-pixel-12.subset.woff2')).size;

  console.log(`\n进标题 ${tTitle}ms   字体请求: ${fonts.map(f => f.url).join(', ') || '(无)'}`);
  console.log(`mp3 请求: 手势前 ${mp3Before} 个 / 手势后 ${mp3After.length} 个 -> ${mp3After.map(m => m.url).join(', ') || '(无)'}`);
  console.log(`字体: loaded=${fontInfo.loaded}  中文宽度 FP=${fontInfo.wFP} monospace=${fontInfo.wMono}  标题="${fontInfo.title}"`);
  console.log('');

  chk(errs.length === 0, '无 JS 错误', errs.join(' | '));
  chk(mp3Before === 0, '① 用户手势前不下载任何 mp3', `(实际 ${mp3Before} 个)`);
  chk(mp3After.length >= 1 && mp3After.length <= 2, '② 手势后只开始拉当前那一首', `(${mp3After.map(m => m.url).join(',')})`);
  chk(fonts.length === 1 && fonts[0].url.includes('subset'), '③ 只用子集字体', `(${fonts.map(f => f.url).join(',')})`);
  chk(fontBytes < 120 * 1024, '③b 子集字体 < 120KB', `(${(fontBytes / 1024).toFixed(1)}KB)`);
  chk(fontInfo.loaded === true, '④ 字体已加载');
  chk(fontInfo.inkFP > 200 && fontInfo.fp !== fontInfo.mono,
    '④b 中文真的按像素字体栅格化（与 monospace 像素不同，非豆腐/回落）', `(着墨像素 ${fontInfo.inkFP})`);
  chk(fontInfo.title === '奇点旅途', '⑤ 标题中文正常', `("${fontInfo.title}")`);

  await page.screenshot({ path: path.join(ROOT, 'probes', 'sv-boot-title.png') });
  await browser.close();
  server.close();
  console.log('\n截图: probes/sv-boot-title.png');
  console.log(pass ? '\n==> ALL PASS' : '\n==> FAILED');
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error(e); server.close(); process.exit(2); });
