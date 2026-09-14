/* Phase 5.4 留档截图 —— 性能：同一份压力场景在三个档位下的样子
 *
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase5-4-shots.js
 *
 * ⚠️ 三张对局图必须是**同一份**场景（bench.stress 钉死生成量）才有可比性；
 *    否则「低画质更省」和「这一波恰好更空」就分不开了。
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const OUT = path.join(__dirname, 'phase5');
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}

const D = [1440, 900], M = [390, 844];
const T = { parts: 420, debris: 90, ghosts: 16, bolts: 18, texts: 26 };

async function shot(tag, vw, vh, job) {
  const b = await chromium.launch({ executablePath: EXE });
  const c = await b.newContext({
    viewport: { width: vw, height: vh }, deviceScaleFactor: 2,
    hasTouch: vw < 700, isMobile: vw < 700,
  });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await p.goto(GAME, { waitUntil: 'load' });
  await p.waitForFunction(() => { const b = document.getElementById('boot'); return !b || b.classList.contains('out'); },
    null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(1200);
  let note = '';
  try { note = (await job(p)) || ''; } catch (e) { errs.push('JOB:' + e.message.slice(0, 160)); }
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(OUT, tag + '.png') });
  await c.close(); await b.close();
  console.log(tag.padEnd(26), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}
const ev = (p, code) => p.evaluate(c => NOVA.debug(c), code);
const evj = async (p, code) => JSON.parse(await ev(p, 'JSON.stringify(' + code + ')'));

/* 同一份压力场景，切到指定档位后冻住主循环再截图（不冻的话画面会一直变） */
async function scene(p, q) {
  await ev(p, `(function(){NOVA.bench.hold(true);NOVA.opts.set('quality','${q}');return 1;})()`);
  await evj(p, `NOVA.bench.stress(60,120,${JSON.stringify(T)})`);
  await evj(p, `NOVA.bench.fill(${JSON.stringify(T)})`);
  const c = await evj(p, `NOVA.bench.counts()`);
  const b = await evj(p, `NOVA.perf().budget`);
  await ev(p, `draw()`);
  return `粒子${c.parts}/${b.parts} 残骸${c.debris}/${b.debris} 敌${c.enemies}`;
}

(async () => {

await shot('5-4-s1-high', ...D, p => scene(p, 'high'));
await shot('5-4-s2-mid', ...D, p => scene(p, 'mid'));
await shot('5-4-s3-low', ...D, p => scene(p, 'low'));

/* 桌面 · 设置面板「显示与性能」段 —— 档位与预算的入口 */
await shot('5-4-s4-settings', ...D, async p => {
  await ev(p, `(function(){toMenu();openSettings();NOVA.opts.ui();return 1;})()`);
  return await ev(p, `'画质档 '+document.querySelectorAll('#optQuality .segb').length`
    + `+' · 特效开关 '+document.querySelectorAll('#optFx .tog').length`
    + `+' · 当前预算 parts='+NOVA.perf().budget.parts`);
});

/* 竖屏 · 低画质同场景 */
await shot('5-4-s5-mobile-low', ...M, async p => {
  const s = await scene(p, 'low');
  return s + ' · 文档宽 ' + await ev(p, `document.documentElement.scrollWidth`);
});

})();
