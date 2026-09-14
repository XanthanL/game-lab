/* Phase 5.1 验证 —— 键位重绑定（KEYMAP）
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase5-1-check.js
 * 产出：../.workbuddy/shots/phase5/5-1-*.png + 每行状态断言
 *
 * ⚠️ 数值断言一律自带 ok 字段（4.1 的假绿教训）：只打印不算验证。
 * ⚠️ 每张图独立浏览器实例（file:// 下 localStorage 跨 context 共享）。
 * ⚠️ 真键盘事件用 p.keyboard.press('i') —— 它产生 code=KeyI，与游戏读的 e.code 一致。
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
  /* ⚠️ #boot 加上 .out 之后才 pointer-events:none，没退场就点会被它吃掉 */
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
const ZH = /[\u4e00-\u9fa5]/;

/* 每个用例开头把键位恢复默认 —— 存档跨 context 共享，不重置会污染下一个用例 */
const fresh = p => ev(p, `(function(){NOVA.keys.reset();if(typeof clearSave==='function')clearSave();return 1;})()`);

(async () => {

/* ── 01 默认表：12 个动作，与旧硬编码逐一对齐 ─────────────────── */
await run('5-1-01-defaults', ...D, async p => {
  const r = await evj(p, `(()=>{
    const d=NOVA.keys.defs();
    const want={left:['KeyA','ArrowLeft'],right:['KeyD','ArrowRight'],thrust:['KeyW','ArrowUp'],
      brake:['KeyS','ArrowDown'],fire:['Space',null],pause:['KeyP','Escape'],settings:['KeyO',null],
      mute:['KeyM',null],reroll:['KeyR',null],restart:['KeyR',null],endless:['KeyE',null],quit:['KeyQ',null]};
    const bad=[];
    for(const k in want){
      const a=d.find(x=>x.id===k);
      if(!a){bad.push(k+':缺');continue;}
      if(a.def[0]!==want[k][0]||a.def[1]!==want[k][1])bad.push(k+':'+JSON.stringify(a.def));
      if(!a.zh||!a.en)bad.push(k+':文案缺');
    }
    const zhBad=d.filter(x=>!/[\\u4e00-\\u9fa5]/.test(x.zh)).map(x=>x.id);
    const enBad=d.filter(x=>/[\\u4e00-\\u9fa5]/.test(x.en)).map(x=>x.id);
    return {n:d.length,bad,zhBad,enBad,map:NOVA.keys.map()};})()`);
  const mapOk = JSON.stringify(r.map) === JSON.stringify({
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], thrust: ['KeyW', 'ArrowUp'],
    brake: ['KeyS', 'ArrowDown'], fire: ['Space', null], pause: ['KeyP', 'Escape'],
    settings: ['KeyO', null], mute: ['KeyM', null], reroll: ['KeyR', null],
    restart: ['KeyR', null], endless: ['KeyE', null], quit: ['KeyQ', null],
  });
  const ok = r.n === 12 && !r.bad.length && !r.zhBad.length && !r.enBad.length && mapOk;
  return `${ok ? 'PASS' : 'FAIL'} ${r.n}个动作 错位=[${r.bad}] 中文名异常=[${r.zhBad}] 英文名含中文=[${r.enBad}] 表对齐=${mapOk}`;
});

/* ── 02 推进 / 转向：改绑后旧键失效、新键生效（真跑 updatePlayer） ── */
await run('5-1-02-thrust', ...D, async p => {
  const r = await evj(p, `(()=>{
    startGame(HULLS[0]);G.mode='play';
    const probe=c=>{NOVA.keys.press(c,true);updatePlayer(1/60);const on=P.thrusting;
      NOVA.keys.press(c,false);updatePlayer(1/60);return on;};
    const wBefore=probe('KeyW');
    NOVA.keys.set('thrust',0,'KeyI');
    const wAfter=probe('KeyW'), iAfter=probe('KeyI');
    NOVA.keys.reset();
    const wReset=probe('KeyW');
    return {wBefore,wAfter,iAfter,wReset};})()`);
  const ok = r.wBefore === true && r.wAfter === false && r.iAfter === true && r.wReset === true;
  return `${ok ? 'PASS' : 'FAIL'} 改绑前 W=${r.wBefore} → 改绑后 W=${r.wAfter} / I=${r.iAfter} → 恢复默认 W=${r.wReset}`;
});

/* ── 03 开火：第二槽位同样生效，且不再响应旧键 ────────────────── */
await run('5-1-03-fire', ...D, async p => {
  const r = await evj(p, `(()=>{
    startGame(HULLS[0]);G.mode='play';
    const shots=c=>{NOVA.weapon.clear();NOVA.keys.press(c,true);
      for(let i=0;i<40;i++)updatePlayer(1/60);
      const n=G.bullets.length;NOVA.keys.press(c,false);return n;};
    const space=shots('Space'),none=shots('KeyZ');
    NOVA.keys.set('fire',0,'KeyJ');          // 主键改成 J
    const j=shots('KeyJ'),space2=shots('Space');
    NOVA.keys.set('fire',1,'KeyK');          // 副键再挂一个 K
    const k=shots('KeyK');
    NOVA.keys.reset();
    const space3=shots('Space');
    return {space,none,j,space2,k,space3};})()`);
  const ok = r.space > 0 && r.none === 0 && r.j > 0 && r.space2 === 0
    && r.k > 0 && r.space3 > 0;
  return `${ok ? 'PASS' : 'FAIL'} 默认 SPACE=${r.space}/无关键=${r.none} | 改J后 J=${r.j}/SPACE=${r.space2}`
    + ` | 副键 K=${r.k} | 恢复后 SPACE=${r.space3}`;
});

/* ── 04 撞车：复用已占用的键会把旧的那一格清空 ─────────────────── */
await run('5-1-04-conflict', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.keys.reset();
    const a=NOVA.keys.set('left',0,'KeyM');       // M 原本是静音
    const m=NOVA.keys.map();
    /* ⚠️ 第二次撞车必须重新 reset —— 上一步已经把 left[0] 从 A 改成 M，A 此时是空的 */
    NOVA.keys.reset();
    const b=NOVA.keys.set('right',1,'KeyA');      // A 在 left 的主槽位
    const m2=NOVA.keys.map();
    NOVA.keys.reset();
    return {cleared:a.cleared,mute:m.mute,left:m.left,
      cleared2:b.cleared,left2:m2.left,right2:m2.right};})()`);
  const ok = r.cleared === 'mute' && JSON.stringify(r.mute) === '[null,null]'
    && JSON.stringify(r.left) === '["KeyM","ArrowLeft"]'
    && r.cleared2 === 'left' && JSON.stringify(r.left2) === '[null,"ArrowLeft"]'
    && JSON.stringify(r.right2) === '["KeyD","KeyA"]';
  return `${ok ? 'PASS' : 'FAIL'} 抢M→清空${r.cleared}${JSON.stringify(r.mute)} `
    + `| 抢A→清空${r.cleared2}${JSON.stringify(r.left2)} right=${JSON.stringify(r.right2)}`;
});

/* ── 05 持久化：写盘 → 重载页面后仍是新绑定 ────────────────────── */
await run('5-1-05-persist', ...D, async p => {
  await ev(p, `(function(){NOVA.keys.reset();NOVA.keys.set('brake',0,'KeyB');return 1;})()`);
  const stored = await evj(p, `NOVA.keys.store()`);
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => { const b = document.getElementById('boot'); return !b || b.classList.contains('out'); },
    null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(1200);
  const after = await evj(p, `NOVA.keys.map()`);
  await ev(p, `(function(){NOVA.keys.reset();return 1;})()`);
  const ok = stored && stored.brake && stored.brake[0] === 'KeyB'
    && after.brake[0] === 'KeyB' && after.brake[1] === 'ArrowDown';
  return `${ok ? 'PASS' : 'FAIL'} 落盘${JSON.stringify(stored && stored.brake)} → 重载后${JSON.stringify(after.brake)}`;
});

/* ── 06 恢复默认 ─────────────────────────────────────────── */
await run('5-1-06-reset', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.keys.reset();
    NOVA.keys.set('thrust',0,'KeyI');NOVA.keys.set('fire',0,'KeyJ');NOVA.keys.set('mute',1,'KeyN');
    const dirty=NOVA.keys.map();
    const back=NOVA.keys.reset();
    return {dirtyThrust:dirty.thrust,dirtyFire:dirty.fire,
      thrust:back.thrust,fire:back.fire,mute:back.mute,store:NOVA.keys.store()};})()`);
  const ok = r.dirtyThrust[0] === 'KeyI' && r.dirtyFire[0] === 'KeyJ'
    && r.thrust[0] === 'KeyW' && r.fire[0] === 'Space'
    && JSON.stringify(r.mute) === '["KeyM",null]';
  return `${ok ? 'PASS' : 'FAIL'} 弄脏 thrust=${JSON.stringify(r.dirtyThrust)} fire=${JSON.stringify(r.dirtyFire)}`
    + ` → 恢复 thrust=${JSON.stringify(r.thrust)} fire=${JSON.stringify(r.fire)} mute=${JSON.stringify(r.mute)}`;
});

/* ── 07 坏存档兜底：不抛异常，坏值整动作回退默认 ───────────────── */
await run('5-1-07-bad-save', ...D, async p => {
  await p.evaluate(() => localStorage.setItem('nova-keys', '{"left":"x","thrust":[1,2],"fire":null}'));
  const r = await evj(p, `(()=>{
    let threw=null;
    try{loadKeys();}catch(e){threw=String(e).slice(0,60);}
    const m=NOVA.keys.map();
    return {threw,left:m.left,thrust:m.thrust,fire:m.fire,right:m.right};})()`);
  await p.evaluate(() => localStorage.removeItem('nova-keys'));
  await ev(p, `(function(){loadKeys();return 1;})()`);
  const ok = !r.threw && JSON.stringify(r.left) === '["KeyA","ArrowLeft"]'
    && JSON.stringify(r.thrust) === '[null,null]'
    && JSON.stringify(r.fire) === '["Space",null]'
    && JSON.stringify(r.right) === '["KeyD","ArrowRight"]';
  return `${ok ? 'PASS' : 'FAIL'} 异常=${r.threw} left${JSON.stringify(r.left)}(字符串→回退) `
    + `thrust${JSON.stringify(r.thrust)}(数字→清空) fire${JSON.stringify(r.fire)} right${JSON.stringify(r.right)}未受影响`;
});

/* ── 08 UI 链路：12 行 / 点击进等待态 / 再点取消 ───────────────── */
await run('5-1-08-ui-slots', ...D, async p => {
  const r = await evj(p, `(()=>{
    const u=NOVA.keys.ui();                 // 打开设置面板
    const w0=NOVA.keys.wait();
    NOVA.keys.click('left',0);
    const w1=NOVA.keys.wait(),t1=NOVA.keys.slotText('left',0);
    NOVA.keys.click('left',0);              // 再点一次 = 取消
    const w2=NOVA.keys.wait(),t2=NOVA.keys.slotText('left',0);
    return {hidden:u.hidden,rows:u.rows,w0,w1,t1,w2,t2};})()`);
  const ok = r.hidden === false && r.rows === 12 && r.w0 === null
    && r.w1 && r.w1.act === 'left' && r.w1.slot === 0
    && /wait/.test(r.t1.cls) && r.t1.text.indexOf('按下按键') >= 0
    && r.w2 === null && !/wait/.test(r.t2.cls) && r.t2.text === 'A';
  return `${ok ? 'PASS' : 'FAIL'} ${r.rows}行 等待态${JSON.stringify(r.w1)} 文案「${r.t1.text}」`
    + ` → 取消后 ${JSON.stringify(r.w2)} 文案「${r.t2.text}」`;
});

/* ── 09 真键盘：等待态吃掉按键不派发，抓完键后恢复派发 ─────────── */
await run('5-1-09-capture', ...D, async p => {
  await ev(p, `(function(){startGame(HULLS[0]);G.mode='play';return 1;})()`);
  await ev(p, `(function(){NOVA.keys.ui();NOVA.keys.click('thrust',0);return 1;})()`);
  await p.keyboard.press('i');               // 应被捕获：不推进、不改模式
  const mid = await evj(p, `(()=>({wait:NOVA.keys.wait(),thrust:NOVA.keys.map().thrust,mode:G.mode}))()`);
  await p.keyboard.press('Escape');          // 关设置面板
  await p.keyboard.press('p');               // 现在该正常派发了
  const after = await evj(p, `(()=>({mode:G.mode,hidden:el.pause.hidden,settings:el.settings.hidden}))()`);
  await ev(p, `(function(){NOVA.keys.reset();return 1;})()`);
  const ok = mid.wait === null && mid.thrust[0] === 'KeyI' && mid.mode === 'play'
    && after.settings === true && after.mode === 'pause' && after.hidden === false;
  return `${ok ? 'PASS' : 'FAIL'} 捕获期 mode=${mid.mode}(须play) thrust=${JSON.stringify(mid.thrust)}`
    + ` → 关面板后按P mode=${after.mode} 暂停面板显示=${!after.hidden}`;
});

/* ── 10 HUD 提示跟随键位 ─────────────────────────────────── */
await run('5-1-10-hints', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.keys.reset();
    const a=NOVA.keys.hints();
    NOVA.keys.set('mute',0,'KeyN');NOVA.keys.set('pause',0,'KeyV');
    const b=NOVA.keys.hints();
    NOVA.keys.reset();
    const c=NOVA.keys.hints();
    return {a,b,c};})()`);
  const ok = /M/.test(r.a.mute) && /P/.test(r.a.pause)
    && /N/.test(r.b.mute) && /V/.test(r.b.pause)
    && /M/.test(r.c.mute) && /P/.test(r.c.pause);
  return `${ok ? 'PASS' : 'FAIL'} 默认「${r.a.mute}」/「${r.a.pause}」→ 改后「${r.b.mute}」/「${r.b.pause}」`
    + ` → 恢复「${r.c.mute}」/「${r.c.pause}」`;
});

/* ── 11 中英：动作名与槽位文案都跟语言走 ─────────────────────── */
await run('5-1-11-lang', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.keys.reset();
    NOVA.death.lang('en');renderKeyList();
    const en=[...el.keyList.querySelectorAll('.keyrow')].map(r=>({
      act:r.dataset.act,lab:r.querySelector('.klabel').textContent,
      slots:[...r.querySelectorAll('.keyslot')].map(b=>b.textContent)}));
    const zhDirty=en.filter(x=>/[\\u4e00-\\u9fa5]/.test(x.lab+x.slots.join(''))).map(x=>x.act);
    /* ⚠️ 分节标题必须在切回中文之前读 —— 切回去它就变回「键位」了 */
    /* ⚠️ 取「键位」那一节本身 —— 5.3 在它前面加了「显示与性能」，
       再写 querySelector('.sec-head') 会读到新增的那一节 */
    const secHead=document.querySelector('#settings [data-i18n="st_keys"]').textContent.trim();
    NOVA.death.lang('zh');renderKeyList();
    const zh=[...el.keyList.querySelectorAll('.keyrow')].map(r=>r.querySelector('.klabel').textContent);
    const enDirty=zh.filter(t=>!/[\\u4e00-\\u9fa5]/.test(t));
    return {n:en.length,first:en[0],head:en.find(x=>x.act==='settings'),zhDirty,zhFirst:zh[0],enDirty,
      secHead};})()`);
  const ok = r.n === 12 && r.first.lab === 'Turn left' && !r.zhDirty.length
    && r.zhFirst === '左转' && !r.enDirty.length && r.head.lab === 'Settings'
    && r.secHead.indexOf('Controls') >= 0;
  return `${ok ? 'PASS' : 'FAIL'} 英文首行「${r.first.lab}」设置「${r.head.lab}」分节「${r.secHead}」`
    + ` 中文残留=[${r.zhDirty}] | 中文首行「${r.zhFirst}」非中文=[${r.enDirty}]`;
});

/* ── 12 数据规模回归 + 图鉴不受影响 ─────────────────────────── */
await run('5-1-12-regress', ...D, async p => {
  await p.evaluate(() => { NOVA.logbook.open(); NOVA.logbook.codex(); });
  await p.waitForTimeout(500);
  const c = await p.evaluate(() => NOVA.counts());
  const lb = await p.evaluate(() => NOVA.logbook.counts());
  const m = await evj(p, `({mods:MODULES.length,syn:SYN.length,
    lvEnMissing:MODULES.filter(m=>!LV_EN[m.id]||LV_EN[m.id].length!==m.max).map(m=>m.id),
    synEnMissing:SYN.filter(s=>!SYN_EN[s.id]).map(s=>s.id),meta:NOVA.meta.tree().length,
    bosses:Object.keys(BOSS_MV).length,hulls:HULLS.length,
    secHeads:document.querySelectorAll('#logbook .sec-head').length})`);
  const r = Object.assign({}, c, lb, m);
  const ok = r.mods === 29 && r.syn === 26 && !r.lvEnMissing.length && !r.synEnMissing.length
    && r.enemies === 24 && r.bosses === 8 && r.codexHulls === 7 && r.affix === 3
    && r.nodes === 18 && r.links === 22 && r.meta === 13 && r.secHeads === 1;   /* 7.9：日志只剩「累计记录」一节 */
  return `${ok ? 'PASS' : 'FAIL'} ` + JSON.stringify(r);
});

/* ── 13 竖屏：设置面板无横向溢出，12 行都在 ─────────────────── */
await run('5-1-13-mobile', ...M, async p => {
  const r = await evj(p, `(()=>{
    NOVA.keys.reset();
    const u=NOVA.keys.ui();
    const de=document.documentElement;
    const rows=[...el.keyList.querySelectorAll('.keyrow')];
    const over=rows.filter(r=>{const b=r.getBoundingClientRect();return b.right>390||b.left<0;}).length;
    return {rows:rows.length,over,sw:de.scrollWidth,vw:window.innerWidth,
      scrollable:el.settings.scrollHeight>=el.settings.clientHeight};})()`);
  const ok = r.rows === 12 && r.over === 0 && r.sw <= r.vw;
  return `${ok ? 'PASS' : 'FAIL'} ${r.rows}行 出界${r.over} 文档宽${r.sw}/视窗${r.vw} 可滚动=${r.scrollable}`;
});

/* ── 14 引导文案跟着键位走：默认仍写 WASD，改绑后才降级成键名 ── */
await run('5-1-14-guide', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.keys.reset();
    const m=()=>guideFill(GUIDE_STEPS.find(x=>x.id==='move'));
    const f=()=>guideFill(GUIDE_STEPS.find(x=>x.id==='fire'));
    const a={m:m(),f:f()};
    NOVA.keys.set('thrust',0,'KeyI');
    const b={m:m(),f:f()};
    NOVA.keys.set('fire',0,'KeyJ');
    const c={m:m(),f:f()};
    NOVA.keys.reset();
    const d={m:m(),f:f()};
    return {a,b,c,d};})()`);
  const ok = /WASD/.test(r.a.m) && /SPACE/.test(r.a.f)
    && !/WASD/.test(r.b.m) && /\bI\b/.test(r.b.m) && /SPACE/.test(r.b.f)
    && /J/.test(r.c.f) && !/SPACE/.test(r.c.f)
    && /WASD/.test(r.d.m) && /SPACE/.test(r.d.f);
  return `${ok ? 'PASS' : 'FAIL'} 默认「${r.a.m}」→ 推进改I「${r.b.m}」`
    + ` → 开火改J「${r.c.f}」→ 恢复「${r.d.m}」`;
});

})();
