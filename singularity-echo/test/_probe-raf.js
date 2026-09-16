/* 一次性诊断探针（用完即删）：量化 drawGateLens 对 headless RAF 帧率的影响
 *   A) play 模式 + 激发门，玩家在 380px 处被引力拉 1.2s —— 透镜 ON vs OFF
 *   B) warpout 过场 0.4s —— 透镜 ON vs OFF
 * 输出：墙钟时间 vs 游戏时间(G.t) 推进比 ≈ 有效帧率，以及 09 需要的位移量。
 */
const path = require('path');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const D = [1024, 768];

const evj = (p, code) => p.evaluate(c => NOVA.debug(c), code);

async function toBoss(p) {
  await evj(p, 'NOVA.launch(0)');
  await p.waitForTimeout(200);
  await evj(p, 'BENCH_HOLD=true');
  await evj(p, 'NOVA.wave(5)');
  await evj(p, 'P.maxHp=99999;P.hp=99999;P.invuln=9999;');
  await evj(p, "for(let i=0;i<2400;i++){if(G.mode!=='play')break;updateWorld(1/60);if(G.asteroids.some(a=>a.boss))break;}");
  return await evj(p, 'NOVA.gate.boss()');
}

async function run(tag, job) {
  const b = await chromium.launch({ executablePath: EXE });
  const c = await b.newContext({ viewport: { width: D[0], height: D[1] }, deviceScaleFactor: 2 });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.goto(GAME, { waitUntil: 'load' });
  await p.waitForFunction(() => { const b = document.getElementById('boot'); return !b || b.classList.contains('out'); }, null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(1000);
  let note = '';
  try { note = (await job(p)) || ''; } catch (e) { errs.push('JOB:' + e.message.slice(0, 200)); }
  await c.close(); await b.close();
  console.log(`[${tag}] ${errs.length ? 'ERR ' + errs.join('|') : note}`);
}

(async () => {
  /* A) play 模式引力拉拽（复现 09 场景） */
  for (const lens of [true, false]) {
    await run(`09 lens=${lens ? 'ON ' : 'OFF'}`, async p => {
      await toBoss(p);
      await evj(p, 'NOVA.gate.killBoss()');
      await evj(p, 'NOVA.gate.killAll()');
      await evj(p, 'NOVA.gate.clearTick()');
      await evj(p, 'cam.x=G.gate.x;cam.y=G.gate.y;');
      await evj(p, 'P.x=G.gate.x+380;P.y=G.gate.y;P.vx=0;P.vy=0;P.xp=0;P.xpNext=99999;G.pending=0;');
      /* killBoss 触发的子弹时间在 BENCH_HOLD 下永不消耗 —— 真实对局里玩家
         从击杀到测距早就过了 0.55s，这里补清才算还原真实状态 */
      await evj(p, 'G.slowT=0;AU.setMuffle(0);');
      const d0 = await evj(p, 'Math.round(Math.hypot(P.x-G.gate.x,P.y-G.gate.y))');
      const t0 = await evj(p, `({gt:G.t, lens:GATE_LENS_ON})`);
      await evj(p, `GATE_LENS_ON=${lens}`);
      await evj(p, 'BENCH_HOLD=false');
      await p.waitForTimeout(1200);
      const r = await evj(p, '({gt:G.t,d:Math.round(Math.hypot(P.x-G.gate.x,P.y-G.gate.y)),mode:G.mode})');
      await evj(p, 'BENCH_HOLD=true');
      const wall = 1.2, gt = r.gt - t0.gt;
      return `墙钟1.2s 游戏推进${gt.toFixed(2)}s(${(gt / wall * 100).toFixed(0)}%) 距离${d0}→${r.d} 拉近${d0 - r.d}px(需≥40) lensBefore=${t0.lens}`;
    });
  }
  /* B) warpout 过场（复现 11 场景） */
  for (const lens of [true, false]) {
    await run(`11 lens=${lens ? 'ON ' : 'OFF'}`, async p => {
      await toBoss(p);
      await evj(p, 'NOVA.gate.killBoss()');
      await evj(p, 'NOVA.gate.killAll()');
      await evj(p, 'NOVA.gate.clearTick()');
      await evj(p, 'NOVA.gate.enter()');
      await evj(p, 'NOVA.gate.warpStep(2.0)');
      await evj(p, 'NOVA.gate.chTick(23)');
      await evj(p, 'G.slowT=0;AU.setMuffle(0);');   // 同上：清掉 killBoss 残留的子弹时间
      const s0 = await evj(p, 'NOVA.gate.state()');
      const t0 = await evj(p, 'G.t');
      await evj(p, `GATE_LENS_ON=${lens}`);
      await evj(p, 'BENCH_HOLD=false');
      await p.waitForTimeout(400);
      const r = await evj(p, '({gt:G.t,warpT:G.warpT,mode:G.mode})');
      await evj(p, 'BENCH_HOLD=true');
      const gt = r.gt - t0;
      return `收束mode=${s0.mode} 墙钟0.4s 游戏推进${gt.toFixed(2)}s(${(gt / 0.4 * 100).toFixed(0)}%) warpT=${r.warpT.toFixed(2)}(需>0.3) mode=${r.mode}`;
    });
  }
})();
