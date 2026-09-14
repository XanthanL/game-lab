/* Phase 7.4 · 冲刺赛模式边界 —— 断言脚本
 * 三个真问题（探针 probe74.js 实测）：
 *   A. G.taMode 只有置真没有复位 → 打完一局 TA 后所有普通局都变 3 分钟限时
 *   B. TA 局的自动存档会冲掉玩家正在打的普通局存档（WAVE 11 → 2）
 *   C. 机库界面照旧显示玩家存下的配置，实际生效的是 standard/无/无，影子指纹也对不上
 */
const { chromium } = require('playwright-core');
const CHROME = require('./_browser').exe();
const BASE = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
let fail = 0, pass = 0;
const ok = (n, c, d = '') => { if (c) pass++; else fail++; console.log((c ? 'ok  PASS ' : 'FAIL     ') + n + (d ? '  ' + d : '')); };
const err = (n, e) => { fail++; console.log('ERR      ' + n + '  ' + e.message); };
const ev = async (p, code) => JSON.parse(await p.evaluate(c => NOVA.debug(c), code));

async function open(b, vp) {
  const p = await (await b.newContext({ viewport: vp || { width: 1280, height: 900 } })).newPage();
  p.on('pageerror', e => console.log('  PAGEERROR', e.message));
  await p.goto(BASE);
  await p.waitForFunction(() => window.NOVA && window.NOVA.ta, null, { timeout: 25000 });
  await p.waitForFunction(() => { const el = document.getElementById('boot'); return !!el && el.hidden; },
    null, { timeout: 25000 }).catch(() => { });
  return p;
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });

  /* 01 A：回主菜单即退出冲刺 */
  try {
    const p = await open(b);
    const r = await ev(p, `(()=>{
      NOVA.ta.start();var on=!!G.taMode;
      toMenu();var off=!!G.taMode;
      return JSON.stringify({on:on,off:off});})()`);
    ok('7-4-01-tomenu', r.on === true && r.off === false, `TA 中 ${r.on} → 回标题后 ${r.off}`);
    await p.close();
  } catch (e) { err('7-4-01-tomenu', e); }

  /* 02 A（核心）：打完 TA 回菜单后，普通漂移不再是限时赛 */
  try {
    const p = await open(b);
    const r = await ev(p, `(()=>{
      NOVA.ta.start();G.score=100;Wv.n=9;die();NOVA.death.finish();
      var taRank=el.overRank.textContent;
      toMenu();startGame(HULLS[0]);          /* 什么都不点，直接开一局普通漂移 */
      return JSON.stringify({taRank:taRank,taMode:!!G.taMode,diff:G.diff,hud:el.tatime.hidden});})()`);
    ok('7-4-02-normal', r.taMode === false && r.hud === true && /TIME ATTACK/.test(r.taRank),
      `TA 榜「${r.taRank}」→ 回菜单 → 普通局 taMode=${r.taMode} · HUD 倒计时隐藏=${r.hud}`);
    await p.close();
  } catch (e) { err('7-4-02-normal', e); }

  /* 03 A：普通局的分数回到 nova-best（不再被 TA 分流吃掉） */
  try {
    const p = await open(b);
    const r = await ev(p, `(()=>{
      NOVA.ta.start();G.score=100;Wv.n=9;die();NOVA.death.finish();
      var taBest=G.best;
      toMenu();startGame(HULLS[0]);
      G.score=88888;Wv.n=15;G.runT=60;die();NOVA.death.finish();
      return JSON.stringify({taBest:taBest,after:G.best,rank:el.overRank.textContent});})()`);
    ok('7-4-03-best', r.after === 88888 && !/TIME ATTACK/.test(r.rank),
      `TA 局后 best=${r.taBest}（未变）→ 普通局 best=${r.after}（已写）· 榜「${r.rank}」`);
    await p.close();
  } catch (e) { err('7-4-03-best', e); }

  /* 04 A：续档一律按普通漂移恢复 */
  try {
    const p = await open(b);
    const r = await ev(p, `(()=>{
      NOVA.ta.mode(false);startGame(HULLS[0]);
      G.mode='play';Wv.n=8;G.score=4000;G.runT=120;saveRun();
      NOVA.ta.start();G.score=10;Wv.n=2;die();NOVA.death.finish();
      toMenu();
      var has=!!loadSave();
      resumeRun();
      return JSON.stringify({has:has,taMode:!!G.taMode,mode:G.mode});})()`);
    ok('7-4-04-resume', r.taMode === false && (r.has === false || r.mode === 'play'),
      `续档：taMode=${r.taMode}（普通漂移）· mode=${r.mode}`);
    await p.close();
  } catch (e) { err('7-4-04-resume', e); }

  /* 05 B：TA 局不写续档存档，普通局照写，切回普通又写 */
  try {
    const p = await open(b);
    const r = await ev(p, `(()=>{
      NOVA.ta.mode(false);startGame(HULLS[0]);
      G.mode='play';Wv.n=11;G.score=5000;G.runT=150;saveRun();
      var w1=loadSave()?loadSave().w:0;
      clearSave();
      G.taMode=true;                     /* 同一局切成 TA（不能用 ta.start：startGame 自己会清档） */
      G.mode='play';Wv.n=2;G.score=10;G.runT=20;saveRun();
      var w2=loadSave()?loadSave().w:0;
      clearSave();
      G.taMode=false;
      G.mode='play';Wv.n=7;G.score=700;G.runT=70;saveRun();
      var w3=loadSave()?loadSave().w:0;
      return JSON.stringify({w1:w1,w2:w2,w3:w3});})()`);
    ok('7-4-05-save', r.w1 === 11 && r.w2 === 0 && r.w3 === 7,
      `普通局 WAVE ${r.w1}（有）· TA 局 ${r.w2}（不写）· 切回普通 WAVE ${r.w3}（有）`);
    await p.close();
  } catch (e) { err('7-4-05-save', e); }

  /* 06 C：机库在 TA 模式下如实标注冻结 */
  try {
    const p = await open(b);
    const r = await ev(p, `(()=>{
      NOVA.ta.mode(false);
      G_DIFF='abyss';G_RMODS=['swarm','brittle'];G_BAN=['crit','magnet'];
      openHulls();
      var off={fz:el.diffRow.classList.contains('tafreeze'),notice:el.taNotice.hidden};
      NOVA.ta.mode(true);openHulls();
      var on={fz:el.diffRow.classList.contains('tafreeze')
                &&el.rmodRow.classList.contains('tafreeze')
                &&el.poolRow.classList.contains('tafreeze'),
              notice:el.taNotice.hidden,txt:el.taNotice.textContent};
      return JSON.stringify({off:off,on:on});})()`);
    ok('7-4-06-freezeui', r.off.fz === false && r.off.notice === true
      && r.on.fz === true && r.on.notice === false && /3/.test(r.on.txt),
      `非 TA：三行可点+说明隐藏 · TA：三行冻结=${r.on.fz} · 说明「${r.on.txt}」`);
    await p.close();
  } catch (e) { err('7-4-06-freezeui', e); }

  /* 07 C：机库取的影子指纹 == 开局后真正用的指纹 */
  try {
    const p = await open(b);
    const r = await ev(p, `(()=>{
      NOVA.ta.mode(false);
      G_DIFF='abyss';G_RMODS=['swarm','brittle'];G_BAN=['crit','magnet'];
      openHulls();var fpNormal=ghostFpMenu();
      NOVA.ta.mode(true);openHulls();var fpTa=ghostFpMenu();
      startGame(HULLS[0]);var fpReal=ghostFp();
      return JSON.stringify({fpNormal:fpNormal,fpTa:fpTa,fpReal:fpReal});})()`);
    ok('7-4-07-fp', r.fpTa === r.fpReal && r.fpTa === 'standard|-|-' && r.fpNormal !== r.fpTa,
      `普通「${r.fpNormal}」· TA「${r.fpTa}」· 开局实际「${r.fpReal}」`);
    await p.close();
  } catch (e) { err('7-4-07-fp', e); }

  /* 08 中英：说明行双语 */
  try {
    const p = await open(b);
    const r = await ev(p, `(()=>{
      NOVA.ta.mode(true);LANG='zh';openHulls();var zh=el.taNotice.textContent;
      LANG='en';openHulls();var en=el.taNotice.textContent;
      LANG='zh';return JSON.stringify({zh:zh,en:en});})()`);
    ok('7-4-08-i18n', /限时冲刺/.test(r.zh) && /TIME ATTACK/.test(r.en),
      `「${r.zh}」/「${r.en}」`);
    await p.close();
  } catch (e) { err('7-4-08-i18n', e); }

  /* 09 回归：TA 本身没被这些复位搞坏（还能正常开局 + 结算进 TA 榜） */
  try {
    const p = await open(b);
    const r = await ev(p, `(()=>{
      NOVA.ta.clear();
      NOVA.ta.start();
      var started={taMode:!!G.taMode,taT:Math.round(G.taT),diff:G.diff};
      G.score=100;Wv.n=6;die();NOVA.death.finish();
      return JSON.stringify({started:started,rank:el.overRank.textContent,
        board:NOVA.ta.board().length});})()`);
    ok('7-4-09-tastill', r.started.taMode === true && r.started.taT === 180
      && r.started.diff === 'standard' && /TIME ATTACK/.test(r.rank) && r.board === 1,
      `TA 仍正常：倒计时 ${r.started.taT}s · standard · 「${r.rank}」· 榜 ${r.board} 条`);
    await p.close();
  } catch (e) { err('7-4-09-tastill', e); }

  /* 10 竖屏 390px：说明行不撑破 */
  try {
    const p = await open(b, { width: 390, height: 844 });
    const r = await ev(p, `(()=>{
      NOVA.ta.mode(true);openHulls();
      return JSON.stringify({sw:document.documentElement.scrollWidth,
        cw:document.documentElement.clientWidth,vis:!el.taNotice.hidden,
        txt:el.taNotice.textContent.length});})()`);
    ok('7-4-10-mobile', r.sw <= r.cw + 1 && r.vis === true && r.txt > 10,
      `390px：scrollW ${r.sw} ≤ clientW ${r.cw} · 说明行可见（${r.txt} 字）`);
    await p.close();
  } catch (e) { err('7-4-10-mobile', e); }

  /* 11 7.4b：ESC 离开机库也要复位（这条路径绕过了 toMenu） */
  try {
    const p = await open(b);
    const r = await ev(p, `(()=>{
      $('btnTime').click();                       /* 点 TIME 进机库 */
      var inTa=!!G.taMode,inMode=G.mode;
      document.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',bubbles:true}));
      var after={mode:G.mode,taMode:!!G.taMode,menu:!el.menu.hidden};
      startGame(HULLS[0]);
      return JSON.stringify({inTa:inTa,inMode:inMode,after:after,
        run:{taMode:!!G.taMode,taT:Math.round(G.taT)}});})()`);
    ok('7-4-11-esc', r.inTa === true && r.inMode === 'hulls'
      && r.after.mode === 'menu' && r.after.menu === true && r.after.taMode === false
      && r.run.taMode === false && r.run.taT === 0,
      `ESC 出机库：${r.inMode} → ${r.after.mode} · taMode ${r.inTa}→${r.after.taMode} · 之后开一局 taT=${r.run.taT}s`);
    await p.close();
  } catch (e) { err('7-4-11-esc', e); }

  /* 12 7.4b：手柄 B（padBack）同样走 closeHulls */
  try {
    const p = await open(b);
    const r = await ev(p, `(()=>{
      $('btnTime').click();
      var inTa=!!G.taMode;
      padBack();
      var after={mode:G.mode,taMode:!!G.taMode};
      startGame(HULLS[0]);
      return JSON.stringify({inTa:inTa,after:after,run:{taMode:!!G.taMode,taT:Math.round(G.taT)}});})()`);
    ok('7-4-12-padback', r.inTa === true && r.after.mode === 'menu' && r.after.taMode === false
      && r.run.taMode === false && r.run.taT === 0,
      `padBack 出机库：taMode ${r.inTa}→${r.after.taMode} · 之后开一局 taT=${r.run.taT}s`);
    await p.close();
  } catch (e) { err('7-4-12-padback', e); }

  console.log('\n7.4 冲刺赛模式边界：' + pass + ' PASS / ' + fail + ' FAIL');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
