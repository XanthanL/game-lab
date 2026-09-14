/* Phase 4.2 验证 —— 新巨像：静默方碑 MONOLITH(W35) + 坍缩之核 COLLAPSE(W40)
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase4-2-check.js
 * 产出：../.workbuddy/shots/phase4/4-2-*.png + 每行状态断言
 *
 * 每个断言独立浏览器实例（file:// 下 localStorage 跨 context 共享）。
 * 游戏作用域一律经 NOVA.debug / NOVA.boss.* 钩子（IIFE 不可见 G / BOSS_AT / P）。
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

/* ── 01 五表同步 ─────────────────────────────────────────── */
await run('4-2-01-tables', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    const kinds=Object.keys(BOSS_MV), atV=Object.values(BOSS_AT);
    return {n:kinds.length,kinds,
      atOrphan:atV.filter(k=>kinds.indexOf(k)<0),
      missName:kinds.filter(x=>!BOSS_NAME[x]),
      missZh:kinds.filter(x=>!BOSS_ZH[x]),
      missStyle:kinds.filter(x=>!BOSS_STYLE[x]),
      waves:Object.keys(BOSS_AT).map(Number),winWave:WIN_WAVE};})())`));
  const endless = r.waves.filter(w => w > r.winWave);
  const ok = r.n === 8 && !r.atOrphan.length && !r.missName.length &&
    !r.missZh.length && !r.missStyle.length &&
    JSON.stringify(endless) === '[35,40]';
  return `${ok ? 'PASS' : 'FAIL'} n=${r.n} orphan=[${r.atOrphan}] missName=[${r.missName}]` +
    ` missZh=[${r.missZh}] missStyle=[${r.missStyle}] waves=[${r.waves}] endless=[${endless}]`;
});

/* ── 02 剧本 Boss 优先于无尽随机 ─────────────────────────── */
await run('4-2-02-scripted', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    if(!P)startGame(HULLS[0]);G.mode='play';
    const out={};
    for(const n of [5,30,35,40,45]){
      G.asteroids.length=0;G.enemies.length=0;buildWave(n);
      out[n]={boss:Wv.boss,kind:Wv.bossKind};
    }
    return out;})())`));
  const ok = r[5].kind === 'rock' && r[30].kind === 'nemesis' &&
    r[35].kind === 'monolith' && r[40].kind === 'collapse' && r[45].boss === true;
  return `${ok ? 'PASS' : 'FAIL'} ` + JSON.stringify(r);
});

/* ── 03 生成与新字段初始化 ───────────────────────────────── */
await run('4-2-03-spawn', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    if(!P)startGame(HULLS[0]);G.mode='play';NOVA.boss.clear();
    const m=spawnAst(4,WORLD.w*0.5,WORLD.h*0.5,'monolith');
    const c=spawnAst(4,WORLD.w*0.5+360,WORLD.h*0.5,'collapse');
    return {m:{kind:m.bossKind,boss:m.boss,fieldR:m.fieldR,fieldOn:m.fieldOn,
               fieldT:+m.fieldT.toFixed(2),hp:Math.round(m.hp)},
            c:{kind:c.bossKind,boss:c.boss,flipT:c.flipT,disk:!!c.disk,
               hp:Math.round(c.hp)},
            monoOn:MONO_ON,monoOff:MONO_OFF,monoR:MONO_R};})())`));
  const ok = r.m.kind === 'monolith' && r.m.boss && r.m.fieldR === 300 &&
    r.m.fieldOn === true && r.m.fieldT === 4.2 &&
    r.c.kind === 'collapse' && r.c.flipT === 0;
  return `${ok ? 'PASS' : 'FAIL'} ` + JSON.stringify(r);
});

/* ── 04 干扰场开合节律 ───────────────────────────────────── */
await run('4-2-04-mono-cycle', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    if(!P)startGame(HULLS[0]);G.mode='play';NOVA.boss.clear();
    const a=spawnAst(4,WORLD.w*0.5,WORLD.h*0.5,'monolith');
    a.hp=a.maxHp=1e7;const seq=[];
    for(let i=0;i<6;i++){
      const was=a.fieldOn;let g=0;
      while(a.fieldOn===was&&g<1500){updateAsts(1/60);g++;}
      seq.push({from:was?'on':'off',to:a.fieldOn?'on':'off',t:+a.fieldT.toFixed(2)});
    }
    return {seq,fieldR:a.fieldR,MONO_ON,MONO_OFF};})())`));
  const offs = r.seq.filter(s => s.to === 'off').map(s => s.t);
  const ons = r.seq.filter(s => s.to === 'on').map(s => s.t);
  const ok = r.fieldR === 300 &&
    offs.every(t => Math.abs(t - 2.6) < 0.05) && ons.every(t => Math.abs(t - 4.2) < 0.05);
  return `${ok ? 'PASS' : 'FAIL'} offs=[${offs}] ons=[${ons}] R=${r.fieldR}`;
});

/* ── 05 干扰场进出的 jam 读写 ────────────────────────────── */
await run('4-2-05-mono-jam', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    if(!P)startGame(HULLS[0]);G.mode='play';NOVA.boss.clear();
    const a=spawnAst(4,WORLD.w*0.5,WORLD.h*0.5,'monolith');
    a.hp=a.maxHp=1e7;a.fieldOn=true;a.fieldT=99;
    P.x=a.x-150;P.y=a.y;P.vx=0;P.vy=0;
    updatePlayer(1/60);updateAsts(1/60);
    const inside={t:+P.jamT.toFixed(3),f:P.jamF,s:P.jamS};
    P.x=a.x-430;P.y=a.y;P.vx=0;P.vy=0;
    for(let i=0;i<40;i++){updatePlayer(1/60);updateAsts(1/60);}
    const outside={t:+P.jamT.toFixed(3),f:P.jamF,s:P.jamS};
    return {inside,outside,MONO_FIRE,MONO_SPD};})())`));
  const ok = r.inside.t > 0 && r.inside.f === 0.55 && r.inside.s === 0.72 &&
    r.outside.t === 0;
  return `${ok ? 'PASS' : 'FAIL'} ` + JSON.stringify(r);
});

/* ── 06 场灭易伤 ×1.5 ───────────────────────────────────── */
await run('4-2-06-mono-vuln', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    if(!P)startGame(HULLS[0]);G.mode='play';NOVA.boss.clear();
    const a=spawnAst(4,WORLD.w*0.5,WORLD.h*0.5,'monolith');
    a.hp=a.maxHp=1e7;a.invT=0;a.fieldT=99;
    a.fieldOn=true;let h0=a.hp;hurtAst(a,100,a.x,a.y,false);const dOn=h0-a.hp;
    a.fieldOn=false;h0=a.hp;hurtAst(a,100,a.x,a.y,false);const dOff=h0-a.hp;
    return {dOn,dOff,ratio:+(dOff/dOn).toFixed(3)};})())`));
  const ok = r.dOn === 100 && r.dOff === 150 && Math.abs(r.ratio - 1.5) < 0.001;
  return `${ok ? 'PASS' : 'FAIL'} ` + JSON.stringify(r);
});

/* ── 07 狂暴后窗口变短（2.6 → 1.8） ──────────────────────── */
await run('4-2-07-mono-rage', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    if(!P)startGame(HULLS[0]);G.mode='play';NOVA.boss.clear();
    const a=spawnAst(4,WORLD.w*0.5,WORLD.h*0.5,'monolith');
    a.hp=a.maxHp=1e6;a.invT=0;
    a.fieldOn=true;a.fieldT=0.001;updateAsts(1/60);
    const calm={stage:a.stage,off:+a.fieldT.toFixed(2)};
    a.hp=a.maxHp*0.55;hurtAst(a,a.maxHp*0.1,a.x,a.y,false);
    a.invT=0;a.fieldOn=true;a.fieldT=0.001;updateAsts(1/60);
    const rage={stage:a.stage,off:+a.fieldT.toFixed(2)};
    return {calm,rage};})())`));
  const ok = r.calm.stage === 0 && Math.abs(r.calm.off - 2.6) < 0.05 &&
    r.rage.stage === 1 && Math.abs(r.rage.off - 1.8) < 0.05;
  return `${ok ? 'PASS' : 'FAIL'} ` + JSON.stringify(r);
});

/* ── 08 引力拉扯 + 作用半径外归零 ────────────────────────── */
await run('4-2-08-gravity', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    if(!P)startGame(HULLS[0]);G.mode='play';NOVA.boss.clear();
    const a=spawnAst(4,WORLD.w*0.78,WORLD.h*0.5,'collapse');a.hp=a.maxHp=1e7;
    P.x=a.x-240;P.y=a.y;P.vx=0;P.vy=0;P.invuln=99;
    const d0=Math.hypot(a.x-P.x,a.y-P.y);
    for(let i=0;i<30;i++){updatePlayer(1/60);updateAsts(1/60);}
    const d1=Math.hypot(a.x-P.x,a.y-P.y),g=G.grav;
    P.x=a.x-900;P.y=a.y;P.vx=0;P.vy=0;updatePlayer(1/60);
    return {d0:Math.round(d0),d1:Math.round(d1),g,far:G.grav,GRAV_R,GRAV_PULL};})())`));
  const ok = r.d1 < r.d0 && r.g && r.g.g > 0 && r.g.inv === false && r.far === null;
  return `${ok ? 'PASS' : 'FAIL'} ` + JSON.stringify(r);
});

/* ── 09 事件视界灼烧 26 dps ─────────────────────────────── */
await run('4-2-09-horizon', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    if(!P)startGame(HULLS[0]);G.mode='play';NOVA.boss.clear();
    const a=spawnAst(4,WORLD.w*0.5,WORLD.h*0.5,'collapse');a.hp=a.maxHp=1e7;
    P.shield=0;P.shieldTmp=0;P.invPick=0;P.hp=P.maxHp;
    const h0=P.hp;
    for(let i=0;i<60;i++){P.x=a.x;P.y=a.y;P.vx=0;P.vy=0;updatePlayer(1/60);updateAsts(1/60);}
    return {h0,h1:+P.hp.toFixed(1),burned:+(h0-P.hp).toFixed(1),dps:HORIZON_DPS};})())`));
  const ok = Math.abs(r.burned - 26) < 2.5 && r.burned > 0;
  return `${ok ? 'PASS' : 'FAIL'} ` + JSON.stringify(r);
});

/* ── 10 狂暴反转：引力倒转为斥力 ─────────────────────────── */
await run('4-2-10-inversion', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    if(!P)startGame(HULLS[0]);G.mode='play';NOVA.boss.clear();
    const a=spawnAst(4,WORLD.w*0.78,WORLD.h*0.5,'collapse');a.hp=a.maxHp=1e7;
    P.x=a.x-280;P.y=a.y;P.vx=0;P.vy=0;
    a.stage=0;a.flipT=0;updatePlayer(1/60);const normal=G.grav;
    a.stage=1;a.flipT=1;updatePlayer(1/60);const inv=G.grav;
    return {normal,inv};})())`));
  const ok = r.normal && r.normal.g > 0 && r.normal.inv === false &&
    r.inv && r.inv.g < 0 && r.inv.inv === true;
  return `${ok ? 'PASS' : 'FAIL'} ` + JSON.stringify(r);
});

/* ── 11 图鉴巨像名录 8 格 ───────────────────────────────── */
await run('4-2-11-bestiary', 1280, 900, async p => {
  await p.evaluate(() => NOVA.logbook.open());
  await p.waitForTimeout(800);
  const r = await p.evaluate(() => {
    const c = NOVA.logbook.counts();
    const cells = [...document.querySelectorAll('#lbBosses .lbcell')];
    return { bosses: c.bosses, n: cells.length,
      tail: cells.slice(-2).map(x => x.textContent.replace(/\s+/g, ' ').trim()),
      waves: cells.map(x => (x.querySelector('.lbwave') || {}).textContent) };
  });
  const ok = r.bosses === 8 && r.n === 8 &&
    /静默方碑/.test(r.tail[0]) && /W35/.test(r.tail[0]) &&
    /坍缩之核/.test(r.tail[1]) && /W40/.test(r.tail[1]);
  return `${ok ? 'PASS' : 'FAIL'} bosses=${r.bosses} n=${r.n} waves=[${r.waves}] tail=${JSON.stringify(r.tail)}`;
});

/* ── 12 数据规模回归 ────────────────────────────────────── */
await run('4-2-12-regress', 1280, 900, async p => {
  const c = await p.evaluate(() => NOVA.counts());
  const m = JSON.parse(await ev(p, `JSON.stringify({meta:META.length,syn:SYN.length})`));
  const ok = c.mods === 29 && c.syn === 26 && c.enemies === 24 && c.bosses === 8 &&
    c.hulls === 7 && c.affix === 3 && c.ach === 18 && m.meta === 13; // 4.3 起第 7 船体「熔炉」
  return `${ok ? 'PASS' : 'FAIL'} ` + JSON.stringify(Object.assign({}, c, m));
});

/* ── 13 4.1 jammer 未被参数化破坏 ───────────────────────── */
await run('4-2-13-jam-regress', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    if(!P)startGame(HULLS[0]);G.mode='play';NOVA.boss.clear();
    spawnEnemy('jammer',P.x+80,P.y);
    const e=G.enemies[G.enemies.length-1];e.hp=e.maxHp=1e6;
    for(let i=0;i<3;i++){updatePlayer(1/60);updateEnemies(1/60);}
    const near={t:+P.jamT.toFixed(2),f:P.jamF,s:P.jamS};
    e.x=P.x+700;e.y=P.y;
    for(let i=0;i<40;i++){updatePlayer(1/60);updateEnemies(1/60);}
    return {near,far:+P.jamT.toFixed(2),c:{fire:JAM_FIRE,spd:JAM_SPD,strip:SUNDER_STRIP}};})())`));
  const ok = r.near.t > 0 && r.near.f === 0.65 && r.near.s === 0.8 &&
    r.far === 0 && r.c.fire === 0.65 && r.c.spd === 0.8 && r.c.strip === 22;
  return `${ok ? 'PASS' : 'FAIL'} ` + JSON.stringify(r);
});

/* ── 14 英文图鉴 ────────────────────────────────────────── */
await run('4-2-14-en', 1280, 900, async p => {
  await p.evaluate(() => NOVA.death.lang('en'));
  await p.evaluate(() => NOVA.logbook.open());
  await p.waitForTimeout(800);
  const r = await p.evaluate(() => {
    const cells = [...document.querySelectorAll('#lbBosses .lbcell')];
    return { n: cells.length,
      tail: cells.slice(-2).map(x => x.textContent.replace(/\s+/g, ' ').trim()) };
  });
  const ok = r.n === 8 && /MONOLITH/.test(r.tail[0]) && /COLLAPSE CORE/.test(r.tail[1]);
  return `${ok ? 'PASS' : 'FAIL'} n=${r.n} tail=${JSON.stringify(r.tail)}`;
});

/* ── 15 留档：两尊新巨像同屏实战 ─────────────────────────── */
await run('4-2-15-live', 1280, 900, async p => {
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    if(!P)startGame(HULLS[0]);G.mode='play';
    const a=spawnAst(4,P.x+300,P.y-160,'monolith');
    const b=spawnAst(4,P.x-320,P.y+150,'collapse');
    a.hp=a.maxHp=1e7;b.hp=b.maxHp=1e7;a.seedT=0.01;b.seedT=0.01;
    for(let i=0;i<120;i++){updatePlayer(1/60);updateAsts(1/60);}
    return {eb:G.ebullets.length,bosses:NOVA.boss.info().length,
            fieldOn:a.fieldOn,grav:G.grav};})())`));
  return `live ${JSON.stringify(r)}`;
});

})();
