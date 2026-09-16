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

/* ── 07 收束 → 跃出 → 发卡 → 选完卡才推进下一波，门已清空 ── */
await run('7-12-07-close-and-advance', ...D, async p => {
  await toBoss(p);
  await evj(p, 'NOVA.gate.killBoss()');
  await evj(p, 'NOVA.gate.killAll()');
  await evj(p, 'NOVA.gate.clearTick()');
  await evj(p, 'NOVA.gate.enter()');
  await evj(p, 'NOVA.gate.warpStep(2.0)');
  await evj(p, "NOVA.gate.pod('level')");      // 额外攒一张，验证两张都发
  const e = await evj(p, 'NOVA.gate.chEnd()'); // 7.13：收束先进跃出过场，不再直接切回 play
  const w = await evj(p, 'NOVA.gate.warpOutStep(2.0)');  // 跃出落地 → 发卡
  const lu = await evj(p, 'NOVA.gate.state()');
  await drainCards(p);
  const s = await evj(p, 'NOVA.gate.state()');
  const ok = e.mode === 'warpout' && w === 'levelup' && lu.pending >= 2 && lu.chAfter === true
    && s.wave === 6 && s.gate === null && s.mode === 'play' && s.cleared === false && s.chAfter === false;
  return `${ok ? 'PASS' : 'FAIL'} 收束：mode=${e.mode}（跃出过场）→ 落地 mode=${w}` +
    ` 待发卡=${lu.pending} 标志=${lu.chAfter}` +
    ` → 选完：WAVE ${s.wave} mode=${s.mode} cleared=${s.cleared} gate=${s.gate}`;
});

/* ── 08 全流程跑一遍不抛错（含 22 秒通道全程 + 跃出）───────────── */
await run('7-12-08-full-run-noerr', ...D, async p => {
  await toBoss(p);
  await evj(p, 'NOVA.gate.killBoss()');
  await evj(p, 'NOVA.gate.killAll()');
  await evj(p, 'NOVA.gate.clearTick()');
  await evj(p, 'NOVA.gate.enter()');
  await evj(p, 'NOVA.gate.warpStep(2.0)');
  const last = await evj(p, 'NOVA.gate.chTick(23)');   // 一口气跑满 22 秒
  const s = await evj(p, 'NOVA.gate.state()');
  await evj(p, 'NOVA.gate.warpOutStep(3.0)');          // 7.13：跃出过场也要走完
  await drainCards(p);
  const s2 = await evj(p, 'NOVA.gate.state()');
  const ok = s.mode === 'warpout' && s2.wave === 6 && s2.gate === null && s2.chAfter === false;
  return `${ok ? 'PASS' : 'FAIL'} 跑满通道 → mode=${s.mode}（应为 warpout）→ 选卡后 WAVE ${s2.wave}` +
    ` / gate=${s2.gate} / chAfter=${s2.chAfter}（收束前末帧 ${JSON.stringify(last)}）`;
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
  /* killBoss 触发的 0.55s 子弹时间（G.slowT）只被 frame() 消耗，BENCH_HOLD 手动
     tick 跳过了它 → 解冻后头 0.55s 世界按 0.35× 慢速跑，引力测量被吃掉近半。
     真实对局里 Boss 死后还要清掉 8 块新残骸门才激发，slowT 早就耗完 —— 补清才是还原。 */
  await evj(p, 'G.slowT=0;AU.setMuffle(0);');
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
  await evj(p, 'G.slowT=0;AU.setMuffle(0);');  // 同 09：清掉 killBoss 残留的子弹时间
  await evj(p, 'BENCH_HOLD=false');      // 交给真实主循环
  await p.waitForTimeout(2600);
  const b = await evj(p, 'NOVA.gate.state()');
  await evj(p, 'BENCH_HOLD=true');
  const ok = a.mode === 'channel' && b.mode === 'channel' && b.ch && b.ch.t > a.ch.t + 1.5;
  return `${ok ? 'PASS' : 'FAIL'} 实时主循环推进通道 t: ${a.ch && a.ch.t} → ${b.ch && b.ch.t}` +
    `（Δ=${b.ch ? (b.ch.t - a.ch.t).toFixed(2) : 'n/a'}s，2.6s 内应涨 ≥1.5s）· 星尘 ${b.ch && b.ch.dust}`;
});

/* ── 11 视觉：跃出过场（7.13 收束不再瞬切，先放 1.5s 出口特效）──── */
await run('7-12-11-visual-warpout', ...D, async p => {
  await toBoss(p);
  await evj(p, 'NOVA.gate.killBoss()');
  await evj(p, 'NOVA.gate.killAll()');
  await evj(p, 'NOVA.gate.clearTick()');
  await evj(p, 'NOVA.gate.enter()');
  await evj(p, 'NOVA.gate.warpStep(2.0)');
  await evj(p, 'NOVA.gate.chTick(23)');       // 跑满 → 收束 → 应进 warpout
  await evj(p, 'G.slowT=0;AU.setMuffle(0);'); // 同 09：清掉子弹时间，否则头 0.55s 按 0.35× 慢速推进
  const s0 = await evj(p, 'NOVA.gate.state()');
  // 解冻 0.4s 让过场真实推进，再冻住 —— 截图窗口里它应该还在播
  await evj(p, 'BENCH_HOLD=false');
  await p.waitForTimeout(400);
  await evj(p, 'BENCH_HOLD=true');
  const s1 = await evj(p, 'NOVA.gate.state()');
  const k = await evj(p, 'NOVA.gate.consts()');
  const ok = s0.mode === 'warpout' && s1.mode === 'warpout'
    && s1.warpT > 0.3 && s1.warpT < k.WARP_OUT_DUR;
  return `${ok ? 'PASS' : 'FAIL'} 收束 mode=${s0.mode}（应为 warpout）· 0.4s 后仍在过场` +
    ` warpT=${s1.warpT.toFixed(2)}s / ${k.WARP_OUT_DUR}s（未落地就别发卡）`;
});

/* ── 12 黑洞透镜 A/B：同一帧透镜开/关各渲一次，影响环上的像素必须不同，
      影响域外的对照点必须相同（证明差异来自透镜而非随机渲染）────── */
await run('7-12-12-visual-lens', ...D, async p => {
  await toBoss(p);
  await evj(p, 'NOVA.gate.killBoss()');
  await evj(p, 'NOVA.gate.killAll()');
  await evj(p, 'NOVA.gate.clearTick()');
  // 门置于屏幕正中、无抖动：两次 draw() 之间除透镜外必须逐像素一致
  await evj(p, 'cam.x=G.gate.x;cam.y=G.gate.y;cam.zoom=1;cam.ox=0;cam.oy=0;G.shake=0;');
  await evj(p, 'P.x=G.gate.x+380;P.y=G.gate.y;P.invuln=9999;P.xp=0;P.xpNext=99999;G.pending=0;');
  const r = await evj(p, `(() => {
    const g = G.gate;
    const dev = (wx, wy) => [Math.round((wx - cam.x + VW / 2) * DPR), Math.round((wy - cam.y + VH / 2) * DPR)];
    const ring = (rad) => Array.from({ length: 24 }, (_, i) => {
      const a = i / 24 * Math.PI * 2;
      return dev(g.x + Math.cos(a) * rad, g.y + Math.sin(a) * rad);
    });
    const lensPts = ring(80);    // 影响域内（reach≈156，吸积盘/箭头之外）
    const ctrlPts = ring(400);   // 影响域外：对照，必须两次一致
    const grab = () => {
      draw();
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      /* 对照环 r=400 在 1024×768@2x 视口里有 6 个点超出画布（|sin|>0.96 的那些），
         越界索引读到 undefined → NaN，NaN!==NaN 会被误判成"两次渲染不同"。
         出界点两次都标 -1，不参与差异统计。 */
      return pts => pts.map(([x, y]) => {
        if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) return -1;
        const i = (y * cv.width + x) * 4;
        return d[i] * 65536 + d[i + 1] * 256 + d[i + 2];
      });
    };
    GATE_LENS_ON = true;  const fa = grab();
    GATE_LENS_ON = false; const fb = grab();
    GATE_LENS_ON = true;
    const diff = (pts) => { const A = fa(pts), B = fb(pts); let n = 0; for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) n++; return n; };
    return { lens: diff(lensPts), ctrl: diff(ctrlPts), state: G.gate.state };
  })()`);
  const ok = r && r.state === 2 && r.ctrl === 0 && r.lens >= 5;
  return `${ok ? 'PASS' : 'FAIL'} 透镜环 24 点中 ${r && r.lens} 点被扭曲（≥5）` +
    ` · 对照环 ${r && r.ctrl} 点漂移（必须 0，否则差异来自随机渲染而非透镜）`;
});

/* ── 13 跃出落地后玩家状态必须有限 —— P.ang 拼成 P.angle 的兄弟 bug 会让
      vx/vy 变 NaN（Math.cos(undefined)），然后 P.x、cam 一起 NaN，整局黑屏
      却看不出原因。这类"字段名拼错"只有跑完整条流程的用例才抓得到。 ── */
await run('7-12-13-warpout-no-nan', ...D, async p => {
  await toBoss(p);
  await evj(p, 'NOVA.gate.killBoss()');
  await evj(p, 'NOVA.gate.killAll()');
  await evj(p, 'NOVA.gate.clearTick()');
  await evj(p, 'NOVA.gate.enter()');
  await evj(p, 'NOVA.gate.warpStep(2.0)');
  await evj(p, 'NOVA.gate.chTick(23)');
  const s0 = await evj(p, 'NOVA.gate.state()');
  await evj(p, 'NOVA.gate.warpOutStep(2.0)');
  const r = await evj(p, `({x:+P.x.toFixed(1),y:+P.y.toFixed(1),vx:+P.vx.toFixed(1),vy:+P.vy.toFixed(1),
    fin:Number.isFinite(P.x)&&Number.isFinite(P.y)&&Number.isFinite(P.vx)&&Number.isFinite(P.vy)})`);
  await drainCards(p);
  const md = await evj(p, 'G.mode');
  await evj(p, "for(let i=0;i<60;i++){if(G.mode!=='play')break;updateWorld(1/60);}");
  const r2 = await evj(p, `({x:+P.x.toFixed(1),y:+P.y.toFixed(1),cx:+cam.x.toFixed(1),
    fin:Number.isFinite(P.x)&&Number.isFinite(P.y)&&Number.isFinite(cam.x)})`);
  const ok = s0.mode === 'warpout' && r.fin && r2.fin && (r.x !== r2.x || r.y !== r2.y);
  return `${ok ? 'PASS' : 'FAIL'} 落地 P=(${r.x},${r.y}) v=(${r.vx},${r.vy}) 有限=${r.fin}` +
    ` · 发卡后 mode=${md} 再跑 1s → P=(${r2.x},${r2.y}) cam.x=${r2.cx}（NaN 会连锁污染相机）`;
});

/* ── 14 触屏摇杆四个方向都得真的往那边走 ──────────────────────
      5.5 原本把「下拉 >0.62」判成刹车，于是推正下方只掉头不推进；
      更隐蔽的是满舵右下/左下（ny≈0.707）也进刹车区，八分舵（ny≈0.566）反而能动。
      这里四个方向各推 1.5s，逐个量位移。 ── */
await run('7-12-14-joy-four-dir', ...D, async p => {
  await evj(p, 'NOVA.launch(0)');
  await p.waitForTimeout(200);
  await evj(p, 'BENCH_HOLD=true');
  await evj(p, 'P.maxHp=99999;P.hp=99999;P.invuln=9999;');
  const dirs = [['下', 0, 46], ['上', 0, -46], ['右', 46, 0], ['左', -46, 0]];
  const out = [];
  for (const [name, dx, dy] of dirs) {
    await evj(p, 'G.asteroids.length=0;G.ebullets.length=0;');
    await evj(p, 'P.x=WORLD.w/2;P.y=WORLD.h/2;P.vx=0;P.vy=0;P.angle=0;');
    await evj(p, `NOVA.touch.set(${dx},${dy})`);
    await evj(p, "for(let i=0;i<90;i++){updatePlayer(1/60);}");
    const r = await evj(p, '({x:Math.round(P.x-WORLD.w/2),y:Math.round(P.y-WORLD.h/2),th:P.thrusting})');
    out.push([name, r]);
  }
  /* 刹车：手指按在杆上但停在死区里 = 刹车，必须比松手自然减速明显更快
     （刹车是 5.5 的功能，只是不能再挂在"向下推"这个方向上） */
  const coast = async (code) => {
    await evj(p, 'G.asteroids.length=0;P.x=WORLD.w/2;P.y=WORLD.h/2;P.vx=400;P.vy=0;P.angle=0;');
    await evj(p, code);
    await evj(p, 'for(let i=0;i<30;i++){updatePlayer(1/60);}');
    return await evj(p, '+Math.hypot(P.vx,P.vy).toFixed(1)');
  };
  const br = await coast('NOVA.touch.set(0,0)');       // 按着不动 → 刹车
  await evj(p, 'NOVA.touch.clear()');
  const fr = await coast('NOVA.touch.clear()');        // 松手 → 只剩自然阻尼
  const [dn, up, rt, lf] = out.map(o => o[1]);
  const ok = dn.y > 100 && up.y < -100 && rt.x > 100 && lf.x < -100
    && dn.th && up.th && rt.th && lf.th && br < fr * 0.6;
  return `${ok ? 'PASS' : 'FAIL'} 推 1.5s 位移：下 Δy=${dn.y}（须 >100）· 上 Δy=${up.y}（须 <-100）` +
    ` · 右 Δx=${rt.x}（须 >100）· 左 Δx=${lf.x}（须 <-100）` +
    ` · 按着不动 0.5s 残速 ${br} vs 松手 ${fr}（刹车须 <60%）`;
});

})();
