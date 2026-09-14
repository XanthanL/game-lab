/* Phase 5.4 验证 —— 性能：让特效预算真正随档位收缩
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase5-4-check.js
 * 产出：../.workbuddy/shots/phase5/5-4-*.png + 每行状态断言
 *
 * ⚠️ 本项不信任墙钟：headless 是软件渲染，单帧耗时被放大十几倍且抖 ±20%，
 *    消融法实测同一项两次能差 40ms，正负号都不可信。
 *    改用**绘制调用次数**（ops）—— 同一场景两次跑完全一致，能断言「少干了多少活」。
 * ⚠️ 单调性是硬判据：七项预算必须三档严格递减，否则「降档」就是自我安慰。
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const OUT = path.join(__dirname, 'phase5');
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}

const D = [1440, 900], M = [390, 844];
const T = { parts: 420, debris: 90, ghosts: 16, bolts: 18, texts: 26 };

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
const setQ = (p, q) => ev(p, `(function(){NOVA.opts.set('quality','${q}');return 1;})()`);
const scene = async p => { await evj(p, `NOVA.bench.stress(60,120,${JSON.stringify(T)})`); await evj(p, `NOVA.bench.fill(${JSON.stringify(T)})`); };

(async () => {

/* ── 01 预算表：三档七项严格单调递减 ─────────────────────── */
await run('5-4-01-table', ...D, async p => {
  const t = await evj(p, `NOVA.bench.table()`);
  const K = ['parts', 'debris', 'ghosts', 'bolts', 'texts', 'fmax', 'shards'];
  const bad = K.filter(k => !(t[0][k] > t[1][k] && t[1][k] > t[2][k]));
  const st = t.map(r => (r.stars.match(/1/g) || []).length);
  const stBad = !(st[0] > st[1] && st[1] > st[2]);
  const keep = t[0].parts === 560 && t[0].debris === 120 && t[0].ghosts === 8 && t[0].texts === 26;
  const ok = !bad.length && !stBad && keep && t.length === 3 && st[0] === 4;
  return `${ok ? 'PASS' : 'FAIL'} 高档沿用旧常量${keep ? '' : '（被改过！）'}` +
    ` · parts ${t[0].parts}/${t[1].parts}/${t[2].parts}` +
    ` debris ${t[0].debris}/${t[1].debris}/${t[2].debris}` +
    ` ghosts ${t[0].ghosts}/${t[1].ghosts}/${t[2].ghosts}` +
    ` bolts ${t[0].bolts}/${t[1].bolts}/${t[2].bolts}` +
    ` 星场${st.join('/')}层` + ((bad.length || stBad) ? ` · 非单调：${bad}` : ' · 八项全单调');
});

/* ── 02 降档立刻砍存量（不等自然消亡） ───────────────────── */
await run('5-4-02-trim', ...D, async p => {
  await setQ(p, 'high'); await scene(p);
  const a = await evj(p, `NOVA.bench.counts()`);
  await setQ(p, 'low');
  const b = await evj(p, `NOVA.bench.counts()`);   // 同一 tick 内读，中间不跑任何更新
  const bd = await evj(p, `NOVA.perf().budget`);
  /* 前置条件别写死 400：bench.fill 最多 40 轮 × burst(10) ≈ 400，
     实测在 389–404 之间抖 —— 阈值贴着天花板必然偶发假失败。
     改成随预算表自适应：切档前必须至少是低档上限的 2 倍，既安全又仍有意义。 */
  const ok = a.parts > bd.parts * 2 && b.parts <= bd.parts && b.debris <= bd.debris
    && b.parts < a.parts && b.debris < a.debris;
  return `${ok ? 'PASS' : 'FAIL'} 粒子 ${a.parts}→${b.parts}(≤${bd.parts})` +
    ` 残骸 ${a.debris}→${b.debris}(≤${bd.debris}) —— 切换瞬间生效，不是等 1 秒寿命走完`;
});

/* ── 03 粒子入口上限随档（burst 撞顶） ───────────────────── */
await run('5-4-03-parts', ...D, async p => {
  const out = [];
  await ev(p, `(function(){startGame(HULLS[0]);G.mode='play';return 1;})()`);
  for (const q of ['high', 'mid', 'low']) {
    await setQ(p, q);
    await ev(p, `(function(){G.parts.length=0;for(let i=0;i<300;i++)burst(P.x,P.y,30,120,4,'255,255,255',2);return 1;})()`);
    const n = await evj(p, `G.parts.length`);
    const cap = (await evj(p, `NOVA.perf().budget`)).parts;
    out.push({ q, n, cap, ok: n === cap });
  }
  const ok = out.every(o => o.ok);
  return `${ok ? 'PASS' : 'FAIL'} ` + out.map(o => `${o.q}=${o.n}/${o.cap}`).join(' ');
});

/* ── 04 残骸入口上限随档 ─────────────────────────────────── */
await run('5-4-04-debris', ...D, async p => {
  const out = [];
  await ev(p, `(function(){startGame(HULLS[0]);G.mode='play';return 1;})()`);
  for (const q of ['high', 'mid', 'low']) {
    await setQ(p, q);
    await ev(p, `(function(){G.debris.length=0;for(let i=0;i<300;i++)shatter(P.x,P.y,10,120,'160,180,210',7);return 1;})()`);
    const n = await evj(p, `G.debris.length`);
    const cap = (await evj(p, `NOVA.perf().budget`)).debris;
    out.push({ q, n, cap, ok: n === cap });
  }
  const ok = out.every(o => o.ok);
  return `${ok ? 'PASS' : 'FAIL'} ` + out.map(o => `${o.q}=${o.n}/${o.cap}`).join(' ');
});

/* ── 05 残影 / 电弧 / 碎片 / 飘字：trim 后不超档位 ───────── */
await run('5-4-05-others', ...D, async p => {
  await setQ(p, 'low'); await scene(p);
  const c = await evj(p, `NOVA.bench.trim()`);
  const b = await evj(p, `NOVA.perf().budget`);
  const ok = c.ghosts <= b.ghosts && c.bolts <= b.bolts && c.shards <= b.shards
    && c.texts <= b.texts + b.fmax;
  return `${ok ? 'PASS' : 'FAIL'} 残影${c.ghosts}≤${b.ghosts} 电弧${c.bolts}≤${b.bolts}` +
    ` 碎片${c.shards}≤${b.shards} 飘字${c.texts}≤${b.texts + b.fmax}` +
    `（bench.fill 为钉死场景故意绕过入口钳制，故用 trim 验上限）`;
});

/* ── 06 绘制调用数三档单调递减（确定性指标） ─────────────── */
await run('5-4-06-ops', ...D, async p => {
  await ev(p, `(function(){NOVA.bench.hold(true);return 1;})()`);
  const o = [];
  for (const q of ['high', 'mid', 'low']) {
    await setQ(p, q); await scene(p);
    await ev(p, `NOVA.bench.drawMs(30)`);            // 预热，吃掉首帧 JIT
    o.push((await evj(p, `NOVA.bench.ops(20)`)).total);
  }
  const [h, m, l] = o;
  const ok = h > m && m > l && l / h <= 0.8;
  return `${ok ? 'PASS' : 'FAIL'} 调用/帧 ${h} → ${m} → ${l}` +
    `（${Math.round(m / h * 100)}% / ${Math.round(l / h * 100)}%）低档须 ≤80%`;
});

/* ── 07 后处理分级：bloom 只在高档 ───────────────────────── */
await run('5-4-07-bloom', ...D, async p => {
  await ev(p, `(function(){NOVA.bench.hold(true);return 1;})()`);
  /* ⚠️ 顺序不能颠倒：scene() 里 stress 会跑 120 次 updateWorld，PP 会被 updatePost 衰减回 0。
     必须先把场景钉死，再设 PP，最后才 ops()（ops 只 draw 不 update，PP 不会被吃掉）。 */
  /* ⚠️ 场景只能钉一次再 A/B：scene() 里的 stress 会重随一次 Boss（无尽波 60 必出巨像），
     不同巨像的 drawImage 基线不同 —— 两次各跑一遍 scene 时，差值里混的是「换了尊 Boss」
     而不是 bloom。实测因此出过高 -3（应为 +1）。 */
  const pair = async q => {
    await setQ(p, q); await scene(p);
    await ev(p, `(function(){PP.bloom=0;PP.glitch=0;return 1;})()`);
    const a = (await evj(p, `NOVA.bench.ops(10)`)).by.drawImage || 0;
    await ev(p, `(function(){PP.bloom=1;PP.glitch=0;return 1;})()`);
    const b = (await evj(p, `NOVA.bench.ops(10)`)).by.drawImage || 0;
    return b - a;
  };
  const d0 = await pair('high'), d1 = await pair('mid'), d2 = await pair('low');
  const ok = d0 >= 1 && d1 === 0 && d2 === 0;
  return `${ok ? 'PASS' : 'FAIL'} bloom 开/关的 drawImage 差值：高${d0}（须≥1）中${d1}（须0）低${d2}（须0）`;
});

/* ── 08 自动看门狗降档时预算同步 ─────────────────────────── */
await run('5-4-08-watchdog', ...D, async p => {
  await setQ(p, 'auto'); await scene(p);
  const r = await evj(p, `(()=>{
    const before=NOVA.perf().tier;
    for(let i=0;i<400;i++)qualityWatch(0.04);   // 持续 <~45fps
    return {before,after:NOVA.perf().tier,budget:NOVA.perf().budget,
            parts:G.parts.length,debris:G.debris.length};})()`);
  const ok = r.before === 0 && r.after === 2 && r.budget.parts === 150
    && r.parts <= 150 && r.debris <= 32;
  return `${ok ? 'PASS' : 'FAIL'} 档 ${r.before}→${r.after}，预算 parts=${r.budget.parts}` +
    ` debris=${r.budget.debris}，存量已砍到 ${r.parts}/${r.debris}`;
});

/* ── 09 低档 DPR 降到 1 ──────────────────────────────────── */
await run('5-4-09-dpr', ...D, async p => {
  const a = [], st = [];
  for (const q of ['high', 'mid', 'low']) {
    await setQ(p, q);
    a.push(await evj(p, `NOVA.perf().dpr`));
    st.push(((await evj(p, `NOVA.perf().stars`)).match(/1/g) || []).length);
  }
  const ok = a[0] === 2 && a[1] === 2 && a[2] === 1 && st[0] === 4 && st[1] === 3 && st[2] === 2;
  return `${ok ? 'PASS' : 'FAIL'} DPR ${a.join(' / ')}（设备 dpr=2，仅低档砍到 1）` +
    ` · 星场运行时层数 ${st.join(' / ')}`;
});

/* ── 10 回归：预算改动没弄坏玩法（能开火能击杀） ─────────── */
await run('5-4-10-play', ...D, async p => {
  await setQ(p, 'low');
  const r = await evj(p, `(()=>{startGame(HULLS[0]);G.mode='play';buildWave(3);
    P.hp=1e9;P.maxHp=1e9;P.invuln=1e9;
    const R=200;   // buildWave 只登记波次，敌人得自己摆到脸上才有得打
    for(let k=0;k<14;k++)spawnEnemy(EN_LIST[0],P.x+Math.cos(k/14*6.2832)*R,P.y+Math.sin(k/14*6.2832)*R);
    P.dmg=60;      // 基础 dmg=1 打 10 秒也就能蹭死一个，测不出「打得死」
    fireOn=true;
    /* ⚠️ updateAim() 在真实 frame() 里是单独一步，updateWorld 不含它 ——
       少了这一步船头朝哪全凭初始角度，子弹全打空，测出来 0 击杀是假的。 */
    for(let i=0;i<600;i++){updateAim();updateWorld(1/60);}
    fireOn=false;
    return {kills:G.kills,parts:G.parts.length,mode:G.mode,
            texts:G.texts.length,shards:G.shards.length};})()`);
  const ok = r.kills >= 3 && r.parts <= 150 && r.texts <= 30 && r.shards <= 7;
  return `${ok ? 'PASS' : 'FAIL'} 低档下击杀${r.kills} 粒子${r.parts} 飘字${r.texts} 碎片${r.shards}` +
    ` —— 全部在低档预算内，且照样打得死人`;
});

/* ── 11 回归：5.1 键位 / 5.2 手柄 / 5.3 设置面板都还在 ───── */
await run('5-4-11-regress', ...D, async p => {
  const r = await evj(p, `(()=>{
    const S=document.getElementById('settings');
    S.classList.add('show');
    const btns=S.querySelectorAll('button').length;
    const q=S.querySelectorAll('#optQuality .segb').length;
    const cb=S.querySelectorAll('#optCb .segb').length;
    const fx=S.querySelectorAll('#optFx .tog').length;
    const rm=document.getElementById('optRm');
    const keys=document.querySelectorAll('#keyList .keyrow').length;
    const slots=document.querySelectorAll('#keyList .keyslot').length;
    S.classList.remove('show');
    return {btns,q,cb,fx,rmtag:rm?rm.tagName:null,rmopt:rm?rm.dataset.opt:null,
            keys,slots,tg:padTargets().length};})()`);
  const ok = r.q === 4 && r.cb === 3 && r.fx === 5 && r.rmtag === 'BUTTON'
    && r.rmopt === 'motion' && r.keys === 12 && r.slots === 24 && r.btns >= 12 && r.tg > 0;
  return `${ok ? 'PASS' : 'FAIL'} 画质${r.q}档 色盲${r.cb}档 特效开关${r.fx}个` +
    ` 减弱动态=${r.rmtag}/${r.rmopt} 键位${r.keys}×${r.slots / r.keys}槽` +
    ` 面板按钮${r.btns} 手柄可达${r.tg}`;
});

/* ── 12 移动端：低档场景 + 无报错 ────────────────────────── */
await run('5-4-12-mobile', ...M, async p => {
  await setQ(p, 'low');
  await ev(p, `(function(){NOVA.bench.hold(true);return 1;})()`);
  await scene(p);
  const c = await evj(p, `NOVA.bench.counts()`);
  const b = await evj(p, `NOVA.perf().budget`);
  const ops = await evj(p, `NOVA.bench.ops(10)`);
  await ev(p, `(function(){NOVA.bench.hold(false);return 1;})()`);
  const ok = c.parts <= b.parts && c.debris <= b.debris && ops.total > 0;
  return `${ok ? 'PASS' : 'FAIL'} 移动端低档 粒子${c.parts}/${b.parts}` +
    ` 残骸${c.debris}/${b.debris} 调用${ops.total}/帧`;
});

})();
