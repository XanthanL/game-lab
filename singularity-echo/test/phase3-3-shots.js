/* Phase 3.3 留档截图 —— 每日挑战（菜单 / 死亡面板含徽章 / 移动端）
 * 用法：cd singularity-echo && NODE_PATH=... node ../.workbuddy/shots/phase3-3-shots.js
 * 产出：../.workbuddy/shots/phase3/3-3-*.png（已由 phase3-3-check.js 产生 12 张断言图）
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
  try {
    if (body) note = await p.evaluate(body) || '';
    await p.waitForTimeout(700);
  } catch (e) { errs.push('JOB:' + e.message.slice(0, 180)); }
  await p.screenshot({ path: path.join(OUT, tag + '.png'), fullPage: false });
  await c.close(); await b.close();
  console.log(tag.padEnd(28), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}

const D = [1280, 900], M = [390, 844];

(async () => {
  // 1) 菜单桌面：btnDaily 高亮 + menuDaily 面板（今日规则 + 历史最佳 12,580）
  await shot('3-3-01-menu', ...D, `NOVA.dailyStore.save({'2026-09-11':{score:12580,wave:8,kills:120,rules:['startLoader','swiftStar']}});
    NOVA.daily.render();
    document.getElementById('menu').hidden=false;
    'menu'`);

  // 2) 死亡面板（含 daily 徽章 + 规则名）：开一局 daily → 立即 kill → showOver
  await shot('3-3-02-over-daily', ...D, `NOVA.debug(\`(function(){
    startDaily(HULLS[0]);
    G.score=9999;Wv.n=12;G.kills=200;
    P.hp=0; die();
    setTimeout(()=>{
      snapshotCause(); showOver();
    }, 60);
  })()\`);
    'daily-killed'`);

  // 3) 移动端：菜单 + daily 面板布局
  await shot('3-3-03-mobile', ...M, `NOVA.dailyStore.save({'2026-09-11':{score:4321,wave:5,kills:80,rules:['startAegis','noRepair']}});
    NOVA.daily.render();
    document.getElementById('menu').hidden=false;
    'mobile-menu'`);
})();