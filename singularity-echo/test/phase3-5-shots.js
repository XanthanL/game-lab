/* Phase 3.5 留档截图 —— 局外解锁树（解锁星图 / UNLOCKS）
 * 用法：cd singularity-echo && NODE_PATH=... node ../.workbuddy/shots/phase3-5-shots.js
 * 产出：../.workbuddy/shots/phase3/3-5-shot-*.png
 *
 * 三张：① 桌面·初始档（0 星尘，全锁）② 桌面·中期档（已解锁 6 节点）
 *       ③ 竖屏 390×844 适配
 * 注意：必须先 NOVA.logbook.open() 再 draw/fit —— 面板 hidden 时量到 0 尺寸，
 *       fitMeta 会退化成 1，最右一列被裁在框外。
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const OUT = path.join(__dirname, 'phase3');
fs.mkdirSync(OUT, { recursive: true });

async function shot(tag, vw, vh, body) {
  const b = await chromium.launch({ executablePath: EXE });
  const c = await b.newContext({
    viewport: { width: vw, height: vh }, deviceScaleFactor: 2,
    hasTouch: vw < 700, isMobile: vw < 700,
  });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.goto(GAME, { waitUntil: 'load' });
  await p.waitForTimeout(1400);
  let note = '';
  try { note = (await p.evaluate(body)) || ''; } catch (e) { errs.push('JOB:' + e.message.slice(0, 180)); }
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(OUT, tag + '.png'), fullPage: false });
  await c.close(); await b.close();
  console.log(tag.padEnd(28), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}

/* 打开日志 → 滚到「解锁星图」→ 重绘 + 适配。unlocked 为空数组时只解锁 mroot。 */
const OPEN = (dust, unlocked) => `(function(){
  NOVA.meta.reset();
  NOVA.meta.grant(${dust});
  ${JSON.stringify(unlocked)}.forEach(function(id){ NOVA.meta.unlock(id); });
  NOVA.logbook.open();
  NOVA.meta.draw();
  NOVA.meta.fit();
  var h = document.querySelector('[data-node-id="lbsec7"]');
  if (h && h.scrollIntoView) h.scrollIntoView({block:'center'});
  var d = document.getElementById('mDust');
  return (d ? d.textContent.trim() : '?') + ' | unlocked=' + NOVA.meta.state().unlocked.length;
})()`;

const D = [1280, 900], M = [390, 844];

(async () => {
  // ① 桌面 · 初始档：0 星尘，13 节点里只有根节点是 done，4 个一级节点 ready
  await shot('3-5-shot-01-locked', ...D, OPEN(0, []));

  // ② 桌面 · 中期档：解锁一条完整生存线 + 火力线前两级，能看出 done/ready/locked 三态并存
  await shot('3-5-shot-02-progress', ...D, OPEN(320, ['hp1', 'hp2', 'sh1', 'dmg1', 'spd1', 'lv1']));

  // ③ 竖屏：解锁树按 0.34 下限缩放后仍完整落在面板内
  await shot('3-5-shot-03-mobile', ...M, OPEN(320, ['hp1', 'hp2', 'dmg1', 'spd1', 'lv1']));
})();
