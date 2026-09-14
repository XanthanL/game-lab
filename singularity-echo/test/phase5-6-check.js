/* Phase 5.6 验证 —— 分享卡片 / 本地排行榜 / 局内截图
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase5-6-check.js
 * 产出：../.workbuddy/shots/phase5/5-6-*.png + 每行状态断言
 *
 * ⚠️ 排行榜断言要**自己造记录**而不是打完一局：分数、名次、截断都要精确可控，
 *    真打一局只能验证「有东西进去了」，量不出排序与 Top10 边界。
 * ⚠️ 卡片颜色是否跟随色盲 token，直接读 shC('amber') 换档前后的返回值 ——
 *    比去 canvas 上取某个像素稳（文字像素稀疏，取点极易落空）。
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

(async () => {

/* ── 01 排序与 Top10 截断 ───────────────────────────────── */
await run('5-6-01-sort', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.board.clear();
    for(let i=1;i<=15;i++)NOVA.board.add({s:i*100,w:i,k:i*3,l:i,t:i*10,h:'peregrine',d:'1/1',m:0,v:0,at:i});
    const L=NOVA.board.list();
    return {n:L.length,max:NOVA.board.max(),top:L[0].s,last:L[L.length-1].s,
            desc:L.every((x,i)=>i===0||L[i-1].s>=x.s)};})()`);
  const ok = r.n === 10 && r.max === 10 && r.top === 1500 && r.last === 600 && r.desc;
  return `${ok ? 'PASS' : 'FAIL'} 塞 15 条 → 剩 ${r.n} 条（上限 ${r.max}）` +
    ` 头 ${r.top} 尾 ${r.last}（应为 1500 / 600）${r.desc ? ' 降序✓' : ' 降序✗'}`;
});

/* ── 02 名次返回值：进榜给 1-based，挤不进给 0 ──────────── */
await run('5-6-02-rank', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.board.clear();
    const mid=NOVA.board.add({s:500,w:1,k:1,l:1,t:1,h:'peregrine',d:'1/1',m:0,v:0,at:1});
    const top=NOVA.board.add({s:9999,w:1,k:1,l:1,t:1,h:'peregrine',d:'1/1',m:0,v:0,at:2});
    for(let i=0;i<8;i++)NOVA.board.add({s:1000+i,w:1,k:1,l:1,t:1,h:'peregrine',d:'1/1',m:0,v:0,at:10+i});
    const out=NOVA.board.add({s:1,w:1,k:1,l:1,t:1,h:'peregrine',d:'1/1',m:0,v:0,at:99});
    return {mid,top,out,n:NOVA.board.list().length};})()`);
  const ok = r.mid === 1 && r.top === 1 && r.out === 0 && r.n === 10;
  return `${ok ? 'PASS' : 'FAIL'} 首条→#${r.mid} · 最高分→#${r.top} · 榜满后垫底→${r.out}（0 = 没进）`;
});

/* ── 03 持久化与读回 ───────────────────────────────────── */
await run('5-6-03-persist', ...D, async p => {
  const a = await evj(p, `(()=>{
    NOVA.board.clear();
    NOVA.board.add({s:4242,w:7,k:33,l:5,t:210,h:'rapier',d:'9/6',m:1,v:0,at:1});
    return {key:NOVA.board.key(),raw:NOVA.board.raw()};})()`);
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(1200);
  const b2 = await evj(p, `(()=>{const n=NOVA.board.load();const L=NOVA.board.list();
    return {n,s:L[0]&&L[0].s,h:L[0]&&L[0].h,m:L[0]&&L[0].m};})()`);
  const parsed = (() => { try { return JSON.parse(a.raw); } catch (e) { return null; } })();
  const ok = a.key === 'nova-board' && Array.isArray(parsed) && b2.n === 1
    && b2.s === 4242 && b2.h === 'rapier' && b2.m === 1;
  return `${ok ? 'PASS' : 'FAIL'} 键 ${a.key} · 刷新后读回 ${b2.n} 条 s=${b2.s} h=${b2.h} m=${b2.m}` +
    `（存档 ${a.raw.length} 字节）`;
});

/* ── 04 清空 ───────────────────────────────────────────── */
await run('5-6-04-clear', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.board.clear();
    for(let i=0;i<4;i++)NOVA.board.add({s:100+i,w:1,k:1,l:1,t:1,h:'peregrine',d:'1/1',m:0,v:0,at:i});
    const before=NOVA.board.list().length;
    const after=NOVA.board.clear();
    return {before,after,raw:NOVA.board.raw()};})()`);
  const ok = r.before === 4 && r.after === 0 && r.raw === '[]';
  return `${ok ? 'PASS' : 'FAIL'} ${r.before} 条 → 清空后 ${r.after} 条，存档=${r.raw}`;
});

/* ── 05 面板渲染 + 本局高亮 ────────────────────────────── */
await run('5-6-05-render', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.board.clear();
    for(let i=0;i<3;i++)NOVA.board.add({s:(3-i)*1000,w:10+i,k:20,l:3,t:100,h:'peregrine',d:'1/1',m:0,v:0,at:i});
    const rows=NOVA.board.render(2);
    const me=document.querySelectorAll('#bdList .bdrow.me').length;
    const txt=document.querySelector('#bdList .bdrow:not(.head)').textContent.replace(/\\s+/g,' ').trim();
    return {rows,me,txt};})()`);
  const ok = r.rows === 4 && r.me === 1 && /3,000/.test(r.txt);
  return `${ok ? 'PASS' : 'FAIL'} 行数 ${r.rows}（3 条 + 表头）· 高亮行 ${r.me} · 首行「${r.txt.slice(0, 40)}」`;
});

/* ── 06 从菜单打开 / 关闭不串面板 ──────────────────────── */
await run('5-6-06-open', ...D, async p => {
  const a = await evj(p, `NOVA.board.open(0)`);
  const mid = await evj(p, `(()=>({menu:el.menu.hidden,board:el.board.hidden}))()`);
  const c2 = await evj(p, `NOVA.board.close()`);
  const after = await evj(p, `(()=>({menu:el.menu.hidden,board:el.board.hidden}))()`);
  const tg = await evj(p, `(()=>{el.board.hidden=false;const n=padTargets().length;el.board.hidden=true;return n;})()`);
  const ok = a.shown && a.menuHidden && mid.board === false && c2 === true
    && after.board === true && after.menu === false && tg >= 2;
  return `${ok ? 'PASS' : 'FAIL'} 打开：board 显示 + menu 隐藏=${a.menuHidden}` +
    ` · 关闭：menu 回来=${!after.menu} · 手柄可聚焦按钮 ${tg} 个`;
});

/* ── 07 结算自动进榜 + 排名行 ──────────────────────────── */
await run('5-6-07-settle', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.board.clear();
    startGame(HULLS[0]);G.mode='play';Wv.n=12;G.kills=77;G.runT=300;G.score=8888;
    showOver();
    return {n:NOVA.board.list().length,s:NOVA.board.list()[0].s,
            rank:el.overRank.textContent,rankHidden:el.overRank.hidden,
            v:NOVA.board.list()[0].v};})()`);
  const ok = r.n === 1 && r.s === 8888 && !r.rankHidden && /#1/.test(r.rank) && r.v === 0;
  return `${ok ? 'PASS' : 'FAIL'} 坠毁进榜 ${r.n} 条 s=${r.s} v=${r.v} · 排名行「${r.rank}」`;
});

/* ── 08 通关进榜标「肃清」 ─────────────────────────────── */
await run('5-6-08-victory', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.board.clear();
    startGame(HULLS[0]);G.mode='play';Wv.n=30;G.kills=200;G.score=5000;
    showVictory();
    return {n:NOVA.board.list().length,s:NOVA.board.list()[0].s,v:NOVA.board.list()[0].v,
            rank:el.vicRank.textContent};})()`);
  const ok = r.n === 1 && r.v === 1 && r.s === 13000 && /#1/.test(r.rank);
  return `${ok ? 'PASS' : 'FAIL'} 通关进榜 s=${r.s}（5000 + 8000 奖励）v=${r.v} · 排名行「${r.rank}」`;
});

/* ── 09 分享卡片：尺寸 / 内容 / 颜色跟随 token ─────────── */
await run('5-6-09-card', ...D, async p => {
  await ev(p, `(function(){startGame(HULLS[0]);G.mode='play';G.score=12345;Wv.n=15;G.kills=99;G.runT=260;
    G.build={};showOver();return 1;})()`);
  const c = await evj(p, `(()=>{const r=NOVA.share.card();return {w:r.w,h:r.h,len:r.url.length,kind:r.url.slice(0,22)};})()`);
  const a = await ev(p, `shC('amber')`);
  await ev(p, `(function(){NOVA.opts.set('cb','rg');return 1;})()`);
  const b3 = await ev(p, `shC('amber')`);
  const open = await evj(p, `NOVA.share.open()`);
  const nat = await p.evaluate(() => new Promise(r => {
    const i = document.getElementById('shareImg');
    if (i.complete) r({ w: i.naturalWidth, h: i.naturalHeight });
    else i.onload = () => r({ w: i.naturalWidth, h: i.naturalHeight });
  }));
  const ok = c.w === 1200 && c.h === 630 && c.len > 5000
    && c.kind === 'data:image/png;base64,' && a !== b3 && open.shown && nat.w === 1200;
  return `${ok ? 'PASS' : 'FAIL'} ${c.w}×${c.h} · ${(c.len / 1024).toFixed(0)}KB · ` +
    `img ${nat.w}×${nat.h} · 色盲切换后 amber：${a} → ${b3}`;
});

/* ── 10 局内截图 ───────────────────────────────────────── */
await run('5-6-10-shot', ...D, async p => {
  await ev(p, `(function(){startGame(HULLS[0]);G.mode='play';
    for(let k=0;k<8;k++)spawnEnemy(EN_LIST[0],P.x+Math.cos(k)*160,P.y+Math.sin(k)*160);
    for(let i=0;i<30;i++)updateWorld(1/60);draw();return 1;})()`);
  const r = await evj(p, `NOVA.share.shot()`);
  const ok = r.kind === 'data:image/png;base64,' && r.len > 20000;
  return `${ok ? 'PASS' : 'FAIL'} 主画布 ${r.kind} · ${(r.len / 1024).toFixed(0)}KB（有实际画面内容）`;
});

/* ── 11 中英 ───────────────────────────────────────────── */
await run('5-6-11-i18n', ...D, async p => {
  await evj(p, `NOVA.board.open(0)`);
  const zh = await p.textContent('#board .panel h2 span');
  const zc = await p.textContent('#btnBdClear');
  await ev(p, `(function(){setLang('en');return 1;})()`);
  const en = await p.textContent('#board .panel h2 span');
  const ec = await p.textContent('#btnBdClear');
  const ok = /本机/.test(zh) && /device/i.test(en) && zc !== ec;
  return `${ok ? 'PASS' : 'FAIL'} 副标题 中「${zh}」/ 英「${en}」· 按钮「${zc}」→「${ec}」`;
});

/* ── 12 回归：5.1 / 5.3 / 5.4 / 5.5 都还在 ─────────────── */
await run('5-6-12-keep', ...D, async p => {
  const r = await evj(p, `(()=>{
    const S=document.getElementById('settings');S.classList.add('show');
    const q=S.querySelectorAll('#optQuality .segb').length;
    const keys=document.querySelectorAll('#keyList .keyrow').length;
    const slots=document.querySelectorAll('#keyList .keyslot').length;
    S.classList.remove('show');
    NOVA.touch.set(0,-46);const mag=+joy.mag.toFixed(2);NOVA.touch.clear();
    return {q,keys,slots,budget:NOVA.perf().budget.parts,mag,
            shot:!!document.getElementById('btnShot'),
            boardBtn:!!document.getElementById('btnBoard')};})()`);
  const ok = r.q === 4 && r.keys === 12 && r.slots === 24 && r.budget === 560
    && r.mag === 1 && r.shot && r.boardBtn;
  return `${ok ? 'PASS' : 'FAIL'} 画质${r.q}档 键位${r.keys}×${r.slots / r.keys}槽 粒子预算${r.budget}` +
    ` 摇杆 mag=${r.mag} 截图/排行榜入口都在`;
});

/* ── 13 竖屏：排行榜面板不出界 ─────────────────────────── */
await run('5-6-13-mobile', ...M, async p => {
  await ev(p, `(function(){NOVA.board.clear();
    for(let i=0;i<6;i++)NOVA.board.add({s:(6-i)*900,w:9+i,k:15,l:4,t:120+i,h:'peregrine',d:'1/1',m:0,v:0,at:i});
    NOVA.board.open(0);return 1;})()`);
  const r = await evj(p, `(()=>{
    const bad=[];
    for(const e of document.querySelectorAll('#board .panel *')){
      const b=e.getBoundingClientRect();
      if(!b.width)continue;
      if(b.right>innerWidth+1||b.left<-1)bad.push((e.id||e.className)+':'+Math.round(b.left)+'~'+Math.round(b.right));
    }
    return {sw:document.documentElement.scrollWidth,vw:innerWidth,
            rows:NOVA.board.rows(),bad};})()`);
  const ok = r.sw <= r.vw && !r.bad.length && r.rows === 6;
  return `${ok ? 'PASS' : 'FAIL'} 竖屏 ${r.vw} 宽 · ${r.rows} 行 · 出界 ${r.bad.length}` +
    (r.bad.length ? ' ' + r.bad.join(' | ') : '');
});

})();
