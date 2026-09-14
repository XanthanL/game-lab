/* Phase 7.7 验证 —— 固定摇杆 + 首屏 / 设置分层
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> node test/phase7-7-check.js
 * 产出：test/phase7/7-7-*.png + 每行状态断言
 *
 * 背景：功能越堆越多，首屏 9 个等宽按钮 + 设置一整条长列表，手机上都要滚。
 *   ① 首屏拆成「出击 / 其它开局方式 / 工具芯片」三层，硬约束是**一屏放得下**；
 *   ② 设置按「音频 / 画面 / 操作」分页，每页一屏内看完；
 *   ③ 触屏摇杆钉死左下角（详见 phase5-5-check 的 04）。
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(require('path').resolve(__dirname, '../index.html')).href;
const OUT = path.join(__dirname, 'phase7');
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}

const P = [390, 844], L = [844, 390];

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

(async () => {

/* ── 01 首屏必须一屏放得下（竖屏 + 横屏） ─────────────── */
for (const [tag, vw, vh] of [['7-7-01a-menu-portrait', ...P], ['7-7-01b-menu-landscape', ...L]]) {
  await run(tag, vw, vh, async p => {
    const r = await p.evaluate(() => {
      const m = document.getElementById('menu');
      const inn = m.querySelector('.menu-in');
      return { sh: m.scrollHeight, ch: m.clientHeight, ih: Math.round(inn.getBoundingClientRect().height) };
    });
    const ok = r.sh <= r.ch + 1;
    return `${ok ? 'PASS' : 'FAIL'} 视口 ${vw}x${vh} · 浮层内容 ${r.sh} / 可用 ${r.ch}` +
      `（超出 ${Math.max(0, r.sh - r.ch)}px）· 内容块高 ${r.ih}`;
  });
}

/* ── 02 三层结构齐全，且每个入口仍然有效 ─────────────── */
await run('7-7-02-menu-layers', ...P, async p => {
  const r = await p.evaluate(() => {
    const q = s => document.querySelectorAll(s).length;
    /* 7.9：模式排加了「ⓘ 模式介绍」→ 4；工具排加了「图鉴 / 星图」→ 8；
       7.10 再加「音乐」→ 9 */
    const ids = ['btnLaunch', 'btnDaily', 'btnTime', 'btnModes', 'btnSeed', 'btnSaves',
      'btnCodex', 'btnStarmap', 'btnMusic', 'btnLogbook', 'btnBoard', 'btnSettings', 'btnLang'];
    return {
      launch: q('.menu-actions .btn'), modes: q('.menu-modes .btn'), utils: q('.menu-util .util'),
      sep: q('.menu-sep'), missing: ids.filter(i => !document.getElementById(i)),
      // 工具芯片必须明显矮于主按钮 —— 三层权重靠高度差读出来
      hLaunch: Math.round(document.getElementById('btnLaunch').getBoundingClientRect().height),
      hUtil: Math.round(document.getElementById('btnSeed').getBoundingClientRect().height),
    };
  });
  const ok = r.launch === 1 && r.modes === 4 && r.utils === 9 && r.sep === 1 &&
    r.missing.length === 0 && r.hUtil < r.hLaunch;
  return `${ok ? 'PASS' : 'FAIL'} 主按钮 ${r.launch} · 模式 ${r.modes} · 工具 ${r.utils}` +
    ` · 分隔线 ${r.sep} · 缺失 id ${JSON.stringify(r.missing)}` +
    ` · 高度 主 ${r.hLaunch}px vs 芯片 ${r.hUtil}px`;
});

/* ── 03 设置分页：互斥切换 + 键位页仍画得出槽位 ──────── */
await run('7-7-03-set-tabs', ...L, async p => {
  await ev(p, 'openSettings()');
  /* 7.9：图鉴也用 .settab / .setpane（同一套分页机制），所以这里必须把选择器收在
     #settings 里 —— 否则 querySelector 会先撞上图鉴的子页，读到的是图鉴的状态。 */
  const S = '#settings ';
  const a = await p.evaluate(S2 => ({
    open: !document.getElementById('settings').hidden,
    tabs: document.querySelectorAll(S2 + '.settab').length,
    onTab: (document.querySelector(S2 + '.settab.on') || {}).dataset,
    onPane: (document.querySelector(S2 + '.setpane.on') || {}).dataset,
    visible: [...document.querySelectorAll(S2 + '.setpane')].filter(s => s.offsetParent !== null).length,
  }), S);
  await p.evaluate(S2 => document.querySelector(S2 + '.settab[data-pick="ctrl"]').click(), S);
  const b = await p.evaluate(S2 => ({
    onTab: (document.querySelector(S2 + '.settab.on') || {}).dataset,
    onPane: (document.querySelector(S2 + '.setpane.on') || {}).dataset,
    visible: [...document.querySelectorAll(S2 + '.setpane')].filter(s => s.offsetParent !== null).length,
    rows: document.querySelectorAll('#keyList .keyrow').length,
  }), S);
  await p.evaluate(S2 => document.querySelector(S2 + '.settab[data-pick="display"]').click(), S);
  const c = await p.evaluate(S2 => ({
    onPane: (document.querySelector(S2 + '.setpane.on') || {}).dataset,
    visible: [...document.querySelectorAll(S2 + '.setpane')].filter(s => s.offsetParent !== null).length,
    segQ: document.querySelectorAll('#optQuality .segb').length,
    tog: document.querySelectorAll('#optFx .tog').length,
  }), S);
  const ok = a.open && a.tabs === 4 && a.onTab.pick === 'audio' && a.onPane.pane === 'audio' &&
    a.visible === 1 && b.onTab.pick === 'ctrl' && b.onPane.pane === 'ctrl' && b.visible === 1 &&
    b.rows > 0 && c.onPane.pane === 'display' && c.visible === 1 &&
    c.segQ === 4 && c.tog > 0;
  return `${ok ? 'PASS' : 'FAIL'} 默认 ${a.onPane.pane}（可见页 ${a.visible}）` +
    ` → 操作页 rows=${b.rows}（可见 ${b.visible}）` +
    ` → 画面页 画质档 ${c.segQ} / 特效 ${c.tog}（可见 ${c.visible}）`;
});

/* ── 04 设置分页的高度：三页必须一屏放得下 ────────────
   横屏手机 844×390 是最紧的场景（可用高只有 ~330px）。
   键位页天生是 12 个动作 × 2 槽的清单，塞不进一屏 —— 它的键位表自己滚，
   面板外壳（标题 / 标签 / 返回）不跟着动，所以允许它比视口略高，
   但**必须**远小于改版前的 1006px（一页撑三屏）。 */
await run('7-7-04-set-height', ...L, async p => {
  await ev(p, 'openSettings()');
  const out = [];
  for (const t of ["audio","display","access","ctrl"]) {
    await p.evaluate(k => document.querySelector('.settab[data-pick="' + k + '"]').click(), t);
    await p.waitForTimeout(60);
    const r = await p.evaluate(() => {
      const s = document.getElementById('settings');
      return { sh: s.scrollHeight, ch: s.clientHeight };
    });
    out.push({ t, ...r });
  }
  const fit = out.filter(o => o.t !== 'ctrl');
  const badFit = fit.filter(o => o.sh > o.ch + 1);
  const c = out.find(o => o.t === 'ctrl');
  const ok = badFit.length === 0 && c.sh <= c.ch * 1.4;
  return `${ok ? 'PASS' : 'FAIL'} ` +
    out.map(o => `${o.t} ${o.sh}/${o.ch}`).join(' · ') +
    ` · 三页零滚动=${badFit.length === 0} · 键位页 ${c.sh}px（≤ ${Math.round(c.ch * 1.4)}，改版前 1006）`;
});

/* ── 05 中英切换：新增文案都要跟着换 ─────────────────── */
await run('7-7-05-i18n', ...P, async p => {
  const zh = await p.evaluate(() => ({
    daily: document.getElementById('btnDaily').textContent.trim(),
    seed: document.getElementById('btnSeed').textContent.trim(),
    lang: document.getElementById('btnLang').textContent.trim(),
  }));
  await ev(p, "setLang('en')");
  const en = await p.evaluate(() => ({
    daily: document.getElementById('btnDaily').textContent.trim(),
    seed: document.getElementById('btnSeed').textContent.trim(),
    lang: document.getElementById('btnLang').textContent.trim(),
    tab: document.querySelector('.settab[data-pick="ctrl"]').textContent.trim(),
    sub: document.querySelector('#settings h2 span').textContent.trim(),
  }));
  await ev(p, 'openSettings()');
  const en2 = await p.evaluate(() => ({
    sub: document.querySelector('#settings h2 span').textContent.trim(),
    tabC: document.querySelector('.settab[data-pick="ctrl"]').textContent.trim(),
    langP: document.getElementById('btnLangP').textContent.trim(),
  }));
  await ev(p, "setLang('zh')");
  const back = await p.evaluate(() => document.getElementById('btnDaily').textContent.trim());
  const ok = zh.daily === '每日挑战' && en.daily === 'Daily run' && en.seed === 'SEED' &&
    en.lang === '🌐 中文' && /CONTROLS/.test(en2.tabC) && en2.sub === 'Settings' &&
    back === '每日挑战';
  return `${ok ? 'PASS' : 'FAIL'} 中「${zh.daily}/${zh.seed}/${zh.lang}」` +
    ` → 英「${en.daily}/${en.seed}/${en.lang}·设置副标 ${en2.sub}·标签 ${en2.tabC.replace(/\s+/g, ' ')}」` +
    ` → 回中「${back}」`;
});

/* ── 06 固定摇杆：整局里 rect 不动，且只在触屏 + 对局中露面 ── */
await run('7-7-06-joy-visibility', ...L, async p => {
  const inMenu = await p.evaluate(() => {
    const b = document.getElementById('joybase');
    return { hidden: b.hidden, w: b.getBoundingClientRect().width };
  });
  await ev(p, `(function(){startGame(HULLS[0]);G.mode='play';setTouch(true);return 1;})()`);
  const inPlay = await p.evaluate(() => {
    const b = document.getElementById('joybase');
    const r = b.getBoundingClientRect();
    return { hidden: b.hidden, l: Math.round(r.left), t: Math.round(r.top),
      bottomGap: Math.round(innerHeight - r.bottom), leftGap: Math.round(r.left) };
  });
  await ev(p, `toMenu()`);
  const back = await p.evaluate(() => document.getElementById('joybase').hidden);
  const ok = inMenu.hidden === true && inPlay.hidden === false &&
    inPlay.leftGap === 26 && inPlay.bottomGap === 30 && back === true;
  return `${ok ? 'PASS' : 'FAIL'} 菜单隐藏=${inMenu.hidden} · 对局中 左/下距边 ${inPlay.leftGap}/${inPlay.bottomGap}` +
    ` · rect ${inPlay.l},${inPlay.t} · 回菜单再隐藏=${back}`;
});

})();
