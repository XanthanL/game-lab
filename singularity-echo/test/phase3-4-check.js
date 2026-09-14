/* Phase 3.4 验证 —— 成就树（真数据 / 依赖闭包 / 三态渲染 / 达成弹窗）
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase3-4-check.js
 * 产出：../.workbuddy/shots/phase3/3-4-*.png + 每行状态断言
 *
 * 断言优先于截图：树的规模 / 依赖闭包 / 三态 / 进度百分比直接从 NOVA.logbook.* 读。
 * 每张图独立浏览器实例（file:// 下 localStorage 跨 context 共享）。
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const OUT = path.join(__dirname, 'phase3');
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}

async function run(tag, vw, vh, job, dsf) {
  const b = await chromium.launch({ executablePath: EXE });
  const c = await b.newContext({
    viewport: { width: vw, height: vh }, deviceScaleFactor: dsf || 1,
    hasTouch: vw < 700, isMobile: vw < 700,
  });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 220)));
  await p.goto(GAME, { waitUntil: 'load' });
  await p.waitForTimeout(1400);
  let note = '';
  try { note = (await job(p)) || ''; } catch (e) { errs.push('JOB:' + e.message.slice(0, 180)); }
  await p.screenshot({ path: path.join(OUT, tag + '.png'), fullPage: false });
  await c.close(); await b.close();
  console.log(tag.padEnd(26), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}

/* 打开航行日志（成就树所在面板）→ 用合成统计渲染一版树 → 读全树节点数据。
   NOVA.logbook.achPreview 只渲染不写盘，是断言两态最干净的方式。 */
const openTree = async (p, stats) => {
  await p.evaluate(() => NOVA.logbook.open());
  await p.waitForTimeout(500);
  if (stats) await p.evaluate(s => NOVA.logbook.achPreview(s), stats);
  await p.waitForTimeout(300);
};
const statsOf = (o) => Object.assign({ k: 0, g: 0, t: 0, w: 0, sc: 0, hulls: [], nomod: 0, flaw: 0 }, o || {});

(async () => {
  const D = [1280, 900], M = [390, 844];

  // 1) 树结构：节点数 / 连线数 / 依赖闭包无悬空 / 坐标不重叠
  await run('3-4-01-tree-structure', ...D, async p => {
    await openTree(p, statsOf());
    const c = await p.evaluate(() => NOVA.logbook.counts());
    const d = await p.evaluate(() => NOVA.logbook.achDeps());
    const n = await p.evaluate(() => NOVA.logbook.achNodes());
    // 坐标唯一性：任何两个节点不能同 x 同 y（4.3b 纵向版式下由 br/dp 槽位推出，重叠即槽位撞车）
    const seen = new Set(), dup = [];
    for (const a of n) { const key = a.x + ',' + a.y; if (seen.has(key)) dup.push(a.id); seen.add(key); }
    // 纵向语义：根在最上（y=0）、汇总在最下（y 最大）、同支子节点必须严格在父节点下方
    const byId = Object.fromEntries(n.map(a => [a.id, a]));
    const root = byId['seed'], agg = byId['all'];
    const maxY = Math.max(...n.map(a => a.y));
    const bad = [];
    for (const a of n) for (const pid of (a.dep || [])) {
      const pa = byId[pid]; if (!pa) continue;
      if (!(a.y > pa.y)) bad.push(a.id + '<=' + pid);      // 子节点 y 必须大于父节点
    }
    const cv = await p.evaluate(() => NOVA.logbook.canvas());
    return `nodes=${c.nodes} links=${c.links} dangling=${d.dangling} dupPos=${dup.length} `
      + `rootY=${root.y} aggY=${agg.y}/${maxY} 非向下=${bad.length} 画布=${cv.w}x${cv.h}(${cv.cols}列)`;
  });

  // 2) 全空档：所有节点应为 locked（除根因 goal:1 而 g:0 也 locked），进度条不出现
  await run('3-4-02-all-locked', ...D, async p => {
    await openTree(p, statsOf());
    const n = await p.evaluate(() => NOVA.logbook.achNodes());
    const locks = n.filter(a => a.cls === 'locked').length;
    const done = n.filter(a => a.cls === 'done').length;
    const bars = n.filter(a => a.bar && a.bar !== '0%' && a.bar !== '').length;
    return `locked=${locks} done=${done} partialBars=${bars} total=${n.length}`;
  });

  // 3) 满达成档：全部 done，进度条满格，（汇总节点也应 done）
  await run('3-4-03-all-done', ...D, async p => {
    await openTree(p, statsOf({
      // ⚠️ 4.3 起 hull6.goal 是 7（多了「熔炉」）—— 只给 6 船的话汇总节点永远停在「前置 5/6」
      k: 5000, g: 20, t: 20000, w: 40, sc: 999999,
      hulls: ['peregrine', 'rapier', 'bulwark', 'raven', 'swarm', 'nemesis', 'forge'], nomod: 5, flaw: 12,
    }));
    const n = await p.evaluate(() => NOVA.logbook.achNodes());
    const done = n.filter(a => a.cls === 'done').length;
    // ⚠️ 内联 style.width 会被浏览器规范化：100.0% 落回 '100%' —— 断言要按规范化后的值
    const fullBars = n.filter(a => a.bar === '100%' || a.bar === '100.0%').length;
    const agg = n.find(a => a.id === 'all');
    // 4.3b 补：日志开着切语言 → 星图节点文案必须跟着换（不重绘就停在旧语言）
    await p.evaluate(() => NOVA.death.lang('en'));
    await p.waitForTimeout(300);
    const enName = await p.evaluate(() => {
      const e = document.querySelector('#lbTreeNodes [data-ach="k1500"] b');
      return e ? e.textContent : null;
    });
    return `done=${done}/${n.length} fullBars=${fullBars} allCls=${agg.cls} allRead=${JSON.stringify(agg.read)} enAfterLang=${JSON.stringify(enName)}`;
  });

  // 4) 中段档：部分节点部分进度 → part 态 + 百分比正确（700/1500 = 46.7%）
  await run('3-4-04-partial', ...D, async p => {
    await openTree(p, statsOf({ k: 700, g: 3, t: 800, w: 12, sc: 5000, hulls: ['peregrine', 'rapier', 'bulwark'] }));
    const n = await p.evaluate(() => NOVA.logbook.achNodes());
    const parts = n.filter(a => a.cls === 'part');
    const done = n.filter(a => a.cls === 'done').map(a => a.id);
    const mid = n.find(a => a.id === 'k1500');
    return `part=${parts.length} done=[${done}] k1500=(${mid.cls} ${JSON.stringify(mid.read)} bar=${mid.bar})`;
  });

  // 5) 进度百分比算术自检：击坠 200 / 目标 4000 → 5.0%
  await run('3-4-05-pct-math', ...D, async p => {
    await openTree(p, statsOf({ k: 200, g: 1 }));
    const n = await p.evaluate(() => NOVA.logbook.achNodes());
    const k4 = n.find(a => a.id === 'k4000');
    const k1 = n.find(a => a.id === 'k100');
    return `k4000 bar=${k4.bar} cls=${k4.cls} | k100 bar=${k1.bar} cls=${k1.cls} read=${JSON.stringify(k1.read)}`;
  });

  // 6) 技巧支：船体数组驱动（3 船 → hull3 done，hull6 part）
  await run('3-4-06-hull-branch', ...D, async p => {
    await openTree(p, statsOf({ g: 5, w: 10, hulls: ['peregrine', 'rapier', 'bulwark'] }));
    const n = await p.evaluate(() => NOVA.logbook.achNodes());
    const h3 = n.find(a => a.id === 'hull3'), h6 = n.find(a => a.id === 'hull6');
    return `hull3=(${h3.cls} ${JSON.stringify(h3.read)}) hull6=(${h6.cls} ${JSON.stringify(h6.read)} bar=${h6.bar})`;
  });

  // 7) 汇总节点依赖判据：6 个前置只满足 2 个 → all 不达成且显示 2/6
  await run('3-4-07-aggregate', ...D, async p => {
    await openTree(p, statsOf({
      k: 5000, t: 20000, w: 40, g: 9, hulls: ['a', 'b', 'c', 'd', 'e', 'f'], nomod: 5, flaw: 0,
    }));
    const n = await p.evaluate(() => NOVA.logbook.achNodes());
    const agg = n.find(a => a.id === 'all');
    // k4000 done + wend done + t5h done + hull6 done = 4/6；nomod/flaw 未达成
    return `allCls=${agg.cls} read=${JSON.stringify(agg.read)}`;
  });

  // 8) 达成弹窗：单条播报文案（走 achMark 写盘 → 入队 → achTick 播报的真实序）
  await run('3-4-08-toast', ...D, async p => {
    await p.evaluate(() => NOVA.launch(0));
    await p.waitForTimeout(400);
    await p.evaluate(() => NOVA.logbook.achReset());
    const t = await p.evaluate(() => NOVA.logbook.achToast('k1500'));
    const q = await p.evaluate(() => NOVA.logbook.achQueue());
    return `main=${JSON.stringify(t.bMain)} sub=${JSON.stringify(t.bSub)} cool=${t.cool} marked=[${t.seen}]`;
  });

  // 9) 弹窗去重：同一成就第二次触发不应再入队（已在 nova-ach 里）
  await run('3-4-09-toast-dedup', ...D, async p => {
    await p.evaluate(() => NOVA.launch(0));
    await p.waitForTimeout(400);
    await p.evaluate(() => NOVA.logbook.achReset());
    const f1 = await p.evaluate(() => NOVA.logbook.achFeed({ k: 4000, g: 1 }));
    const f2 = await p.evaluate(() => NOVA.logbook.achFeed({ k: 4000, g: 1 }));
    return `first=[${f1.queue}] second=[${f2.queue}] firstN=${f1.queued} secondN=${f2.queued} seenN=${f2.seen.length}`;
  });

  // 10) 英文：节点文字 EN 化（名称 / 描述）
  await run('3-4-10-en', ...D, async p => {
    await openTree(p, statsOf({ k: 700, g: 3, w: 12 }));
    await p.evaluate(() => NOVA.death.lang('en'));
    await p.waitForTimeout(400);
    const n = await p.evaluate(() => NOVA.logbook.achNodes());
    const g = await p.evaluate(() => {
      const e = document.querySelector('#lbTreeNodes [data-ach="k1500"]');
      return e ? e.querySelector('b').textContent + '|' + e.querySelector('span').textContent : null;
    });
    return `k1500=${JSON.stringify(g)} total=${n.length}`;
  });

  // 11) 竖屏：树容器在 390×844 不横向溢出，缩放后整树在视窗内
  await run('3-4-11-mobile', ...M, async p => {
    await openTree(p, statsOf({ k: 700, g: 3, w: 12 }));
    const m = await p.evaluate(() => {
      const t = document.querySelector('#lbTree').getBoundingClientRect();
      const f = NOVA.logbook.fit();   // 4.3b 返回 {scale,content,view,cols}
      return { treeW: Math.round(t.width), treeH: Math.round(t.height),
        vw: innerWidth, overflowX: Math.round(t.right - innerWidth), fit: f };
    });
    return JSON.stringify(m);
  });

  // 12) 回归：图鉴计数不受影响（成就树扩容不应动到其他区块）
  await run('3-4-12-regress', ...D, async p => {
    await openTree(p, statsOf({ k: 99999, g: 50, t: 99999, w: 60, sc: 9e6, hulls: ['a', 'b', 'c', 'd', 'e', 'f'], nomod: 9, flaw: 9 }));
    const c = await p.evaluate(() => NOVA.logbook.counts());
    const heads = await p.evaluate(() => document.querySelectorAll('#logbook .sec-head').length);
    return `counts=${JSON.stringify(c)} secHeads=${heads}`;
  });
})();
