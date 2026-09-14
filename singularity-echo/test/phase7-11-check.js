/* Phase 7.11 验证 —— 敌人图鉴建模（敌型 / 巨像）
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> node test/phase7-11-check.js
 * 产出：test/phase7/7-11-*.png + 每行状态断言
 *
 * 四条硬约束：
 *   ① 每格必须有**真的画了东西**的模型画布（数非透明像素，不是只看元素在不在）；
 *   ② 未解锁的敌型也要有模型（降透明 + 去饱和），不能是空框；
 *   ③ 开图鉴不许污染 RND（6-1-07 那个坑：rand() 一响，每日挑战的种子序列就被挪走）；
 *   ④ 模型画布不许吃掉格子的布局（列布局，canvas 在文字之上）。
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const OUT = path.join(__dirname, 'phase7');
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}

const D = [1024, 768], M = [390, 844];

async function run(tag, vw, vh, job) {
  const b = await chromium.launch({ executablePath: EXE });
  const c = await b.newContext({
    viewport: { width: vw, height: vh }, deviceScaleFactor: 2,
    hasTouch: true, isMobile: true,
  });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 220)));
  await p.goto(GAME, { waitUntil: 'load' });
  await p.waitForFunction(() => { const b = document.getElementById('boot'); return !b || b.classList.contains('out'); },
    null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(1200);
  let note = '';
  try { note = (await job(p)) || ''; } catch (e) { errs.push('JOB:' + e.message.slice(0, 200)); }
  await p.screenshot({ path: path.join(OUT, tag + '.png'), fullPage: false });
  await c.close(); await b.close();
  console.log(tag.padEnd(30), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}
const evj = (p, code) => p.evaluate(c => NOVA.debug(c), code);

/* 打开图鉴并切到敌人页（模型是切到才画的，必须走真实入口） */
async function openFoe(p) {
  await evj(p, 'NOVA.logbook.codex()');
  await p.waitForTimeout(160);
  await evj(p, "NOVA.debug('pickCodexTab(\"foe\")')");
  await p.waitForTimeout(220);
}

(async () => {

/* ── 01 24 个敌型全部画出模型 ──────────────────────── */
await run('7-11-01-foe-models', ...D, async p => {
  await openFoe(p);
  const r = await evj(p, 'NOVA.logbook.foeModels()');
  const f = r.foes;
  const empty = f.filter(x => x.px < 60).map(x => x.k);
  const ok = f.length === 24 && empty.length === 0;
  const lo = Math.min.apply(null, f.map(x => x.px)), hi = Math.max.apply(null, f.map(x => x.px));
  return `${ok ? 'PASS' : 'FAIL'} 敌型 ${f.length} 格 · 空模型 ${empty.length} 个[${empty.join(',')}]` +
    ` · 像素数 ${lo}~${hi}`;
});

/* ── 02 8 个巨像全部画出模型（含三环 / 干扰场 / 吸积盘） ── */
await run('7-11-02-boss-models', ...D, async p => {
  await openFoe(p);
  const r = await evj(p, 'NOVA.logbook.foeModels()');
  const b = r.bosses;
  const empty = b.filter(x => x.px < 120).map(x => x.k);
  const ok = b.length === 8 && empty.length === 0;
  return `${ok ? 'PASS' : 'FAIL'} 巨像 ${b.length} 格 · 空模型 ${empty.length} 个[${empty.join(',')}]` +
    ` · 像素 ${b.map(x => x.k + ':' + x.px).join(' ')}`;
});

/* ── 03 未解锁的敌型：模型仍在，只是压暗 ───────────── */
await run('7-11-03-locked-still-drawn', ...D, async p => {
  await openFoe(p);
  const r = await evj(p, 'NOVA.logbook.foeModels()');
  const lk = r.foes.filter(x => x.locked), op = r.foes.filter(x => !x.locked);
  const dead = lk.filter(x => x.px < 60).map(x => x.k);
  /* 新档 w=0 → 24 型全锁（连 W1 的 seeker 也是 reached>=1 才开）。
     先验「全锁时模型照样画得出」，再写一份 w=13 的存档重开，
     验解锁态与锁定态**同时存在**且都有像素 —— 只验一端等于没验。 */
  const dim = await evj(p, `(function(){const c=document.querySelector('#lbEnemies .lbcell.locked canvas.cxmodel');
    return c?getComputedStyle(c).opacity+'/'+getComputedStyle(c).filter:'none';})()`);
  const a = lk.length === 24 && op.length === 0 && dead.length === 0;
  await evj(p, `NOVA.debug('localStorage.setItem("nova-stats",JSON.stringify({k:900,g:9,t:600,w:13,sc:90000,hulls:[],nomod:0,flaw:0}));drawLogbook();pickCodexTab("foe")')`);
  await p.waitForTimeout(220);
  const r2 = await evj(p, 'NOVA.logbook.foeModels()');
  const lk2 = r2.foes.filter(x => x.locked), op2 = r2.foes.filter(x => !x.locked);
  const dead2 = r2.foes.filter(x => x.px < 60).map(x => x.k);
  const b = op2.length >= 12 && lk2.length >= 8 && dead2.length === 0;
  const ok = a && b;
  return `${ok ? 'PASS' : 'FAIL'} 全锁档 ${lk.length} 锁/0 开（都有像素）· W13 档 ${op2.length} 开/${lk2.length} 锁` +
    ` · 空模型 ${dead.length + dead2.length} · locked 画布 ${dim}`;
});

/* ── 04 开图鉴不污染 RND ──────────────────────────── */
await run('7-11-04-no-rnd-leak', ...D, async p => {
  const before = await evj(p, 'JSON.stringify([RND.on,RND.s,RND.s0])');
  await openFoe(p);
  await evj(p, 'NOVA.logbook.foeModels()');          // 再画一遍，两次绘制都必须无副作用
  await evj(p, "NOVA.debug('pickCodexTab(\"hull\");pickCodexTab(\"foe\")')");
  const after = await evj(p, 'JSON.stringify([RND.on,RND.s,RND.s0])');
  const ok = before === after;
  return `${ok ? 'PASS' : 'FAIL'} RND ${before} → ${after}`;
});

/* ── 05 布局：模型在文字之上，整格不溢出 ──────────── */
await run('7-11-05-layout', ...M, async p => {
  await openFoe(p);
  const r = await evj(p, `(function(){
    const g=document.getElementById('lbEnemies');
    const cell=g.querySelector('.lbcell'), cv=cell.querySelector('canvas.cxmodel');
    const nm=cell.querySelector('.lbname');
    const cr=cv.getBoundingClientRect(), nr=nm.getBoundingClientRect(), gr=g.getBoundingClientRect();
    let over=0;
    for(const c of g.querySelectorAll('.lbcell')){
      const b=c.getBoundingClientRect();
      if(b.right>gr.right+1||b.left<gr.left-1)over++;
    }
    return {above:cr.bottom<=nr.top+1, aspect:+(cr.width/cr.height).toFixed(2),
      overflow:over, n:g.querySelectorAll('.lbcell').length,
      dir:getComputedStyle(cell).flexDirection};
  })()`);
  const ok = r.above && r.overflow === 0 && Math.abs(r.aspect - 1.5) < 0.06 && r.dir === 'column';
  return `${ok ? 'PASS' : 'FAIL'} 竖屏 390×844 · 模型在文字之上=${r.above} · 宽高比 ${r.aspect}（须 1.5）` +
    ` · 横向溢出 ${r.overflow}/${r.n} · flex=${r.dir}`;
});

/* ── 07 8 个巨像两两不同（形状指纹） ────────────────── */
await run('7-11-07-boss-distinct', ...D, async p => {
  await openFoe(p);
  await p.waitForTimeout(200);
  /* 7.11 之前 rock/eye/twin/hydra/nemesis 是同一套随机 16 边多边形、颜色也同族，
     图鉴里 5 张卡一模一样。改成按 kind 分派轮廓 + 细节后，这一条是守住成果的不变量。
     ⚠️ 指纹必须用**亮度**而不是 alpha 覆盖率 —— 本体是填充的，画在内部的细节
     （矿脉 / 虹膜 / 三核网）不会增加"非透明像素数"，alpha 指纹会全部误判为相同。 */
  const r = await p.evaluate(() => {
    const grab = cv => {
      const g = cv.getContext('2d'), N = 12;
      const d = g.getImageData(0, 0, cv.width, cv.height).data;
      const fp = [];
      for (let by = 0; by < N; by++) for (let bx = 0; bx < N; bx++) {
        let s = 0, n = 0;
        for (let y = (by * cv.height / N) | 0; y < ((by + 1) * cv.height / N) | 0; y++)
          for (let x = (bx * cv.width / N) | 0; x < ((bx + 1) * cv.width / N) | 0; x++) {
            const i = (y * cv.width + x) * 4;
            if (d[i + 3] > 10) {            // 只统计实心的格子
              s += (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11); n++;
            }
          }
        // 亮度分 4 档：0=空 1=暗 2=中 3=亮 —— 内部细节的明暗差就能被读到
        fp.push(n < 6 ? 0 : Math.min(3, 1 + ((s / n) / 40) | 0));
      }
      return { k: cv.getAttribute('data-boss'), fp: fp.join('') };
    };
    return [...document.querySelectorAll('#lbBosses canvas[data-boss]')].map(grab);
  });
  const diff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; };
  const same = []; let min = 999;
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    const d = diff(r[i].fp, r[j].fp);
    if (d < min) min = d;
    if (d < 8) same.push(`${r[i].k}≡${r[j].k}(差${d}/144)`);
  }
  const ok = r.length === 8 && same.length === 0;
  return `${ok ? 'PASS' : 'FAIL'} 巨像 ${r.length} 个 · 雷同 ${same.length} 对` +
    (same.length ? ' [' + same.join(' ') + ']' : `（最接近的一对差 ${min}/144，阈值 8）`);
});

/* ── 06 切中英文后重建，模型照样画得出 ────────────── */
await run('7-11-06-i18n-redraw', ...D, async p => {
  await openFoe(p);
  await evj(p, "NOVA.debug('setLang(\"en\")')");
  await p.waitForTimeout(260);
  await evj(p, "NOVA.debug('pickCodexTab(\"foe\")')");
  await p.waitForTimeout(220);
  const r = await evj(p, 'NOVA.logbook.foeModels()');
  const bad = r.foes.filter(x => x.px < 60).length + r.bosses.filter(x => x.px < 120).length;
  const name = await evj(p, `document.querySelector('#lbEnemies .lbname').textContent`);
  const ok = bad === 0 && r.foes.length === 24 && /[A-Za-z]/.test(name);
  return `${ok ? 'PASS' : 'FAIL'} 切英文后重建：空模型 ${bad} 个 · 首个名称「${name}」`;
});

})();
