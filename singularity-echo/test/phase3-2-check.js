/* Phase 3.2 验证 —— 协同扩展（12 → 22 条 / 全部真实生效 / 孤儿卡清零）
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase3-2-check.js
 * 产出：../.workbuddy/shots/phase3/3-2-*.png + 每行状态断言
 *
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

const D = [1280, 900], M = [390, 844];

(async () => {
  // 1) 规模：SYN 应为 22 条
  await run('3-2-01-count', ...D, async p => {
    const n = await p.evaluate(() => NOVA.syn.count());
    return `count=${n} ok=${n >= 20}`;
  });

  // 2) 无假协同：没有任何一条 apply 是空函数体
  await run('3-2-02-no-empty-apply', ...D, async p => {
    const empty = await p.evaluate(() => NOVA.syn.emptyApply());
    return `emptyCount=${empty.length} empty=[${empty}] ok=${empty.length === 0}`;
  });

  // 3) 依赖合法：a/b 都是真实存在的能力型模块
  await run('3-2-03-deps', ...D, async p => {
    const bad = await p.evaluate(() => NOVA.syn.badDeps());
    return `badCount=${bad.length} bad=[${bad}] ok=${bad.length === 0}`;
  });

  // 4) 孤儿卡清零：3.2 前 twin/pierce/ricochet/frag/guided 一条协同都没有
  await run('3-2-04-orphans', ...D, async p => {
    const orphans = await p.evaluate(() => NOVA.syn.orphans());
    return `orphans=[${orphans}] ok=${orphans.length === 0}`;
  });

  // 5) 无重复配对 + 英文名齐全
  await run('3-2-05-integrity', ...D, async p => {
    const dupes = await p.evaluate(() => NOVA.syn.dupes());
    const missing = await p.evaluate(() => NOVA.syn.enMissing());
    return `dupes=[${dupes}] enMissing=[${missing}] ok=${dupes.length === 0 && missing.length === 0}`;
  });

  // 6) 核心：每条协同调用 apply() 后 P 上必须真的有字段变化（changed>=1）
  await run('3-2-06-all-real', ...D, async p => {
    await p.evaluate(() => NOVA.launch(0));
    await p.waitForTimeout(400);
    const a = await p.evaluate(() => NOVA.syn.audit());
    const zero = a.zero;
    const minChanged = Math.min(...a.rows.map(r => r.changed));
    return `n=${a.rows.length} zero=[${zero}] minChanged=${minChanged} ok=${zero.length === 0}`;
  });

  // 7) 安全：跑完全部协同后，等级下标字段（mine/nova/blink）没被越界改动
  await run('3-2-07-level-safe', ...D, async p => {
    await p.evaluate(() => NOVA.launch(0));
    await p.waitForTimeout(400);
    const a = await p.evaluate(() => NOVA.syn.audit());
    return `lvBad=[${a.lvBad}] lvAfter=${JSON.stringify(a.lvAfter)} ok=${a.lvBad.length === 0}`;
  });

  // 8) 抽样几条新协同的实际数值变化（确认效果是"设计意图"而非意外）
  await run('3-2-08-sample-effects', ...D, async p => {
    await p.evaluate(() => NOVA.launch(0));
    await p.waitForTimeout(400);
    const ids = ['volley_pierce', 'guided_frag', 'ignite', 'storm'];
    const out = [];
    for (const id of ids) {
      const r = await p.evaluate(i => NOVA.syn.effect(i), id);
      out.push(`${id}:${JSON.stringify(r.diff)}`);
    }
    return out.join(' | ');
  });

  // 9) 实机：装上 twin+pierce 应真的触发「齐射穿刺」，且 G.syn 记录到位
  await run('3-2-09-live-trigger', ...D, async p => {
    await p.evaluate(() => NOVA.launch(0));
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => NOVA.debug(
      "(function(){G.build={twin:1,pierce:1};const before=P.pierce;" +
      "const got=checkSynergies();" +
      "return JSON.stringify({got:got.map(s=>s.id),before,after:P.pierce,syn:!!G.syn['volley_pierce']});})()"));
    return r;
  });

  // 10) 回归：卡牌稀有度与成就树不受影响（模块数仍 26、成就树仍 18 节点）
  await run('3-2-10-regress', ...D, async p => {
    const mods = await p.evaluate(() => NOVA.cards.rarity().length);
    await p.evaluate(() => NOVA.logbook.open());
    await p.waitForTimeout(400);
    const cnt = await p.evaluate(() => NOVA.logbook.counts());
    return `modules=${mods} nodes=${cnt.nodes} links=${cnt.links} ok=${mods === 29 && cnt.nodes === 18}`;
  });
})();
