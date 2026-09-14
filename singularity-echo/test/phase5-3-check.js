/* Phase 5.3 验证 —— 设置面板补完（画质档 / 特效开关 / 色盲模式 / 减弱动态）
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase5-3-check.js
 * 产出：../.workbuddy/shots/phase5/5-3-*.png + 每行状态断言
 *
 * ⚠️ 数值断言一律自带 ok 字段：只打印不算验证。
 * ⚠️ 色盲那条是本项目第一次「用模拟矩阵量化辨色」—— 基础配色必须不过线，
 *    否则说明这条断言根本没在测东西。
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

/* ── 01 默认值与表定义 ─────────────────────────────────────── */
await run('5-3-01-defaults', ...D, async p => {
  const r = await evj(p, `(()=>{const o=NOVA.opts.get(),d=NOVA.opts.defs();
    return {o,d,bad:Object.keys(o).length};})()`);
  const ok = r.o.quality === 'auto' && r.o.cb === 'off' && r.o.shake === 1
    && r.o.nebula === 1 && r.o.glow === 1 && r.o.parts === 1 && r.o.motion === 0
    && r.d.q.length === 4 && r.d.cb.length === 3 && r.d.bool.length === 6;
  return `${ok ? 'PASS' : 'FAIL'} ${JSON.stringify(r.o)} · 画质${r.d.q.length}档 色盲${r.d.cb.length}档 开关${r.d.bool.length}个`;
});

/* ── 02 持久化与坏档兜底 ──────────────────────────────────── */
await run('5-3-02-persist', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.opts.set('quality','low');NOVA.opts.set('cb','rg');NOVA.opts.set('shake',0);
    const raw=NOVA.opts.store();
    /* 重载：清掉内存态再 loadOpts() */
    OPTS.quality='auto';OPTS.cb='off';OPTS.shake=1;
    loadOpts();
    const back={q:OPTS.quality,cb:OPTS.cb,shake:OPTS.shake};
    /* 坏档：每项单独判定，只回退坏的那一项 */
    try{localStorage.setItem('nova-opts','{"quality":"ultra","cb":9,"shake":"yes","glow":1}');}catch(e){}
    OPTS.quality='auto';OPTS.cb='off';OPTS.glow=1;loadOpts();
    const bad={q:OPTS.quality,cb:OPTS.cb,glow:OPTS.glow};
    /* 非对象 */
    try{localStorage.setItem('nova-opts','"nope"');}catch(e){}
    const before=OPTS.quality;loadOpts();
    const junk=OPTS.quality===before;
    try{localStorage.removeItem('nova-opts');}catch(e){}
    NOVA.opts.reset();
    return {raw,back,bad,junk};})()`);
  const ok = r.back.q === 'low' && r.back.cb === 'rg' && r.back.shake === 0
    && r.bad.q === 'auto' && r.bad.cb === 'off' && r.bad.glow === 1 && r.junk;
  return `${ok ? 'PASS' : 'FAIL'} 落盘→重载 ${JSON.stringify(r.back)}`
    + ` · 坏档只回退坏项 ${JSON.stringify(r.bad)} · 非对象存档不动=${r.junk}`;
});

/* ── 03 画质四档：qTier / 自动开关 ─────────────────────────── */
await run('5-3-03-quality', ...D, async p => {
  const r = await evj(p, `(()=>{
    const out={};
    for(const q of ['auto','high','mid','low']){
      NOVA.opts.set('quality',q);
      out[q]={tier:NOVA.opts.tier(),auto:NOVA.opts.auto(),dpr:NOVA.opts.dpr()};
    }
    out.cap=NOVA.opts.fluidCap();
    NOVA.opts.reset();
    return out;})()`);
  const ok = r.auto.tier === 0 && r.auto.auto === true
    && r.high.tier === 0 && r.high.auto === false
    && r.mid.tier === 1 && r.mid.auto === false
    && r.low.tier === 2 && r.low.auto === false
    && r.low.dpr <= r.high.dpr;
  return `${ok ? 'PASS' : 'FAIL'} auto T${r.auto.tier}/自动${r.auto.auto}`
    + ` · high T${r.high.tier} · mid T${r.mid.tier} · low T${r.low.tier} dpr${r.low.dpr}`
    + ` · 本机 WebGL=${r.cap}`;
});

/* ── 04 手动档锁死：持续掉帧也不自动降级 ───────────────────── */
await run('5-3-04-quality-lock', ...D, async p => {
  const r = await evj(p, `(()=>{
    G.mode='play';
    const slow=()=>{for(let i=0;i<200;i++)qualityWatch(0.05);};   /* 10 秒 20fps */
    NOVA.opts.set('quality','high');const t0=NOVA.opts.tier();slow();const t1=NOVA.opts.tier();
    NOVA.opts.set('quality','auto');slow();const t2=NOVA.opts.tier();
    NOVA.opts.reset();
    G.mode='menu';
    return {t0,t1,t2};})()`);
  const ok = r.t1 === r.t0 && r.t1 === 0 && r.t2 > r.t1;
  return `${ok ? 'PASS' : 'FAIL'} 手动 high ${r.t0}→${r.t1}(须不变) · 自动档 ${r.t1}→${r.t2}(须降级)`;
});

/* ── 05 特效开关：震动 / 辉光 / 粒子 ──────────────────────── */
await run('5-3-05-fx-toggles', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.opts.set('motion',0);
    /* 震动 */
    NOVA.opts.set('shake',1);G.shake=0;shake(10);const on=G.shake;
    NOVA.opts.set('shake',0);G.shake=0;shake(10);const off=G.shake;
    /* 辉光 / 故障 */
    NOVA.opts.set('glow',1);PP.bloom=0;PP.glitch=0;ppBloom(0.8);ppGlitch(0.8);
    const gOn=[+PP.bloom.toFixed(3),+PP.glitch.toFixed(3)];
    NOVA.opts.set('glow',0);PP.bloom=0;PP.glitch=0;ppBloom(0.8);ppGlitch(0.8);
    const gOff=[+PP.bloom.toFixed(3),+PP.glitch.toFixed(3)];
    /* 粒子层（display 由 setParts 直接写，与 WebGL 无关）*/
    NOVA.opts.set('parts',1);const pOn=document.getElementById('fxProton').style.display;
    NOVA.opts.set('parts',0);const pOff=document.getElementById('fxProton').style.display;
    /* 星云：本机有 WebGL 才断言 display，否则只验不崩 + 值落盘 */
    const cap=NOVA.opts.fluidCap();
    NOVA.opts.set('quality','high');NOVA.opts.set('nebula',1);
    const nOn=NOVA.opts.fluid();
    NOVA.opts.set('nebula',0);const nOff=NOVA.opts.fluid();
    NOVA.opts.reset();
    return {on,off,gOn,gOff,pOn,pOff,nOn,nOff,cap};})()`);
  const ok = r.on > 0 && r.off === 0 && r.gOn[0] > 0 && r.gOff[0] === 0
    && r.gOn[1] > 0 && r.gOff[1] === 0 && r.pOn !== 'none' && r.pOff === 'none'
    && (!r.cap || (r.nOn === true && r.nOff === false));
  return `${ok ? 'PASS' : 'FAIL'} 震动 ${r.on}/${r.off}(须0) · 辉光 ${JSON.stringify(r.gOn)}/${JSON.stringify(r.gOff)}`
    + ` · 粒子层 display「${r.pOn}」/「${r.pOff}」· 星云 ${r.nOn}/${r.nOff}(WebGL=${r.cap})`;
});

/* ── 06 减弱动态：data-rm / 震动归零 / 循环动画时长归零 ──────── */
await run('5-3-06-motion', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.opts.set('shake',1);
    NOVA.opts.set('motion',0);
    const offRm=NOVA.opts.rm();
    G.shake=0;shake(10);const sOn=+G.shake.toFixed(2);
    cam.kick=0;camKick(0.02);const kOn=+cam.kick.toFixed(4);
    const amb1=getComputedStyle(document.documentElement).getPropertyValue('--ambient-1').trim();
    NOVA.opts.set('motion',1);
    const onRm=NOVA.opts.rm();
    G.shake=0;shake(10);const sOff=+G.shake.toFixed(2);
    cam.kick=0;camKick(0.02);const kOff=+cam.kick.toFixed(4);
    const amb2=getComputedStyle(document.documentElement).getPropertyValue('--ambient-1').trim();
    const ovAnim=getComputedStyle(document.querySelector('#settings')).animationName;
    NOVA.opts.reset();
    return {offRm,onRm,sOn,sOff,kOn,kOff,amb1,amb2,ovAnim};})()`);
  const ok = r.offRm === false && r.onRm === true && r.sOn > 0 && r.sOff === 0
    && r.kOn > 0 && r.kOff === 0 && r.amb1 !== r.amb2 && r.amb2 === '0s';
  return `${ok ? 'PASS' : 'FAIL'} data-rm ${r.offRm}→${r.onRm} · 震动 ${r.sOn}→${r.sOff}(须0)`
    + ` · 镜头冲击 ${r.kOn}→${r.kOff}(须0) · 循环动画 ${r.amb1}→${r.amb2} · 面板 animation=${r.ovAnim}`;
});

/* ── 07 色盲：token 覆盖与还原（切回「关」要逐条还原，不许残留） ── */
await run('5-3-07-cb-tokens', ...D, async p => {
  const r = await evj(p, `(()=>{
    const K=NOVA.opts.cbKeys();
    const base={};for(const k of K)base[k]=NOVA.opts.cssVar(k);
    NOVA.opts.set('cb','rg');
    const rg={};for(const k of K)rg[k]=NOVA.opts.cssVar(k);
    NOVA.opts.set('cb','by');
    const by={};for(const k of K)by[k]=NOVA.opts.cssVar(k);
    NOVA.opts.set('cb','off');
    const back={};for(const k of K)back[k]=NOVA.opts.cssVar(k);
    const resid=K.filter(k=>back[k]!==base[k]);
    const changed=K.filter(k=>rg[k]!==base[k]);
    return {n:K.length,resid,changed,
      sample:[base['danger'],rg['danger'],by['danger'],back['danger']]};})()`);
  const ok = r.resid.length === 0 && r.changed.length === r.n && r.n >= 12
    && r.sample[0] === r.sample[3] && r.sample[1] !== r.sample[0] && r.sample[2] !== r.sample[0];
  return `${ok ? 'PASS' : 'FAIL'} ${r.n}个 token · 覆盖${r.changed.length}个`
    + ` · 切回残留=${JSON.stringify(r.resid)}(须空) · danger ${r.sample.join(' → ')}`;
});

/* ── 08 PAL 重读 + 中性色不动 ─────────────────────────────── */
await run('5-3-08-cb-pal', ...D, async p => {
  const r = await evj(p, `(()=>{
    const NEU=['steel','ink','white','line','void','panel'];
    NOVA.opts.set('cb','off');const p0=NOVA.opts.palette();
    NOVA.opts.set('cb','rg');const p1=NOVA.opts.palette();
    NOVA.opts.set('cb','by');const p2=NOVA.opts.palette();
    NOVA.opts.set('cb','off');const p3=NOVA.opts.palette();
    const neuMoved=NEU.filter(k=>p1[k]!==p0[k]||p2[k]!==p0[k]);
    const infoMoved=['danger','amber','foe','cyan'].filter(k=>p1[k]!==p0[k]&&p2[k]!==p0[k]);
    return {neuMoved,infoMoved,d0:p0.danger,d1:p1.danger,d2:p2.danger,back:p3.danger===p0.danger};})()`);
  const ok = r.neuMoved.length === 0 && r.infoMoved.length === 4 && r.back
    && r.d0 !== r.d1 && r.d1 !== r.d2;
  return `${ok ? 'PASS' : 'FAIL'} 中性色被改=${JSON.stringify(r.neuMoved)}(须空)`
    + ` · 信息色已改 ${r.infoMoved.length}/4 · danger ${r.d0} / ${r.d1} / ${r.d2} · 还原=${r.back}`;
});

/* ── 09 核心：用 CVD 模拟量化「换完色真的分得开」 ────────────── */
await run('5-3-09-cb-separation', ...D, async p => {
  const r = await evj(p, `(()=>{
    const hx=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
    const D=(a,b)=>Math.round(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]));
    const pair=(a,b,m)=>D(NOVA.opts.sim(hx(NOVA.opts.cssVar(a)),m),
                           NOVA.opts.sim(hx(NOVA.opts.cssVar(b)),m));
    const PAIRS=[['danger','amber'],['foe','cyan-hi'],['hp-b','shield-b']];
    const out={};
    for(const [cb,m] of [['off','deut'],['off','trit'],['rg','deut'],['by','trit']]){
      NOVA.opts.set('cb',cb);
      out[cb+'/'+m]=PAIRS.map(q=>pair(q[0],q[1],m));
    }
    NOVA.opts.set('cb','off');
    return out;})()`);
  const baseD = r['off/deut'], baseT = r['off/trit'];
  const rgD = r['rg/deut'], byT = r['by/trit'];
  const TH = 90;
  const min = a => Math.min.apply(null, a);
  const ok = min(rgD) >= TH && min(byT) >= TH
    && min(baseD) < TH && min(baseT) < TH
    && rgD.every((v, i) => v >= baseD[i]) && byT.every((v, i) => v >= baseT[i]);
  return `${ok ? 'PASS' : 'FAIL'} 模拟后 sRGB 距离（门槛 ${TH}）`
    + ` · 红绿轴 基础${JSON.stringify(baseD)} → rg${JSON.stringify(rgD)}`
    + ` · 蓝黄轴 基础${JSON.stringify(baseT)} → by${JSON.stringify(byT)}`;
});

/* ── 10 敌方弹丸走 token（色盲模式要能改到它） ──────────────── */
await run('5-3-10-foe-token', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.opts.set('cb','off');const base=RGBA('foe',1);
    NOVA.opts.set('cb','rg');const rg=RGBA('foe',1);
    NOVA.opts.set('cb','by');const by=RGBA('foe',1);
    NOVA.opts.set('cb','off');const back=RGBA('foe',1);
    const mine=RGBA('cyan-hi',1);
    return {base,rg,by,back,mine};})()`);
  const ok = r.base === 'rgba(255,176,138,1)' && r.rg !== r.base && r.by !== r.base
    && r.back === r.base && r.rg !== r.mine && r.by !== r.mine;
  return `${ok ? 'PASS' : 'FAIL'} 默认 ${r.base} · rg ${r.rg} · by ${r.by}`
    + ` · 还原=${r.back === r.base} · 与己方 ${r.mine} 不同=${r.rg !== r.mine}`;
});

/* ── 11 中英文案 ──────────────────────────────────────────── */
await run('5-3-11-i18n', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.opts.ui();openSettings();
    const zh=[...document.querySelectorAll('#settings .sec-head')].map(e=>e.textContent.trim());
    const qzh=[...document.querySelectorAll('#optQuality .segb')].map(e=>e.textContent);
    const czh=[...document.querySelectorAll('#optCb .segb')].map(e=>e.textContent);
    const fzh=[...document.querySelectorAll('#optFx .tog span')].map(e=>e.textContent);
    const rmzh=document.querySelector('#optRm span').textContent;
    NOVA.death.lang('en');NOVA.opts.ui();
    const en=[...document.querySelectorAll('#settings .sec-head')].map(e=>e.textContent.trim());
    const qen=[...document.querySelectorAll('#optQuality .segb')].map(e=>e.textContent);
    const fen=[...document.querySelectorAll('#optFx .tog span')].map(e=>e.textContent);
    const rmen=document.querySelector('#optRm span').textContent;
    const cjk=/[\\u4e00-\\u9fa5]/.test(qen.join('')+fen.join('')+rmen);
    NOVA.death.lang('zh');NOVA.opts.ui();
    return {zh,qzh,czh,fzh,rmzh,en,qen,fen,rmen,cjk};})()`);
  const ok = r.zh.length >= 3 && r.qzh.length === 4 && r.czh.length === 3 && r.fzh.length === 5
    && r.qen.join(',') === 'AUTO,HIGH,MED,LOW' && r.fen.length === 5
    && r.rmen === 'Reduce motion' && !r.cjk;
  return `${ok ? 'PASS' : 'FAIL'} 分节${r.zh.length}个 ${JSON.stringify(r.zh.slice(0, 2))}`
    + ` · 画质 ${JSON.stringify(r.qzh)}→${JSON.stringify(r.qen)}`
    + ` · 色盲 ${JSON.stringify(r.czh)} · 特效 ${JSON.stringify(r.fzh)}→${JSON.stringify(r.fen)}`
    + ` · 动态「${r.rmzh}」→「${r.rmen}」英文含中文=${r.cjk}`;
});

/* ── 12 手柄可达：新控件都是 button，进 padTargets ───────────── */
await run('5-3-12-pad', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.pad.hold(0,0,0);toMenu();openSettings();NOVA.opts.ui();
    const list=padTargets();               /* NOVA.pad.targets() 返回的是 id 字符串，这里要元素本身 */
    const nOpt=list.filter(b=>b.dataset&&b.dataset.opt).length;
    const before=OPTS.quality;
    NOVA.opts.click('#optQuality .segb[data-val="low"]');
    const after=OPTS.quality;
    /* 减弱动态是 div.tog 而不是 button —— 但它带 data-opt，走委托，鼠标也得点得动 */
    const rm0=OPTS.motion;
    NOVA.opts.click('#optRm');const rm1=OPTS.motion;
    NOVA.opts.click('#optRm');const rm2=OPTS.motion;
    NOVA.opts.reset();NOVA.pad.clear();closeSettings();
    return {n:list.length,nOpt,q:before+'/'+after,rm:[rm0,rm1,rm2]};})()`);
  const ok = r.n >= 15 && r.nOpt === 13 && r.q === 'auto/low'
    && r.rm[0] === 0 && r.rm[1] === 1 && r.rm[2] === 0;
  return `${ok ? 'PASS' : 'FAIL'} 可聚焦 ${r.n} 个（其中设置项 ${r.nOpt} 个，须 13）`
    + ` · 点「低」画质 ${r.q} · 减弱动态连点 ${JSON.stringify(r.rm)}`;
});

/* ── 13 数据规模回归 ──────────────────────────────────────── */
await run('5-3-13-regress', ...D, async p => {
  await p.evaluate(() => NOVA.logbook.open());   // nodes / links 要日志树渲染出来才有
  await p.waitForTimeout(500);
  const c = await p.evaluate(() => NOVA.counts());
  const lb = await p.evaluate(() => NOVA.logbook.counts());
  const m = await evj(p, `({lvEnMissing:MODULES.filter(m=>!LV_EN[m.id]||LV_EN[m.id].length!==m.max).map(m=>m.id),
    synEnMissing:SYN.filter(s=>!SYN_EN[s.id]).map(s=>s.id),meta:NOVA.meta.tree().length,
    bosses:Object.keys(BOSS_MV).length,keys:Object.keys(NOVA.keys.map()).length,
    palKeys:Object.keys(NOVA.opts.palette()).length})`);
  const r = Object.assign({}, c, lb, m);
  await ev(p, `(function(){toMenu();return 1;})()`);
  const ok = r.mods === 29 && r.syn === 26 && r.enemies === 24 && r.bosses === 8
    && r.hulls === 7 && r.affix === 3 && r.ach === 18 && r.nodes === 18 && r.links === 22
    && r.meta === 13 && r.keys === 12 && r.palKeys === 26
    && (!r.lvEnMissing || r.lvEnMissing.length === 0)
    && (!r.synEnMissing || r.synEnMissing.length === 0);
  return `${ok ? 'PASS' : 'FAIL'} ${JSON.stringify(r)}`;
});

/* ── 14 竖屏：不出界 + 控件有尺寸（手柄才点得到） ────────────── */
await run('5-3-14-mobile', ...M, async p => {
  const r = await evj(p, `(()=>{
    NOVA.opts.ui();openSettings();
    const rows=[...document.querySelectorAll('#settings .optrow')];
    const boxes=rows.map(e=>{const b=e.getBoundingClientRect();return [Math.round(b.width),Math.round(b.right)];});
    const btns=[...document.querySelectorAll('#settings [data-opt]')]
      .map(e=>{const b=e.getBoundingClientRect();return [+b.width.toFixed(1),+b.height.toFixed(1)];});
    const tooSmall=btns.filter(b=>b[0]<2||b[1]<2).length;
    const over=boxes.filter(b=>b[1]>390).length;
    const w=document.documentElement.scrollWidth;
    NOVA.opts.reset();closeSettings();
    return {rows:rows.length,boxes,btns:btns.length,tooSmall,over,w};})()`);
  const ok = r.rows >= 3 && r.btns === 13 && r.tooSmall === 0 && r.over === 0 && r.w <= 390;
  return `${ok ? 'PASS' : 'FAIL'} 设置行 ${r.rows} 行 · 控件 ${r.btns} 个（太小 ${r.tooSmall}）`
    + ` · 出界 ${r.over} · 文档宽 ${r.w} · 右缘 ${JSON.stringify(r.boxes)}`;
});

})();
