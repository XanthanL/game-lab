/* Phase 4.4 验证 —— 新武器行为（散射 / 裂变 / 口径）+ rollChoices 加权修正
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase4-4-check.js
 * 产出：../.workbuddy/shots/phase4/4-4-*.png + 每行状态断言
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

/* 起一局并把 G.build 按续档重放的同一条路径装上去（k=1..n 逐级 apply + 重算协同） */
const build = (p, b) => ev(p, `(function(){
  startGame(HULLS[0]);
  G.build=${JSON.stringify(b)};
  for(const[id,n]of Object.entries(G.build)){const m=MOD_BY_ID[id];if(!m||m.max===Infinity)continue;
    for(let k=1;k<=Math.min(n,m.max);k++)m.apply(k);}
  recountMax();G.syn={};G.synQ=[];checkSynergies();G.synQ=[];
  return 'ok';})()`);

(async () => {

/* ── 01 三张新卡的数据完整性 + 四表同步 ──────────────────────── */
await run('4-4-01-module-data', ...D, async p => {
  const r = await evj(p, `(()=>{
    const ids=['spray','split','caliber'];
    const bad=[];
    for(const id of ids){
      const m=MOD_BY_ID[id];
      if(!m){bad.push(id+':缺失');continue;}
      if(!m.zh||!m.en||!m.g||!m.rarity)bad.push(id+':字段缺');
      if(m.max!==6)bad.push(id+':max='+m.max);
      if(m.type!==(id==='caliber'?'stat':'ability'))bad.push(id+':type='+m.type);
      if(!m.lv||m.lv.length!==6)bad.push(id+':lv='+(m.lv?m.lv.length:0));
      if(!LV_EN[id]||LV_EN[id].length!==6)bad.push(id+':LV_EN缺');
      if(!RARITY_W[m.rarity])bad.push(id+':rarity='+m.rarity);
    }
    return {bad,kinds:{ab:MODULES.filter(m=>m.type==='ability').length,
      st:MODULES.filter(m=>m.type!=='ability').length},
      total:MODULES.length};})()`);
  const ok = !r.bad.length && r.total === 29 && r.kinds.ab === 18 && r.kinds.st === 11;
  return `${ok ? 'PASS' : 'FAIL'} 坏=[${r.bad}] 模块=${r.total}(能力${r.kinds.ab}/数值${r.kinds.st})`;
});

/* ── 02 六条新协同：id 唯一 / 两端存在 / 中英齐 / apply 真改字段 ── */
await run('4-4-02-synergy', ...D, async p => {
  const r = await evj(p, `(()=>{
    /* ⚠️ 只有能力型卡能挂协同（数值型参与会被 NOVA.syn.badDeps 判坏）——
       口径 caliber 是数值型，所以这里只有散射与裂变各两条。 */
    const ids=['fan_guided','fan_barrel','shard_pierce','shard_blast'];
    const all=SYN.map(s=>s.id),dup=all.filter((x,i)=>all.indexOf(x)!==i);
    const bad=[];
    for(const id of ids){
      const s=synById(id);
      if(!s){bad.push(id+':缺失');continue;}
      if(!MOD_BY_ID[s.a]||!MOD_BY_ID[s.b])bad.push(id+':端点不存在');
      if(!SYN_EN[id]||!SYN_EN[id][0]||!SYN_EN[id][1])bad.push(id+':SYN_EN缺');
      if(/[\\u4e00-\\u9fa5]/.test((SYN_EN[id]||[]).join('')))bad.push(id+':EN含中文');
    }
    return {bad,dup:[...new Set(dup)],total:SYN.length};})()`);
  // apply 真实生效：装上两端后逐条比对字段快照
  const eff = await ev(p, `(function(){
    const pairs=[['fan_guided','spray','guided'],['fan_barrel','spray','twin'],
      ['shard_pierce','split','pierce'],['shard_blast','split','frag']];
    const out=[];
    for(const [sid,a,bb] of pairs){
      startGame(HULLS[0]);
      G.build={};G.build[a]=1;G.build[bb]=1;
      for(const[id,n]of Object.entries(G.build)){const m=MOD_BY_ID[id];
        for(let k=1;k<=n;k++)m.apply(k);}
      const snap=JSON.stringify(P);
      G.syn={};G.synQ=[];const got=checkSynergies();G.synQ=[];
      const after=JSON.parse(JSON.stringify(P));
      const before=JSON.parse(snap);
      let changed=0;for(const k in after)if(after[k]!==before[k])changed++;
      out.push({sid,fired:got.some(g=>g.id===sid),changed});
    }
    return JSON.stringify(out);})()`);
  const arr = JSON.parse(eff);
  const dead = arr.filter(x => !x.fired || x.changed === 0).map(x => x.sid);
  const ok = !r.bad.length && !r.dup.length && !dead.length && r.total === 26;
  return `${ok ? 'PASS' : 'FAIL'} 坏=[${r.bad}] 重复=[${r.dup}] 空协同=[${dead}] 协同总数=${r.total}`;
});

/* ── 03 散射：弹数 / 张角 / 与枪管叠加 ─────────────────────── */
await run('4-4-03-spray-count', ...D, async p => {
  await build(p, {});
  const base = await ev(p, `JSON.stringify(NOVA.weapon.fire())`);
  const rows = [];
  for (const n of [1, 2, 4, 6]) {
    await build(p, { spray: n });
    const f = JSON.parse(await ev(p, `JSON.stringify(NOVA.weapon.fire())`));
    const fld = await ev(p, `JSON.stringify(NOVA.weapon.fields())`);
    rows.push({ n, bullets: f.length, arc: JSON.parse(fld).sprayArc });
  }
  const ok = rows.every((r, i) => r.bullets === [2, 3, 4, 6][i] + 1)
    && rows[3].arc < rows[0].arc && JSON.parse(base).length === 1;
  return `${ok ? 'PASS' : 'FAIL'} 裸机=${JSON.parse(base).length}发 → `
    + rows.map(r => `L${r.n}:${r.bullets}发/弧${r.arc}`).join(' ');
});

/* ── 04 散射弹丸伤害 = dmg × sprayMul，主弹不受影响 ─────────── */
await run('4-4-04-spray-dmg', ...D, async p => {
  await build(p, { spray: 3, warhead: 0 });
  const r = await ev(p, `(function(){
    NOVA.weapon.clear();
    const f=NOVA.weapon.fire();
    const main=f[0],pellets=f.slice(1);
    return JSON.stringify({dmg:P.dmg,sprayMul:P.sprayMul,
      mainDmg:main.dmg,pelletDmg:pellets.map(b=>b.dmg),
      mainR:main.r,pelletR:pellets.map(b=>+b.r.toFixed(2))});})()`);
  const o = JSON.parse(r);
  const want = +(o.dmg * o.sprayMul).toFixed(4);
  const ok = Math.abs(o.mainDmg - o.dmg) < 1e-6
    && o.pelletDmg.every(d => Math.abs(d - want) < 1e-6)
    && o.pelletR.every(x => x < o.mainR);
  return `${ok ? 'PASS' : 'FAIL'} 主弹${o.mainDmg}=基准${o.dmg} 散射弹${o.pelletDmg[0]}`
    + `(期望${want} = ${o.dmg}×${o.sprayMul}) 半径 主${o.mainR}/散${o.pelletR[0]}`;
});

/* ── 05 裂变：命中炸出 split 枚弹片，弹片不再二次分裂 ────────── */
await run('4-4-05-split', ...D, async p => {
  const r = JSON.parse(await ev(p, `(function(){
    startGame(HULLS[0]);
    G.build={split:3};
    for(let k=1;k<=3;k++)MOD_BY_ID.split.apply(k);
    NOVA.weapon.clear();
    G.enemies.length=0;
    NOVA.enemy.spawn('drifter');
    const e=G.enemies[0];
    e.x=P.x+40;e.y=P.y;e.hp=1e9;e.maxHp=1e9;
    P.angle=0;P.vx=0;P.vy=0;
    NOVA.weapon.fire();
    const before=NOVA.weapon.bullets();
    /* ⚠️ 不能只看推进完的瞬时值：弹片是从命中点向四周炸开的，朝后飞的那几枚会**立刻**
       再命中同一个敌人而消失（pierce=0 / sp=0）。逐帧记录弹片数峰值才是"炸出了几枚"。 */
    let peakShard=0,peakSp=0;
    for(let k=0;k<12;k++){updateBullets(1/60);
      const b=NOVA.weapon.bullets();
      peakShard=Math.max(peakShard,b.shard);peakSp=Math.max(peakSp,b.withSp);}
    return JSON.stringify({split:P.split,before,peakShard,peakSp});})()`));
  const ok = r.peakShard === r.split && r.peakSp <= 1
    && r.before.shard === 0 && r.before.withSp === 1;
  return `${ok ? 'PASS' : 'FAIL'} split=${r.split} 命中前${JSON.stringify(r.before)}`
    + ` → 弹片峰值${r.peakShard}(须=${r.split}) 带裂变标记峰值${r.peakSp}(弹片须为0)`;
});

/* ── 06 裂变弹片伤害 = 母弹 × splitMul ─────────────────────── */
await run('4-4-06-split-dmg', ...D, async p => {
  const r = JSON.parse(await ev(p, `(function(){
    startGame(HULLS[0]);
    G.build={split:5};
    for(let k=1;k<=5;k++)MOD_BY_ID.split.apply(k);
    NOVA.weapon.clear();G.enemies.length=0;
    NOVA.enemy.spawn('drifter');
    const e=G.enemies[0];e.x=P.x+40;e.y=P.y;e.hp=1e9;e.maxHp=1e9;
    P.angle=0;P.vx=0;P.vy=0;
    const f=NOVA.weapon.fire();const mother=f[0].dmg;
    for(let k=0;k<12;k++)updateBullets(1/60);
    const sh=G.bullets.filter(b=>b.shard);
    return JSON.stringify({mother,splitMul:P.splitMul,
      shards:sh.map(b=>+b.dmg.toFixed(4)),n:sh.length});})()`));
  const want = +(r.mother * r.splitMul).toFixed(4);
  const ok = r.n > 0 && r.shards.every(d => Math.abs(d - want) < 1e-4);
  return `${ok ? 'PASS' : 'FAIL'} 母弹${r.mother}×${r.splitMul}=${want} → 弹片${r.n}枚 ${JSON.stringify(r.shards.slice(0, 3))}…`;
});

/* ── 07 口径：bulletR/bspd/rangeMul 逐级，且不被制导的绝对赋值吃掉 ── */
await run('4-4-07-caliber', ...D, async p => {
  const one = JSON.parse(await ev(p, `(function(){
    startGame(HULLS[0]);
    MOD_BY_ID.caliber.apply(1);
    return JSON.stringify(NOVA.weapon.fields());})()`));
  const max = JSON.parse(await ev(p, `(function(){
    startGame(HULLS[0]);
    for(let k=1;k<=6;k++)MOD_BY_ID.caliber.apply(k);
    return JSON.stringify(NOVA.weapon.fields());})()`));
  // 顺序无关：guided 对 rangeLife 是**绝对赋值**，caliber 走独立 rangeMul → 两种顺序必须同值
  const order = JSON.parse(await ev(p, `(function(){
    const life=()=>{NOVA.weapon.clear();const f=NOVA.weapon.fire();return +f[0].life.toFixed(5);};
    startGame(HULLS[0]);
    MOD_BY_ID.caliber.apply(1);MOD_BY_ID.guided.apply(2);
    const a=life();
    startGame(HULLS[0]);
    MOD_BY_ID.guided.apply(2);MOD_BY_ID.caliber.apply(1);
    const b=life();
    return JSON.stringify({caliberFirst:a,guidedFirst:b});})()`));
  const ok = Math.abs(one.bulletR - 4) < 1e-6 && Math.abs(one.rangeMul - 1.10) < 1e-6
    && max.bulletR > 8 && max.rangeMul > 1.5
    && Math.abs(order.caliberFirst - order.guidedFirst) < 1e-6;
  return `${ok ? 'PASS' : 'FAIL'} L1 半径${one.bulletR}/射程×${one.rangeMul} | `
    + `MAX 半径${max.bulletR}/射程×${max.rangeMul} | 顺序无关 ${order.caliberFirst} vs ${order.guidedFirst}`;
});

/* ── 08 零新模块时弹丸与旧版完全一致（无隐式改动） ───────────── */
await run('4-4-08-no-regress-shape', ...D, async p => {
  await build(p, {});
  const r = JSON.parse(await ev(p, `(function(){
    NOVA.weapon.clear();
    const f=NOVA.weapon.fire()[0];
    return JSON.stringify({r:f.r,life:f.life,sp:f.sp,dmg:f.dmg,
      rangeLife:P.rangeLife,rangeMul:P.rangeMul});})()`));
  const ok = r.r === 3 && Math.abs(r.life - 1.15) < 1e-6 && r.sp === 0
    && Math.abs(r.rangeMul - 1) < 1e-9;
  return `${ok ? 'PASS' : 'FAIL'} 半径${r.r} 射程${r.life}(=${r.rangeLife}×${r.rangeMul}) 裂变标记${r.sp}`;
});

/* ── 09 其余 26 张旧卡装新卡后零溢出（基线字段不被污染） ────── */
await run('4-4-09-legacy-clean', ...D, async p => {
  const r = JSON.parse(await ev(p, `(function(){
    const base=(()=>{startGame(HULLS[0]);return JSON.stringify(P);})();
    const b=JSON.parse(base);
    const bad=[];
    for(const m of MODULES){
      if(['spray','split','caliber'].indexOf(m.id)>=0)continue;
      startGame(HULLS[0]);
      for(let k=1;k<=m.max;k++)m.apply(k);
      const a=P;
      // 新字段在这张旧卡上必须保持默认（口径例外：它改的就是这些字段）
      const drift=[];
      if(a.spray!==0)drift.push('spray='+a.spray);
      if(a.split!==0)drift.push('split='+a.split);
      if(Math.abs(a.bulletR-3)>1e-9)drift.push('bulletR='+a.bulletR);
      if(Math.abs(a.rangeMul-1)>1e-9)drift.push('rangeMul='+a.rangeMul);
      if(drift.length)bad.push(m.id+':'+drift.join(','));
    }
    return JSON.stringify({bad,n:MODULES.length-3});})()`));
  const ok = !r.bad.length;
  return `${ok ? 'PASS' : 'FAIL'} 检查${r.n}张旧卡 污染=[${r.bad.slice(0, 4)}]`;
});

/* ── 10 等级表与文案对齐 ──────────────────────────────────── */
await run('4-4-10-tables', ...D, async p => {
  const r = await evj(p, `(()=>({
    spray:SPRAY_LV.length,split:SPLIT_LV.length,
    sprayTiers:SPRAY_LV.map(t=>t[0]).join(''),splitTiers:SPLIT_LV.map(t=>t[0]).join(''),
    sprayMulUp:SPRAY_LV[5][1]>=SPRAY_LV[0][1],splitMulUp:SPLIT_LV[5][1]>=SPLIT_LV[0][1],
    arcDown:SPRAY_LV[5][2]<SPRAY_LV[0][2],
    lvZh:['spray','split','caliber'].map(i=>MOD_BY_ID[i].lv.length).join(','),
    lvEn:['spray','split','caliber'].map(i=>(LV_EN[i]||[]).length).join(','),
  }))()`);
  const ok = r.spray === 6 && r.split === 6 && r.sprayTiers === '233446'
    && r.splitTiers === '233448' && r.sprayMulUp && r.splitMulUp && r.arcDown
    && r.lvZh === '6,6,6' && r.lvEn === '6,6,6';
  return `${ok ? 'PASS' : 'FAIL'} 弹数序列 ${r.sprayTiers}/${r.splitTiers} 伤害递增=${r.sprayMulUp&&r.splitMulUp}`
    + ` 张角收束=${r.arcDown} lv 中${r.lvZh} 英${r.lvEn}`;
});

/* ── 11 加权修正：boost 有上界 + 能力封顶后位置翻转 ──────────── */
await run('4-4-11-slot-flip', ...D, async p => {
  const r = JSON.parse(await ev(p, `(function(){
    const caps=()=>{let a=0,s=0;for(const m of MODULES){const n=G.build[m.id]||0;
      if(n>0){if(m.type==='ability')a++;else s++;}}return {a,s};};
    const measure=(bld)=>{
      startGame(HULLS[0]);G.build=Object.assign({},bld);
      let ab=0,st=0;
      for(let i=0;i<400;i++){const ch=rollChoices();
        for(const m of ch){if(m.id==='repair')continue;
          if(m.type==='ability')ab++;else st++;}}
      return {ab,st,caps:caps()};
    };
    // 未封顶：应仍是 2 能力 1 数值
    const early=measure({});
    // 能力型已封顶 6 种：应翻转为 1 能力 2 数值
    const late=measure({twin:1,pierce:1,ricochet:1,frag:1,guided:1,drone:1});
    return JSON.stringify({early,late});})()`));
  const eR = r.early.ab / (r.early.ab + r.early.st);
  const lR = r.late.ab / (r.late.ab + r.late.st);
  const ok = r.early.caps.a === 0 && eR > 0.6 && r.late.caps.a === 6 && lR < 0.4;
  return `${ok ? 'PASS' : 'FAIL'} 未封顶(能力${r.early.caps.a}种) 能力占比${eR.toFixed(3)}`
    + ` → 已封顶(能力${r.late.caps.a}种) 能力占比${lR.toFixed(3)}`;
});

/* ── 12 全量模拟：数值型封顶时机必须提前 ─────────────────────── */
await run('4-4-12-sim', ...D, async p => {
  const r = JSON.parse(await ev(p, `(function(){
    const RUNS=200,MAXLV=40;
    const abCap=[],stCap=[];let lateAb=0,lateSt=0;
    for(let n=0;n<RUNS;n++){
      startGame(HULLS[0]);G.build={};G.rarPity=0;
      let a=-1,s=-1;
      for(let lv=0;lv<MAXLV;lv++){
        let an=0,sn=0;
        for(const m of MODULES){const k=G.build[m.id]||0;
          if(k>0){if(m.type==='ability')an++;else sn++;}}
        if(an>=ABILITY_CAP&&a<0)a=lv;
        if(sn>=STAT_CAP&&s<0)s=lv;
        const capped=an>=ABILITY_CAP&&sn>=STAT_CAP;
        const ch=rollChoices();
        for(const m of ch){if(m.id==='repair')continue;
          if(capped){if(m.type==='ability')lateAb++;else lateSt++;}}
        const pick=ch[Math.floor(Math.random()*ch.length)];
        if(pick.id!=='repair')G.build[pick.id]=(G.build[pick.id]||0)+1;
      }
      if(a>=0)abCap.push(a); if(s>=0)stCap.push(s);
    }
    const avg=x=>x.length?+(x.reduce((u,v)=>u+v,0)/x.length).toFixed(1):null;
    return JSON.stringify({ab:avg(abCap),st:avg(stCap),
      stHit:stCap.length+'/'+RUNS,
      late:+(lateAb/(lateAb+lateSt||1)).toFixed(3)});})()`));
  // 修前实测：能力 12.2 / 数值 24.2 / 数值达成率 274/300 / 后期能力占比 0.663
  const ok = r.st < 24.2 && r.late < 0.55;
  return `${ok ? 'PASS' : 'FAIL'} 封顶时机 能力${r.ab} 数值${r.st}(修前24.2) `
    + `数值达成率${r.stHit}(修前274/300) 后期能力占比${r.late}(修前0.663)`;
});

/* ── 13 新卡真的进池：能被 roll 出来，且不破坏 3 选 1 与保底 ──── */
await run('4-4-13-in-pool', ...D, async p => {
  const r = JSON.parse(await ev(p, `(function(){
    startGame(HULLS[0]);G.build={};G.rarPity=0;
    const hit={spray:0,split:0,caliber:0};let sizes=new Set(),badSize=0;
    for(let i=0;i<3000;i++){
      const ch=rollChoices();
      sizes.add(ch.length);
      if(ch.length!==3)badSize++;
      for(const m of ch)if(hit[m.id]!==undefined)hit[m.id]++;
    }
    return JSON.stringify({hit,badSize,sizes:[...sizes]});})()`));
  const ok = r.hit.spray > 0 && r.hit.split > 0 && r.hit.caliber > 0 && r.badSize === 0;
  return `${ok ? 'PASS' : 'FAIL'} 3000 次抽取命中 散射${r.hit.spray} 裂变${r.hit.split} 口径${r.hit.caliber}`
    + ` 张数异常${r.badSize} ${JSON.stringify(r.sizes)}`;
});

/* ── 14 数据规模回归 + 图鉴不受影响 ─────────────────────────── */
await run('4-4-14-regress', ...D, async p => {
  /* ⚠️ NOVA.logbook.counts() 数的是 DOM 子节点 —— 不开面板全是 0（不是回归）。
     7.9 起船体搬进了图鉴「战机」页，所以要连图鉴一起开才数得到。 */
  await p.evaluate(() => { NOVA.logbook.open(); NOVA.logbook.codex(); });
  await p.waitForTimeout(500);
  const c = await p.evaluate(() => NOVA.counts());
  const lb = await p.evaluate(() => NOVA.logbook.counts());
  const m = await evj(p, `({mods:MODULES.length,syn:SYN.length,synEn:Object.keys(SYN_EN).length,
    lvEnMissing:MODULES.filter(m=>!LV_EN[m.id]||LV_EN[m.id].length!==m.max).map(m=>m.id),
    synEnMissing:SYN.filter(s=>!SYN_EN[s.id]).map(s=>s.id),meta:NOVA.meta.tree().length})`);
  const r = Object.assign({}, c, lb, m);
  const ok = r.mods === 29 && r.syn === 26 && !r.lvEnMissing.length && !r.synEnMissing.length
    && r.enemies === 24 && r.bosses === 8 && r.codexHulls === 7 && r.affix === 3
    && r.nodes === 18 && r.links === 22 && r.meta === 13;
  return `${ok ? 'PASS' : 'FAIL'} ` + JSON.stringify(r);
});

/* ── 15 英文：卡名 / 等级文案 / 协同全部无中文 ───────────────── */
await run('4-4-15-en', ...D, async p => {
  const r = await evj(p, `(()=>{
    NOVA.death.lang('en');
    const zh=m=>/[\\u4e00-\\u9fa5]/.test(m);
    const ids=['spray','split','caliber'];
    return {names:ids.map(i=>MOD_BY_ID[i].en),
      lvDirty:ids.filter(i=>(LV_EN[i]||[]).some(zh)),
      synDirty:['fan_guided','fan_barrel','shard_pierce','shard_blast']
        .filter(i=>(SYN_EN[i]||[]).some(zh)),
      ui:(()=>{startGame(HULLS[0]);G.build={spray:2};
        for(let k=1;k<=2;k++)MOD_BY_ID.spray.apply(k);
        return document.getElementById('cardrow')?'has':'no';})()};})()`);
  const ok = !r.lvDirty.length && !r.synDirty.length && r.names.every(n => n && !/[\u4e00-\u9fa5]/.test(n));
  return `${ok ? 'PASS' : 'FAIL'} 英文名${JSON.stringify(r.names)} 等级含中文=[${r.lvDirty}] 协同含中文=[${r.synDirty}]`;
});

/* ── 16 实机：三张新卡齐装跑一段，弹幕数可控且无异常 ─────────── */
await run('4-4-16-live', ...D, async p => {
  const r = JSON.parse(await ev(p, `(function(){
    startGame(HULLS[0]);
    G.build={spray:6,split:6,caliber:6,twin:6,frag:3};
    for(const[id,n]of Object.entries(G.build)){const m=MOD_BY_ID[id];
      for(let k=1;k<=n;k++)m.apply(k);}
    recountMax();G.syn={};G.synQ=[];checkSynergies();G.synQ=[];
    G.enemies.length=0;
    for(let i=0;i<12;i++)NOVA.enemy.spawn('drifter');
    for(const e of G.enemies){e.hp=1e9;e.maxHp=1e9;}
    let peak=0;
    for(let k=0;k<180;k++){
      if(k%12===0)fireGun();
      for(let s=0;s<3;s++)updateBullets(1/120);
      peak=Math.max(peak,G.bullets.length);
    }
    return JSON.stringify({peak,now:G.bullets.length,
      shards:G.bullets.filter(b=>b.shard).length,
      spLeft:G.bullets.filter(b=>b.sp>0).length});})()`));
  // 弹片不再二次分裂 → 总量有界；峰值不应失控（<1200）
  const ok = r.peak > 0 && r.peak < 1200;
  return `${ok ? 'PASS' : 'FAIL'} 3 秒满配峰值弹幕${r.peak} 当前${r.now}(弹片${r.shards}) 未裂${r.spLeft}`;
});

/* ── 17 高爆弹爆炸色跟随船体（7.11） ─────────────────── */
await run('4-4-17-splash-hull-color', ...D, async p => {
  /* 原实现把爆炸色写死成橙 255,180,90（MAX 金 236,208,138）——
     高爆弹是玩家自己打出去的，爆开的光跟船身同色才读得出"这是我的火力"。
     验两件事：① 爆炸粒子的 c 等于当前船体辉光；② 换一艘船，色真的跟着变
     （只验"等于某值"会被写死的常量蒙混过去，换船不变色说明取色没接上）。 */
  const r = JSON.parse(await ev(p, `(function(){
    const probe=(hullId,fragLv)=>{
      startGame(HULLS.find(h=>h.id===hullId));
      G.build={frag:fragLv};
      const m=MOD_BY_ID.frag;
      for(let k=1;k<=fragLv;k++)m.apply(k);
      recountMax();
      const before=G.parts.length;
      splashAt(P.x+60,P.y,80,10,null);
      const spawned=G.parts.slice(before);
      return {hull:hullId,expect:hullGlow(),
        got:[...new Set(spawned.map(q=>q.c))],
        n:spawned.length,
        fragMax:!!P.fragMax};
    };
    return JSON.stringify({a:probe('rapier',3),b:probe('bulwark',3),
      c:probe('raven',6),d:probe('peregrine',1)});})()`));
  const s = [r.a, r.b, r.c, r.d];
  // 每艘船：爆炸色必须命中该船辉光（MAX 额外多一道白热芯 255,246,225，也要认）
  const hit = s.every(x => x.got.includes(x.expect) && x.n > 0);
  const changed = r.a.expect !== r.b.expect && r.a.got[0] !== r.b.got[0];
  const maxed = r.c.fragMax && r.c.got.includes('255,246,225');
  const ok = hit && changed && maxed;
  return `${ok ? 'PASS' : 'FAIL'} ` +
    s.map(x => `${x.hull}:${x.got.join('+')}${x.got.includes(x.expect) ? '✓' : '(应' + x.expect + ')'}`).join(' ') +
    ` · 换船变色=${changed} · MAX 白热芯=${maxed}`;
});

})();
