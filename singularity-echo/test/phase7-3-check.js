/* Phase 7.3 · 冲刺赛分享闭环 —— 断言脚本
 * ⚠️ 收端必须用**全新浏览器实例**验证：G.taMode 是内存态，
 *    同一页面里上一步留下的 true 会污染结果（§7 #169 的同类教训）。 */
const { chromium } = require('playwright-core');
const CHROME = require('./_browser').exe();
const BASE = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
let fail = 0, pass = 0;
const ok = (n, c, d = '') => { if (c) pass++; else fail++; console.log((c ? 'ok  PASS ' : 'FAIL     ') + n + (d ? '  ' + d : '')); };
const err = (n, e) => { fail++; console.log('ERR      ' + n + '  ' + e.message); };
const ev = async (p, code) => JSON.parse(await p.evaluate(c => NOVA.debug(c), code));

async function open(b, url, vp) {
  const p = await (await b.newContext({ viewport: vp || { width: 1280, height: 900 } })).newPage();
  p.on('pageerror', e => console.log('  PAGEERROR', e.message));
  await p.goto(url || BASE);
  await p.waitForFunction(() => window.NOVA && window.NOVA.ta, null, { timeout: 25000 });
  await p.waitForFunction(() => { const el = document.getElementById('boot'); return !!el && el.hidden; },
    null, { timeout: 25000 }).catch(() => { });
  await p.waitForTimeout(350);
  return p;
}
const FLY = `function fly(sec){G.mode='play';var t0=G.runT;
  for(var i=0;i<sec*10;i++){G.runT=t0+i*0.1;var t=G.runT;
    P.x=WORLD.w/2+140*Math.cos(0.7*t)+60*Math.cos(1.9*t);
    P.y=WORLD.h/2+150*Math.sin(0.8*t)+55*Math.sin(2.1*t);P.angle=t;ghostRec();}}`;

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });

  /* 01 版本号 v2，且 v1 仍被接受 */
  try {
    const p = await open(b);
    const r = await ev(p, `JSON.stringify([NOVA.gcode.ver(),typeof gcodeDec==='function'])`);
    ok('7-3-01-ver', r[0] === 2 && r[1] === true, `GCODE_VER=${r[0]}（解码端照收 v1）`);
    await p.close();
  } catch (e) { err('7-3-01-ver', e); }

  /* 02 TA 局产出的码带 ta 标志；普通局不带 */
  try {
    const p = await open(b);
    const r = await ev(p, `(()=>{${FLY}
      NOVA.ta.start();fly(180);
      var ta=NOVA.gcode.dec(gcodeMine()).ta;
      NOVA.ta.mode(false);startGame(HULLS[0]);G.seed=normSeed(555);fly(120);
      var nm=NOVA.gcode.dec(gcodeMine()).ta;
      return JSON.stringify({ta:ta,nm:nm});})()`);
    ok('7-3-02-flag', r.ta === true && r.nm === false, `TA 码 ta=${r.ta} · 普通码 ta=${r.nm}`);
    await p.close();
  } catch (e) { err('7-3-02-flag', e); }

  /* 03 核心：乙方全新实例点开 TA 链接 → 进 3 分钟冲刺 */
  let taUrl = '';
  try {
    const A = await open(b);
    const made = await ev(A, `(()=>{${FLY}
      NOVA.ta.start();fly(180);G.score=4321;Wv.n=12;
      var u=gcodeUrl(gcodeMine());
      return JSON.stringify({u:u,seed:G.seed});})()`);
    await A.close();
    taUrl = made.u;
    const B = await open(b, BASE + made.u.slice(made.u.indexOf('#')));
    const got = await ev(B, `JSON.stringify({taMode:!!G.taMode,taT:Math.round(G.taT),
      seed:G.seed,gsrc:G.gsrc,gN:G.gplay?G.gplay.n:0,gDt:G.gplay?+G.gplay.dt.toFixed(3):-1,
      hud:!el.tatime.hidden,diff:G.diff,rm:G.rmods.length,ban:G.ban.length})`);
    ok('7-3-03-recipient', got.taMode === true && got.taT === 180
      && got.seed === made.seed && got.gsrc === 'link' && got.gN === 720 && got.gDt === 0.25
      && got.hud === true && got.diff === 'standard' && got.rm === 0 && got.ban === 0,
      `乙方：TA=${got.taMode} · 倒计时 ${got.taT}s · 同地图 ✓ · 影子 ${got.gN} 点 dt=${got.gDt}s · HUD 已显示 · standard/无挑战/无禁用`);
    await B.close();
  } catch (e) { err('7-3-03-recipient', e); }

  /* 04 普通漂移链接不会把人拽进 TA */
  try {
    const A = await open(b);
    const made = await ev(A, `(()=>{${FLY}
      NOVA.ta.mode(false);startGame(HULLS[0]);G.seed=normSeed(777);fly(120);
      return JSON.stringify({u:gcodeUrl(gcodeMine())});})()`);
    await A.close();
    const B = await open(b, BASE + made.u.slice(made.u.indexOf('#')));
    const got = await ev(B, `JSON.stringify({taMode:!!G.taMode,hud:!el.tatime.hidden})`);
    ok('7-3-04-normal', got.taMode === false && got.hud === false,
      `普通链接：TA=${got.taMode} · HUD 倒计时不显示=${!got.hud}`);
    await B.close();
  } catch (e) { err('7-3-04-normal', e); }

  /* 05 老码兼容：手工造一个 v1 码（无标志字节），仍按 5Hz 解出且 ta=false */
  try {
    const p = await open(b);
    const r = await ev(p, `(()=>{
      var o=[1,20,1,0,0,0,0,0,0,0,0,0];       /* v1 头：ver=1, dtcs=20(5Hz), ... */
      vPut(o,500);vPut(o,7);vPut(o,10);
      var px=0,py=0,pa=0;
      for(var i=0;i<10;i++){
        var x=100+i*8,y=200+i*5,a=(i*10)&255;
        var da=a-pa;if(da>128)da-=256;if(da<-128)da+=256;
        vPut(o,x-px);vPut(o,y-py);vPut(o,da);px=x;py=y;pa=a;}
      var g=gcodeDec(b64e(o));
      return JSON.stringify({ok:!!g,dt:g?+g.dt.toFixed(4):-1,n:g?g.n:-1,ta:g?!!g.ta:'ERR'});})()`);
    ok('7-3-05-oldcode', r.ok === true && Math.abs(r.dt - 0.2) < 1e-6 && r.n === 10 && r.ta === false,
      `v1 老码照解：dt=${r.dt} · ${r.n} 点 · ta=${r.ta}（无标志字节即普通局）`);
    await p.close();
  } catch (e) { err('7-3-05-oldcode', e); }

  /* 06 版本号上界：ver 超出已知范围一律 null（不把垃圾当码） */
  try {
    const p = await open(b);
    const r = await ev(p, `(()=>{
      function mk(ver){var o=[ver,0,20,1,0,0,0,0,0,0,0,0];vPut(o,1);vPut(o,1);vPut(o,1);
        vPut(o,10);vPut(o,10);vPut(o,0);return gcodeDec(b64e(o));}
      return JSON.stringify({v0:!!mk(0),v1:!!mk(1),v2:!!mk(2),v3:!!mk(3),v9:!!mk(9)});})()`);
    ok('7-3-06-verguard', r.v0 === false && r.v1 === true && r.v2 === true && r.v3 === false && r.v9 === false,
      `ver 0/1/2/3/9 → ${[r.v0, r.v1, r.v2, r.v3, r.v9].join('/')}（只认 1 与 2）`);
    await p.close();
  } catch (e) { err('7-3-06-verguard', e); }

  /* 07 分享横幅区分冲刺赛 / 普通轨迹 */
  try {
    const p = await open(b);
    const r = await ev(p, `(()=>{${FLY}
      NOVA.ta.start();fly(180);
      gcodeShare(el.overGhost,el.overGhostHint);
      var ta=el.bMain.textContent;
      NOVA.ta.mode(false);startGame(HULLS[0]);G.seed=normSeed(555);fly(120);
      gcodeShare(el.overGhost,el.overGhostHint);
      var nm=el.bMain.textContent;
      return JSON.stringify({ta:ta,nm:nm});})()`);
    ok('7-3-07-banner', r.ta === 'SPRINT LINK' && r.nm === 'TRACK LINK',
      `TA 横幅「${r.ta}」· 普通横幅「${r.nm}」`);
    await p.close();
  } catch (e) { err('7-3-07-banner', e); }

  /* 08 乙方开局有明确交代（TIME ATTACK 横幅） */
  try {
    const A = await open(b);
    const made = await ev(A, `(()=>{${FLY}
      NOVA.ta.start();fly(180);
      return JSON.stringify({u:gcodeUrl(gcodeMine())});})()`);
    await A.close();
    const B = await open(b, BASE + made.u.slice(made.u.indexOf('#')));
    const got = await ev(B, `JSON.stringify({b:el.bMain.textContent,s:el.bSub.textContent})`);
    ok('7-3-08-intro', got.b === 'TIME ATTACK' && /3/.test(got.s),
      `乙方开局横幅「${got.b}」/「${got.s}」`);
    await B.close();
  } catch (e) { err('7-3-08-intro', e); }

  /* 09 链接只长 2 字符（一个标志字节的代价） */
  try {
    const p = await open(b);
    const r = await ev(p, `JSON.stringify([NOVA.gcode.ver(),NOVA.gcode.max()])`);
    ok('7-3-09-cost', r[0] === 2 && r[1] === 450, `ver=${r[0]} · 非 TA 档上限 ${r[1]} 点（标志位只 +1 字节 ≈ 1.4 字符）`);
    await p.close();
  } catch (e) { err('7-3-09-cost', e); }

  /* 10 回归：6.6 往返 / 6.5 幽灵 / 6.1 种子都不破 */
  try {
    const p = await open(b);
    const r = await ev(p, `(()=>{
      var sd=NOVA.seed.code(12345);
      var gp=NOVA.ghost.push(1,2,3).gn;
      G.seed=normSeed(1234567);
      var src={sc:98765,w:23,hull:'rapier',sd:1234567,diff:'abyss',
               rm:['swarm','brittle'],bn:['crit','magnet','drone'],
               dt:0.2,n:200,pts:(function(){var a=[];for(var i=0;i<200;i++)a.push(100+i,200+i,0);return a;})()};
      var c=gcodeEnc(src),d=gcodeDec(c);
      return JSON.stringify({sd:sd,gp:gp,ok:!!d&&d.sc===98765&&d.n===200&&d.sd==='00QGLJ',
        len:c.length});})()`);
    /* 注：这里的 200 点是合成的直线航线，增量极小、压缩率远高于真实航线（828 vs ~1870 字符），
       所以长度下界放宽；真正的断言是往返一致（sc / n / 短码都对得上）。 */
    ok('7-3-10-regress', r.sd === '0009IX' && r.gp >= 1 && r.ok === true && r.len > 600 && r.len < 2000,
      `种子码 ${r.sd} · 6.6 往返 OK（${r.len} 字符）· 幽灵钩子可写`);
    await p.close();
  } catch (e) { err('7-3-10-regress', e); }

  /* 11 竖屏 390px：乙方点开不撑破 */
  try {
    const A = await open(b);
    const made = await ev(A, `(()=>{${FLY}
      NOVA.ta.start();fly(180);
      return JSON.stringify({u:gcodeUrl(gcodeMine())});})()`);
    await A.close();
    const B = await open(b, BASE + made.u.slice(made.u.indexOf('#')), { width: 390, height: 844 });
    const got = await ev(B, `JSON.stringify({sw:document.documentElement.scrollWidth,
      cw:document.documentElement.clientWidth,ta:!!G.taMode,hud:!el.tatime.hidden})`);
    ok('7-3-11-mobile', got.sw <= got.cw + 1 && got.ta === true && got.hud === true,
      `390px：scrollW ${got.sw} ≤ clientW ${got.cw} · TA=${got.ta} · HUD 倒计时已显示`);
    await B.close();
  } catch (e) { err('7-3-11-mobile', e); }

  console.log('\n7.3 冲刺赛分享闭环：' + pass + ' PASS / ' + fail + ' FAIL');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
