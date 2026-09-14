/* Phase 7.9 验证 —— 结算大数适配 + LAUNCH 精简 + 模式介绍 + 图鉴 / 星图分家
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> node test/phase7-9-check.js
 * 产出：test/phase7/7-9-*.png + 每行状态断言
 *
 * 四条改动各自的硬约束：
 *   ① 结算大数：任何量级任何视口都必须是**完整一行**、不越界（fitNum）；
 *   ② 机库：默认零配置按钮（四排折进一条摘要），展开后仍可改且摘要跟着变；
 *   ③ 模式介绍：三个模式各有卡片，点得开、退得回；
 *   ④ 图鉴 / 星图 / 日志三分：图鉴四个子页互斥且都有内容，星图两棵树画得出，
 *      日志只剩累计记录。
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const OUT = path.join(__dirname, 'phase7');
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}

const P = [390, 844], L = [844, 390], D = [1024, 768];

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
  await p.waitForTimeout(1300);
  let note = '';
  try { note = (await job(p)) || ''; } catch (e) { errs.push('JOB:' + e.message.slice(0, 200)); }
  await p.screenshot({ path: path.join(OUT, tag + '.png'), fullPage: false });
  await c.close(); await b.close();
  console.log(tag.padEnd(30), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}
const ev = (p, code) => p.evaluate(c => NOVA.debug(c), code);

/* 结算面板里大数是否「一行 + 不越界」 —— 四个视口 × 五个量级都量一遍 */
const MEASURE = `(()=>{
  const n=document.getElementById('overScore');
  const pn=n.closest('.panel'),cs=getComputedStyle(pn);
  const content=pn.getBoundingClientRect().width-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
  const fs=parseFloat(getComputedStyle(n).fontSize);
  const lh=parseFloat(getComputedStyle(n).lineHeight)||fs*1.2;
  return {fs:Math.round(fs*10)/10,content:Math.round(content),
    scroll:n.scrollWidth,client:n.clientWidth,
    lines:Math.round(n.getBoundingClientRect().height/lh*10)/10};
})()`;

(async () => {

/* ── 01 结算大数：一行 + 不越界 ─────────────────────── */
for (const [tag, vw, vh] of [['7-9-01a-score-portrait', ...P], ['7-9-01b-score-landscape', ...L],
                             ['7-9-01c-score-desktop', ...D]]) {
  await run(tag, vw, vh, async p => {
    const bad = [];
    for (const sc of [3500, 560000, 56000000, 1234567890, 99999999999]) {
      await ev(p, ['G.mode="menu";G.taMode=false;', 'startGame(HULLS[0]);', 'G.mode="play";',
        'G.score=' + sc + ';G.best=0;', 'showOver();'].join('\n'));
      await p.waitForTimeout(140);
      const m = await p.evaluate(MEASURE);
      if (m.scroll - m.client > 1 || m.lines > 1.35) bad.push(sc + '(' + m.fs + 'px,' + m.lines + '行)');
    }
    return `${bad.length ? 'FAIL' : 'PASS'} ${vw}x${vh} · 越界/折行的量级 ${bad.length ? bad.join(' ') : '无'}`;
  });
}

/* ── 02 机库：默认零配置按钮，四排折进一条 ───────────── */
await run('7-9-02-hulls-collapsed', ...P, async p => {
  await ev(p, 'openHulls()');
  await p.waitForTimeout(200);
  const a = await p.evaluate(() => {
    const vis = s => { const e = document.querySelector(s); return !!e && e.offsetParent !== null; };
    return {
      bodyHidden: document.getElementById('cfgBody').hidden,
      barVisible: vis('#cfgBar'),
      // 收起时：四排配置全都不该占版面
      rowsVisible: ['#diffRow', '#rmodRow', '#poolRow', '#ghostRow'].filter(vis),
      sum: (document.getElementById('cfgSum').textContent || '').trim(),
      expanded: document.getElementById('cfgBar').getAttribute('aria-expanded'),
      cards: document.querySelectorAll('#hullrow .card').length,
      hullsHidden: document.getElementById('hulls').hidden,
    };
  });
  await p.evaluate(() => document.getElementById('cfgBar').click());
  await p.waitForTimeout(160);
  const b = await p.evaluate(() => {
    const vis = s => { const e = document.querySelector(s); return !!e && e.offsetParent !== null; };
    return {
      bodyHidden: document.getElementById('cfgBody').hidden,
      rowsVisible: ['#diffRow', '#rmodRow', '#poolRow', '#ghostRow'].filter(vis),
      btns: document.querySelectorAll('#cfgBody button').length,
      expanded: document.getElementById('cfgBar').getAttribute('aria-expanded'),
    };
  });
  const ok = !a.hullsHidden && a.bodyHidden && a.barVisible && a.rowsVisible.length === 0 &&
    a.sum.length > 0 && a.expanded === 'false' && a.cards > 0 &&
    !b.bodyHidden && b.rowsVisible.length === 4 && b.btns > 10 && b.expanded === 'true';
  return `${ok ? 'PASS' : 'FAIL'} 收起：可见配置排 ${a.rowsVisible.length}（要 0）· 船卡 ${a.cards} ·` +
    ` 摘要「${a.sum}」 → 展开：可见配置排 ${b.rowsVisible.length}/4 · 按钮 ${b.btns}`;
});

/* ── 03 改配置后摘要要跟着变 ─────────────────────────── */
await run('7-9-03-cfg-summary', ...P, async p => {
  await ev(p, 'openHulls();setCfg(true);');
  await p.waitForTimeout(200);
  const before = await p.evaluate(() => document.getElementById('cfgSum').textContent.trim());
  // 点第一个可用的难度按钮（标准 → 巡航）
  await p.evaluate(() => { const b = document.querySelector('#diffRow .dif:not(.lock)'); if (b) b.click(); });
  await p.waitForTimeout(160);
  const afterDiff = await p.evaluate(() => document.getElementById('cfgSum').textContent.trim());
  await p.evaluate(() => { const b = document.querySelector('#rmodRow .rmod:not(.lock)'); if (b) b.click(); });
  await p.waitForTimeout(160);
  const afterRmod = await p.evaluate(() => document.getElementById('cfgSum').textContent.trim());
  const ok = before !== afterDiff && afterDiff !== afterRmod && /×/.test(afterRmod);
  return `${ok ? 'PASS' : 'FAIL'} 「${before}」→「${afterDiff}」→「${afterRmod}」`;
});

/* ── 04 模式介绍：三张卡片 + 可开关 ──────────────────── */
await run('7-9-04-modes', ...P, async p => {
  await p.evaluate(() => document.getElementById('btnModes').click());
  await p.waitForTimeout(220);
  const a = await p.evaluate(() => ({
    open: !document.getElementById('modes').hidden,
    menuHidden: document.getElementById('menu').hidden,
    cards: document.querySelectorAll('#mdList .mdcard').length,
    rows: document.querySelectorAll('#mdList .mdrows>div').length,
    empty: [...document.querySelectorAll('#mdList .mdone')].filter(e => !e.textContent.trim()).length,
    sh: document.getElementById('modes').scrollHeight,
  }));
  await p.evaluate(() => document.getElementById('btnMdBack').click());
  await p.waitForTimeout(200);
  const b = await p.evaluate(() => ({
    hidden: document.getElementById('modes').hidden,
    menu: !document.getElementById('menu').hidden,
  }));
  const ok = a.open && a.menuHidden && a.cards === 3 && a.rows === 12 && a.empty === 0 && b.hidden && b.menu;
  return `${ok ? 'PASS' : 'FAIL'} 卡片 ${a.cards}/3 · 差异行 ${a.rows}/12 · 空文案 ${a.empty}` +
    ` · 返回后收起 ${b.hidden}`;
});

/* ── 05 图鉴：四个子页互斥且都有内容 ─────────────────── */
await run('7-9-05-codex-tabs', ...L, async p => {
  await p.evaluate(() => document.getElementById('btnCodex').click());
  await p.waitForTimeout(260);
  const out = [];
  for (const t of ['hull', 'foe', 'mode', 'up']) {
    await p.evaluate(k => document.querySelector('#cxTabs .settab[data-pick="' + k + '"]').click(), t);
    await p.waitForTimeout(120);
    const r = await p.evaluate(() => {
      const on = document.querySelector('#codex .setpane.on');
      const vis = [...document.querySelectorAll('#codex .setpane')].filter(s => s.offsetParent !== null);
      return {
        pane: on ? on.dataset.pane : null, visible: vis.length,
        items: on ? on.querySelectorAll('.cxitem,.lbcell,.mdcard').length : 0,
        models: on ? on.querySelectorAll('canvas.cxmodel').length : 0,
        txt: on ? (on.textContent || '').trim().length : 0,
      };
    });
    out.push({ t, ...r });
  }
  const ok = out.every(o => o.visible === 1 && o.items > 0 && o.txt > 40) &&
    out.map(o => o.t).join() === out.map(o => o.pane).join() &&
    out[0].models > 0;   // 战机页必须真的画出模型
  return `${ok ? 'PASS' : 'FAIL'} ` + out.map(o => `${o.pane}:${o.items}项/${o.txt}字`).join(' · ') +
    ` · 战机模型 ${out[0].models}`;
});

/* ── 06 星图 / 日志已分家 ────────────────────────────── */
await run('7-9-06-split', ...D, async p => {
  await p.evaluate(() => document.getElementById('btnStarmap').click());
  await p.waitForTimeout(400);
  const s = await p.evaluate(() => ({
    open: !document.getElementById('starmap').hidden,
    ach: document.querySelectorAll('#lbTreeNodes .lbnode').length,
    meta: document.querySelectorAll('#mTreeNodes .lbnode').length,
    dust: (document.getElementById('mDust').textContent || '').trim().length,
    hasCodex: !!document.querySelector('#starmap .lbgrid'),
  }));
  await p.evaluate(() => document.getElementById('btnSmBack').click());
  await p.waitForTimeout(180);
  await p.evaluate(() => document.getElementById('btnLogbook').click());
  await p.waitForTimeout(260);
  const l = await p.evaluate(() => ({
    open: !document.getElementById('logbook').hidden,
    stats: document.querySelectorAll('#logbook .statgrid b').length,
    hasTree: !!document.querySelector('#logbook .lbnode'),
    hasGrid: !!document.querySelector('#logbook .lbgrid'),
  }));
  await p.evaluate(() => document.getElementById('btnLbBack').click());
  await p.waitForTimeout(180);
  await p.evaluate(() => document.getElementById('btnCodex').click());
  await p.waitForTimeout(300);
  const c = await p.evaluate(() => ({
    open: !document.getElementById('codex').hidden,
    hasTree: !!document.querySelector('#codex .lbnode'),
    hasStats: !!document.querySelector('#codex .statgrid'),
  }));
  const ok = s.open && s.ach > 0 && s.meta > 0 && s.dust > 0 && !s.hasCodex &&
    l.open && l.stats === 6 && !l.hasTree && !l.hasGrid &&
    c.open && !c.hasTree && !c.hasStats;
  return `${ok ? 'PASS' : 'FAIL'} 星图：成就 ${s.ach} 节点 / 解锁 ${s.meta} 节点 / 星尘 ${s.dust} 字` +
    ` · 日志：${l.stats} 项累计，无树 ${!l.hasTree} 无网格 ${!l.hasGrid}` +
    ` · 图鉴：无树 ${!c.hasTree}`;
});

/* ── 07 新面板 ESC 一律回主菜单 ──────────────────────── */
await run('7-9-07-esc', ...P, async p => {
  const out = [];
  for (const [btn, panel, mode] of [['btnCodex', 'codex', 'codex'], ['btnStarmap', 'starmap', 'starmap'],
                                    ['btnModes', 'modes', 'modes']]) {
    await p.evaluate(b => document.getElementById(b).click(), btn);
    await p.waitForTimeout(200);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
    const r = await p.evaluate(id => ({
      hidden: document.getElementById(id).hidden,
      menu: !document.getElementById('menu').hidden,
    }), panel);
    out.push({ mode, ...r });
  }
  const ok = out.every(o => o.hidden && o.menu);
  return `${ok ? 'PASS' : 'FAIL'} ` + out.map(o => `${o.mode}:${o.hidden ? '已收起' : '仍开着'}`).join(' · ');
});

/* ── 08 中英文切换后新界面仍有文案 ───────────────────── */
await run('7-9-08-i18n', ...P, async p => {
  const zh = await p.evaluate(() => ({
    modes: document.getElementById('btnModes').textContent.trim(),
    codex: document.getElementById('btnCodex').textContent.trim(),
    star: document.getElementById('btnStarmap').textContent.trim(),
    cfg: (document.querySelector('#cfgBar .cfgbar-k') || {}).textContent,
  }));
  await p.evaluate(() => document.getElementById('btnLang').click());
  await p.waitForTimeout(240);
  const en = await p.evaluate(() => ({
    modes: document.getElementById('btnModes').textContent.trim(),
    codex: document.getElementById('btnCodex').textContent.trim(),
    star: document.getElementById('btnStarmap').textContent.trim(),
    cfg: (document.querySelector('#cfgBar .cfgbar-k') || {}).textContent,
  }));
  await ev(p, 'openModes()');
  await p.waitForTimeout(200);
  const md = await p.evaluate(() => [...document.querySelectorAll('#mdList .mdone')]
    .map(e => e.textContent.trim().slice(0, 24)));
  const ok = /[一-龥]/.test(zh.modes) && /[A-Za-z]/.test(en.modes) &&
    /[A-Za-z]/.test(en.codex) && /[A-Za-z]/.test(en.star) &&
    en.cfg && en.cfg !== zh.cfg && md.length === 3 && md.every(t => t.length > 8);
  return `${ok ? 'PASS' : 'FAIL'} 模式「${zh.modes}→${en.modes}」图鉴「${zh.codex}→${en.codex}」` +
    `星图「${zh.star}→${en.star}」配置「${zh.cfg}→${en.cfg}」英文卡 ${md.length} 张`;
});

})();
