/* Phase 7.8 验证 —— 曲库后台加载：启动不再等歌
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> node test/phase7-8-check.js
 * 产出：test/phase7/7-8-*.png + 每行状态断言
 *
 * 背景：朋友反馈「初始加载曲库预热时进度条卡很久不动」。
 *   根因：BOOT_STEPS 里有一布 `await BGM._load(菜单曲)` —— 4~6MB 的 mp3 在弱网
 *   要十几秒，而进度条只在每个 step 的头尾各写一次宽度，于是整条冻在原地。
 * 修法三条：
 *   ① 曲库从「await」改成「后台发起」，启动流程一秒都不等它；
 *   ② 进度条改成 目标值 + rAF 缓动 + 慢爬，任何 step 慢了条也在动；
 *   ③ 单步 6 秒兜底 + 单曲 45 秒泄漏兜底，谁挂了都不拖死全局。
 *
 * ⚠️ 必须跑 http：file:// 下 fetch 被 CORS 挡掉，BGM 永远加载失败（见 MEMORY）。
 */
const http = require('http'), fsp = require('fs'), path = require('path');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'phase7');
try { fsp.mkdirSync(OUT, { recursive: true }); } catch (e) { }

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript',
  '.mp3': 'audio/mpeg', '.json': 'application/json', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

/* 极简静态服务器：只要能跑 http 就够，别为一个测试引 express */
function serve(port) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fsp.existsSync(f) || !fsp.statSync(f).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
    fsp.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(port, '127.0.0.1', () => r(srv)));
}
const PORT = 8731;
let MP3 = [];   /* 当前这一轮里被请求过的 mp3 文件名（run 内重置） */
const GAME = `http://127.0.0.1:${PORT}/index.html`;

async function run(tag, mp3DelayMs, job) {
  const b = await chromium.launch({ executablePath: EXE });
  const c = await b.newContext({
    viewport: { width: 844, height: 390 }, deviceScaleFactor: 2,
    hasTouch: true, isMobile: true,
  });
  const p = await c.newPage();
  MP3 = [];
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 220)));
  /* 记录进度条每一次宽度变化 —— 用来断言「条在动」而不是「两头跳一下」 */
  await p.addInitScript(() => {
    window.__bootW = [];
    const rec = () => {
      const bar = document.getElementById('bootBar');
      if (bar) {
        window.__bootW.push(bar.style.width);
        new MutationObserver(() => window.__bootW.push(bar.style.width))
          .observe(bar, { attributes: true, attributeFilter: ['style'] });
      } else requestAnimationFrame(rec);
    };
    rec();
  });
  /* 每首 mp3 都记一笔并人为延迟 —— 用来量化「启动有没有在等歌」 */
  await p.route('**/*.mp3', async route => {
    MP3.push(route.request().url().split('/').pop());
    if (mp3DelayMs > 0) await new Promise(r => setTimeout(r, mp3DelayMs));
    await route.continue();
  });
  const t0 = Date.now();
  await p.goto(GAME, { waitUntil: 'domcontentloaded' });
  let note = '';
  try { note = (await job(p, t0)) || ''; } catch (e) { errs.push('JOB:' + e.message.slice(0, 200)); }
  await p.screenshot({ path: path.join(OUT, tag + '.png'), fullPage: false });
  await c.close(); await b.close();
  console.log(tag.padEnd(30), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}
const ev = (p, code) => p.evaluate(c => NOVA.debug(c), code);
const evj = async (p, code) => JSON.parse(await ev(p, 'JSON.stringify(' + code + ')'));
const waitBoot = p => p.waitForFunction(
  () => { const b = document.getElementById('boot'); return b && (b.classList.contains('out') || b.hidden); },
  null, { timeout: 20000 });

(async () => {
  const srv = await serve(PORT);

  /* ── 01 弱网（mp3 慢 8 秒）：启动必须照常在几秒内结束 ───── */
  await run('7-8-01-boot-unblocked', 8000, async p => {
    await waitBoot(p);
    const ms = await evj(p, `NOVA.bootMs()`);
    const r = await p.evaluate(() => ({
      menu: !document.getElementById('menu').hidden,
      phase: document.getElementById('bootPhase').textContent,
      pct: document.getElementById('bootPct').textContent,
    }));
    const ok = ms < 4000 && r.menu && r.pct === '100%';
    return `${ok ? 'PASS' : 'FAIL'} mp3 人为慢 8s → 启动只用了 ${ms}ms（上限 4000）` +
      ` · 菜单可见=${r.menu} · 进度条停在 ${r.pct}（${r.phase}）`;
  });

  /* ── 02 进度条必须一路在动，不是两头各跳一次 ─────────── */
  await run('7-8-02-bar-moves', 8000, async p => {
    await waitBoot(p);
    const r = await p.evaluate(() => {
      const w = window.__bootW.map(s => parseFloat(s) || 0);
      let mono = true;
      for (let i = 1; i < w.length; i++) if (w[i] < w[i - 1] - 0.01) mono = false;
      return { n: w.length, uniq: new Set(w.map(x => x.toFixed(1))).size,
        first: w[0], last: w[w.length - 1], mono, sample: w.slice(0, 6).map(x => x.toFixed(1)) };
    });
    const ok = r.uniq >= 8 && r.mono && r.last >= 99.5;
    return `${ok ? 'PASS' : 'FAIL'} 宽度写入 ${r.n} 次 / 不同值 ${r.uniq} 个（要求 ≥8）` +
      ` · 单调不回退=${r.mono} · ${r.first.toFixed(1)}% → ${r.last.toFixed(1)}%` +
      ` · 前几帧 ${r.sample.join('→')}`;
  });

  /* ── 03 歌在后台下：不挡启动，下完自动接上 ───────────── */
  await run('7-8-03-bg-load', 3000, async p => {
    await waitBoot(p);
    const early = await evj(p, `NOVA.bgm.state()`);
    /* 等歌下完（3s 延迟 + 解码）再断言它真的接上了 */
    await p.waitForFunction(() => NOVA.bgm.state().cache.length > 0, null, { timeout: 20000 });
    const late = await evj(p, `NOVA.bgm.state()`);
    const fin = MP3.length;
    const ok = early.cache.length === 0 && late.cache.length >= 1 &&
      late.group === 'menu' && fin >= 1;
    return `${ok ? 'PASS' : 'FAIL'} 启动完成时缓存 ${early.cache.length} 首（应为 0，说明没等它）` +
      ` → 稍后 ${late.cache.length} 首 ${JSON.stringify(late.cache)}` +
      ` · 当前曲组 ${late.group} · mp3 请求 ${fin} 次`;
  });

  /* ── 04 并发去重：同一首只许下一个请求 ───────────────── */
  await run('7-8-04-dedupe', 1500, async p => {
    await waitBoot(p);
    MP3.length = 0;
    const url = await evj(p, `NOVA.bgm.urls('combat')[0]`);
    /* 后台预热 + 立刻切曲，两条路径会同时要这一首 —— 必须只发一个请求 */
    await p.evaluate(u => { NOVA.bgm.warm(['combat']); NOVA.bgm.switchTo('combat'); }, url);
    await p.waitForTimeout(2200);
    const r = MP3.filter(u => /Asteroid/.test(u)).length;
    const st = await evj(p, `NOVA.bgm.state()`);
    const ok = r === 1;
    return `${ok ? 'PASS' : 'FAIL'} 同一首并发请求 ${r} 次（要求恰好 1）` +
      ` · 缓存 ${JSON.stringify(st.cache)} · 在下载 ${JSON.stringify(st.pending)}`;
  });

  /* ── 05 选船时预热巡航曲：开打时它已经在了 ───────────── */
  await run('7-8-05-warm-on-hulls', 1200, async p => {
    await waitBoot(p);
    MP3.length = 0;
    await ev(p, `openHulls()`);
    await p.waitForFunction(() => NOVA.bgm.state().cache.some(u => /Comet/.test(u)),
      null, { timeout: 20000 });
    const st = await evj(p, `NOVA.bgm.state()`);
    const names = MP3.slice();
    const ok = st.cache.some(u => /Comet/.test(u));
    return `${ok ? 'PASS' : 'FAIL'} 打开机库后已缓存 ${JSON.stringify(st.cache)}` +
      ` · 期间请求 ${names.length} 首`;
  });

  srv.close();
})();
