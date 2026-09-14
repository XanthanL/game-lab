/* Phase 3.1 验证 —— 卡牌稀有度 / 升阶（rarity 字段 / 权重分布 / 保底 / 卡面视觉 / 升阶标记）
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase3-1-check.js
 * 产出：../.workbuddy/shots/phase3/3-1-*.png + 每行状态断言
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
  // 1) 稀有度字段完整性：26 项全部有合法 rarity，分档数 = 设计（common 11 / rare 8 / epic 7）
  await run('3-1-01-rarity-fields', ...D, async p => {
    const r = await p.evaluate(() => NOVA.cards.rarity());
    const valid = r.every(x => ['common', 'rare', 'epic'].includes(x.rarity));
    const cnt = r.reduce((a, x) => (a[x.rarity] = (a[x.rarity] || 0) + 1, a), {});
    return `n=${r.length} valid=${valid} cnt=${JSON.stringify(cnt)}`;
  });

  // 2) 权重分布：3000 次纯权重抽样（每次重置 build + pity）。
  //    注：rollChoices 强制每 offer 至少 2 张能力型，而能力型中 rare+ 占 75%，
  //    故实测 rare+ 占比显著高于"全池纯权重"的 8/23/69 —— 这是设计预期的放大，非 bug。
  await run('3-1-02-distribution', ...D, async p => {
    const rolls = await p.evaluate(() => NOVA.cards.roll(3000));
    const tally = { common: 0, rare: 0, epic: 0, repair: 0 }; let total = 0;
    for (const row of rolls) for (const r of row) { tally[r] = (tally[r] || 0) + 1; total++; }
    const pct = k => (tally[k] / total * 100);
    const ok = pct('common') > 55 && pct('common') < 70
      && pct('rare') > 20 && pct('rare') < 32
      && pct('epic') > 8 && pct('epic') < 16
      && pct('common') > pct('rare') && pct('rare') > pct('epic');
    return `common=${pct('common').toFixed(1)}% rare=${pct('rare').toFixed(1)}% epic=${pct('epic').toFixed(1)}% ok=${ok}`;
  });

  // 3) 保底计数逻辑（确定性）：用 debug 在游戏作用域里构造两种极端局
  //    A：拥有全部 rare+ 满级 → 池里只剩 common → 本次 offer 无 rare+，rarPity 0→1
  //    B：拥有全部 common 满级 → 池里只剩 rare+ → 本次必出 rare+，rarPity 归 0
  await run('3-1-03-pity', ...D, async p => {
    const A = await p.evaluate(() => NOVA.debug(
      "(function(){const ids=MODULES.filter(m=>rarityOf(m)!=='common').map(m=>m.id);" +
      "G.build={};ids.forEach(id=>G.build[id]=6);G.rarPity=0;" +
      "const ch=rollChoices();" +
      "return JSON.stringify({hasRare:ch.some(c=>c.id!=='repair'&&rarityOf(c)!=='common'),pity:G.rarPity});})()"));
    const B = await p.evaluate(() => NOVA.debug(
      "(function(){const ids=MODULES.filter(m=>rarityOf(m)==='common').map(m=>m.id);" +
      "G.build={};ids.forEach(id=>G.build[id]=6);G.rarPity=5;" +
      "const ch=rollChoices();" +
      "return JSON.stringify({hasRare:ch.some(c=>c.id!=='repair'&&rarityOf(c)!=='common'),pity:G.rarPity});})()"));
    const a = JSON.parse(A), b = JSON.parse(B);
    return `A=${JSON.stringify(a)} B=${JSON.stringify(b)} ok=${(!a.hasRare && a.pity === 1 && b.hasRare && b.pity === 0)}`;
  });

  // 4) 卡面稀有度视觉：开升级面板，应有卡的 r-rare/r-epic 类 + 稀有度标签文字
  await run('3-1-04-card-faces', ...D, async p => {
    await p.evaluate(() => NOVA.launch(0));
    await p.waitForTimeout(400);
    await p.evaluate(() => NOVA.debug("openLevelUp()"));
    await p.waitForTimeout(400);
    const f = await p.evaluate(() => NOVA.cards.faces());
    const rarClasses = f.filter(x => x && x.rClass.some(c => c.startsWith('r-'))).length;
    const rarTags = f.filter(x => x && x.rarTag).length;
    const sample = (f.find(x => x && x.rarTag) || {}).rarTag;
    return `faces=${f.length} rarClassCards=${rarClasses} rarTagCards=${rarTags} sampleTag=${JSON.stringify(sample)}`;
  });

  // 5) 升阶标记：已持有且未满级的卡，卡面应出现「↑ 升阶」且带 up 类
  await run('3-1-05-upgrade-mark', ...D, async p => {
    await p.evaluate(() => NOVA.launch(0));
    await p.waitForTimeout(400);
    await p.evaluate(() => NOVA.debug(
      "(function(){G.build={hull:2};G.choices=[MOD_BY_ID['hull'],MOD_BY_ID['twin'],REPAIR];renderCards();})()"));
    await p.waitForTimeout(300);
    const f = await p.evaluate(() => NOVA.cards.faces());
    const hull = f.find(x => x && x.id === 'hull');
    return `hullCls=${JSON.stringify(hull.rClass)} upMark=${JSON.stringify(hull.upMark)} hasUp=${hull.rClass.includes('up') && !!hull.upMark}`;
  });

  // 6) 满级卡：持有到 max 的卡不应再显示升阶标记，应显示 mx（MAX）
  await run('3-1-06-max-mark', ...D, async p => {
    await p.evaluate(() => NOVA.launch(0));
    await p.waitForTimeout(400);
    await p.evaluate(() => NOVA.debug(
      "(function(){G.build={hull:6};G.choices=[MOD_BY_ID['hull'],MOD_BY_ID['twin'],REPAIR];renderCards();})()"));
    await p.waitForTimeout(300);
    const f = await p.evaluate(() => NOVA.cards.faces());
    const hull = f.find(x => x && x.id === 'hull');
    return `hullCls=${JSON.stringify(hull.rClass)} upMark=${JSON.stringify(hull.upMark)} isMax=${hull.rClass.includes('mx') && !hull.rClass.includes('up')}`;
  });

  // 7) 英文：稀有度标签应显示 COMMON/RARE/EPIC
  await run('3-1-07-en', ...D, async p => {
    await p.evaluate(() => NOVA.launch(0));
    await p.waitForTimeout(400);
    await p.evaluate(() => NOVA.debug("openLevelUp()"));
    await p.waitForTimeout(300);
    await p.evaluate(() => NOVA.death.lang('en'));
    await p.waitForTimeout(300);
    const f = await p.evaluate(() => NOVA.cards.faces());
    const tag = (f.find(x => x && x.rarTag) || {}).rarTag;
    return `enTag=${JSON.stringify(tag)}`;
  });

  // 8) 竖屏：升级面板不横向溢出
  await run('3-1-08-mobile', ...M, async p => {
    await p.evaluate(() => NOVA.launch(0));
    await p.waitForTimeout(400);
    await p.evaluate(() => NOVA.debug("openLevelUp()"));
    await p.waitForTimeout(400);
    const m = await p.evaluate(() => {
      const r = document.querySelector('#cards .cards-in').getBoundingClientRect();
      return { panelW: Math.round(r.width), vw: innerWidth, overflowX: Math.round(r.right - innerWidth) };
    });
    return JSON.stringify(m);
  });

  // 9) 回归：模块总数仍是 26，rollChoices 每次稳定返回 3 张（含 repair 兜底）
  await run('3-1-09-regress', ...D, async p => {
    const r = await p.evaluate(() => NOVA.cards.rarity());
    const sizes = await p.evaluate(() => NOVA.debug(
      "(function(){const out=[];for(let i=0;i<50;i++){G.build={};G.rarPity=0;out.push(rollChoices().length);}return JSON.stringify(out);})()"));
    const arr = JSON.parse(sizes);
    const stable = [...new Set(arr)].every(n => n === 3);
    return `modules=${r.length} rollSizes=[${[...new Set(arr)]}] stable=${stable}`;
  });

  // 10) 回归：modStats（当前读数）对任意已持有卡仍可正常返回（不抛错）
  await run('3-1-10-modstats', ...D, async p => {
    const ok = await p.evaluate(() => NOVA.debug(
      "(function(){try{for(const m of MODULES){G.build[m.id]=3;const rd=modStats(m.id);if(!Array.isArray(rd))return false;}G.build={};return true;}catch(e){return 'ERR:'+e.message;}})()"));
    return `modStatsOk=${ok}`;
  });
})();
