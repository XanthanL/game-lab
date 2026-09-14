/* Phase 3.2 留档截图 —— 协同扩展（22 条真实生效 + 孤儿卡补齐）
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase3-2-shots.js
 * 产出：../.workbuddy/shots/phase3/3-2-*.png
 *
 * 每张图独立浏览器实例（file:// 下 localStorage 跨 context 共享）。
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const OUT = path.join(__dirname, 'phase3');
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}

/* 6 张能力型（正好等于 ABILITY_CAP）—— 全部是本轮的「孤儿卡」组合，
   实测可同时触发 7 条协同，且 7 条全是 3.2 新增的。 */
function setupBuild() {
  return `NOVA.debug(\`(function(){
    G.build={twin:2,pierce:2,ricochet:2,frag:2,guided:2,tesla:2};
    P=newPlayer();G.player=P;G.lastHull.apply();
    for(const[id,n]of Object.entries(G.build)){
      const m=MOD_BY_ID[id];if(!m||m.max===Infinity)continue;
      for(let k=1;k<=Math.min(n,m.max);k++)m.apply(k);
    }
    recountMax();G.syn={};G.synQ=[];checkSynergies();G.synQ=[];
    return JSON.stringify({abilities:Object.keys(G.build).length,
      syn:SYN.filter(s=>G.syn[s.id]).map(s=>s.id)});
  })()\`)`;
}

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
    await p.evaluate(() => NOVA.launch(0));
    await p.waitForTimeout(500);
    note = await p.evaluate(setupBuild());
    if (body) note = await p.evaluate(body) || note;
    await p.waitForTimeout(700);
  } catch (e) { errs.push('JOB:' + e.message.slice(0, 180)); }
  await p.screenshot({ path: path.join(OUT, tag + '.png'), fullPage: false });
  await c.close(); await b.close();
  console.log(tag.padEnd(24), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}

(async () => {
  // 1) 暂停面板协同条：6 张能力卡 → 7 条协同全部激活（桌面）
  await shot('3-2-01-syn-desktop', 1280, 900, `NOVA.debug('pauseGame();"paused"')`);

  // 2) 暂停面板协同条（竖屏）
  await shot('3-2-02-syn-mobile', 390, 844, `NOVA.debug('pauseGame();"paused"')`);

  // 3) 卡面协同块：抽到 twin 时列出它参与的 3 条协同，且另一半全在构筑里（全部标亮）
  await shot('3-2-03-card-syn', 1280, 900, `NOVA.debug(\`(function(){
    openLevelUp();
    G.choices=[MOD_BY_ID.twin,MOD_BY_ID.guided,MOD_BY_ID.tesla];
    renderCards();deckify(el.cardrow);
    return JSON.stringify(el.cardrow.querySelectorAll('.synrow').length+' rows / '+
      el.cardrow.querySelectorAll('.synrow.on').length+' on');
  })()\`)`);
})();
