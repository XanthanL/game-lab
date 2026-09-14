/* Phase 5.2 验证 —— 手柄支持（PAD）
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase5-2-check.js
 * 产出：../.workbuddy/shots/phase5/5-2-*.png + 每行状态断言
 *
 * ⚠️ 无头环境没有真手柄 —— 全部走 `NOVA.pad.hold/tap` 注入 PAD_TEST。
 * ⚠️ 数值断言一律自带 ok 字段：只打印不算验证。
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const OUT = path.join(__dirname, 'phase5');
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}

const D = [1440, 900], M = [390, 844];

async function run(tag, vw, vh, job) {
  const b = await chromium.launch({ executablePath: EXE });
  const c = await b.newContext({
    viewport: { width: vw, height: vh }, deviceScaleFactor: 2,
    hasTouch: vw < 700, isMobile: vw < 700,
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
  console.log(tag.padEnd(28), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}
const ev = (p, code) => p.evaluate(c => NOVA.debug(c), code);
const evj = async (p, code) => JSON.parse(await ev(p, 'JSON.stringify(' + code + ')'));

/* 每个用例都从"没手柄"开始 —— PAD 状态是模块级的，跨用例会残留 */
const unplug = p => ev(p, `(function(){NOVA.pad.clear();return 1;})()`);

(async () => {

/* ── 01 死区与摇杆映射：死区内归零 / 越界重映射 / 斜推径向归一化 ── */
await run('5-2-01-stick-map', ...D, async p => {
  const r = await evj(p, `(()=>{
    const c=NOVA.pad.const();
    const at=(x,y)=>{NOVA.pad.hold(x,y,0);const s=NOVA.pad.state();return [s.ax,s.ay];};
    const out={dz:at(0.1,0),half:at(0.5,0),full:at(1,0),neg:at(-1,0),
      corner:at(1,1),cornerLen:0};
    const s=NOVA.pad.state();out.cornerLen=+Math.hypot(out.corner[0],out.corner[1]).toFixed(4);
    NOVA.pad.clear();
    return {c,out};})()`);
  const o = r.out;
  const ok = Math.abs(o.dz[0]) < 1e-9 && Math.abs(o.dz[1]) < 1e-9
    && Math.abs(o.half[0] - (0.5 - r.c.dz) / (1 - r.c.dz)) < 1e-4
    && Math.abs(o.full[0] - 1) < 1e-4 && Math.abs(o.neg[0] + 1) < 1e-4
    && Math.abs(o.cornerLen - 1) < 1e-3;
  return `${ok ? 'PASS' : 'FAIL'} 死区${r.c.dz} 0.1→${o.dz[0]} 0.5→${o.half[0].toFixed(4)} `
    + `1→${o.full[0]} -1→${o.neg[0]} 斜推模长=${o.cornerLen}`;
});

/* ── 02 转向是模拟量：转速随推力量线性变化，不是推到底才算 ────── */
await run('5-2-02-analog-turn', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.pad.clear();aimMode='key';
    const turnAt=x=>{NOVA.pad.hold(x,0,0);aimMode='key';return NOVA.pad.step().turn;};
    const t0=turnAt(0),t3=turnAt(0.35),t6=turnAt(0.7),t9=turnAt(1);
    /* 键盘与摇杆叠加：按住 D 的同时把摇杆推到底，应比单推摇杆更快（但受 ±1 夹取） */
    NOVA.pad.hold(1,0,0);NOVA.keys.press('KeyD',true);aimMode='key';
    const both=NOVA.pad.step().turn;
    NOVA.keys.press('KeyD',false);NOVA.pad.clear();
    return {t0,t3,t6,t9,both};})()`);
  const ok = r.t0 === 0 && r.t3 > 0 && r.t6 > r.t3 && r.t9 > r.t6
    && Math.abs(r.both - r.t9) < 1e-6;   // 已到夹取上限，叠加不会再快
  return `${ok ? 'PASS' : 'FAIL'} 转量 0→${r.t0} 0.35→${r.t3} 0.7→${r.t6} 1→${r.t9}`
    + ` 摇杆满推+D=${r.both}(夹取后与满推相同)`;
});

/* ── 03 推进 / 刹车：摇杆上推推进，下拉或 LT 刹车 ─────────────── */
await run('5-2-03-thrust-brake', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.pad.clear();
    startGame(HULLS[0]);G.mode='play';
    const thr=ay=>{NOVA.pad.hold(0,ay,0);return NOVA.pad.step().thrust;};
    const up=thr(-0.8),mid=thr(-0.2),down=thr(0.8);
    /* 刹车用速度衰减量测：同初速下，刹车帧剩下的速度必须更小 */
    const dec=()=>{P.vx=100;P.vy=0;P.angle=0;updatePlayer(1/60);return +P.vx.toFixed(4);};
    NOVA.pad.clear();const noB=dec();
    NOVA.pad.hold(0,0.8,0);const stickB=dec();
    NOVA.pad.hold(0,0,1<<6);const ltB=dec();      // LT
    NOVA.pad.hold(0,0,1<<4);const lbB=dec();      // LB
    NOVA.pad.clear();
    return {up,mid,down,noB,stickB,ltB,lbB};})()`);
  const ok = r.up === true && r.mid === false && r.down === false
    && r.stickB < r.noB && r.ltB < r.noB && r.lbB < r.noB;
  return `${ok ? 'PASS' : 'FAIL'} 推进 上${r.up}/中${r.mid}/下${r.down} · `
    + `减速 基准${r.noB} → 摇杆${r.stickB} / LT${r.ltB} / LB${r.lbB}`;
});

/* ── 04 开火：A / RT / RB 任一都行 ─────────────────────────── */
await run('5-2-04-fire', ...D, async p => {
  const r = await evj(p, `(()=>{
    const shots=m=>{NOVA.pad.hold(0,0,m);return NOVA.pad.fireStep();};
    const none=shots(0),a=shots(1<<0),rt=shots(1<<7),rb=shots(1<<5),x=shots(1<<2);
    NOVA.pad.clear();
    const off=NOVA.pad.fireStep();
    return {none,a,rt,rb,x,off};})()`);
  const ok = r.none === 0 && r.a > 0 && r.rt > 0 && r.rb > 0 && r.x === 0 && r.off === 0;
  return `${ok ? 'PASS' : 'FAIL'} 无键${r.none} A=${r.a} RT=${r.rt} RB=${r.rb} X键(不开火)=${r.x} 拔掉后${r.off}`;
});

/* ── 05 边沿检测：同一键按住只触发一次 ─────────────────────── */
await run('5-2-05-edge', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.pad.clear();
    const t1=NOVA.pad.tap(0,0,1<<0);          // 第一次按下
    const t2=NOVA.pad.tap(0,0,1<<0);          // 再按一次（中间已松开）
    NOVA.pad.hold(0,0,1<<0);
    const a=NOVA.pad.state().press;           // 按下那一帧
    NOVA.pad.hold(0,0,1<<0);                  // 再采一帧：仍按住
    const b=NOVA.pad.state().press;           // → 应无新边沿
    NOVA.pad.clear();
    return {t1,t2,a,b};})()`);
  const ok = r.t1 === 1 && r.t2 === 1 && r.a === 1 && r.b === 0;
  return `${ok ? 'PASS' : 'FAIL'} 首按边沿=${r.t1} 二次=${r.t2} 按下帧=${r.a} 保持帧=${r.b}(须为0)`;
});

/* ── 06 START 暂停 / 继续，Select 开设置 ───────────────────── */
await run('5-2-06-start-select', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.pad.hold(0,0,0);startGame(HULLS[0]);G.mode='play';
    const m0=G.mode;
    NOVA.pad.ui(1/60,1<<9);const m1=G.mode;    // START
    NOVA.pad.ui(1/60,1<<9);const m2=G.mode;    // 再按 → 继续
    NOVA.pad.ui(1/60,1<<8);const setInPlay=el.settings.hidden; // play 中 Select 应被拒
    toMenu();NOVA.pad.ui(1/60,1<<8);const setOpen=!el.settings.hidden;  // 菜单里才开
    NOVA.pad.ui(1/60,1<<1);const setClosed=el.settings.hidden; // B 关闭
    NOVA.pad.clear();
    return {m0,m1,m2,setInPlay,setOpen,setClosed};})()`);
  const ok = r.m0 === 'play' && r.m1 === 'pause' && r.m2 === 'play' && r.setInPlay && r.setOpen && r.setClosed;
  return `${ok ? 'PASS' : 'FAIL'} ${r.m0}→START→${r.m1}→START→${r.m2} `
    + `| play 中 Select 被拒=${r.setInPlay} · 菜单里开设置=${r.setOpen} · B 关闭=${r.setClosed}`;
});

/* ── 07 选牌：十字键移动选择，A 确认，X 换牌 ────────────────── */
await run('5-2-07-cards', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.pad.hold(0,0,0);
    startGame(HULLS[0]);
    G.mode='levelup';G.rerolled=false;cardPicking=false;
    G.choices=rollChoices();renderCards();el.cards.hidden=false;
    const sel0=NOVA.pad.sel();
    NOVA.pad.ui(1/60,1<<15);                 // 十字键右 → 1
    const sel1=NOVA.pad.sel(),idx1=NOVA.pad.state().sel;
    NOVA.pad.ui(1/60,1<<15);                 // 再右 → 2
    const idx2=NOVA.pad.state().sel;
    NOVA.pad.ui(1/60,1<<14);                 // 左回 → 1
    const idx3=NOVA.pad.state().sel;
    const want=G.choices[idx3].id;
    NOVA.pad.ui(1/60,1<<0);                  // A 确认（此时选中 idx3）
    const drawn=el.cardrow.children[idx3]?el.cardrow.children[idx3].classList.contains('drawn'):false;
    const took=!!G.build[want];
    return {sel0,sel1,idx1,idx2,idx3,want,drawn,took,
      rerollBefore:G.rerolled?1:0,cls:el.cardrow.children[0].className};})()`);
  const ok = JSON.stringify(r.sel0) === JSON.stringify([true, false, false])
    && JSON.stringify(r.sel1) === JSON.stringify([false, true, false])
    && r.idx1 === 1 && r.idx2 === 2 && r.idx3 === 1 && r.drawn;
  return `${ok ? 'PASS' : 'FAIL'} 选中位 ${JSON.stringify(r.sel0)}→右→${JSON.stringify(r.sel1)}`
    + `→右→${r.idx2}→左→${r.idx3} | A 确认抽中「${r.want}」动效=${r.drawn}`;
});

/* ── 08 机库：十字键选船，A 出击 ───────────────────────────── */
await run('5-2-08-hulls', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.pad.hold(0,0,0);
    toMenu();openHulls();
    const sel0=NOVA.pad.sel();
    NOVA.pad.ui(1/60,1<<15);          // 右 → 第二艘
    const idx=NOVA.pad.state().sel;
    NOVA.pad.ui(1/60,1<<0);           // A 出击
    const hull=(G.lastHull&&G.lastHull.id)||null;
    NOVA.pad.clear();
    return {sel0,idx,hull,mode:G.mode};})()`);
  const ok = r.sel0[0] === true && r.idx === 1 && r.hull === 'rapier' && r.mode === 'play';
  return `${ok ? 'PASS' : 'FAIL'} 初始选中${JSON.stringify(r.sel0.slice(0, 3))} → 右移到 ${r.idx}`
    + ` → A 出击 船体=${r.hull} 模式=${r.mode}`;
});

/* ── 09 通用按钮导航：焦点移动 + A 点击 ─────────────────────── */
await run('5-2-09-focus-nav', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.pad.hold(0,0,0);toMenu();
    const n=NOVA.pad.targets().length;
    const b=document.getElementById('btnLaunch');
    if(b)b.focus();
    const focused=document.activeElement?document.activeElement.id:null;
    NOVA.pad.ui(1/60,1);              // A
    const mode=G.mode;
    /* 十字键下移：焦点应离开 btnLaunch */
    toMenu();if(b)b.focus();
    NOVA.pad.ui(1/60,1<<13);          // 下
    const after=document.activeElement?document.activeElement.id:null;
    NOVA.pad.clear();
    return {n,focused,mode,after};})()`);
  const ok = r.n >= 5 && r.focused === 'btnLaunch' && r.mode === 'hulls'
    && r.after && r.after !== 'btnLaunch';
  return `${ok ? 'PASS' : 'FAIL'} ${r.n}个可聚焦按钮 聚焦「${r.focused}」→A→${r.mode}`
    + ` · 下移后焦点「${r.after}」`;
});

/* ── 10 B 键返回：与 ESC 语义逐条对齐 ──────────────────────── */
await run('5-2-10-back', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.pad.hold(0,0,0);
    const out={};
    openSettings();NOVA.pad.ui(1/60,1<<1);out.settings=el.settings.hidden;
    toMenu();openLogbook();NOVA.pad.ui(1/60,1<<1);out.logbook=G.mode;
    toMenu();openHulls();NOVA.pad.ui(1/60,1<<1);
    out.hulls=el.hulls.hidden+'/'+(!el.menu.hidden);
    NOVA.pad.clear();
    return out;})()`);
  const ok = r.settings === true && r.logbook === 'menu' && r.hulls === 'true/true';
  return `${ok ? 'PASS' : 'FAIL'} 设置关闭=${r.settings} 日志→${r.logbook} 机库关闭/回菜单=${r.hulls}`;
});

/* ── 11 拔掉手柄后零残留：键盘照常，摇杆归零 ─────────────────── */
await run('5-2-11-unplug', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.pad.hold(1,0,1);             // 满推 X + 开火
    const on=NOVA.pad.state();
    NOVA.pad.clear();
    const off=NOVA.pad.state();
    startGame(HULLS[0]);G.mode='play';aimMode='key';
    const a0=P.angle;NOVA.keys.press('KeyD',true);updatePlayer(1/60);
    const kbTurn=+(P.angle-a0).toFixed(5);
    NOVA.keys.press('KeyD',false);
    const kbThr=(NOVA.keys.press('KeyW',true),updatePlayer(1/60),P.thrusting);
    NOVA.keys.press('KeyW',false);
    return {onAx:on.ax,onFire:on.fire,offOn:off.on,offAx:off.ax,offFire:off.fire,kbTurn,kbThr};})()`);
  const ok = r.onAx === 1 && r.onFire === true && r.offOn === false
    && r.offAx === 0 && r.offFire === false && r.kbTurn > 0 && r.kbThr === true;
  return `${ok ? 'PASS' : 'FAIL'} 插入时 ax=${r.onAx}/fire=${r.onFire} → 拔掉 on=${r.offOn}`
    + ` ax=${r.offAx} fire=${r.offFire} | 键盘 D 转${r.kbTurn} W 推进=${r.kbThr}`;
});

/* ── 12 连接提示：首次连上弹一次横幅 ───────────────────────── */
await run('5-2-12-connect', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.pad.hold(0,0,0);
    const first=el.bMain.textContent+'|'+el.bSub.textContent;
    NOVA.pad.clear();NOVA.pad.hold(0,0,0);   // 再连一次：不该重复弹
    el.bMain.textContent='';el.bSub.textContent='';
    NOVA.pad.hold(0,0,0);
    const again=el.bMain.textContent;
    NOVA.pad.clear();
    return {first,again};})()`);
  const ok = /CONTROLLER/.test(r.first) && /手柄已连接/.test(r.first) && r.again === '';
  return `${ok ? 'PASS' : 'FAIL'} 首次「${r.first.slice(0, 46)}…」二次重连提示=「${r.again}」(须为空)`;
});

/* ── 13 数据规模回归 + 图鉴不受影响 ────────────────────────── */
await run('5-2-13-regress', ...D, async p => {
  await p.evaluate(() => NOVA.logbook.open());
  await p.waitForTimeout(500);
  const c = await p.evaluate(() => NOVA.counts());
  const lb = await p.evaluate(() => NOVA.logbook.counts());
  const m = await evj(p, `({mods:MODULES.length,syn:SYN.length,
    lvEnMissing:MODULES.filter(m=>!LV_EN[m.id]||LV_EN[m.id].length!==m.max).map(m=>m.id),
    synEnMissing:SYN.filter(s=>!SYN_EN[s.id]).map(s=>s.id),meta:NOVA.meta.tree().length,
    bosses:Object.keys(BOSS_MV).length,hulls:HULLS.length,
    keys:Object.keys(NOVA.keys.map()).length})`);
  const r = Object.assign({}, c, lb, m);
  const ok = r.mods === 29 && r.syn === 26 && !r.lvEnMissing.length && !r.synEnMissing.length
    && r.enemies === 24 && r.bosses === 8 && r.hulls === 7 && r.affix === 3
    && r.nodes === 18 && r.links === 22 && r.meta === 13 && r.keys === 12;
  return `${ok ? 'PASS' : 'FAIL'} ` + JSON.stringify(r);
});

/* ── 14 竖屏：手柄选卡同样生效，无横向溢出 ──────────────────── */
await run('5-2-14-mobile', ...M, async p => {
  const r = await evj(p, `(()=>{
    NOVA.pad.hold(0,0,0);
    startGame(HULLS[0]);
    G.mode='levelup';G.rerolled=false;cardPicking=false;
    G.choices=rollChoices();renderCards();el.cards.hidden=false;
    NOVA.pad.ui(1/60,1<<15);
    const sel=NOVA.pad.sel(),idx=NOVA.pad.state().sel;
    const de=document.documentElement;
    NOVA.pad.clear();
    return {sel,idx,sw:de.scrollWidth,vw:window.innerWidth};})()`);
  const ok = r.idx === 1 && r.sel[1] === true && r.sw <= r.vw;
  return `${ok ? 'PASS' : 'FAIL'} 竖屏选中 ${JSON.stringify(r.sel)} 文档宽${r.sw}/视窗${r.vw}`;
});

})();
