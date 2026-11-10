// singularity-echo 回归探针（8.x）
// 验四件事：① 难度档扩到 4 档且局内冻结 ② 曲库按字节预算 + 真 LRU + 播放保护
//           ③ 死 CSS 清干净后 keyframes 无缺口 ④ 主循环与启动链路没被带崩
// 运行： NODE_PATH=<node-workspace>/node_modules node probes/echo-check.js
// 退出码 = 失败项数。自带静态服务，不需要手工起 http server。
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const SITE = path.resolve(ROOT, '..');           // 站群根：../assets/gl-back.js 在这里
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml',
};

function findChrome() {
  if (process.env.CHROME_EXE) return process.env.CHROME_EXE;
  const pw = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');
  if (fs.existsSync(pw)) {
    const dirs = fs.readdirSync(pw).filter(d => /^chromium(-|_)/.test(d))
      .sort((a, b) => (parseInt((b.match(/(\d+)$/) || [0, 0])[1], 10) - parseInt((a.match(/(\d+)$/) || [0, 0])[1], 10)));
    for (const d of dirs) {
      for (const rel of ['chrome-win64/chrome.exe', 'chrome-headless-shell-win64/chrome-headless-shell.exe'])
        if (fs.existsSync(path.join(pw, d, rel))) return path.join(pw, d, rel);
    }
  }
  throw new Error('找不到 Chromium，设 CHROME_EXE 或 npx playwright install chromium');
}

function serve() {
  const server = http.createServer((q, s) => {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    let fp = path.join(ROOT, p);
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      // 线上 ../assets/* 落在站群根；探针以子项目为 root，需显式回退
      const alt = path.join(SITE, p);
      const shared = path.join(SITE, 'assets') + path.sep;
      if (p.startsWith('/assets/') && alt.startsWith(shared) && fs.existsSync(alt) && !fs.statSync(alt).isDirectory()) fp = alt;
      else { s.writeHead(404); s.end('404'); return; }
    }
    s.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    fs.createReadStream(fp).pipe(s);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => {
    server.unref();
    r({ server, base: 'http://127.0.0.1:' + server.address().port + '/index.html' });
  }));
}

const PASS = [], FAIL = [];
const chk = (ok, name, extra) => {
  (ok ? PASS : FAIL).push(name);
  console.log((ok ? '  PASS ' : '  FAIL ') + name + (extra ? '   ' + extra : ''));
};

(async () => {
  const { server, base } = await serve();
  const browser = await chromium.launch({
    executablePath: findChrome(), headless: true,
    args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 180)); });

  await page.goto(base, { waitUntil: 'load' });
  // ⚠️ 等 bootMs>0 才是 boot 真正结束；只等 NOVA.mode==='menu' 会在启动中途返回
  await page.waitForFunction(() => window.NOVA && window.NOVA.diff && NOVA.bootMs() > 0, null, { timeout: 90000 });

  /* ---------- ① 难度档 ---------- */
  const d = await page.evaluate(() => ({
    list: NOVA.diff.list(),
    lockedBefore: NOVA.diff.unlocked('singularity'),
  }));
  chk(d.list.length === 4, '难度档扩到 4 档', d.list.map(x => x.id).join(' / '));
  chk(d.list.map(x => x.id).join(',') === 'cruise,standard,abyss,singularity', '档位顺序与 id 正确');
  const keys = ['hp', 'dmg', 'spd', 'cnt', 'sc'];
  const mono = keys.every(k => d.list.every((x, i) => i === 0 || x[k] > d.list[i - 1][k]));
  chk(mono, '四档五个系数严格单调递增');
  chk(d.list[1].sc === 1 && d.list[3].sc === 1.8, '标准档仍为设计基准 1.0，奇点档得分 ×1.8');
  chk(d.lockedBefore === false && d.list[3].req === 30, '奇点档需最远波次 ≥30 才解锁');

  const unlock = await page.evaluate(() => {
    NOVA.diff.setWave(30);
    return { on: NOVA.diff.unlocked('singularity'), wave: NOVA.diff.list().length };
  });
  chk(unlock.on === true, '达成第 30 波后奇点档解锁');

  /* ---------- ② 机库 UI / 窄屏 ---------- */
  const ui = await page.evaluate(() => {
    NOVA.debug('openHulls()');
    const row = document.getElementById('diffRow');
    return { n: row ? row.querySelectorAll('.dif').length : -1 };
  });
  chk(ui.n === 4, '机库渲染出 4 个难度按钮', 'n=' + ui.n);
  await page.setViewportSize({ width: 480, height: 900 });
  // 难度行在机库的折叠配置区里，openHulls() 默认收起 → 不展开量到的 rect 全是 0
  await page.evaluate(() => NOVA.debug('setCfg(true)'));
  await page.waitForTimeout(400);
  const narrow = await page.evaluate(() => {
    const r = document.getElementById('diffRow');
    const bs = [...r.querySelectorAll('.dif')].map(b => b.getBoundingClientRect());
    return {
      visible: bs.some(b => b.width > 0), n: bs.length,
      overflow: bs.some(b => b.right > innerWidth + 1 || b.left < -1),
      sw: r.scrollWidth, cw: r.clientWidth,
    };
  });
  chk(narrow.visible && narrow.n === 4 && !narrow.overflow && narrow.sw <= narrow.cw + 2,
      '480px 窄屏四个难度按钮都在视口内且不溢出', JSON.stringify(narrow));
  await page.setViewportSize({ width: 1280, height: 800 });

  /* ---------- ③ 局内冻结 + 实战系数 ---------- */
  const run = await page.evaluate(() => {
    NOVA.diff.pick('singularity');
    NOVA.debug('startGame(HULLS[0])');
    const a = { run: NOVA.diff.run(), sc: NOVA.debug('diffNow().sc'), hp: NOVA.debug('diffNow().hp') };
    NOVA.diff.pick('cruise');                 // 局内改菜单选择，不许影响当前这局
    return { ...a, after: NOVA.diff.run(), mode: NOVA.mode };
  });
  chk(run.run === 'singularity' && run.sc === 1.8 && run.hp === 1.65, '奇点档在实战里真的生效', JSON.stringify(run));
  chk(run.after === 'singularity', '开局后改菜单难度，本局数值仍冻结');
  chk(run.mode === 'play', '能正常开局进入 play');

  /* ---------- ④ 曲库：预算 / LRU / 播放保护 ---------- */
  const b = await page.evaluate(() => {
    const B = NOVA.bgm, MB = 1024 * 1024;
    const budget = B.budget();
    B.clear();
    B.put('A', 100 * MB); B.put('B', 100 * MB); B.put('C', 100 * MB);
    const before = B.bytes();
    const order = B.touch('A');                       // 命中刷新 LRU：A 移到队尾
    NOVA.debug("BGM.cur={url:'CUR',src:null,g:null};BGM.group='combat';1");
    B.put('CUR', 100 * MB);
    const prot = B.protected();
    const kept = B.evict(100 * MB, 'D');              // 需要再放一首 → 按预算淘汰
    const after = B.bytes();
    NOVA.debug("BGM.cur=null;BGM.group=null;BGM.cache.clear();1");
    return { budget, before, order, prot, kept, after };
  });
  chk(b.budget === 256 * 1024 * 1024, '曲库按解码字节预算封顶（256MB，旧版 4 首 ≈335MB）');
  chk(b.before === 300 * 1024 * 1024, 'bufBytes 按 PCM 实占字节计量', String(b.before));
  chk(JSON.stringify(b.order) === JSON.stringify(['B', 'C', 'A']), '命中会把曲子刷新到 LRU 队尾（不再 FIFO）', JSON.stringify(b.order));
  chk(b.prot.indexOf('CUR') >= 0, '正在播放的曲子进入保护集');
  chk(b.kept.indexOf('CUR') >= 0 && b.kept.indexOf('A') < 0, '淘汰跳过受保护项、清掉最久未用的', JSON.stringify(b.kept));
  chk(b.after <= b.budget, '淘汰后回到预算内', `${b.after} <= ${b.budget}`);

  /* ---------- ⑤ keyframes 完整性 / 死 CSS ---------- */
  const kf = await page.evaluate(() => {
    const css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');   // 注释里也写着 animation: 字样
    const defs = [...clean.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1]);
    const stop = /^(infinite|forwards|backwards|both|none|linear|ease|ease-in|ease-out|ease-in-out|normal|reverse|alternate|running|paused)$/;
    /* CSS 是压缩的（一行多规则、} 前常省略分号），值必须同时截在 ; 与 } 上，
       否则会把后面的 @keyframes / 注释整段吞成「动画名」。 */
    const refs = [...clean.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)]
      .flatMap(m => m[1].split(/[\s,]+/))
      .filter(t => t && !/^[\d.]+m?s$/.test(t) && !stop.test(t)
        && !/^(var\(|calc\(|rgb\(|--)/.test(t));
    return { defs: defs.length, missing: refs.filter(t => !defs.includes(t)), toast: /\.toast-combo\{/.test(css) };
  });
  chk(kf.missing.length === 0, 'keyframes 引用零缺口（死 comboPulse 已清除）', JSON.stringify(kf.missing));
  chk(kf.toast === false, '注入的 Tailwind toast 死 CSS 已移除');

  /* ---------- ⑥ 静态实现检查 ---------- */
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  chk(!/this\.cache\.size>=4/.test(src), '旧 FIFO「留 4 首」淘汰逻辑已不存在');
  chk(/const pri=\['menu','cruise','combat','boss','end','endless','evolve'\]/.test(src), '后台预热按开局优先级排序');
  chk(/cacheBytes\(\)>=BGM_MEM_MAX\*0\.92/.test(src), '预热在预算快满时停手（不再白下 3 首）');

  /* ---------- ⑦ 主循环活着 + 零错误 ---------- */
  const t0 = await page.evaluate(() => NOVA.debug('G.t'));
  await page.waitForTimeout(900);
  const t1 = await page.evaluate(() => NOVA.debug('G.t'));
  chk(t1 > t0, '主循环持续推进（改动没带崩后续绑定）', `${t0.toFixed(2)} -> ${t1.toFixed(2)}`);
  chk(errs.length === 0, '全程零 pageerror / console error', errs.join(' | ').slice(0, 240));

  console.log(`\n== 汇总 ==  ${PASS.length} PASS / ${FAIL.length} FAIL`);
  if (FAIL.length) console.log('   失败：' + FAIL.join(' · '));
  await browser.close();
  server.close();
  process.exit(FAIL.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
