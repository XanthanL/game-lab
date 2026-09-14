/* Phase 7.2 · 冲刺赛闭环 —— 断言脚本 */
const { chromium } = require('playwright-core');
const CHROME = require('./_browser').exe();
const BASE = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
let fail = 0, pass = 0;
const ok = (n, c, d = '') => { if (c) pass++; else fail++; console.log((c ? 'ok  PASS ' : 'FAIL     ') + n + (d ? '  ' + d : '')); };
const err = (n, e) => { fail++; console.log('ERR      ' + n + '  ' + e.message); };
const ev = async (p, code) => JSON.parse(await p.evaluate(c => NOVA.debug(c), code));

async function fresh(b, vp) {
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

  /* 01 常量：普通档 5Hz×90s / TA 档 4Hz×180s */
  try {
    const p = await fresh(b);
    const r = await ev(p, `JSON.stringify([NOVA.gcode.hz(),NOVA.gcode.sec(),NOVA.gcode.max(),
      NOVA.gcode.taHz(),NOVA.gcode.taSec(),NOVA.gcode.taMax(),NOVA.gcode.cap()])`);
    ok('7-2-01-const', r[0] === 5 && r[1] === 90 && r[2] === 450 && r[3] === 4 && r[4] === 180 && r[5] === 720 && r[6] === 720,
      `普通 ${r[0]}Hz×${r[1]}s=${r[2]}点 · TA ${r[3]}Hz×${r[4]}s=${r[5]}点 · 解码上界 ${r[6]}`);
    await p.close();
  } catch (e) { err('7-2-01-const', e); }

  /* 02 TA 自动落种子（核心缺陷：原先 G.seed=0 导致 gcodeMine 返空） */
  try {
    const p = await fresh(b);
    const r = await ev(p, `(()=>{
      NOVA.ta.start();
      var a=G.seed;
      NOVA.ta.mode(false);startGame(HULLS[0]);
      var b=G.seed;
      return JSON.stringify({ta:a,norm:b});})()`);
    ok('7-2-02-autoseed', r.ta > 0 && r.ta <= 36 ** 6 - 1 && r.norm === 0,
      `TA 开局种子 ${r.ta}（有）· 普通局 ${r.norm}（0=随机，不变）`);
    await p.close();
  } catch (e) { err('7-2-02-autoseed', e); }

  /* 03 TA 两次开局种子不同（不能每次都是同一张图） */
  try {
    const p = await fresh(b);
    const r = await ev(p, `(()=>{
      NOVA.ta.start();var a=G.seed;
      NOVA.ta.start();var b=G.seed;
      NOVA.ta.start();var c=G.seed;
      return JSON.stringify({a:a,b:b,c:c,same:(a===b||b===c||a===c)});})()`);
    ok('7-2-03-distinct', r.same === false && r.a > 0 && r.b > 0 && r.c > 0,
      `三连开 ${r.a} / ${r.b} / ${r.c} 互不相同`);
    await p.close();
  } catch (e) { err('7-2-03-distinct', e); }

  /* 04 玩家自带种子优先（不被自动种子覆盖） */
  try {
    const p = await fresh(b);
    const r = await ev(p, `(()=>{
      G.taMode=true;G.dailyMode=false;G.daily=null;
      startGame(HULLS[0],NOVA.seed.code?12345:12345);
      return JSON.stringify({seed:G.seed,code:seedCode(G.seed)});})()`);
    ok('7-2-04-override', r.seed === 12345 && r.code === '0009IX',
      `手填 12345 → G.seed=${r.seed} · 短码 ${r.code}`);
    await p.close();
  } catch (e) { err('7-2-04-override', e); }

  /* 05 TA 能出轨迹码了，且比普通局长（覆盖 180s vs 90s） */
  try {
    const p = await fresh(b);
    const r = await ev(p, `(()=>{
      function fly(sec){G.mode='play';var t0=G.runT;
        for(var i=0;i<sec*10;i++){G.runT=t0+i*0.1;
          var t=G.runT;
          P.x=WORLD.w/2+140*Math.cos(0.7*t)+60*Math.cos(1.9*t)+40*Math.cos(3.3*t);
          P.y=WORLD.h/2+150*Math.sin(0.8*t)+55*Math.sin(2.1*t)+38*Math.sin(3.7*t);
          P.angle=t;ghostRec();}}
      NOVA.ta.start();fly(180);
      var ta=gcodeMine();
      var taN=(function(){var d=gcodeDec(ta);return d?d.n:0;})();
      NOVA.ta.mode(false);startGame(HULLS[0]);G.seed=normSeed(999);fly(180);
      var nm=gcodeMine();
      return JSON.stringify({taLen:ta.length,taN:taN,nmLen:nm.length,
        taDt:+(1/NOVA.gcode.taHz()).toFixed(3)});})()`);
    ok('7-2-05-emit', r.taLen > 0 && r.taN === 720 && r.nmLen > 0 && r.taLen > r.nmLen,
      `TA 码 ${r.taLen} 字 / ${r.taN} 点（dt=${r.taDt}s）· 普通码 ${r.nmLen} 字 · TA 更长=${r.taLen > r.nmLen}`);
    await p.close();
  } catch (e) { err('7-2-05-emit', e); }

  /* 06 解码 dt 跟随头部 hz（不是写死的 1/GCODE_HZ） */
  try {
    const p = await fresh(b);
    const r = await ev(p, `(()=>{
      function fly(sec){G.mode='play';var t0=G.runT;
        for(var i=0;i<sec*10;i++){G.runT=t0+i*0.1;var t=G.runT;
          P.x=WORLD.w/2+140*Math.cos(0.7*t)+60*Math.cos(1.9*t);
          P.y=WORLD.h/2+150*Math.sin(0.8*t)+55*Math.sin(2.1*t);P.angle=t;ghostRec();}}
      NOVA.ta.start();fly(180);
      var d=gcodeDec(gcodeMine());
      NOVA.ta.mode(false);startGame(HULLS[0]);G.seed=normSeed(777);fly(180);
      var e=gcodeDec(gcodeMine());
      return JSON.stringify({taDt:d?+d.dt.toFixed(4):-1,nmDt:e?+e.dt.toFixed(4):-1});})()`);
    ok('7-2-06-dt', Math.abs(r.taDt - 0.25) < 1e-6 && Math.abs(r.nmDt - 0.2) < 1e-6,
      `TA 码 dt=${r.taDt}（4Hz）· 普通码 dt=${r.nmDt}（5Hz）`);
    await p.close();
  } catch (e) { err('7-2-06-dt', e); }

  /* 07 向后兼容：老码（头部 hz=20）仍按 5Hz 解，不受 TA 档影响 */
  try {
    const p = await fresh(b);
    const r = await ev(p, `(()=>{
      /* 手工造一个「老格式」码：头部第二字节写 20（=100/5Hz），再塞 10 个点 */
      var o=[1,20,1,0,0,0,0,0,0,0,0,0];
      vPut(o,500);vPut(o,7);vPut(o,10);
      var px=0,py=0,pa=0;
      for(var i=0;i<10;i++){
        var x=100+i*8,y=200+i*5,a=(i*10)&255;
        var da=a-pa;if(da>128)da-=256;if(da<-128)da+=256;
        vPut(o,x-px);vPut(o,y-py);vPut(o,da);px=x;py=y;pa=a;}
      var code=b64e(o);
      var d=gcodeDec(code);
      var after=gcodeHz();
      return JSON.stringify({ok:!!d,dt:d?+d.dt.toFixed(4):-1,n:d?d.n:-1,hzNow:after});})()`);
    ok('7-2-07-compat', r.ok === true && Math.abs(r.dt - 0.2) < 1e-6 && r.n === 10,
      `老码（头部 hz=20）照样解出 dt=${r.dt} · ${r.n} 点 —— 与当前模式 ${r.hzNow}Hz 无关`);
    await p.close();
  } catch (e) { err('7-2-07-compat', e); }

  /* 08 TA 结算显示种子（6.1 的规矩：有种子就显示） */
  try {
    const p = await fresh(b);
    const r = await ev(p, `(()=>{
      NOVA.ta.start();G.score=100;Wv.n=5;die();NOVA.death.finish();
      return JSON.stringify({hidden:el.overSeed.hidden,txt:el.overSeed.textContent});})()`);
    ok('7-2-08-seedline', r.hidden === false && /^SEED · [0-9A-Z]{6}$/.test(r.txt),
      `结算种子行显示「${r.txt}」`);
    await p.close();
  } catch (e) { err('7-2-08-seedline', e); }

  /* 09 TA 结算给出轨迹链接按钮（原先因为无种子而隐藏） */
  try {
    const p = await fresh(b);
    const r = await ev(p, `(()=>{
      function fly(sec){G.mode='play';var t0=G.runT;
        for(var i=0;i<sec*10;i++){G.runT=t0+i*0.1;var t=G.runT;
          P.x=WORLD.w/2+140*Math.cos(0.7*t);P.y=WORLD.h/2+150*Math.sin(0.8*t);
          P.angle=t;ghostRec();}}
      NOVA.ta.start();fly(120);
      G.score=100;Wv.n=5;die();NOVA.death.finish();
      return JSON.stringify({btn:el.btnGhostO.hidden,url:gcodeUrl(gcodeMine()).length});})()`);
    ok('7-2-09-share', r.btn === false && r.url > 1900,
      `轨迹链接按钮已显示 · 链接 ${r.url} 字（含 #seed= & #g=）`);
    await p.close();
  } catch (e) { err('7-2-09-share', e); }

  /* 10 外来影子注入：TA 码解出的 dt 正确，能按 180s 播完 */
  try {
    const p = await fresh(b);
    const r = await ev(p, `(()=>{
      function fly(sec){G.mode='play';var t0=G.runT;
        for(var i=0;i<sec*10;i++){G.runT=t0+i*0.1;var t=G.runT;
          P.x=WORLD.w/2+140*Math.cos(0.7*t);P.y=WORLD.h/2+150*Math.sin(0.8*t);
          P.angle=t;ghostRec();}}
      NOVA.ta.start();fly(180);
      var code=gcodeMine();
      var g=gcodeDec(code);
      var last=ghostAt?null:null;
      /* 用通用插值按解出的 dt 走一遍：180s 处必须还有位置（覆盖整局） */
      var n=g.n,dt=g.dt;
      var atEnd=gpAt(g.pts,n,dt,179.5);
      var atHalf=gpAt(g.pts,n,dt,90);
      return JSON.stringify({n:n,dt:+dt.toFixed(3),half:!!atHalf,end:!!atEnd,
        span:+(n*dt).toFixed(1)});})()`);
    ok('7-2-10-span', r.n === 720 && r.half === true && r.end === true && r.span >= 179,
      `解出 ${r.n} 点 · dt=${r.dt}s · 跨 ${r.span}s —— 90s 处与 179.5s 处都有位置`);
    await p.close();
  } catch (e) { err('7-2-10-span', e); }

  /* 11 回归：6.6 随机局仍不出码 · 6.5 幽灵钩子不破 */
  try {
    const p = await fresh(b);
    const r = await ev(p, `(()=>{
      NOVA.ta.mode(false);startGame(HULLS[0]);   /* 无种子随机局 */
      G.mode='play';
      for(var i=0;i<600;i++){G.runT=i*0.1;P.x=300+i;P.y=400;P.angle=0;ghostRec();}
      var noSeed=gcodeMine();
      var gp=NOVA.ghost.push(1,2,3).gn;
      return JSON.stringify({noSeed:noSeed,gp:gp,max:NOVA.gcode.max()});})()`);
    ok('7-2-11-regress', r.noSeed === '' && r.gp >= 1 && r.max === 450,
      `随机局 gcodeMine()=「${r.noSeed}」· 幽灵钩子可写 gn=${r.gp} · 非 TA 档上限 ${r.max} 点`);
    await p.close();
  } catch (e) { err('7-2-11-regress', e); }

  /* 12 i18n + 竖屏 390px */
  try {
    const p = await fresh(b, { width: 390, height: 844 });
    const r = await ev(p, `(()=>{
      NOVA.ta.start();taHudPaint();
      G.score=100;Wv.n=4;die();NOVA.death.finish();
      var zh=el.overSeed.textContent;
      return JSON.stringify({sw:document.documentElement.scrollWidth,
        cw:document.documentElement.clientWidth,seed:zh,
        overShown:!el.over.hidden});})()`);
    ok('7-2-12-mobile', r.sw <= r.cw + 1 && /^SEED · /.test(r.seed) && r.overShown === true,
      `390px：scrollW ${r.sw} ≤ clientW ${r.cw} · 种子行「${r.seed}」· 结算面板已渲染`);
    await p.close();
  } catch (e) { err('7-2-12-mobile', e); }

  console.log('\n7.2 冲刺赛闭环：' + pass + ' PASS / ' + fail + ' FAIL');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
