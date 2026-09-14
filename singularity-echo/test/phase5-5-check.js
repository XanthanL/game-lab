/* Phase 5.5 验证 —— 移动端专项（虚拟摇杆手感 / 安全区 / 横竖屏）
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase5-5-check.js
 * 产出：../.workbuddy/shots/phase5/5-5-*.png + 每行状态断言
 *
 * ⚠️ 摇杆的「模拟量」必须**量**出来：改前推 3px 与推 46px 在 0.5s 内都转满 90°
 *    （旧代码是恒定 10 rad/s 斜率）。所以断言取 8 帧（0.133s）—— 这段时间内
 *    满舵也到不了目标角，转角才与推杆幅度成正比。取 0.5s 会被目标角 clamp 成常数。
 * ⚠️ 重锚只能派发真实 TouchEvent 测：`NOVA.touch.set()` 绕过了 touchmove 里的逻辑。
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const OUT = path.join(__dirname, 'phase5');
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}

const P = [390, 844], L = [844, 390];

async function run(tag, vw, vh, job) {
  const b = await chromium.launch({ executablePath: EXE });
  const c = await b.newContext({
    viewport: { width: vw, height: vh }, deviceScaleFactor: 3,
    hasTouch: true, isMobile: true,
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
const play = p => ev(p, `(function(){startGame(HULLS[0]);G.mode='play';setTouch(true);return 1;})()`);

(async () => {

/* ── 01 模拟量转向：推杆幅度 → 转角严格递增 ─────────────── */
await run('5-5-01-analog', ...P, async p => {
  await play(p);
  const r = await evj(p, `(()=>{
    const out=[];
    for(const px of [3,10,20,33,46]){
      P.angle=0;
      NOVA.touch.set(0,px);          // 向下推 = 目标角 90°
      for(let i=0;i<8;i++)updatePlayer(1/60);
      out.push({px,deg:+(P.angle*180/Math.PI).toFixed(2),mag:+joy.mag.toFixed(3)});
    }
    NOVA.touch.clear();return out;})()`);
  const d = r.map(x => x.deg);
  const ok = d[0] === 0 && d[1] < d[2] && d[2] < d[3] && d[3] < d[4] && d[4] > 25;
  return `${ok ? 'PASS' : 'FAIL'} 8帧转角 ${r.map(x => x.px + 'px:' + x.deg + '°').join(' ')}` +
    `（mag ${r.map(x => x.mag).join('/')}）· 死区内必须 0、之后严格递增`;
});

/* ── 02 死区：抖动不该转船 ──────────────────────────────── */
await run('5-5-02-deadzone', ...P, async p => {
  await play(p);
  const r = await evj(p, `(()=>{
    const o={};
    for(const px of [1,2,4,6,8]){
      P.angle=0;NOVA.touch.set(px,px);
      for(let i=0;i<30;i++)updatePlayer(1/60);
      o[px]=+(P.angle*180/Math.PI).toFixed(3);
    }
    NOVA.touch.clear();return o;})()`);
  const dz = (await evj(p, `NOVA.touch.const()`)).DZ;
  const ok = r['1'] === 0 && r['2'] === 0 && r['4'] === 0;
  return `${ok ? 'PASS' : 'FAIL'} 推 1/2/4px → ${r['1']}/${r['2']}/${r['4']}°（须全 0）` +
    ` · 6/8px → ${r['6']}/${r['8']}° · 死区 ${dz}`;
});

/* ── 03 下拉 = 刹车（改前 up / down 都在推进） ──────────── */
await run('5-5-03-brake', ...P, async p => {
  await play(p);
  const r = await evj(p, `(()=>{
    const run=(dy)=>{P.vx=300;P.vy=0;P.angle=0;
      NOVA.touch.set(0,dy);
      for(let i=0;i<30;i++)updatePlayer(1/60);
      const s=Math.hypot(P.vx,P.vy);NOVA.touch.clear();return +s.toFixed(1);};
    return {up:run(-46),down:run(46),idle:run(0)};})()`);
  const ok = r.down < r.idle * 0.55 && r.up > r.idle;
  return `${ok ? 'PASS' : 'FAIL'} 初速 300 → 上推 ${r.up} · 不动 ${r.idle} · 下拉 ${r.down}` +
    `（下拉须明显低于不动：它是刹车不是推进）`;
});

/* ── 04 手指拖远时底盘重锚，且满舵不跳变 ───────────────── */
await run('5-5-04-reanchor', ...P, async p => {
  await play(p);
  const r = await evj(p, `(()=>{
    const T=(id,x,y)=>new Touch({identifier:id,target:document.body,clientX:x,clientY:y});
    const fire=(type,x,y)=>{const t=T(7,x,y);
      window.dispatchEvent(new TouchEvent(type,{changedTouches:[t],touches:[t],bubbles:true}));};
    fire('touchstart',100,600);
    const o0={left:joybase.style.left,top:joybase.style.top};
    fire('touchmove',100+40,600);            // 杆内：底盘不动
    const near={left:joybase.style.left,mag:+joy.mag.toFixed(3)};
    fire('touchmove',100+3*46+30,600);       // 拖到 3R 外：应重锚
    const far={left:joybase.style.left,mag:+joy.mag.toFixed(3),dx:+joy.dx.toFixed(1)};
    fire('touchend',100+3*46+30,600);
    return {o0,near,far,clean:joy.on===false};})()`);
  const moved = r.far.left !== r.near.left;
  const ok = r.o0.left === r.near.left && moved && r.far.mag === 1 && r.clean;
  return `${ok ? 'PASS' : 'FAIL'} 近距底盘不动(${r.near.left}) · 拖远后挪到 ${r.far.left}` +
    ` · 满舵 mag=${r.far.mag} dx=${r.far.dx}（重锚须保持满舵，不能归零让船停转）`;
});

/* ── 05 安全区变量链路 + FIRE 按钮用 calc 避让 ─────────── */
await run('5-5-05-safearea', ...P, async p => {
  await play(p);   // ⚠️ #firebtn 在菜单态是 hidden，rect 全 0，量出来的是视口尺寸
  const r = await evj(p, `(()=>({safe:NOVA.touch.safe(),btn:NOVA.touch.btnRect(),
    css:{t:CSS.supports('top','env(safe-area-inset-top)')}}))()`);
  const has = ['t', 'r', 'b', 'l'].every(k => typeof r.safe[k] === 'string' && r.safe[k] !== '');
  const ok = has && r.btn.right === 28 && r.btn.bottom === 34 && r.btn.w === 96;
  return `${ok ? 'PASS' : 'FAIL'} --safe-* = ${JSON.stringify(r.safe)}` +
    ` · FIRE 距右/底 ${r.btn.right}/${r.btn.bottom}px（= 28/34 + inset）`;
});

/* ── 06 竖屏提示：出现 / 点击永久忽略 / 横屏不出现 ─────── */
await run('5-5-06-orient', ...P, async p => {
  await play(p);
  await ev(p, `NOVA.touch.sync()`);
  const a = await evj(p, `NOVA.touch.orient()`);
  /* ⚠️ 不能用 p.click()：Playwright 发的是**真鼠标**，pointerType==='mouse'
     会触发 5.5 的「切回键鼠」把 isTouch 置 false，提示当场消失，这一下永远点不到。
     真机上玩家用的是手指（pointerType==='touch'），不会有这个问题。 */
  await p.tap('#orhint');
  const b = await evj(p, `NOVA.touch.orient()`);
  const ls = await p.evaluate(() => localStorage.getItem('nova-orient'));
  await p.setViewportSize({ width: 844, height: 390 });
  await p.waitForTimeout(300);
  await ev(p, `NOVA.touch.sync()`);
  const c = await evj(p, `NOVA.touch.orient()`);
  const ok = a.hidden === false && a.on === true && b.hidden === true
    && b.ignored === true && ls === '1' && c.land === true && c.hidden === true;
  return `${ok ? 'PASS' : 'FAIL'} 竖屏出现=${!a.hidden} → 点击后 ignored=${b.ignored}` +
    ` 存档=${ls} → 转横屏 land=${c.land} hidden=${c.hidden}`;
});

/* ── 07 竖屏提示中英 ───────────────────────────────────── */
await run('5-5-07-i18n', ...P, async p => {
  await play(p);
  await ev(p, `NOVA.touch.sync()`);
  const zh = await p.textContent('#orhint span[data-i18n]');
  await ev(p, `(function(){setLang('en');return 1;})()`);
  const en = await p.textContent('#orhint span[data-i18n]');
  const ok = /横屏/.test(zh) && /Landscape/i.test(en) && zh !== en;
  return `${ok ? 'PASS' : 'FAIL'} 中「${zh}」/ 英「${en}」`;
});

/* ── 08 真鼠标按下时从触屏切回键鼠 ─────────────────────── */
await run('5-5-08-mouse-back', ...P, async p => {
  await play(p);
  const a = await evj(p, `NOVA.touch.isTouch()`);
  await p.mouse.move(200, 400);
  await p.mouse.down(); await p.mouse.up();
  const b = await evj(p, `NOVA.touch.isTouch()`);
  const ok = a === true && b === false;
  return `${ok ? 'PASS' : 'FAIL'} 触屏后 isTouch=${a} → 真鼠标按下后 isTouch=${b}` +
    `（触屏笔记本插鼠标不该被永久判成触屏）`;
});

/* ── 09 回归：键盘 / 手柄转向不受摇杆改动影响 ──────────── */
await run('5-5-09-regress', ...P, async p => {
  await play(p);
  const r = await evj(p, `(()=>{
    P.angle=0;keys[KEYMAP.right[0]]=true;
    for(let i=0;i<30;i++)updatePlayer(1/60);
    const key=+(P.angle*180/Math.PI).toFixed(2);keys[KEYMAP.right[0]]=false;
    P.angle=0;PAD.ax=1;PAD.on=true;
    for(let i=0;i<30;i++)updatePlayer(1/60);
    const pad=+(P.angle*180/Math.PI).toFixed(2);PAD.ax=0;PAD.on=false;
    return {key,pad,turn:+P.turn.toFixed(2)};})()`);
  const ok = r.key > 50 && r.pad > 50;
  return `${ok ? 'PASS' : 'FAIL'} 0.5s 转角 键${r.key}° 手柄${r.pad}°（P.turn=${r.turn}）`;
});

/* ── 10 竖屏 / 横屏都不出界，FIRE 与摇杆都在屏内 ───────── */
await run('5-5-10-bounds', ...P, async p => {
  await play(p);
  const chk = async () => await evj(p, `(()=>{
    const bad=[];
    for(const e of document.querySelectorAll('#hud>*,#firebtn,#orhint')){
      const r=e.getBoundingClientRect();
      if(!r.width||e.hidden)continue;
      if(r.right>innerWidth+1||r.left<-1||r.bottom>innerHeight+1||r.top<-1)
        bad.push((e.id||e.className)+':'+Math.round(r.left)+','+Math.round(r.top)+'~'+Math.round(r.right)+','+Math.round(r.bottom));
    }
    return {sw:document.documentElement.scrollWidth,vw:innerWidth,vh:innerHeight,bad};})()`);
  const a = await chk();
  await p.setViewportSize({ width: 844, height: 390 });
  await p.waitForTimeout(400);
  const b = await chk();
  const ok = a.sw <= a.vw && b.sw <= b.vw && !a.bad.length && !b.bad.length;
  return `${ok ? 'PASS' : 'FAIL'} 竖屏 ${a.vw}×${a.vh} 溢出 ${a.bad.length} · 横屏 ${b.vw}×${b.vh} 溢出 ${b.bad.length}` +
    (a.bad.length ? ' ' + a.bad.join(' | ') : '') + (b.bad.length ? ' ' + b.bad.join(' | ') : '');
});

/* ── 11 触屏下打得死人（摇杆 + FIRE 全链路） ───────────── */
await run('5-5-11-play', ...L, async p => {
  await play(p);
  const r = await evj(p, `(()=>{
    startGame(HULLS[0]);G.mode='play';setTouch(true);
    P.hp=1e9;P.maxHp=1e9;P.invuln=1e9;P.dmg=60;
    const R=200;
    for(let k=0;k<14;k++)spawnEnemy(EN_LIST[0],P.x+Math.cos(k/14*6.2832)*R,P.y+Math.sin(k/14*6.2832)*R);
    fireOn=true;let vmax=0;
    /* ⚠️ 不能一路满舵推到底：10 秒能跑 3000px，早撞上世界边界（速度被钳 0）
       也飞出了 200px 的敌人圈 —— 那时「0 击杀」是测试自己造成的，不是玩法坏了。
       只推 1 秒验证「杆确实在驱动船」，剩下的时间松杆让它留在敌群里打。 */
    for(let i=0;i<600;i++){
      if(i<60)NOVA.touch.set(0,-46);else NOVA.touch.clear();
      updateAim();updateWorld(1/60);
      vmax=Math.max(vmax,Math.hypot(P.vx,P.vy));
    }
    fireOn=false;NOVA.touch.clear();
    return {kills:G.kills,vmax:+vmax.toFixed(0),v:+Math.hypot(P.vx,P.vy).toFixed(0)};})()`);
  const ok = r.kills >= 3 && r.vmax > 150;
  return `${ok ? 'PASS' : 'FAIL'} 满舵 1 秒峰速 ${r.vmax}（杆在驱动船）· 击杀 ${r.kills}` +
    `（松杆后末速 ${r.v} —— 留在敌群里才打得到）`;
});

/* ── 12 回归：5.1 键位 / 5.3 设置 / 5.4 预算都还在 ─────── */
await run('5-5-12-keep', ...P, async p => {
  const r = await evj(p, `(()=>{
    const S=document.getElementById('settings');S.classList.add('show');
    const q=S.querySelectorAll('#optQuality .segb').length;
    const keys=document.querySelectorAll('#keyList .keyrow').length;
    const slots=document.querySelectorAll('#keyList .keyslot').length;
    S.classList.remove('show');
    return {q,keys,slots,budget:NOVA.perf().budget.parts,tg:padTargets().length};})()`);
  const ok = r.q === 4 && r.keys === 12 && r.slots === 24 && r.budget === 560 && r.tg > 0;
  return `${ok ? 'PASS' : 'FAIL'} 画质${r.q}档 键位${r.keys}×${r.slots / r.keys}槽` +
    ` 高画质粒子预算${r.budget} 手柄可达${r.tg}`;
});

/* ── 13 touchcancel 不要立刻打死摇杆（手机端超频发）───────
   原始 endTouch 把 touchend / touchcancel 一律立即 joy.id=null；手机上浏览器滚屏/保留/系统手势会抢手势发 touchcancel，
   玩家手指其实还在屏幕上，摇杆已被打死，必须抬起重新摸。修后 touchcancel 延迟 120ms 收尾：
   同一手指 touchmove 续上 → 摇杆继续工作；真抬起→ touchend 一律收尾。以下验证：
   A) cancel 后 50ms 内 touchmove 同 id → joy.on 仍为 true、dx 跟手
   B) cancel 后 150ms 静默 → joy.on 如期关闭（避免摇杆死走）
   C) touchend 立即关闭（兑底未破）  */
await run('5-5-13-cancel', ...P, async p => {
  await play(p);
  const dispatch = async (id, type, x, y) => await ev(p,
    `(function(){
      const t=new Touch({identifier:${id},target:document.body,clientX:${x},clientY:${y}});
      const isEnd=${type==='touchend'||type==='touchcancel'?'true':'false'};
      window.dispatchEvent(new TouchEvent('${type}',{bubbles:true,cancelable:false,touches:isEnd?[]:[t],targetTouches:isEnd?[]:[t],changedTouches:isEnd?[t]:[t]}));
      return 1;
    })()`);
  /* A */
  await dispatch(1,'touchstart',137,506);
  await dispatch(1,'touchmove',137,460);
  const before=await evj(p,`NOVA.touch.state()`);
  await dispatch(1,'touchcancel',137,460);
  await p.waitForTimeout(50);
  await dispatch(1,'touchmove',91,506);
  await p.waitForTimeout(40);
  const after=await evj(p,`NOVA.touch.state()`);
  const okA=before.on===true&&after.on===true&&after.dx===-46&&after.dy===0;
  await dispatch(1,'touchend',91,506);
  /* B */
  await dispatch(1,'touchstart',137,506);
  await dispatch(1,'touchmove',137,460);
  await dispatch(1,'touchcancel',137,460);
  await p.waitForTimeout(150);
  const b=await evj(p,`NOVA.touch.state()`);
  const okB=b.on===false&&b.mag===0;
  /* C */
  await dispatch(1,'touchstart',137,506);
  await dispatch(1,'touchmove',137,460);
  await dispatch(1,'touchend',137,460);
  const c=await evj(p,`NOVA.touch.state()`);
  const okC=c.on===false&&c.mag===0;
  const ok=okA&&okB&&okC;
  return `${ok?'PASS':'FAIL'} 后收尾：A 50ms后续上左推dx=${after.dx} on=${after.on} · B 150ms后 on=${b.on} · C touchend后 on=${c.on}`;
});
/* ── 14 touchcancel 后 120ms 内新手指触摸：必须能接管（原 7.6 修后的缺口）──────
   7.6 修完后 touchstart 仍按 joy.id===null 判定，joy.id 占着旧 id 时新手指被吞。
   修：joy.endT 待收尾时也允许 touchstart 接管；timeout 回调里 endT=0 避免残留 truthy。  */
await run('5-5-14-takeover', ...P, async p => {
  await play(p);
  const dispatch = async (id, type, x, y) => await ev(p,
    `(function(){
      const t=new Touch({identifier:${id},target:document.body,clientX:${x},clientY:${y}});
      const isEnd=${type==='touchend'||type==='touchcancel'?'true':'false'};
      window.dispatchEvent(new TouchEvent('${type}',{bubbles:true,cancelable:false,touches:isEnd?[]:[t],targetTouches:isEnd?[]:[t],changedTouches:isEnd?[t]:[t]}));
      return 1;
    })()`);
  await dispatch(1,'touchstart',137,506);
  await dispatch(1,'touchmove',137,460);
  await dispatch(1,'touchcancel',137,460);
  await p.waitForTimeout(30);
  await dispatch(2,'touchstart',200,600);
  await dispatch(2,'touchmove',246,600);
  const s=await evj(p,`NOVA.touch.state()`);
  const ok=s.dx===46&&s.dy===0;
  await dispatch(2,'touchend',246,600);
  return `${ok?'PASS':'FAIL'} cancel 后 30ms 新手指右推：dx=${s.dx} dy=${s.dy}（期望 46/0）`;
});

})();
