/* Phase 7.10 验证 —— 加载页奇点视界 + 主界面环境层 + 音乐鉴赏
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> node test/phase7-10-check.js
 * 产出：test/phase7/7-10-*.png + 每行状态断言
 *
 * 三条硬约束：
 *   ① 画布必须**真的画了东西**（数非透明像素，不是只看元素在不在）；
 *   ② 环境层是背景 —— pointer-events:none，绝不能吃掉菜单点击；
 *   ③ 音乐鉴赏：九首曲子全部列得出，点播后 tick() 不许把曲子抢回去。
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
  await p.waitForTimeout(1200);
  let note = '';
  try { note = (await job(p)) || ''; } catch (e) { errs.push('JOB:' + e.message.slice(0, 200)); }
  await p.screenshot({ path: path.join(OUT, tag + '.png'), fullPage: false });
  await c.close(); await b.close();
  console.log(tag.padEnd(30), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}
const ev = (p, code) => p.evaluate(c => NOVA.debug(c), code);
const evj = (p, code) => p.evaluate(c => NOVA.debug(c), code);

(async () => {

/* ── 01 加载页画布真的画了东西 ──────────────────────── */
await run('7-10-01-boot-canvas', ...D, async p => {
  const r = await p.evaluate(() => {
    const c = document.getElementById('bootcv');
    if (!c) return { has: false };
    return { has: true, w: c.width, h: c.height, px: NOVA.sing.px('bootcv'),
      pe: getComputedStyle(c).pointerEvents, z: getComputedStyle(c).zIndex };
  });
  const ok = r.has && r.px > 500 && r.pe === 'none';
  return `${ok ? 'PASS' : 'FAIL'} 画布 ${r.w}x${r.h} · 非透明像素 ${r.px}` +
    ` · pointer-events=${r.pe}（须 none） z=${r.z}`;
});

/* ── 02 主界面环境层在动，且不挡点击 ─────────────────── */
await run('7-10-02-menu-canvas', ...D, async p => {
  await p.waitForTimeout(300);
  const a = await p.evaluate(() => ({ px: NOVA.sing.px('menucv'), st: NOVA.sing.state() }));
  await p.waitForTimeout(420);
  const b = await p.evaluate(() => ({ px: NOVA.sing.px('menucv'), st: NOVA.sing.state() }));
  // 环境层必须是背景：菜单中心点命中的应该是菜单里的元素，不是画布
  const hit = await p.evaluate(() => {
    const t = document.elementFromPoint(innerWidth / 2, innerHeight * 0.62);
    return t ? (t.id || t.tagName + '.' + t.className) : null;
  });
  const ok = a.px > 500 && b.st.t > a.st.t && hit && String(hit) !== 'menucv';
  return `${ok ? 'PASS' : 'FAIL'} 非透明像素 ${a.px}→${b.px} · 时钟 ${a.st.t}s→${b.st.t}s` +
    ` · 中心命中「${hit}」（不该是 menucv）`;
});

/* ── 03 指针牵引 + 点击冲击波 ───────────────────────── */
await run('7-10-03-interact', ...D, async p => {
  const before = await p.evaluate(() => NOVA.sing.state());
  await p.mouse.move(120, 180);
  await p.waitForTimeout(400);
  const moved = await p.evaluate(() => NOVA.sing.state());
  await p.mouse.click(300, 300);
  const waved = await p.evaluate(() => NOVA.sing.state());
  await p.waitForTimeout(1500);   // 环 1.1s 生命期，之后应被清掉
  const after = await p.evaluate(() => NOVA.sing.state());
  const ok = Math.abs(moved.cx - before.cx) > 0.02 && waved.waves > 0 && after.waves === 0;
  return `${ok ? 'PASS' : 'FAIL'} 中心 x ${before.cx}→${moved.cx}（指针牵引）` +
    ` · 点击后环 ${waved.waves} 个 → 1.5s 后 ${after.waves} 个（须回收）`;
});

/* ── 04 音乐鉴赏：九首全列得出 + 点播不被 tick 抢走 ──── */
await run('7-10-04-music', ...D, async p => {
  await p.evaluate(() => NOVA.music.open());
  await p.waitForTimeout(260);
  const list = await p.evaluate(() => NOVA.music.list());
  const rows = await p.evaluate(() => document.querySelectorAll('#muList .mu-item').length);
  const first = list[0];
  /* 必须**在同一个 evaluate 里**点完立刻读：muPlay 的下游是 fetch + decodeAudioData，
     file:// 下会失败并把 muCur 清回 null —— 那就测不到"点播已受理"这一步了。
     muCur 与 previewUrl 都是 await 之前同步写入的，同步读得到。 */
  const dur = await p.evaluate(u => {
    document.querySelector('[data-mu="' + u + '"]').click();
    return { cur: NOVA.music.cur(), prev: NOVA.music.preview() };
  }, first.u);
  /* tick() 每帧都在跑 —— 鉴赏期间它不许把曲子抢回阶段曲。等 6 帧确认。 */
  await p.waitForTimeout(600);
  const held = await p.evaluate(() => NOVA.music.preview());
  await p.evaluate(() => NOVA.music.stop());
  const stopped = await p.evaluate(() => ({ cur: NOVA.music.cur(), prev: NOVA.music.preview() }));
  const ok = list.length === 9 && rows === 9 && dur.cur === first.u && dur.prev === first.u &&
    held === first.u && stopped.cur === null && stopped.prev === null;
  return `${ok ? 'PASS' : 'FAIL'} 曲目 ${list.length}/9（DOM ${rows}）` +
    ` · 点播「${first.zh}」→ previewUrl 保持 ${held === first.u} · 停止后 ${stopped.prev}`;
});

/* ── 05 音乐面板：能开能退，ESC 也要能退 ─────────────── */
await run('7-10-05-music-esc', ...P, async p => {
  await p.evaluate(() => document.getElementById('btnMusic').click());
  await p.waitForTimeout(240);
  const a = await p.evaluate(() => ({ open: !document.getElementById('music').hidden,
    menu: document.getElementById('menu').hidden }));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(240);
  const b = await p.evaluate(() => ({ hidden: document.getElementById('music').hidden,
    menu: !document.getElementById('menu').hidden }));
  const ok = a.open && a.menu && b.hidden && b.menu;
  return `${ok ? 'PASS' : 'FAIL'} 打开 ${a.open}（菜单收起 ${a.menu}）→ ESC 后收起 ${b.hidden}（菜单回来 ${b.menu}）`;
});

/* ── 06 加了「音乐」芯片，首屏仍要一屏放得下 ─────────── */
for (const [tag, vw, vh] of [['7-10-06a-menu-portrait', ...P], ['7-10-06b-menu-landscape', ...L]]) {
  await run(tag, vw, vh, async p => {
    const r = await p.evaluate(() => {
      const m = document.getElementById('menu');
      return { sh: m.scrollHeight, ch: m.clientHeight,
        utils: document.querySelectorAll('.menu-util .util').length,
        music: !!document.getElementById('btnMusic') };
    });
    const ok = r.sh <= r.ch + 1 && r.utils === 9 && r.music;
    return `${ok ? 'PASS' : 'FAIL'} ${vw}x${vh} 浮层 ${r.sh}/${r.ch}（超出 ${Math.max(0, r.sh - r.ch)}px）` +
      ` · 工具芯片 ${r.utils} 个（含音乐 ${r.music}）`;
  });
}

/* ── 07 英文：新界面文案全部换得过来 ─────────────────── */
await run('7-10-07-i18n', ...P, async p => {
  const zh = await p.evaluate(() => document.getElementById('btnMusic').textContent.trim());
  await p.evaluate(() => document.getElementById('btnLang').click());
  await p.waitForTimeout(260);
  const en = await p.evaluate(() => ({
    music: document.getElementById('btnMusic').textContent.trim(),
    sub: (document.querySelector('#music [data-i18n="mu_sub"]') || {}).textContent,
    stop: (document.getElementById('btnMuStop') || {}).textContent,
  }));
  await p.evaluate(() => NOVA.music.open());
  await p.waitForTimeout(240);
  const names = await p.evaluate(() => [...document.querySelectorAll('#muList .mu-n')]
    .map(e => e.textContent.trim()).slice(0, 3));
  const ok = /[一-龥]/.test(zh) && /MUSIC/i.test(en.music) && /[A-Za-z]/.test(en.sub || '') &&
    /[A-Za-z]/.test(en.stop || '') && names.length === 3 && names.every(n => !/[一-龥]/.test(n));
  return `${ok ? 'PASS' : 'FAIL'} 音乐「${zh}→${en.music}」副标「${en.sub}」` +
    ` 停止「${en.stop}」· 英文曲名 ${JSON.stringify(names)}`;
});

})();
