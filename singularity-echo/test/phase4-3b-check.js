/* 星图改版验证（4.3b）—— 纵向版式 + 响应式列数 + 滚轮/双指/按钮缩放
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase4-3b-check.js
 * 产出：../.workbuddy/shots/phase4/4-3b-*.png + 每行状态断言
 *
 * ⚠️ 数值断言一律自带 ok 字段（4.1 的假绿教训）：只打印不算验证。
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const OUT = path.join(__dirname, 'phase4');
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
  /* ⚠️ 启动遮罩 #boot 只有加上 .out 才 pointer-events:none —— 没淡出时它会吃掉所有点击，
     表现为「点击断言随机失败」（曾一度 4-3b-13 命中到一个无 class 的 DIV）。必须等它退场。 */
  await p.waitForFunction(
    () => { const b = document.getElementById('boot'); return !b || b.classList.contains('out'); },
    null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(1500);
  let note = '';
  try { note = (await job(p)) || ''; } catch (e) { errs.push('JOB:' + e.message.slice(0, 200)); }
  await p.screenshot({ path: path.join(OUT, tag + '.png'), fullPage: false });
  await c.close(); await b.close();
  console.log(tag.padEnd(28), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}
const ev = (p, code) => p.evaluate(c => NOVA.debug(c), code);
/* 7.9：成就树 / 解锁树搬进了「星图」面板，开日志已经量不到它们 */
const openTree = p => ev(p, 'openStarmap();resetAchPan();"ok"');

(async () => {

/* ── 01 纵向：每个子节点都在父节点下方 ─────────────────────── */
await run('4-3b-01-vertical', ...D, async p => {
  await openTree(p);
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    const chk=(A,key)=>{
      const bad=[];
      for(const a of A){ if(!a.req)continue;
        const q=A.find(k=>k.id===a.req);
        if(!q||!(a.y>q.y))bad.push(a.id+'<='+a.req); }
      const root=A.find(a=>a.id==='seed'||a.id==='mroot'),agg=A.find(a=>a.id==='all');
      return {bad,rootY:root?root.y:null,aggY:agg?agg.y:null,
        maxY:Math.max(...A.map(a=>a.y)),minY:Math.min(...A.map(a=>a.y))};};
    return {ach:chk(NOVA.logbook.achNodes(),'ach'),meta:chk(NOVA.meta.tree(),'meta')};})())`));
  const a = r.ach, m = r.meta;
  const ok = !a.bad.length && !m.bad.length && a.rootY === 0 && m.rootY === 0 &&
    a.aggY === a.maxY && a.aggY > 400 && a.minY === 0;
  return `${ok ? 'PASS' : 'FAIL'} ach bad=[${a.bad}] root=${a.rootY} 汇总y=${a.aggY}/最大${a.maxY}` +
    ` | meta bad=[${m.bad}] root=${m.rootY}`;
});

/* ── 02 响应式列数：桌面 4 列 / 手机 2 列 ──────────────────── */
await run('4-3b-02-cols', ...D, async p => {
  await openTree(p);
  const d = JSON.parse(await ev(p, `JSON.stringify({a:NOVA.logbook.canvas(),m:NOVA.meta.canvas()})`));
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(700);
  await ev(p, 'drawAch(loadStats());drawMeta();fitAch();fitMeta();"ok"');
  const mm = JSON.parse(await ev(p, `JSON.stringify({a:NOVA.logbook.canvas(),m:NOVA.meta.canvas()})`));
  const ok = d.a.cols === 4 && d.m.cols === 4 && mm.a.cols === 2 && mm.m.cols === 2 &&
    mm.a.w < d.a.w && mm.a.h > d.a.h;
  return `${ok ? 'PASS' : 'FAIL'} 桌面 ach ${d.a.w}x${d.a.h}(${d.a.cols}列) meta ${d.m.w}x${d.m.h}` +
    ` → 手机 ach ${mm.a.w}x${mm.a.h}(${mm.a.cols}列) meta ${mm.m.w}x${mm.m.h}(${mm.m.cols}列)`;
});

/* ── 03 节点不重叠、不越界 ─────────────────────────────────── */
for (const [tag, vp] of [['4-3b-03-fit-desktop', D], ['4-3b-03-fit-mobile', M]]) {
  await run(tag, ...vp, async p => {
    await openTree(p);
    const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
      const chk=(A,cv)=>{
        const s=new Set(),dup=[];
        for(const a of A){const k=a.x+','+a.y;if(s.has(k))dup.push(a.id);s.add(k);}
        const out=A.filter(a=>a.x<0||a.y<0||a.x+150>cv.w+0.5||a.y+52>cv.h+0.5).map(a=>a.id);
        return {dup,out};};
      return {ach:chk(NOVA.logbook.achNodes(),NOVA.logbook.canvas()),
              meta:chk(NOVA.meta.tree(),NOVA.meta.canvas())};})())`));
    const ok = !r.ach.dup.length && !r.ach.out.length && !r.meta.dup.length && !r.meta.out.length;
    return `${ok ? 'PASS' : 'FAIL'} ach dup=[${r.ach.dup}] out=[${r.ach.out}]` +
      ` meta dup=[${r.meta.dup}] out=[${r.meta.out}]`;
  });
}

/* ── 04 默认缩放：桌面/手机都必须接近原尺寸（旧版 0.447 / 0.34） ── */
for (const [tag, vp, floor] of [['4-3b-04-scale-desktop', D, 0.9], ['4-3b-04-scale-mobile', M, 0.85]]) {
  await run(tag, ...vp, async p => {
    await openTree(p);
    const r = JSON.parse(await ev(p, `JSON.stringify({a:NOVA.logbook.fit(),m:NOVA.meta.fit()})`));
    const ok = r.a.scale >= floor && r.m.scale >= floor && r.a.scale <= 1 && r.m.scale <= 1;
    return `${ok ? 'PASS' : 'FAIL'} 成就 ${r.a.scale} (内容${r.a.content} 视窗${r.a.view})` +
      ` 解锁 ${r.m.scale} (内容${r.m.content}) 门槛≥${floor}`;
  });
}

/* ── 05 连线方向：父底边中点 → 子顶边中点（y1<y2） ─────────── */
await run('4-3b-05-links', ...D, async p => {
  await openTree(p);
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    const grab=id=>[...document.querySelectorAll('#'+id+' line')].map(l=>({
      x1:+l.getAttribute('x1'),y1:+l.getAttribute('y1'),
      x2:+l.getAttribute('x2'),y2:+l.getAttribute('y2')}));
    const chk=ls=>({n:ls.length,notDown:ls.filter(l=>!(l.y2>l.y1)).length,
      midX:ls.filter(l=>Math.abs((l.x1%168)-75)<0.6&&Math.abs((l.x2%168)-75)<0.6).length});
    return {ach:chk(grab('lbTreeLinks')),meta:chk(grab('mTreeLinks')),
      vb:document.getElementById('lbTreeLinks').getAttribute('viewBox')};})())`));
  const ok = r.ach.n === 22 && r.meta.n === 12 && !r.ach.notDown && !r.meta.notDown;
  return `${ok ? 'PASS' : 'FAIL'} ach ${r.ach.n}线 非向下=${r.ach.notDown} 走列中线=${r.ach.midX}` +
    ` | meta ${r.meta.n}线 非向下=${r.meta.notDown} | viewBox=${r.vb}`;
});

/* ── 06 缩放按钮：± 与适配 ─────────────────────────────────── */
await run('4-3b-06-buttons', ...D, async p => {
  await openTree(p);
  const base = JSON.parse(await ev(p, 'JSON.stringify(NOVA.logbook.tf())'));
  await p.click('#lbTree .lb-zoom button[data-zoom="+"]');
  const up = JSON.parse(await ev(p, 'JSON.stringify(NOVA.logbook.tf())'));
  await p.click('#lbTree .lb-zoom button[data-zoom="-"]');
  await p.click('#lbTree .lb-zoom button[data-zoom="-"]');
  const dn = JSON.parse(await ev(p, 'JSON.stringify(NOVA.logbook.tf())'));
  await p.click('#lbTree .lb-zoom button[data-zoom="fit"]');
  const fit = JSON.parse(await ev(p, 'JSON.stringify(NOVA.logbook.tf())'));
  const rng = JSON.parse(await ev(p, 'JSON.stringify(NOVA.logbook.zoomRange())'));
  for (let i = 0; i < 14; i++) await p.click('#lbTree .lb-zoom button[data-zoom="+"]');
  const cap = JSON.parse(await ev(p, 'JSON.stringify(NOVA.logbook.tf())'));
  for (let i = 0; i < 20; i++) await p.click('#lbTree .lb-zoom button[data-zoom="-"]');
  const floorS = JSON.parse(await ev(p, 'JSON.stringify(NOVA.logbook.tf())'));
  const ok = up.s > base.s && dn.s < up.s && Math.abs(fit.s - base.s) < 1e-3 &&
    Math.abs(cap.s - rng.max) < 1e-3 && Math.abs(floorS.s - rng.min) < 1e-3;
  return `${ok ? 'PASS' : 'FAIL'} ${base.s} →+${up.s} →−${dn.s} →fit ${fit.s}` +
    ` 上限${cap.s}(max${rng.max}) 下限${floorS.s}(min${rng.min})`;
});

/* ── 07 滚轮缩放 ───────────────────────────────────────────── */
await run('4-3b-07-wheel', ...D, async p => {
  await openTree(p);
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    const box=document.getElementById('lbTree'),b=box.getBoundingClientRect();
    const before=NOVA.logbook.tf().s;
    box.dispatchEvent(new WheelEvent('wheel',{deltaY:-120,clientX:b.left+b.width/2,
      clientY:b.top+b.height/2,bubbles:true,cancelable:true}));
    const up=NOVA.logbook.tf().s;
    box.dispatchEvent(new WheelEvent('wheel',{deltaY:240,clientX:b.left+b.width/2,
      clientY:b.top+b.height/2,bubbles:true,cancelable:true}));
    return {before,up,down:NOVA.logbook.tf().s};})())`));
  const ok = r.up > r.before && r.down < r.up;
  return `${ok ? 'PASS' : 'FAIL'} ${r.before} →上滚${r.up} →下滚${r.down}`;
});

/* ── 08 双指捏合 ───────────────────────────────────────────── */
await run('4-3b-08-pinch', ...M, async p => {
  await openTree(p);
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    const w=el.lbTreeWrap,b=w.getBoundingClientRect();
    const cx=b.left+b.width/2,cy=b.top+b.height/3;
    const mk=(t,id,x,y)=>new PointerEvent(t,{pointerId:id,clientX:x,clientY:y,
      bubbles:true,pointerType:'touch',isPrimary:id===1});
    const before=NOVA.logbook.tf().s;
    w.dispatchEvent(mk('pointerdown',1,cx-40,cy));
    w.dispatchEvent(mk('pointerdown',2,cx+40,cy));
    w.dispatchEvent(mk('pointermove',1,cx-90,cy));
    w.dispatchEvent(mk('pointermove',2,cx+90,cy));
    const after=NOVA.logbook.tf().s;
    w.dispatchEvent(mk('pointerup',1,cx-90,cy));
    w.dispatchEvent(mk('pointerup',2,cx+90,cy));
    return {before,after};})())`));
  const ok = r.after > r.before * 1.5;
  return `${ok ? 'PASS' : 'FAIL'} ${r.before} →捏开${r.after}`;
});

/* ── 09 缩放锚点：指针下那一点保持不动 ─────────────────────── */
await run('4-3b-09-anchor', ...D, async p => {
  await openTree(p);
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    const box=document.getElementById('lbTree'),b=box.getBoundingClientRect();
    const ax=b.left+120,ay=b.top+140;                 // 锚点（视窗坐标）
    const g=()=>{const t=NOVA.logbook.tf();
      return {gx:(ax-b.left-t.x)/t.s,gy:(ay-b.top-t.y)/t.s,s:t.s};};
    const a=g();
    NOVA.logbook.zoom('+',ax,ay);
    const c=g();
    return {s0:a.s,s1:c.s,dx:Math.abs(c.gx-a.gx),dy:Math.abs(c.gy-a.gy)};})())`));
  const ok = r.s1 > r.s0 && r.dx < 1.5 && r.dy < 1.5;
  return `${ok ? 'PASS' : 'FAIL'} ${r.s0}→${r.s1} 锚点漂移 ${r.dx.toFixed(2)},${r.dy.toFixed(2)}px`;
});

/* ── 10 平移夹取：拖不出视窗 ───────────────────────────────── */
await run('4-3b-10-clamp', ...D, async p => {
  await openTree(p);
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    NOVA.logbook.zoom(2.0);                       // 放大后内容必然超出视窗
    const t0=NOVA.logbook.tf();
    const far=NOVA.logbook.pan(99999,99999);      // 往右下狂拖
    const lo=NOVA.logbook.tf();
    const back=NOVA.logbook.pan(-99999,-99999);   // 再往左上狂拖
    const box=document.getElementById('lbTree');
    const ch=+el.lbTreeWrap.dataset.ch,cw=+el.lbTreeWrap.dataset.cw;
    return {s:t0.s,lo,back,bw:box.clientWidth,bh:box.clientHeight,
      cwS:Math.round(cw*t0.s),chS:Math.round(ch*t0.s)};})())`));
  const okX = r.lo.x <= 0.5 && r.lo.y <= 0.5 &&
    r.back.x >= r.bw - r.cwS - 0.5 && r.back.y >= r.bh - r.chS - 0.5;
  const ok = okX && r.cwS > r.bw;
  return `${ok ? 'PASS' : 'FAIL'} 放大${r.s} 内容${r.cwS}x${r.chS} 视窗${r.bw}x${r.bh}` +
    ` 右下界(${r.lo.x},${r.lo.y}) 左上界(${r.back.x},${r.back.y})`;
});

/* ── 11 解锁树同样能平移缩放（旧版只有成就树能拖） ─────────── */
await run('4-3b-11-meta-pan', ...D, async p => {
  await openTree(p);
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    const b0=NOVA.meta.tf();
    NOVA.meta.zoom('+');const up=NOVA.meta.tf();
    const p1=NOVA.meta.pan(-60,-40);
    return {s0:b0.s,s1:up.s,px:p1.x,py:p1.y,hasBtns:document.querySelectorAll('#mTree .lb-zoom button').length};})())`));
  const ok = r.s1 > r.s0 && r.hasBtns === 3 && r.px !== 0;
  return `${ok ? 'PASS' : 'FAIL'} ${r.s0}→${r.s1} 平移(${r.px},${r.py}) 按钮${r.hasBtns}个`;
});

/* ── 12 缩放按钮不随画布平移 ───────────────────────────────── */
await run('4-3b-12-btn-fixed', ...D, async p => {
  await openTree(p);
  /* ⚠️ 面板 panelIn 入场动画 0.33s 没跑完就取 bbox，量到的是动画中间帧
     （实测能差 8px / 3px 宽），缩放前后一比就是假 FAIL —— 必须等它落定。 */
  await p.waitForTimeout(600);
  const a = await p.locator('#lbTree .lb-zoom').boundingBox();
  await ev(p, 'NOVA.logbook.zoom(2.2);NOVA.logbook.pan(-200,-150);"ok"');
  const b = await p.locator('#lbTree .lb-zoom').boundingBox();
  const ok = Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5;
  return `${ok ? 'PASS' : 'FAIL'} 前(${a.x.toFixed(0)},${a.y.toFixed(0)}) 后(${b.x.toFixed(0)},${b.y.toFixed(0)})` +
    ` 宽${a.width.toFixed(0)}→${b.width.toFixed(0)}`;
});

/* ── 13 点击节点仍能解锁（平移逻辑不能吃掉点击） ───────────── */
await run('4-3b-13-click', ...D, async p => {
  /* 7.9：解锁树搬进了星图，这里必须开星图 —— 开日志的话日志浮层会盖住节点 */
  await ev(p, `NOVA.meta.reset();NOVA.meta.grant(100);openStarmap();NOVA.meta.draw();NOVA.meta.fit();"ok"`);
  await p.waitForTimeout(500);
  /* ⚠️ 必须先滚到「解锁星图」小节 —— 节点落在面板滚动区之外时，强制点击会打在
     覆盖其上的元素上（静默失败，dust 不减、类不变）。与 3-5-12 同一处坑。 */
  await p.evaluate(() => {
    const h = document.querySelector('[data-node-id="lbsec7"]');
    if (h && h.scrollIntoView) h.scrollIntoView({ block: 'center' });
  });
  await p.waitForTimeout(400);
  /* 用真实鼠标事件点节点中心 —— 比 p.click(selector) 少一层 Playwright 自己的
     滚动/命中推断，命中测试失败时下面能把真正挡住它的元素打出来。 */
  const hit = await p.evaluate(() => {
    const n = document.querySelector('[data-meta="dmg1"]');
    const r = n.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const t = document.elementFromPoint(cx, cy);
    const chain = [];
    for (let e = t; e && chain.length < 4; e = e.parentElement) {
      chain.push(e.tagName + (e.id ? '#' + e.id : '') + (e.className ? '.' + e.className : '')
        + '[pe=' + getComputedStyle(e).pointerEvents + ',z=' + getComputedStyle(e).zIndex + ']');
    }
    return { x: cx, y: cy, on: !!(t && t.closest && t.closest('[data-meta="dmg1"]')),
      top: t ? t.tagName + '|' + (t.className || '') : null, chain,
      stack: document.elementsFromPoint(cx, cy).slice(0, 4).map(e => e.tagName + (e.id ? '#' + e.id : '') + (e.className ? '.' + e.className : '')) };
  });
  await p.mouse.click(hit.x, hit.y);
  await p.waitForTimeout(300);
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>({
    ok:NOVA.meta.state().unlocked.indexOf('dmg1')>=0,
    cls:document.querySelector('[data-meta="dmg1"]').className.replace('lbnode ',''),
    dust:NOVA.meta.state().dust}))())`));
  const ok = r.ok && r.cls === 'done';
  return `${ok ? 'PASS' : 'FAIL'} ${JSON.stringify(r)} 命中=${JSON.stringify(hit)}`;
});

/* ── 14 英文提示含 pinch ───────────────────────────────────── */
await run('4-3b-14-en', ...D, async p => {
  await openTree(p);
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    NOVA.death.lang('en');
    const A=()=>document.getElementById('lbTreeHint').textContent;
    const B=()=>document.getElementById('mTreeHint').textContent;
    const a=A(),b=B();
    NOVA.death.lang('zh');
    const c=A(),d=B();
    return {a,b,c,d,ok:/pinch/i.test(a)&&/pinch/i.test(b)&&/双指/.test(c)&&/双指/.test(d)};})())`));
  const ok = r.ok;
  return `${ok ? 'PASS' : 'FAIL'} en="${r.a}" / "${r.b}" | zh="${r.c}" / "${r.d}"`;
});

/* ── 15 竖屏无横向溢出 ─────────────────────────────────────── */
await run('4-3b-15-overflow', ...M, async p => {
  await openTree(p);
  const r = JSON.parse(await ev(p, `JSON.stringify((()=>{
    const a=document.getElementById('lbTree').getBoundingClientRect();
    const m=document.getElementById('mTree').getBoundingClientRect();
    const p=document.querySelector('#logbook .panel').getBoundingClientRect();
    return {vw:innerWidth,panelR:Math.round(p.right),achR:Math.round(a.right),
      metaR:Math.round(m.right),achW:Math.round(a.width),achH:Math.round(a.height),
      docW:document.documentElement.scrollWidth};})())`));
  const ok = r.achR <= r.vw + 0.5 && r.metaR <= r.vw + 0.5 && r.docW <= r.vw + 1;
  return `${ok ? 'PASS' : 'FAIL'} vw=${r.vw} panel右${r.panelR} 成就右${r.achR}(${r.achW}x${r.achH})` +
    ` 解锁右${r.metaR} 文档宽${r.docW}`;
});

/* ── 16 回归：图鉴与数据规模不受影响 ───────────────────────── */
await run('4-3b-16-regress', ...D, async p => {
  await openTree(p);
  const c = await p.evaluate(() => NOVA.counts());
  const lb = await p.evaluate(() => NOVA.logbook.counts());
  const m = JSON.parse(await ev(p, 'JSON.stringify({meta:META.length,ach:ACH.length})'));
  const r = Object.assign({}, c, lb, m);
  const ok = r.mods === 29 && r.enemies === 24 && r.bosses === 8 && r.hulls === 7 &&
    r.affix === 3 && r.nodes === 18 && r.links === 22 && r.meta === 13 && r.ach === 18;
  return `${ok ? 'PASS' : 'FAIL'} ` + JSON.stringify(r);
});

})();
