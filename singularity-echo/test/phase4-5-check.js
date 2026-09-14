/* Phase 4.5 验证 —— 无尽模式专属机制（巨像轮换袋 + 强化层）
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase4-5-check.js
 * 产出：../.workbuddy/shots/phase4/4-5-*.png + 每行状态断言
 *
 * 修前基线（_probe-endless.js 实测，200 局 × 41~100 波）：
 *   连续重复率 11.58% · 148/200 局至少撞一次 · 同款巨像最小间隔 5 波
 *   强度曲线 30 波后纯线性：hpMul 3.61@30 → 9.91@100，没有任何加压层
 *
 * ⚠️ 数值断言一律自带 ok 字段（4.1 的假绿教训）：只打印不算验证。
 * ⚠️ 每张图独立浏览器实例（file:// 下 localStorage 跨 context 共享）。
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
  /* ⚠️ #boot 加上 .out 之后才 pointer-events:none，没退场就点会被它吃掉（4.3b 踩过） */
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

(async () => {

/* ── 01 强化层常量与分层边界 ────────────────────────────────── */
await run('4-5-01-tier-consts', ...D, async p => {
  const r = await evj(p, `(()=>{
    const c=NOVA.endless.consts();
    const seq=[1,30,40,41,42,45,46,50,71,75,100,200].map(n=>n+':'+NOVA.endless.tier(n));
    const m=[40,41,45,100,200].map(n=>{const x=NOVA.endless.muls(n);
      return n+':t'+x.tier+'/hp'+x.hp+'/dm'+x.dmg+'/sp'+x.spd+'/ex'+x.extra;});
    let mono=true,prev=null;
    for(let n=41;n<=300;n++){const x=NOVA.endless.muls(n);
      if(prev&&(x.hp<prev.hp-1e-9||x.dmg<prev.dmg-1e-9||x.extra<prev.extra))mono=false;
      prev=x;}
    return {c,seq,m,mono,spdCap:NOVA.endless.muls(200).spd};})()`);
  const want = ['40:0', '41:1', '45:1', '46:2', '100:12', '200:32'];
  const seqOk = want.every(w => r.seq.indexOf(w) >= 0) && r.seq.indexOf('40:0') >= 0;
  const ok = r.c.from === 41 && r.c.every === 5 && r.c.kinds === 8
    && r.m[0] === '40:t0/hp1/dm1/sp1/ex0'
    && r.m[1] === '41:t1/hp1.14/dm1.08/sp1.03/ex1'
    && r.mono && Math.abs(r.spdCap - 1.5) < 1e-9 && seqOk;
  return `${ok ? 'PASS' : 'FAIL'} from=${r.c.from} 每${r.c.every}波 巨像${r.c.kinds}种 | `
    + r.m.join(' ') + ` | 单调=${r.mono} 速度封顶=${r.spdCap}`;
});

/* ── 02 Boss 轮换：零连续重复 + 无饥饿（修前 11.58% 重复） ──── */
await run('4-5-02-boss-rotation', ...D, async p => {
  const r = await evj(p, `(()=>{
    const K=Object.keys(BOSS_MV);
    let adjRep=0,total=0,starve=0,maxGap=0;
    const rounds=200;
    for(let r=0;r<rounds;r++){
      const s=NOVA.endless.seq(41,140);
      for(let i=0;i<s.length;i++){total++;if(i>0&&s[i]===s[i-1])adjRep++;}
      for(let i=0;i+16<=s.length;i++){const w=s.slice(i,i+16);
        for(const k of K)if(w.indexOf(k)<0)starve++;}
      /* ⚠️ last 初值必须是 null：用 -99 会把「首次出现」算成上百波的间隔 */
      for(const k of K){let last=null;
        for(let i=0;i<s.length;i++)if(s[i]===k){
          if(last!==null)maxGap=Math.max(maxGap,i-last);last=i;}}
    }
    return {K,adjRep,total,starve,maxGap,picks:NOVA.endless.seq(41,140).length};})()`);
  const ok = r.adjRep === 0 && r.starve === 0 && r.maxGap <= 15 && r.K.length === 8;
  return `${ok ? 'PASS' : 'FAIL'} ${r.total}次抽取 连续重复${r.adjRep}(修前11.58%) `
    + `16窗饥饿${r.starve} 同款最大间隔${r.maxGap}波(窗长${r.picks})`;
});

/* ── 03 精英巨像轮换（43/48/53… 与 Boss 用不同的袋子） ──────── */
await run('4-5-03-champ-rotation', ...D, async p => {
  const r = await evj(p, `(()=>{
    let adjRep=0,total=0;
    for(let r=0;r<200;r++){
      const keep={bb:G.bossBag,cb:G.champBag,bl:G.bossLast,cl:G.champLast};
      G.bossBag=null;G.champBag=null;G.bossLast=null;G.champLast=null;
      const out=[];
      for(let n=41;n<=140;n++)if(n%5===3)out.push(bagPick('champ'));
      G.bossBag=keep.bb;G.champBag=keep.cb;G.bossLast=keep.bl;G.champLast=keep.cl;
      for(let i=0;i<out.length;i++){total++;if(i>0&&out[i]===out[i-1])adjRep++;}
    }
    return {adjRep,total};})()`);
  const ok = r.adjRep === 0 && r.total === 4000;
  return `${ok ? 'PASS' : 'FAIL'} ${r.total}次精英抽取 连续重复${r.adjRep}`;
});

/* ── 04 存档往返：续档后轮换记忆不丢，首抽不会撞上一只 ───────── */
await run('4-5-04-save-roundtrip', ...D, async p => {
  const r = JSON.parse(await ev(p, `(function(){
    startGame(HULLS[0]);
    G.mode='play';G.endless=true;
    G.bossBag=['twin','eye','hydra'];G.champBag=['warden'];
    G.bossLast='rock';G.champLast='nemesis';
    saveRun();
    const raw=JSON.parse(localStorage.getItem('nova-save'));
    G.bossBag=null;G.champBag=null;G.bossLast=null;G.champLast=null;
    resumeRun();
    const after={bb:G.bossBag,cb:G.champBag,bl:G.bossLast,cl:G.champLast};
    /* 续档后清袋重洗：200 次里一次都不该抽到记忆里的上一只 */
    let hit=0;
    for(let i=0;i<200;i++){G.bossBag=null;G.bossLast='twin';
      if(bagPick('boss')==='twin')hit++;}
    return JSON.stringify({raw:{bb:raw.bb,cb:raw.cb,bl:raw.bl,cl:raw.cl},after,hit});})()`));
  const ok = JSON.stringify(r.raw.bb) === '["twin","eye","hydra"]' && r.raw.bl === 'rock'
    && JSON.stringify(r.after.bb) === '["twin","eye","hydra"]' && r.after.bl === 'rock'
    && JSON.stringify(r.after.cb) === '["warden"]' && r.after.cl === 'nemesis' && r.hit === 0;
  return `${ok ? 'PASS' : 'FAIL'} 落盘${JSON.stringify(r.raw.bb)}/${r.raw.bl} → 续档`
    + `${JSON.stringify(r.after.bb)}/${r.after.bl} 精英${JSON.stringify(r.after.cb)}/${r.after.cl} 撞车${r.hit}/200`;
});

/* ── 05 强化层真的加在敌人身上（血量 / 伤害 / 速度） ─────────── */
await run('4-5-05-enemy-power', ...D, async p => {
  const r = JSON.parse(await ev(p, `(function(){
    startGame(HULLS[0]);
    const out=[];
    for(const n of [40,45,60,80,100]){
      NOVA.endless.build(n);
      /* ⚠️ applyAffix 有 5%–20% 概率给精英词缀（血量 / 伤害会被乘一遍），
         直接取一只会把「波次成长」和「抽到词缀」混在一起 → 这条断言天生 flaky。
         改成一直生成到抽中一只**无词缀**的，量到的才是纯波次成长。 */
      let e=null;
      for(let i=0;i<60;i++){
        G.enemies.length=0;
        NOVA.enemy.spawn('seeker');
        e=G.enemies[G.enemies.length-1];
        if(!e.affix)break;
      }
      out.push({n,tier:Wv.tier,hp:+e.hp.toFixed(2),dmg:+e.dmg.toFixed(4),
        spd:e.spd?+e.spd.toFixed(3):null,aff:e.affix||''});
    }
    return JSON.stringify(out);})()`));
  const hpR = r[4].hp / r[0].hp, dmR = r[4].dmg / r[0].dmg;
  const mono = r.every((x, i) => i === 0 || (x.hp > r[i - 1].hp && x.dmg > r[i - 1].dmg));
  const finite = r.every(x => isFinite(x.hp) && x.hp > 0 && isFinite(x.dmg));
  // 纯线性基线只有 ×2.2；叠加 12 层指数后应 ≥ ×8
  const ok = mono && finite && hpR > 8 && dmR > 2 && r[0].tier === 0 && r[4].tier === 12;
  return `${ok ? 'PASS' : 'FAIL'} ` + r.map(x => `W${x.n}(T${x.tier}):hp${x.hp}/dm${x.dmg}`).join(' ')
    + ` | 100/40 血×${hpR.toFixed(2)} 伤×${dmR.toFixed(2)}（线性基线仅×2.20）`;
});

/* ── 06 额外敌人上限随层数抬高（38 → 48） ─────────────────── */
await run('4-5-06-extra-count', ...D, async p => {
  const r = JSON.parse(await ev(p, `(function(){
    const one=n=>{NOVA.endless.build(n);return {n,tier:Wv.tier,qE:Wv.qE.length,boss:Wv.boss};};
    /* ⚠️ 60 是 Boss 波，qE 只有几只 seeker，量不出「额外敌人」—— 换成非 Boss 的 62 */
    const at=[39,41,62].map(one);
    let maxQ=0,maxN=0;
    for(let n=91;n<=99;n++){if(n%5===0)continue;
      const o=one(n);if(o.qE>maxQ){maxQ=o.qE;maxN=n;}}
    return JSON.stringify({at,maxQ,maxN});})()`));
  const ok = r.at[0].qE === 38 && r.at[0].tier === 0
    && r.at[1].qE === 39 && r.maxQ === 48;
  return `${ok ? 'PASS' : 'FAIL'} ` + r.at.map(x => `W${x.n}(T${x.tier}):${x.qE}只`).join(' ')
    + ` 上限区峰值 ${r.maxQ}只@W${r.maxN}（旧上限 38）`;
});

/* ── 07 前 40 波零回归：倍率恒等 + 剧本 Boss 不被吃掉 ────────── */
await run('4-5-07-no-regress-40', ...D, async p => {
  const r = JSON.parse(await ev(p, `(function(){
    let idn=true,over=0;
    for(let n=1;n<=40;n++){
      const x=NOVA.endless.muls(n);
      if(x.tier!==0||x.hp!==1||x.dmg!==1||x.spd!==1||x.extra!==0)idn=false;
      NOVA.endless.build(n);
      if(Wv.qE.length>38)over++;
    }
    const bad=[];
    for(let n=5;n<=40;n+=5){
      NOVA.endless.build(n);
      if(Wv.bossKind!==BOSS_AT[n])bad.push(n+':'+(Wv.bossKind||'null')+'≠'+BOSS_AT[n]);
      if(Wv.tier!==0)bad.push(n+':tier'+Wv.tier);
    }
    return JSON.stringify({idn,over,bad});})()`));
  const ok = r.idn && r.over === 0 && !r.bad.length;
  return `${ok ? 'PASS' : 'FAIL'} 1~40波倍率恒等=${r.idn} 超编波数${r.over} 剧本Boss错位=[${r.bad}]`;
});

/* ── 08 端到端：真跑 41→100，Boss 序列无相邻重复且层级递进 ──── */
await run('4-5-08-live-41-100', ...D, async p => {
  const r = JSON.parse(await ev(p, `(function(){
    startGame(HULLS[0]);
    NOVA.endless.resetBags();
    const seq=[],bad=[];
    let prev=null;
    for(let n=41;n<=100;n++){
      const o=NOVA.endless.build(n);
      if(o.boss){seq.push(n+'@'+o.kind);
        if(prev&&prev===o.kind)bad.push(n+':'+o.kind);
        prev=o.kind;}
      /* 每波造两只，确认血量/伤害既有限又非空 */
      if(!o.boss){
        G.enemies.length=0;
        NOVA.enemy.spawn('drifter');NOVA.enemy.spawn('seeker');
        for(const e of G.enemies){
          if(!isFinite(e.hp)||e.hp<=0||!isFinite(e.dmg))bad.push('w'+n+':NaN');}
      }
    }
    const tiers=[41,45,46,60,80,100].map(n=>NOVA.endless.tier(n));
    return JSON.stringify({seq,bad,tiers});})()`));
  const ok = r.bad.length === 0 && r.seq.length === 12
    && JSON.stringify(r.tiers) === JSON.stringify([1, 1, 2, 4, 8, 12]);
  return `${ok ? 'PASS' : 'FAIL'} 60波真跑 异常=[${r.bad.slice(0, 3)}] `
    + `层序${JSON.stringify(r.tiers)} Boss序列 ${r.seq.slice(0, 6).join(' ')}…`;
});

/* ── 09 HUD / 横幅文案：0 层无后缀，中英各自正确 ─────────────── */
await run('4-5-09-text', ...D, async p => {
  const r = JSON.parse(await ev(p, `(function(){
    NOVA.death.lang('zh');
    startGame(HULLS[0]);
    NOVA.endless.build(40);updateHUD();
    const a=el.wave.textContent;
    NOVA.endless.build(45);updateHUD();
    const b=el.wave.textContent,bSub=el.bSub.textContent;
    NOVA.death.lang('en');
    NOVA.endless.build(46);updateHUD();
    const c=el.wave.textContent,cSub=el.bSub.textContent;
    NOVA.death.lang('zh');
    return JSON.stringify({a,b,c,bSub:bSub.slice(-12),cSub:cSub.slice(-12)});})()`));
  const ok = r.a === 'WAVE 40' && /WAVE 45 · 强化层 1$/.test(r.b)
    && /WAVE 46 · AMP 2$/.test(r.c) && !ZH.test(r.c)
    && r.bSub.indexOf('强化层 1') >= 0 && r.cSub.indexOf('AMP 2') >= 0;
  return `${ok ? 'PASS' : 'FAIL'} 中文「${r.a}」→「${r.b}」 英文「${r.c}」 横幅尾 ${r.bSub} / ${r.cSub}`;
});

/* ── 10 数据规模回归 + 图鉴不受影响 + 无脚本报错 ─────────────── */
await run('4-5-10-regress', ...D, async p => {
  await p.evaluate(() => NOVA.logbook.open());
  await p.waitForTimeout(500);
  const c = await p.evaluate(() => NOVA.counts());
  const lb = await p.evaluate(() => NOVA.logbook.counts());
  const m = await evj(p, `({mods:MODULES.length,syn:SYN.length,
    lvEnMissing:MODULES.filter(m=>!LV_EN[m.id]||LV_EN[m.id].length!==m.max).map(m=>m.id),
    synEnMissing:SYN.filter(s=>!SYN_EN[s.id]).map(s=>s.id),meta:NOVA.meta.tree().length,
    bosses:Object.keys(BOSS_MV).length,hulls:HULLS.length})`);
  const r = Object.assign({}, c, lb, m);
  const ok = r.mods === 29 && r.syn === 26 && !r.lvEnMissing.length && !r.synEnMissing.length
    && r.enemies === 24 && r.bosses === 8 && r.hulls === 7 && r.affix === 3
    && r.nodes === 18 && r.links === 22 && r.meta === 13;
  return `${ok ? 'PASS' : 'FAIL'} ` + JSON.stringify(r);
});

/* ── 11 手机端跑一段无尽波，确认无异常 ─────────────────────── */
await run('4-5-11-mobile', ...M, async p => {
  const r = JSON.parse(await ev(p, `(function(){
    startGame(HULLS[0]);
    NOVA.endless.resetBags();
    let bad=0,worst=0;
    for(let n=41;n<=70;n++){
      NOVA.endless.build(n);
      worst=Math.max(worst,Wv.qE.length+Wv.qA.length);
      if(Wv.qE.length>48)bad++;
      if(Wv.tier!==NOVA.endless.tier(n))bad++;
    }
    return JSON.stringify({bad,worst,tier:NOVA.endless.tier(70)});})()`));
  /* ⚠️ worst 是小行星主导的（70 波光石头就 ~97 块，4.5 之前就这样），
     这里只卡「无异常 + 层数正确 + 敌人数不超上限」，别拿它当阈值。 */
  const ok = r.bad === 0 && r.worst < 250 && r.tier === 6;
  return `${ok ? 'PASS' : 'FAIL'} 30波手机端 异常${r.bad} 单波最多${r.worst}目标(含小行星) W70层=${r.tier}`;
});

})();
