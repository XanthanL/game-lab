/* Phase 7.12 验证 —— 奇点门：Boss 死 → 未激发奇点 → 清场激发 → 驶入 → 通道 → 发卡 → 下一波
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> node test/phase7-12-check.js
 * 产出：test/phase7/7-12-*.png + 每行状态断言
 *
 * 这一份测的是**用户口述的那条流程本身**，不是单点函数：
 *   ① Boss 死在原地 → 门就长在原地（坐标 = Boss 死亡点），且**不再**掉两个升级；
 *   ② 没清完残敌时门是 state 1，清完才变 state 2；
 *   ③ 门在时波次不许自己往前走（这正是"打完直接开 wave 6"的病根）；
 *   ④ 玩家驶入 → 跃迁 → 真的进到通道（雷霆战机式纵版）；
 *   ⑤ 通道里 A/D 真的能左右动（不是只有键盘常量生效），自动开火真的能打死残骸；
 *   ⑥ 通道掉的永久属性道具真的写进 P，升级道具真的攒成待发卡；
 *   ⑦ 收束 → 发卡 → 选完卡才推进到下一波，且门已清空。
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const OUT = path.join(__dirname, 'phase7');
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}

const D = [1024, 768];

async function run(tag, vw, vh, job) {
  const b = await chromium.launch({ executablePath: EXE });
  const c = await b.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2 });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 240)));
  await p.goto(GAME, { waitUntil: 'load' });
  await p.waitForFunction(() => { const b = document.getElementById('boot'); return !b || b.classList.contains('out'); },
    null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(1000);
  let note = '';
  try { note = (await job(p)) || ''; } catch (e) { errs.push('JOB:' + e.message.slice(0, 200)); }
  /* 断言期间主循环是冻结的（见 toBoss 里的 BENCH_HOLD），
     截图前解冻跑几帧 —— 否则拍到的是冻结前那一帧的老画面。 */
  await evj(p, 'BENCH_HOLD=false').catch(() => {});
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(OUT, tag + '.png'), fullPage: false });
  await c.close(); await b.close();
  console.log(errs.length ? 'ERR ' + errs.join(' | ') : note);
}
const evj = (p, code) => p.evaluate(c => NOVA.debug(c), code);
/* pickCard 有 440ms 的抽卡动效（setTimeout 后才 resolveCard），选卡必须等它落地 */
async function drainCards(p) {
  for (let i = 0; i < 10; i++) {
    const m = await evj(p, 'G.mode');
    if (m !== 'levelup') break;
    await evj(p, 'NOVA.select(0)');
    await p.waitForTimeout(560);
  }
  return evj(p, 'G.mode');
}

/* 起一局 → 跳到 wave 5 → 推进到 MOTHER ROCK 真的出场。
   ⚠️ 走 buildWave + updateWorld 而不是直接 spawnAst：门是在 killAst 里生成的，
      Boss 必须真的是"被 director 放出来的那只"，否则测的不是上线路径。 */
async function toBoss(p) {
  await evj(p, 'NOVA.launch(0)');
  await p.waitForTimeout(200);
  /* 冻结主循环 → 世界只在探针显式 tick 时前进。
     不冻结的话 RAF 会在两次 evaluate 之间偷偷推进，断言就变成看运气（实测同一份
     用例能在两次运行里给出相反结果）。 */
  await evj(p, 'BENCH_HOLD=true');
  await evj(p, 'NOVA.wave(5)');
  // 无人值守推进：血量拉满，免得玩家在等 boss 出场时被小怪打死
  await evj(p, 'P.maxHp=99999;P.hp=99999;P.invuln=9999;');
  await evj(p, "for(let i=0;i<2400;i++){if(G.mode!=='play')break;updateWorld(1/60);if(G.asteroids.some(a=>a.boss))break;}");
  return await evj(p, 'NOVA.gate.boss()');
}

(async () => {

/* ── 01 Boss 死在原地 → 门就长在原地，且不再掉两个升级 ────────── */
await run('7-12-01-gate-spawn', ...D, async p => {
  const boss = await toBoss(p);
  if (!boss) return 'FAIL 没等到 Boss 出场';
  const r = await evj(p, 'NOVA.gate.killBoss()');
  const lv = await evj(p, "NOVA.debug('G.pickups.filter(u=>u.type===\"level\").length')");
  const st = await evj(p, 'NOVA.gate.state()');
  /* 门会被夹进场内（GATE_R+24 的边距），所以贴边死的 Boss 允许有这点偏移 */
  const d = (r && boss) ? Math.hypot(r.x - boss.x, r.y - boss.y) : 999;
  const ok = r && r.state === 1 && d < 40 && lv === 0 && st.mode === 'play';
  return `${ok ? 'PASS' : 'FAIL'} 门生成于 Boss 死亡点：门 (${r && r.x},${r && r.y}) vs boss (${boss.x},${boss.y})` +
    ` 偏差 ${d.toFixed(1)}px（贴边时会被夹进场内）· state=${r && r.state}` +
    ` · 掉落的升级道具 ${lv} 个（应为 0）· 场上残骸 ${st.asts}`;
});

/* ── 02 残敌还在 → 门保持未激发；清场 → 激发，且波次不许自己走 ── */
await run('7-12-02-arm-on-clear', ...D, async p => {
  await toBoss(p);
  await evj(p, 'NOVA.gate.killBoss()');
  const before = await evj(p, 'NOVA.gate.state()');
  // 残骸还在：清场检查不该点亮门
  const mid = await evj(p, 'NOVA.gate.clearTick()');
  await evj(p, 'NOVA.gate.killAll()');
  const armed = await evj(p, 'NOVA.gate.clearTick()');
  const after = await evj(p, 'NOVA.gate.state()');
  const w = after.wave;
  // 再等 3 秒：门在时第 6 波**不许**自动开
  await evj(p, 'for(let i=0;i<180;i++){if(G.mode!==\'play\')break;updateWorld(1/60);}');
  const late = await evj(p, 'NOVA.gate.state()');
  const ok = before.gate.state === 1 && mid === 1 && armed === 2 && after.gate.state === 2
    && late.wave === 5 && late.mode === 'play' && late.cleared === true;
  return `${ok ? 'PASS' : 'FAIL'} 有残敌 ${before.asts} 时 state=${mid}（应为 1）→ 清场后 state=${armed}` +
    ` · 3 秒后仍停在 WAVE ${late.wave} / mode=${late.mode} / cleared=${late.cleared}`;
});

/* ── 03 玩家驶入 → 跃迁 → 进入通道 ─────────────────── */
await run('7-12-03-enter-and-warp', ...D, async p => {
  await toBoss(p);
  await evj(p, 'NOVA.gate.killBoss()');
  await evj(p, 'NOVA.gate.killAll()');
  await evj(p, 'NOVA.gate.clearTick()');
  const armed = await evj(p, 'NOVA.gate.state()');
  const m1 = await evj(p, 'NOVA.gate.enter()');          // 驶入 → warp
  const m2 = await evj(p, 'NOVA.gate.warpStep(2.0)');    // 过场 → channel
  const inCh = await evj(p, 'NOVA.gate.state()');
  const ok = armed.gate.state === 2 && m1 === 'warp' && m2 === 'channel'
    && inCh.mode === 'channel' && !!inCh.ch;
  return `${ok ? 'PASS' : 'FAIL'} 激发 state=${armed.gate.state} → 驶入 mode=${m1} → 过场后 mode=${m2}` +
    ` · 通道 t=${inCh.ch && inCh.ch.t} 星尘=${inCh.ch && inCh.ch.dust}`;
});

/* ── 04 通道里 A/D 真的能左右机动（不是写死的常量）────────── */
await run('7-12-04-channel-ad', ...D, async p => {
  await toBoss(p);
  await evj(p, 'NOVA.gate.killBoss()');
  await evj(p, 'NOVA.gate.killAll()');
  await evj(p, 'NOVA.gate.clearTick()');
  await evj(p, 'NOVA.gate.enter()');
  await evj(p, 'NOVA.gate.warpStep(2.0)');
  const k = await evj(p, 'NOVA.gate.consts()');
  const x0 = await evj(p, 'NOVA.gate.state()');
  const xr = await evj(p, 'NOVA.gate.chStep(1,0.6)');   // 按 D
  const xl = await evj(p, 'NOVA.gate.chStep(-1,1.2)');  // 按 A
  const ok = xr > x0.ch.psx + 20 && xl < xr - 40 && xl > k.VW * 0.1;
  return `${ok ? 'PASS' : 'FAIL'} 起点 x=${x0.ch.psx} → 按 D 0.6s → ${xr} → 按 A 1.2s → ${xl}` +
    `（视口宽 ${k.VW}，须右移后再左移且不出界）`;
});

/* ── 05 通道自动开火真的能打死残骸 / 残机 ─────────────── */
await run('7-12-05-channel-combat', ...D, async p => {
  await toBoss(p);
  await evj(p, 'NOVA.gate.killBoss()');
  await evj(p, 'NOVA.gate.killAll()');
  await evj(p, 'NOVA.gate.clearTick()');
  await evj(p, 'NOVA.gate.enter()');
  await evj(p, 'NOVA.gate.warpStep(2.0)');
  await evj(p, 'NOVA.gate.chTick(9)');
  const s = await evj(p, 'NOVA.gate.state()');
  const k = await evj(p, 'NOVA.gate.chKill()');   // 机头正前方摆一块残骸，看弹幕能不能打掉
  const ok = s.ch && s.ch.bl > 0 && k && k.gone && s.mode === 'channel';
  return `${ok ? 'PASS' : 'FAIL'} 9 秒后：在飞弹幕 ${s.ch && s.ch.bl} · 击坠 ${s.ch && s.ch.kills}` +
    ` · 星尘 ${s.ch && s.ch.dust} · 场上残骸 ${s.ch && s.ch.rocks} 残机 ${s.ch && s.ch.foes}` +
    ` · 正前方残骸被打掉=${k && k.gone}（${k && k.frames} 帧）`;
});

/* ── 06 永久属性道具真写进 P；升级道具攒成待发卡（不打断通道）── */
await run('7-12-06-pod-permanent', ...D, async p => {
  await toBoss(p);
  await evj(p, 'NOVA.gate.killBoss()');
  await evj(p, 'NOVA.gate.killAll()');
  await evj(p, 'NOVA.gate.clearTick()');
  await evj(p, 'NOVA.gate.enter()');
  await evj(p, 'NOVA.gate.warpStep(2.0)');
  const a0 = await evj(p, 'NOVA.gate.stat()');
  const d1 = await evj(p, "NOVA.gate.pod('dmg')");
  const h1 = await evj(p, "NOVA.gate.pod('hp')");
  const s1 = await evj(p, "NOVA.gate.pod('spd')");
  const m1 = await evj(p, "NOVA.gate.pod('mag')");
  const c1 = await evj(p, "NOVA.gate.pod('crit')");
  const v1 = await evj(p, "NOVA.gate.pod('vel')");
  const r1 = await evj(p, "NOVA.gate.pod('rate')");
  const lv0 = (await evj(p, 'NOVA.gate.stat()')).level;
  const l1 = await evj(p, "NOVA.gate.pod('level')");
  const st = await evj(p, 'NOVA.gate.state()');
  const ok = d1.dmg > a0.dmg && h1.maxHp > a0.maxHp && s1.maxSpeed > a0.maxSpeed
    && m1.magnet > a0.magnet && c1.crit > a0.crit && v1.bspd > a0.bspd && r1.fireRate > a0.fireRate
    && l1.level > lv0 && l1.pending > 0 && st.mode === 'channel';
  return `${ok ? 'PASS' : 'FAIL'} 伤害 ${a0.dmg}→${d1.dmg} · 结构 ${a0.maxHp}→${h1.maxHp}` +
    ` · 极速 ${a0.maxSpeed}→${s1.maxSpeed} · 磁引 ${a0.magnet}→${m1.magnet}` +
    ` · 暴击 ${a0.crit}→${c1.crit} · 弹速 ${a0.bspd}→${v1.bspd} · 射速 ${a0.fireRate}→${r1.fireRate}` +
    ` · 等级 ${lv0}→${l1.level}（待发卡 ${l1.pending}，通道未被打断 mode=${st.mode}）`;
});

/* ── 07 收束 → 发卡 → 选完卡才推进下一波，门已清空 ────────── */
await run('7-12-07-close-and-advance', ...D, async p => {
  await toBoss(p);
  await evj(p, 'NOVA.gate.killBoss()');
  await evj(p, 'NOVA.gate.killAll()');
  await evj(p, 'NOVA.gate.clearTick()');
  await evj(p, 'NOVA.gate.enter()');
  await evj(p, 'NOVA.gate.warpStep(2.0)');
  await evj(p, "NOVA.gate.pod('level')");      // 额外攒一张，验证两张都发
  const e = await evj(p, 'NOVA.gate.chEnd()');
  await drainCards(p);
  const s = await evj(p, 'NOVA.gate.state()');
  const ok = e.mode === 'levelup' && e.pending >= 2 && e.chAfter === true
    && s.wave === 6 && s.gate === null && s.mode === 'play' && s.cleared === false && s.chAfter === false;
  return `${ok ? 'PASS' : 'FAIL'} 收束：mode=${e.mode} 待发卡=${e.pending} 标志=${e.chAfter}` +
    ` → 选完：WAVE ${s.wave} mode=${s.mode} cleared=${s.cleared} gate=${s.gate}`;
});

/* ── 08 全流程跑一遍不抛错（含 22 秒通道全程）───────────── */
await run('7-12-08-full-run-noerr', ...D, async p => {
  await toBoss(p);
  await evj(p, 'NOVA.gate.killBoss()');
  await evj(p, 'NOVA.gate.killAll()');
  await evj(p, 'NOVA.gate.clearTick()');
  await evj(p, 'NOVA.gate.enter()');
  await evj(p, 'NOVA.gate.warpStep(2.0)');
  const last = await evj(p, 'NOVA.gate.chTick(23)');   // 一口气跑满 22 秒
  const s = await evj(p, 'NOVA.gate.state()');
  await drainCards(p);
  const s2 = await evj(p, 'NOVA.gate.state()');
  const ok = s.mode !== 'channel' && s2.wave === 6 && s2.gate === null && s2.chAfter === false;
  return `${ok ? 'PASS' : 'FAIL'} 跑满通道 → mode=${s.mode} → 选卡后 WAVE ${s2.wave} / gate=${s2.gate}` +
    ` / chAfter=${s2.chAfter}（收束前末帧 ${JSON.stringify(last)}）`;
});

/* ── 09 视觉：激发态奇点（真实 RAF 渲染，不是手动 tick）────────── */
await run('7-12-09-visual-gate', ...D, async p => {
  await toBoss(p);
  await evj(p, 'NOVA.gate.killBoss()');
  await evj(p, 'NOVA.gate.killAll()');
  await evj(p, 'NOVA.gate.clearTick()');
  await evj(p, 'cam.x=G.gate.x;cam.y=G.gate.y;');
  // 把玩家放到引力圈内（但不进判定圈），才验得到"被往里拽"
  await evj(p, 'P.x=G.gate.x+380;P.y=G.gate.y;P.vx=0;P.vy=0;P.xp=0;P.xpNext=99999;G.pending=0;');
  const d0 = await evj(p, 'Math.round(Math.hypot(P.x-G.gate.x,P.y-G.gate.y))');
  const s = await evj(p, 'NOVA.gate.state()');
  // 解冻后靠真 RAF 渲染：门必须还在（激发态不会自己消失），且距离在缩小
  await evj(p, 'BENCH_HOLD=false');
  await p.waitForTimeout(1200);
  const s2 = await evj(p, 'NOVA.gate.state()');
  const d1 = await evj(p, 'Math.round(Math.hypot(P.x-G.gate.x,P.y-G.gate.y))');
  await evj(p, 'BENCH_HOLD=true');
  const ok = s.gate.state === 2 && s2.gate && s2.gate.state === 2 && d1 < d0 - 40;
  return `${ok ? 'PASS' : 'FAIL'} 实时渲染下门仍在 state=${s2.gate && s2.gate.state}` +
    ` · 玩家距门 ${d0} → ${d1}px（1.2s 内应被往里拽近）`;
});

/* ── 10 视觉：通道实时跑动（验证 frame() 真的分派到 chUpdate）────── */
await run('7-12-10-visual-channel', ...D, async p => {
  await toBoss(p);
  await evj(p, 'NOVA.gate.killBoss()');
  await evj(p, 'NOVA.gate.killAll()');
  await evj(p, 'NOVA.gate.clearTick()');
  await evj(p, 'NOVA.gate.enter()');
  await evj(p, 'NOVA.gate.warpStep(2.0)');
  const a = await evj(p, 'NOVA.gate.state()');
  await evj(p, 'BENCH_HOLD=false');      // 交给真实主循环
  await p.waitForTimeout(2600);
  const b = await evj(p, 'NOVA.gate.state()');
  await evj(p, 'BENCH_HOLD=true');
  const ok = a.mode === 'channel' && b.mode === 'channel' && b.ch && b.ch.t > a.ch.t + 1.5;
  return `${ok ? 'PASS' : 'FAIL'} 实时主循环推进通道 t: ${a.ch && a.ch.t} → ${b.ch && b.ch.t}` +
    `（Δ=${b.ch ? (b.ch.t - a.ch.t).toFixed(2) : 'n/a'}s，2.6s 内应涨 ≥1.5s）· 星尘 ${b.ch && b.ch.dust}`;
});

})();
