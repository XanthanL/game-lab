/* Phase 2.3 验证 —— 航行日志重构（图鉴 + 成就星图容器）
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase2-3-check.js
 * 产出：../.workbuddy/shots/phase3/2-3-*.png + 每行状态断言
 *
 * 断言优先于截图：条目数 / 解锁态 / 成就进度直接从 NOVA.logbook.* 读，截图只核对版式。
 * 每张图独立浏览器实例（file:// 下 localStorage 跨 context 共享，nova-* 会互相污染）。
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
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.goto(GAME, { waitUntil: 'load' });
  await p.waitForTimeout(1400);
  let note = '';
  try { note = (await job(p)) || ''; } catch (e) { errs.push('JOB:' + e.message.slice(0, 160)); }
  await p.screenshot({ path: path.join(OUT, tag + '.png'), fullPage: false });
  await c.close(); await b.close();
  console.log(tag.padEnd(22), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}

// 打开日志面板（菜单 → 日志），并可选注入累计统计
const openLb = async (p, stats) => {
  if (stats) await p.evaluate(s => { try { localStorage.setItem('nova-stats', JSON.stringify(s)); } catch (e) {} }, stats);
  await p.evaluate(() => NOVA.logbook.open());
  await p.waitForTimeout(600);
  // 面板很长，成就树在底部 —— 要测树必须先滚进视口
  await p.evaluate(() => document.querySelector('#lbTree').scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(400);
};

(async () => {
  const D = [1280, 900], M = [390, 844];

  // 1) 空统计：所有敌型/巨像应处于未解锁态，图鉴条目数与数据表一致
  await run('2-3-01-logbook-empty', ...D, async p => {
    await p.evaluate(() => { try { localStorage.removeItem('nova-stats'); } catch (e) {} });
    await openLb(p);
    const c = await p.evaluate(() => NOVA.logbook.counts());
    const lk = await p.evaluate(() => NOVA.logbook.locked());
    return `counts=${JSON.stringify(c)} locked=${JSON.stringify(lk)}`;
  });

  // 2) 高统计（最远 30 波）：全部敌型与巨像应解锁
  await run('2-3-02-logbook-filled', ...D, async p => {
    await openLb(p, { k: 4200, g: 37, w: 30, t: 7200, sc: 980000 });
    const c = await p.evaluate(() => NOVA.logbook.counts());
    const lk = await p.evaluate(() => NOVA.logbook.locked());
    const ach = await p.evaluate(() => NOVA.logbook.ach());
    return `counts=${JSON.stringify(c)} locked=${JSON.stringify(lk)} achDone=${ach.filter(a => a.done).length}/${ach.length}`;
  });

  // 3) 中段统计：只解锁到 13 波的敌型（用锁定数验证解锁边界真的按波次走）
  await run('2-3-03-logbook-mid', ...D, async p => {
    await openLb(p, { k: 300, g: 5, w: 13, t: 600, sc: 20000 });
    const lk = await p.evaluate(() => NOVA.logbook.locked());
    const ach = await p.evaluate(() => NOVA.logbook.ach().filter(a => a.done).map(a => a.id));
    return `locked=${JSON.stringify(lk)} ach=${JSON.stringify(ach)}`;
  });

  // 4) 成就进度mid：k=800/1500 应显示百分比而非全黑
  await run('2-3-04-ach-progress', ...D, async p => {
    await openLb(p, { k: 800, g: 9, w: 18, t: 1800, sc: 120000 });
    const ach = await p.evaluate(() => NOVA.logbook.ach().map(a => `${a.id}:${Math.round(a.pct * 100)}%${a.done ? '✓' : ''}`));
    const partial = await p.evaluate(() => document.querySelectorAll('#lbTreeNodes .lbnode:not(.done):not(.locked)').length);
    return `ach=${JSON.stringify(ach)} partialNodes=${partial}`;
  });

  // 5) 树形结构完整性：节点层与连线层都渲染、坐标 1:1、已达成连线为黄铜实线、
  //    自动适配缩放生效（整张图需缩进视窗，否则最右一列被裁）
  await run('2-3-05-ach-tree', ...D, async p => {
    await openLb(p, { k: 4200, g: 37, w: 30, t: 7200, sc: 980000 });
    const t = await p.evaluate(() => {
      const c = NOVA.logbook.counts();
      const wrap = document.querySelector('#lbTreeWrap');
      const box = document.querySelector('#lbTree').getBoundingClientRect();
      const links = [...document.querySelectorAll('#lbTreeLinks line')];
      const svg = document.querySelector('#lbTreeLinks');
      const nodes = document.querySelector('#lbTreeNodes');
      const r = document.querySelector('#lbTree').getBoundingClientRect();
      return {
        nodes: c.nodes, links: c.links,
        svg: [svg.getAttribute('width'), svg.getAttribute('height')],
        canvas: [getComputedStyle(nodes).width, getComputedStyle(nodes).height],
        wrapH: Math.round(wrap.getBoundingClientRect().height),
        boxH: Math.round(box.height),
        amber: links.filter(l => /201,162,39/.test(l.getAttribute('stroke'))).length,
        dashed: links.filter(l => l.getAttribute('stroke-dasharray')).length,
        tf: NOVA.logbook.tf(),
        // 缩放后最右一列是否落在视窗内
        rightEdgeInside: (() => {
          const n = [...document.querySelectorAll('.lbnode')].map(e => e.getBoundingClientRect().right);
          return Math.max(...n) <= r.right + 1;
        })(),
      };
    });
    return JSON.stringify(t);
  }, 2);

  // 6) 拖拽平移：pointer 按下移动后 translate 分量应改变，且缩放不被覆盖
  await run('2-3-06-ach-drag', ...D, async p => {
    await openLb(p, { k: 4200, g: 37, w: 30, t: 7200, sc: 980000 });
    const before = await p.evaluate(() => NOVA.logbook.tf());
    const pt = await p.evaluate(() => {
      const r = document.querySelector('#lbTree').getBoundingClientRect();
      for (let y = r.top + 8; y < r.bottom - 8; y += 6) {
        for (let x = r.left + 8; x < r.right - 8; x += 6) {
          const el = document.elementFromPoint(x, y);
          if (el && !el.closest('.lbnode') && el.closest('#lbTreeWrap')) return { x: Math.round(x), y: Math.round(y) };
        }
      }
      return null;
    });
    if (!pt) return 'NO-GRAB-POINT (节点铺满视窗)';
    await p.mouse.move(pt.x, pt.y);
    await p.mouse.down();
    await p.mouse.move(pt.x - 70, pt.y - 25, { steps: 8 });
    const after = await p.evaluate(() => NOVA.logbook.tf());
    await p.mouse.up();
    const moved = after.x !== before.x && after.y !== before.y;
    const scaleKept = after.s === before.s;
    return `before=${JSON.stringify(before)} after=${JSON.stringify(after)} moved=${moved} scaleKept=${scaleKept}`;
  });

  // 7) 竖屏：图鉴两列、成就树可用、没有横向溢出
  await run('2-3-07-logbook-mobile', ...M, async p => {
    await openLb(p, { k: 4200, g: 37, w: 30, t: 7200, sc: 980000 });
    const t = await p.evaluate(() => {
      const panel = document.querySelector('#logbook .panel').getBoundingClientRect();
      const grid = document.querySelector('#lbEnemies');
      const cell = grid && grid.firstElementChild;
      const cols = cell ? Math.round(grid.getBoundingClientRect().width / cell.getBoundingClientRect().width) : 0;
      return {
        panelW: Math.round(panel.width), vw: innerWidth,
        overflowX: Math.round(panel.right - innerWidth),
        cols, treeH: Math.round(document.querySelector('#lbTree').getBoundingClientRect().height),
        nodeW: document.querySelector('.lbnode') ? Math.round(document.querySelector('.lbnode').getBoundingClientRect().width) : 0,
      };
    });
    return JSON.stringify(t);
  }, 2);

  // 8) 中英切换：图鉴与成就标题应跟随语言
  await run('2-3-08-logbook-en', ...D, async p => {
    await openLb(p, { k: 4200, g: 37, w: 30, t: 7200, sc: 980000 });
    await p.evaluate(() => NOVA.debug("setLang('en')"));
    await p.waitForTimeout(400);
    await p.evaluate(() => NOVA.logbook.open());
    await p.waitForTimeout(400);
    const t = await p.evaluate(() => {
      const secs = [...document.querySelectorAll('#logbook .lb-sec')].map(s => s.textContent.replace(/\s+/g, ' ').trim());
      const first = document.querySelector('#lbEnemies .lbname');
      const node = document.querySelector('.lbnode b');
      const trait = document.querySelector('#lbEnemies .lbtrait');
      return { secs, enemy1: first && first.textContent, node: node && node.textContent,
        trait: trait && trait.textContent.slice(0, 34) };
    });
    return JSON.stringify(t);
  }, 2);

  // 9) 回归：2.1 引导 / 2.2 卡牌在新版 logbook 下不受影响
  await run('2-3-09-regress-cards', ...D, async p => {
    await p.evaluate(() => NOVA.launch(0));
    await p.waitForTimeout(1400);
    await p.evaluate(() => NOVA.giveXp(25)); await p.waitForTimeout(1100);
    const info = await p.evaluate(() => {
      const cs = document.querySelectorAll('#cardrow .card');
      const c = cs[0];
      return { cards: cs.length, rd: !!(c && c.querySelector('.rd')), syn: !!(c && c.querySelector('.syn')),
        cardH: c ? Math.round(c.getBoundingClientRect().height) : 0 };
    });
    return JSON.stringify(info);
  }, 2);

  // 10) 图鉴数据一致性：条目数应等于数据表长度（EN_LIST 20 / BOSS_AT 6 / AFFIX 3 / HULLS 6）
  await run('2-3-10-counts', ...D, async p => {
    await openLb(p, { k: 9999, g: 100, w: 30, t: 99999, sc: 9999999 });
    const t = await p.evaluate(() => {
      const c = NOVA.logbook.counts();
      const exp = NOVA.debug('JSON.stringify({en:EN_LIST.length,boss:Object.keys(BOSS_AT).length,affix:Object.keys(AFFIX).length,hull:HULLS.length,ach:ACH.length,link:(()=>{let n=0;for(const a of ACH){if(a.req)n++;n+=(a.dependsOn||[]).length;}return n;})()})');
      return { actual: c, expected: JSON.parse(exp) };
    });
    const ok = t.actual.enemies === t.expected.en && t.actual.bosses === t.expected.boss &&
      t.actual.affix === t.expected.affix && t.actual.hulls === t.expected.hull &&
      t.actual.nodes === t.expected.ach && t.actual.links === t.expected.link;
    return `${ok ? 'MATCH' : 'MISMATCH'} actual=${JSON.stringify(t.actual)} expected=${JSON.stringify(t.expected)}`;
  });
})();
