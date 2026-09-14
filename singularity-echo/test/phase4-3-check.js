/* Phase 4.3 验证 —— 新船体「熔炉 FORGE」（第 7 船体 · 过热膛线）
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase4-3-check.js
 * 产出：../.workbuddy/shots/phase4/4-3-*.png + 每行状态断言
 *
 * 每个断言独立浏览器实例（file:// 下 localStorage 跨 context 共享）。
 * 游戏作用域一律经 NOVA.debug 钩子（IIFE 不可见 G / P / HULLS）。
 *
 * ⚠️ 数值断言必须自带 ok 字段（4.1 曾因只写 jamT、不写 jamF/jamS 得到 ratio=1 的假绿），
 *    本脚本沿用同一条纪律：所有 PASS/FAIL 由断言体内判定，不让调用方二次解读。
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const OUT = path.join(__dirname, 'phase4');
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}

async function run(tag, vw, vh, job) {
  const b = await chromium.launch({ executablePath: EXE });
  const c = await b.newContext({
    viewport: { width: vw, height: vh }, deviceScaleFactor: 2,
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
  console.log(tag.padEnd(28), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}

const ev = (p, code) => p.evaluate(c => NOVA.debug(c), code);

(async () => {

/* ── 01 四表同步（HULL_TINT / HULL_GEO / HULL_TAIL / TRAIL_RAMP） ── */
await run('4-3-01-tables', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    const ids=HULLS.map(h=>h.id);
    const keys=n=>Object.keys(({HULL_TINT,HULL_GEO,HULL_TAIL,TRAIL_RAMP})[n]);
    const miss=n=>ids.filter(i=>!(({HULL_TINT,HULL_GEO,HULL_TAIL,TRAIL_RAMP})[n][i]!==undefined));
    const orphan=n=>keys(n).filter(k=>ids.indexOf(k)<0);
    return {ids,
      tint:keys('HULL_TINT').length, geo:keys('HULL_GEO').length,
      tail:keys('HULL_TAIL').length, ramp:keys('TRAIL_RAMP').length,
      missTint:miss('HULL_TINT'),missGeo:miss('HULL_GEO'),
      missTail:miss('HULL_TAIL'),missRamp:miss('TRAIL_RAMP'),
      orphTint:orphan('HULL_TINT'),orphGeo:orphan('HULL_GEO'),
      orphTail:orphan('HULL_TAIL'),orphRamp:orphan('TRAIL_RAMP'),
      tailEqGeo:ids.every(i=>HULL_TAIL[i]===-HULL_GEO[i].t),
      tintShape:ids.every(i=>{const t=HULL_TINT[i];
        return /^#[0-9a-f]{6}$/.test(t.fill)&&/^#[0-9a-f]{6}$/.test(t.line)&&/^\\d+,\\d+,\\d+$/.test(t.glow);}),
      ramp3:ids.every(i=>TRAIL_RAMP[i].length===3)};})())`));
  const ok = r.ids.length === 7 && r.ids[6] === 'forge' &&
    r.tint === 7 && r.geo === 7 && r.tail === 7 && r.ramp === 7 &&
    !r.missTint.length && !r.missGeo.length && !r.missTail.length && !r.missRamp.length &&
    !r.orphTint.length && !r.orphGeo.length && !r.orphTail.length && !r.orphRamp.length &&
    r.tailEqGeo && r.tintShape && r.ramp3;
  return `${ok ? 'PASS' : 'FAIL'} ids=[${r.ids}] n=${r.tint}/${r.geo}/${r.tail}/${r.ramp}` +
    ` miss=${[r.missTint, r.missGeo, r.missTail, r.missRamp].map(a => a.length)}` +
    ` orphan=${[r.orphTint, r.orphGeo, r.orphTail, r.orphRamp].map(a => a.length)}` +
    ` tail=-geo.t:${r.tailEqGeo} tintShape:${r.tintShape} ramp3:${r.ramp3}`;
});

/* ── 02 机库文案（中英双份 + 字形 + 解锁说明） ─────────────── */
await run('4-3-02-copy', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    const h=HULLS.find(x=>x.id==='forge');
    const note=typeof h.lockNote==='function'?h.lockNote():h.lockNote;
    return {g:h.g,zh:h.zh,en:h.en,descLen:h.desc.length,
      enDesc:!!HULL_EN.forge,enLock:!!HULL_LOCK_EN.forge,
      note,enNote:HULL_LOCK_EN.forge,
      descKeys:Object.keys(HULL_EN).length,lockKeys:Object.keys(HULL_LOCK_EN).length};})())`));
  const ok = !!r.g && r.zh === '熔炉' && r.en === 'Forge' && r.descLen > 20 &&
    r.enDesc && r.enLock && /40/.test(r.note) && /40/.test(r.enNote) &&
    r.descKeys === 7 && r.lockKeys === 4;
  return `${ok ? 'PASS' : 'FAIL'} ${r.g} ${r.zh}/${r.en} desc=${r.descLen}B` +
    ` en=${r.descKeys}/${r.lockKeys} note="${r.note}"`;
});

/* ── 03 解锁门禁与持久化 ──────────────────────────────────── */
await run('4-3-03-unlock', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    const before={forge:hullUnlocked('forge'),pere:hullUnlocked('peregrine'),raven:hullUnlocked('raven')};
    const added=unlockHull('forge');
    const again=unlockHull('forge'); // 重复解锁应返回 false
    return {before,added,again,after:hullUnlocked('forge'),
      stored:JSON.parse(localStorage.getItem('nova-hulls')||'[]')};})())`));
  const ok = r.before.forge === false && r.before.pere === true &&
    r.added === true && r.again === false && r.after === true &&
    r.stored.indexOf('forge') >= 0;
  return `${ok ? 'PASS' : 'FAIL'} ` + JSON.stringify(r);
});

/* ── 04 机库渲染 7 张卡（锁定 → 解锁） ─────────────────────── */
await run('4-3-04-hangar', 1280, 900, async p => {
  const locked = JSON.parse(await ev(p, `JSON.stringify((()=>{
    openHulls();
    const cards=[...el.hullrow.children];
    const f=cards[6];
    return {n:cards.length,cv:el.hullrow.querySelectorAll('.hullcv').length,
      forgeLocked:f.classList.contains('lock'),
      forgeTitle:f.querySelector('h3').textContent,
      forgeBody:f.querySelector('p').textContent.slice(0,24),
      lockedCount:cards.filter(c=>c.classList.contains('lock')).length};})())`));
  const open = JSON.parse(await ev(p, `JSON.stringify((()=>{
    unlockHull('forge');unlockHull('raven');unlockHull('nemesis');
    openHulls();
    const cards=[...el.hullrow.children],f=cards[6];
    return {n:cards.length,forgeLocked:f.classList.contains('lock'),
      lockedCount:cards.filter(c=>c.classList.contains('lock')).length,
      forgeBody:f.querySelector('p').textContent.slice(0,24)};})())`));
  const ok = locked.n === 7 && locked.cv === 7 && locked.forgeLocked === true &&
    /熔炉/.test(locked.forgeTitle) && locked.forgeBody.indexOf('肃清第 40 波') === 0 &&
    open.n === 7 && open.forgeLocked === false && open.lockedCount === 1 &&
    open.forgeBody.indexOf('过热膛线') === 0;
  return `${ok ? 'PASS' : 'FAIL'} locked=${JSON.stringify(locked)} unlocked=${JSON.stringify(open)}`;
});

/* ── 05 apply() 属性效果 ─────────────────────────────────── */
await run('4-3-05-apply', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    startGame(HULLS[0]);
    const b={fr:P.fireRate,bs:P.bspd,hp:P.maxHp,on:P.heatOn};
    startGame(HULLS[6]);
    const f={fr:P.fireRate,bs:P.bspd,hp:P.maxHp,on:P.heatOn};
    return {base:b,forge:f,
      rFr:+(f.fr/b.fr).toFixed(3),rBs:+(f.bs/b.bs).toFixed(3),rHp:+(f.hp/b.hp).toFixed(3),
      hpFull:P.hp===P.maxHp};})())`));
  const ok = r.forge.on === true && r.base.on === false &&
    Math.abs(r.rFr - 1.10) < 0.001 && Math.abs(r.rBs - 1.12) < 0.001 &&
    Math.abs(r.rHp - 0.92) < 0.006 && r.hpFull;
  return `${ok ? 'PASS' : 'FAIL'} fr×${r.rFr} bspd×${r.rBs} hp×${r.rHp}` +
    ` heatOn=${r.forge.on}/${r.base.on} hpFull=${r.hpFull}`;
});

/* ── 06 蓄热速率与射速解耦 ───────────────────────────────── */
await run('4-3-06-heat-rate', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    startGame(HULLS[6]);G.mode='play';
    G.asteroids.length=0;G.enemies.length=0;G.bullets.length=0;
    const one=()=>{P.heat=0;P.heatLock=0;mouse.down=true;
      for(let i=0;i<60;i++)updatePlayer(1/60);
      mouse.down=false;return +P.heat.toFixed(1);};
    const slow=one();
    P.fireRate*=3;const fast=one();
    return {slow,fast,up:HEAT_UP,ok:Math.abs(slow-HEAT_UP)<0.6&&Math.abs(fast-HEAT_UP)<0.6};})())`));
  const ok = r.ok && r.slow > 25 && r.slow < 35 && Math.abs(r.slow - r.fast) < 0.6;
  return `${ok ? 'PASS' : 'FAIL'} 1s蓄热 slow=${r.slow} 射速×3后=${r.fast} HEAT_UP=${r.up}`;
});

/* ── 07 满膛锁膛 → 强制散热 → 解锁归零 ───────────────────── */
await run('4-3-07-lock', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    startGame(HULLS[6]);G.mode='play';
    G.asteroids.length=0;G.enemies.length=0;
    P.heat=0;P.heatLock=0;mouse.down=true;
    let i=0;for(;i<600&&P.heatLock<=0;i++)updatePlayer(1/60);
    const rampSec=+(i/60).toFixed(2),atLock=+P.heat.toFixed(1),lock=P.heatLock;
    // 锁膛期间按住开火也不该出弹
    G.bullets.length=0;
    for(let k=0;k<30;k++)updatePlayer(1/60);
    const shotsLocked=G.bullets.length,heatMid=+P.heat.toFixed(1);
    let j=0;for(;j<600&&P.heatLock>0;j++)updatePlayer(1/60);
    const ventSec=+(j/60).toFixed(2),heatEnd=+P.heat.toFixed(2);
    mouse.down=false;
    return {rampSec,atLock,lock:+lock.toFixed(2),shotsLocked,heatMid,ventSec,heatEnd,
      ok:atLock>=99.9&&lock>1.6&&shotsLocked===0&&heatMid<atLock&&heatEnd===0};})())`));
  // ventSec 只统计「探测完 0.5s 之后」的剩余锁膛：1.7 - 0.5 = 1.2s
  const ok = r.ok && Math.abs(r.rampSec - 3.33) < 0.15 && Math.abs(r.ventSec - 1.20) < 0.15;
  return `${ok ? 'PASS' : 'FAIL'} 蓄满 ${r.rampSec}s→heat ${r.atLock} 锁 ${r.lock}s` +
    ` 锁膛内弹数=${r.shotsLocked} 中途heat=${r.heatMid} 排空 ${r.ventSec}s→${r.heatEnd}`;
});

/* ── 08 伤害倍率：冷膛 0.85× / 满膛 1.45×（含背射） ───────── */
await run('4-3-08-dmg', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    startGame(HULLS[6]);G.mode='play';
    G.asteroids.length=0;G.enemies.length=0;G.bullets.length=0;
    // P.backMax 必须置 true：back 标记写作 back:P.backMax||undefined，为 false 时背射弹
    // 与普通弹在 !b.back 下无法区分（.pop() 会拿到背射弹 —— 曾据此算出 0.2559 的假偏差）
    P.backshot=1;P.backMax=true;P.barrels=1;
    // 关键：必须在「同一帧」里先刷新 heatMul 再开火 —— 断言读的是当帧倍率，
    // 而不是外部手工 set 的 heat（set 之后热量会被散热/蓄热改写，见 4.1 的假绿教训）
    const shot=heat=>{P.heat=heat;P.heatLock=0;G.bullets.length=0;P.fireCd=0;
      mouse.down=true;updatePlayer(1/60);mouse.down=false;
      const main=G.bullets.filter(b=>!b.back).pop(),back=G.bullets.filter(b=>b.back).pop();
      return {mul:+P.heatMul.toFixed(4),
        dmg:main?+main.dmg.toFixed(4):null,
        back:back?+back.dmg.toFixed(4):null,
        lock:+P.heatLock.toFixed(2)};};
    const cold=shot(0),hot=shot(HEAT_MAX-0.001);
    const dmg=P.dmg,backPow=P.backPow;
    return {cold,hot,base:+dmg.toFixed(3),backPow,
      dCold:Math.abs(cold.dmg-dmg*cold.mul),dHot:Math.abs(hot.dmg-dmg*hot.mul),
      dBack:Math.abs(cold.back-dmg*backPow*cold.mul),
      ok:Math.abs(cold.mul-HEAT_COLD)<0.01&&Math.abs(hot.mul-HEAT_HOT)<1e-6&&
         Math.abs(cold.dmg-dmg*cold.mul)<1e-9&&Math.abs(hot.dmg-dmg*hot.mul)<1e-9&&
         Math.abs(cold.back-dmg*backPow*cold.mul)<1e-9&&hot.lock>1.6,
      COLD:HEAT_COLD,HOT:HEAT_HOT};})())`));
  const ok = r.ok;
  return `${ok ? 'PASS' : 'FAIL'} mul ${r.cold.mul}→${r.hot.mul}（锁 ${r.hot.lock}s）` +
    ` 主弹偏差 ${r.dCold}/${r.dHot} 背射偏差 ${r.dBack} base=${r.base} backPow=${r.backPow}`;
});

/* ── 09 非熔炉船体完全不受影响 ───────────────────────────── */
await run('4-3-09-other-hulls', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    const out={};
    for(const idx of [0,1,2,3,4,5]){
      startGame(HULLS[idx]);G.mode='play';
      G.asteroids.length=0;G.enemies.length=0;G.bullets.length=0;
      mouse.down=true;
      for(let i=0;i<90;i++)updatePlayer(1/60);
      mouse.down=false;
      G.bullets.length=0;P.fireCd=0;mouse.down=true;updatePlayer(1/60);mouse.down=false;
      const b=G.bullets[G.bullets.length-1];
      out[HULLS[idx].id]={on:P.heatOn,heat:+P.heat.toFixed(3),mul:+P.heatMul.toFixed(3),
        lock:P.heatLock,dmgEq:!!b&&Math.abs(b.dmg-P.dmg)<1e-9};
    }
    return out;})())`));
  const bad = Object.keys(r).filter(k => r[k].on || r[k].heat !== 0 ||
    r[k].mul !== 1 || r[k].lock !== 0 || !r[k].dmgEq);
  return `${bad.length ? 'FAIL' : 'PASS'} n=${Object.keys(r).length} bad=[${bad}] ` +
    Object.keys(r).map(k => `${k}:${r[k].mul}`).join(' ');
});

/* ── 10 HUD 过热槽：显隐 / 宽度 / 锁膛态 ─────────────────── */
await run('4-3-10-hud', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    startGame(HULLS[0]);G.mode='play';updateHUD();
    const pere={hidden:el.heatrow.hidden};
    startGame(HULLS[6]);G.mode='play';updateHUD();
    const shown=!el.heatrow.hidden;
    P.heat=50;P.heatLock=0;updateHUD();const w50=el.heatbar.style.width;
    P.heat=100;P.heatLock=0;updateHUD();const w100=el.heatbar.style.width;
    P.heatLock=1.2;updateHUD();const lockCls=el.heatrow.classList.contains('lock');
    P.heatLock=0;P.heat=0;updateHUD();
    const unlockCls=el.heatrow.classList.contains('lock'),w0=el.heatbar.style.width;
    return {pere,shown,w50,w100,lockCls,unlockCls,w0,
      ok:pere.hidden===true&&shown&&parseFloat(w50)===50&&parseFloat(w100)===100&&
         lockCls&&!unlockCls&&parseFloat(w0)===0};})())`));
  const ok = r.ok;
  return `${ok ? 'PASS' : 'FAIL'} 游隼隐藏=${r.pere.hidden} 熔炉显示=${r.shown}` +
    ` 50%→${r.w50} 100%→${r.w100} 锁膛class=${r.lockCls}/${r.unlockCls} 归零→${r.w0}`;
});

/* ── 11 击碎坍缩之核 → 解锁熔炉（真实击杀路径） ───────────── */
await run('4-3-11-w40', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    startGame(HULLS[0]);G.mode='play';
    G.asteroids.length=0;G.ebullets.length=0;
    const before=hullUnlocked('forge');
    const a=spawnAst(4,P.x+420,P.y,'collapse');
    a.stage=1;a.invT=0;
    hurtAst(a,1e9,P.x,P.y,false);
    return {kind:a.bossKind,before,after:hullUnlocked('forge'),
      stored:JSON.parse(localStorage.getItem('nova-hulls')||'[]'),
      left:G.asteroids.length};})())`));
  const ok = r.before === false && r.after === true &&
    r.stored.indexOf('forge') >= 0;
  return `${ok ? 'PASS' : 'FAIL'} ${r.kind} unlock ${r.before}→${r.after} stored=[${r.stored}]`;
});

/* ── 12 hullPath 新形状可绘制且与既有船体不同 ─────────────── */
await run('4-3-12-shape', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    const px=id=>{
      const c=document.createElement('canvas');c.width=120;c.height=120;
      const g=c.getContext('2d');
      g.translate(60,60);g.rotate(-Math.PI/2);g.scale(2,2);
      drawHullBody(g,id,1);
      const d=g.getImageData(0,0,120,120).data;let n=0;
      for(let i=3;i<d.length;i+=4)if(d[i]>8)n++;
      return n;};
    const forge=px('forge');
    return {forge,others:HULLS.filter(h=>h.id!=='forge').map(h=>[h.id,px(h.id)]),
      ok:forge>600&&HULLS.filter(h=>h.id!=='forge').every(h=>px(h.id)!==forge)};})())`));
  const ok = r.ok;
  return `${ok ? 'PASS' : 'FAIL'} forge=${r.forge}px others=${JSON.stringify(r.others)}`;
});

/* ── 13 图鉴 / 成就联动（7 格 · 全舰制霸 7） ──────────────── */
await run('4-3-13-logbook', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    unlockHull('forge');openLogbook();
    const chips=[...el.lbHulls.children].map(c=>c.textContent.trim());
    const a6=ACH.find(a=>a.id==='hull6');
    return {chips,achGoal:a6.goal(),achZh:a6.d,achEn:a6.de,
      ok:chips.length===7&&/熔炉/.test(chips[6])&&a6.goal()===7&&/7 /.test(a6.d)&&/7 hulls/.test(a6.de)};})())`));
  const ok = r.ok;
  return `${ok ? 'PASS' : 'FAIL'} chips=${r.chips.length} [${r.chips.join('|')}]` +
    ` hull6 goal=${r.achGoal} "${r.achZh}" / "${r.achEn}"`;
});

/* ── 14 全规模回归 ───────────────────────────────────────── */
await run('4-3-14-regress', 1280, 900, async p => {
  const c = await p.evaluate(() => NOVA.counts());
  const m = JSON.parse(await ev(p, `JSON.stringify({meta:META.length})`));
  const r = Object.assign({}, c, m);
  const ok = r.mods === 29 && r.syn === 26 && r.enemies === 24 && r.bosses === 8 &&
    r.hulls === 7 && r.affix === 3 && r.ach === 18 && r.meta === 13;
  return `${ok ? 'PASS' : 'FAIL'} ` + JSON.stringify(r);
});

/* ── 15 英文机库 ─────────────────────────────────────────── */
await run('4-3-15-en', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    NOVA.death.lang('en');
    openHulls();
    const cards=[...el.hullrow.children];
    const lockedEn=cards[6].querySelector('p').textContent;
    unlockHull('forge');openHulls();
    const openEn=[...el.hullrow.children][6].querySelector('p').textContent;
    NOVA.death.lang('zh');
    return {lockedEn,openEn,
      ok:/Clear wave 40/.test(lockedEn)&&/Overheat rifling/.test(openEn)};})())`));
  const ok = r.ok;
  return `${ok ? 'PASS' : 'FAIL'} lock="${r.lockedEn.slice(0, 46)}…" desc="${r.openEn.slice(0, 46)}…"`;
});

/* ── 16 实机：熔炉出战 + 过热槽在 HUD 上 ─────────────────── */
await run('4-3-16-live', 1280, 800, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    unlockHull('forge');
    openHulls();
    [...el.hullrow.children][6].click();
    G.mode='play';
    G.asteroids.length=0;G.enemies.length=0;
    P.heat=62;P.heatLock=0;
    return {hull:G.lastHull.id,on:P.heatOn,mul:+P.heatMul.toFixed(3)};})())`));
  await p.waitForTimeout(900);
  const hud = JSON.parse(await ev(p, `JSON.stringify((()=>({
    hidden:el.heatrow.hidden,w:el.heatbar.style.width,
    lock:el.heatrow.classList.contains('lock'),mode:G.mode,hull:G.lastHull.id}))())`));
  const ok = r.hull === 'forge' && r.on === true && hud.hidden === false && hud.hull === 'forge';
  return `${ok ? 'PASS' : 'FAIL'} live ${JSON.stringify(r)} hud=${JSON.stringify(hud)}`;
});

})();
