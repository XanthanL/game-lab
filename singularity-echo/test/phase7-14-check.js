/* Phase 7.14 验证 —— 巨像终极技：LASH 近身横扫 / SWEEP 时针扫描 / DOMAIN 领域湮灭
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> node test/phase7-14-check.js
 * 产出：test/phase7/7-14-*.png + 每行状态断言
 *
 * 这一份要证伪的是一句话：「boss 似乎都是完全一样的战斗模式」。
 * 所以第一条断言就是**量化差异** —— 八只的扫描参数组合必须互不相同。
 * 其余断言围绕三条纪律：
 *   · 先预告后落刀（telegraph 真的存在，且落刀前玩家有读过的时间）；
 *   · 霸体必有代价（扫描期掉血 0，硬直期伤害 ×1.4）；
 *   · 伤害要真的疼（臂 32~37、领域 40~58，顶不住）。
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
  await evj(p, 'BENCH_HOLD=false').catch(() => {});
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(OUT, tag + '.png'), fullPage: false });
  await c.close(); await b.close();
  console.log(errs.length ? 'ERR ' + errs.join(' | ') : note);
}
const evj = (p, code) => p.evaluate(c => NOVA.debug(c), code);

/* 起一局 → 跳到指定 boss 波 → 推进到 boss 出场 → 冻结主循环 + 清场（只留 boss） */
async function toBoss(p, wave) {
  await evj(p, 'NOVA.launch(0)');
  await p.waitForTimeout(200);
  await evj(p, 'BENCH_HOLD=true');
  await evj(p, 'NOVA.wave(' + (wave || 5) + ')');
  await evj(p, 'P.maxHp=99999;P.hp=99999;P.invuln=9999;');
  await evj(p, "for(let i=0;i<2400;i++){if(G.mode!=='play')break;updateWorld(1/60);if(G.asteroids.some(a=>a.boss))break;}");
  // 只留 boss：小怪与弹幕会污染「掉了多少血」的测量
  await evj(p, 'G.enemies.length=0;Wv.qE.length=0;Wv.qA.length=0;G.warns.length=0;G.ebullets.length=0;');
  await evj(p, 'P.hp=P.maxHp;P.invuln=0;');
  return await evj(p, 'NOVA.od.state()');
}

(async () => {

/* ── 01 八只的扫描参数必须真的不同（量化"战斗模式是否一样"）── */
await run('7-14-01-params-distinct', ...D, async p => {
  const r = await evj(p, 'NOVA.od.params()');
  const sig = r.map(x => [x.arm, x.arms, x.arc, x.spin, x.len, x.w, x.dur, x.dmg].join('|'));
  const dup = [];
  for (let i = 0; i < sig.length; i++) for (let j = i + 1; j < sig.length; j++)
    if (sig[i] === sig[j]) dup.push(r[i].k + '≡' + r[j].k);
  const arms = new Set(r.map(x => x.arms)).size;
  const spins = new Set(r.map(x => x.spin)).size;
  const shapes = new Set(r.map(x => x.arm)).size;
  const durs = new Set(r.map(x => x.dur)).size;
  const ok = r.length === 8 && dup.length === 0 && arms >= 4 && spins >= 8 && shapes >= 6 && durs >= 7;
  return `${ok ? 'PASS' : 'FAIL'} 八只参数全不相同：雷同 ${dup.length} 对 · 臂形 ${shapes} 种` +
    ` · 臂数 ${arms} 种 · 转速 ${spins} 种 · 时长 ${durs} 种 · 伤害 ${new Set(r.map(x => x.dmg)).size} 种`;
});

/* ── 02 状态机：预告 → 生长 → 扫描 → 收束，且全程霸体 ────────── */
await run('7-14-02-od-phases', ...D, async p => {
  await toBoss(p, 5);
  const f = await evj(p, 'NOVA.od.force()');
  const seq = [];
  for (let i = 0; i < 8; i++) {
    const s = await evj(p, 'NOVA.od.state()');
    seq.push(s.sweeps.length ? s.sweeps[0].ph : (s.boss && s.boss.odPh) || '-');
    await evj(p, 'NOVA.od.step(0.8)');
  }
  const st = await evj(p, 'NOVA.od.state()');
  const uniq = [...new Set(seq)].filter(x => x !== '-');
  const ok = f && uniq.indexOf('tele') >= 0 && uniq.indexOf('grow') >= 0
    && uniq.indexOf('spin') >= 0 && st.boss && st.boss.odPh === null;
  return `${ok ? 'PASS' : 'FAIL'} 起手 ${f && f.kind} ph=${f && f.ph} invT=${f && f.invT}` +
    ` → 经历阶段 [${uniq.join(' → ')}] → 收束后 odPh=${st.boss && st.boss.odPh}`;
});

/* ── 03 霸体：扫描期打不动它；硬直期伤害 ×1.4 ─────────────── */
await run('7-14-03-armour-and-stun', ...D, async p => {
  await toBoss(p, 5);
  await evj(p, 'NOVA.od.force()');
  await evj(p, 'NOVA.od.step(2.0)');            // 越过 tele+grow，进入 spin
  const inSpin = await evj(p, 'NOVA.od.state()');
  const a1 = await evj(p, 'NOVA.od.poke()');    // 扫描期：应掉 0
  /* 硬直只有 1.1s，一把 step 过去就衰减没了 —— 必须状态驱动地等它出现。
     （这不是测试的洁癖：真实玩家也是看到「硬直」二字才冲上去，窗口就是这么短） */
  let stunned = null;
  for (let i = 0; i < 50; i++) {
    await evj(p, 'NOVA.od.step(0.2)');
    const s = await evj(p, 'NOVA.od.state()');
    if (s.boss && s.boss.stunT > 0) { stunned = s; break; }
  }
  const a2 = await evj(p, 'NOVA.od.poke()');    // 硬直期：100 × 1.4 = 140
  const ok = inSpin.sweeps.length && inSpin.sweeps[0].ph === 'spin'
    && a1.lost === 0 && stunned && Math.abs(a2.lost - 140) < 0.5;
  return `${ok ? 'PASS' : 'FAIL'} 扫描期(ph=${inSpin.sweeps[0] && inSpin.sweeps[0].ph})` +
    ` 打 100 掉 ${a1.lost}（须 0）→ 硬直 ${stunned && stunned.boss.stunT}s 打 100 掉 ${a2.lost}（须 140）`;
});

/* ── 04 扫描判定：臂上掉血，两臂之间不掉血 ─────────────────── */
await run('7-14-04-sweep-hit', ...D, async p => {
  await toBoss(p, 5);
  await evj(p, 'NOVA.od.force()');
  await evj(p, 'NOVA.od.step(2.0)');
  const on = await evj(p, 'NOVA.od.put(true)');       // 摆到臂上
  await evj(p, 'NOVA.od.heal()');
  const off = await evj(p, 'NOVA.od.put(false)');     // 摆到两臂之间
  const ok = on.hit && on.dmg >= 30 && !off.hit;
  return `${ok ? 'PASS' : 'FAIL'} 臂上：命中=${on.hit} 掉 ${on.dmg} 血（须 ≥30，顶不住）` +
    ` · 臂间：命中=${off.hit} 掉 ${off.dmg} 血（须 0，有得躲）`;
});

/* ── 05 潮汐扇（arc>0）：扇内被拽 + 掉血，扇外安全 ──────────── */
await run('7-14-05-tide-arc', ...D, async p => {
  await toBoss(p, 40);                                 // collapse
  const b = await evj(p, 'NOVA.od.state()');
  await evj(p, 'NOVA.od.force()');
  await evj(p, 'NOVA.od.step(2.0)');
  const inside = await evj(p, 'NOVA.od.putArc(true)');
  await evj(p, 'NOVA.od.heal()');
  const outside = await evj(p, 'NOVA.od.putArc(false)');
  const s = await evj(p, 'NOVA.od.state()');
  const ok = b.boss.kind === 'collapse' && s.sweeps.length && s.sweeps[0].arc > 3
    && inside.hit && !outside.hit;
  return `${ok ? 'PASS' : 'FAIL'} ${b.boss.kind} 扇宽 ${s.sweeps[0] && s.sweeps[0].arc} rad` +
    ` · 扇内命中=${inside.hit} 掉 ${inside.dmg} · 扇外命中=${outside.hit} 掉 ${outside.dmg}`;
});

/* ── 06 LASH 近身横扫：贴脸就掉血 ─────────────────────────── */
await run('7-14-06-lash', ...D, async p => {
  await toBoss(p, 5);
  const r = await evj(p, 'NOVA.od.lash()');
  const ok = r && r.hit && r.dmg >= 18;
  return `${ok ? 'PASS' : 'FAIL'} 贴脸横扫：命中=${r && r.hit} 掉 ${r && r.dmg} 血（须 ≈22）`;
});

/* ── 07 领域 · 安全眼：圈外掉半血，圈内安全 ────────────────── */
await run('7-14-07-domain-eyes', ...D, async p => {
  await toBoss(p, 10);                                  // eye
  const d = await evj(p, 'NOVA.od.forceDom()');
  /* 安全圈挪到距 boss 400px 处（仍在领域 520 内，但够远 —— 否则 boss 会一路蹭过来，
     接触伤害把玩家推出圈，测出「圈内也挨炸」的假象），玩家站圈心 */
  await evj(p, 'G.domains[0].items.forEach((it,i)=>{it.x=G.domains[0].x+400;it.y=G.domains[0].y+i*200;});');
  await evj(p, 'P.x=G.domains[0].items[0].x;P.y=G.domains[0].items[0].y;P.invuln=0;P.hp=P.maxHp;');
  await evj(p, 'NOVA.od.stepClean(2.2)');
  const safe = await evj(p, 'NOVA.od.hp()');
  // 同样的站位，但把所有安全圈挪到场外 → 应该掉一大截
  await evj(p, 'NOVA.od.forceDom()');
  await evj(p, 'G.domains[0].items.forEach((it,i)=>{it.x=G.domains[0].x+4000+i*90;it.y=G.domains[0].y+4000;});');
  await evj(p, 'P.x=G.domains[0].x+400;P.y=G.domains[0].y;P.invuln=0;P.hp=P.maxHp;');
  await evj(p, 'NOVA.od.stepClean(2.2)');
  const hurt = await evj(p, 'NOVA.od.hp()');
  const max = await evj(p, 'P.maxHp');
  const ok = d && d.tpl === 'eyes' && safe === max && hurt < max - 40;
  return `${ok ? 'PASS' : 'FAIL'} ${d && d.tpl} 安全圈内 ${safe}/${max}（须满血）` +
    ` · 圈外 ${hurt}/${max}（须掉 ≥40，碰一下就半死）`;
});

/* ── 08 领域 · 网格引爆 / 壁障：能触发、能判定、跑完自清 ─────── */
await run('7-14-08-domain-grid-wall', ...D, async p => {
  await toBoss(p, 25);                                  // warden → grid
  const g = await evj(p, 'NOVA.od.forceDom()');
  await evj(p, 'P.hp=P.maxHp;P.invuln=0;');
  await evj(p, 'NOVA.od.stepClean(7)');
  const gHp = await evj(p, 'NOVA.od.hp()');
  const gLeft = await evj(p, 'G.domains.length');
  const max = await evj(p, 'P.maxHp');

  await toBoss(p, 5);                                   // rock → wall
  const w = await evj(p, 'NOVA.od.forceDom()');
  await evj(p, 'P.hp=P.maxHp;P.invuln=0;');
  /* wall 用普通 step（不清 invuln）：墙是**持续覆盖**的带，
     stepClean 每帧把 invuln 清 0 会让它每帧都结算一次，测出「8000 点伤害」的假象。 */
  await evj(p, 'NOVA.od.step(14)');
  const wLeft = await evj(p, 'G.domains.length');
  const wHp = await evj(p, 'NOVA.od.hp()');
  const ok = g && g.tpl === 'grid' && gLeft === 0 && (max - gHp) > 0
    && w && w.tpl === 'wall' && wLeft === 0;
  return `${ok ? 'PASS' : 'FAIL'} grid(${g && g.tpl} n=${g && g.n}) 残留 ${gLeft} 掉血 ${(max - gHp).toFixed(0)}` +
    ` · wall(${w && w.tpl} n=${w && w.n}) 残留 ${wLeft} 掉血 ${(max - wHp).toFixed(0)}`;
});

/* ── 09 八只都能起手扫描技，且跑完全程不报错 ──────────────── */
await run('7-14-09-all-eight', ...D, async p => {
  const waves = { 5: 'rock', 10: 'eye', 15: 'twin', 20: 'hydra', 25: 'warden', 30: 'nemesis', 35: 'monolith', 40: 'collapse' };
  const bad = [], seen = [];
  for (const w of Object.keys(waves)) {
    await toBoss(p, +w);
    const f = await evj(p, 'NOVA.od.force()');
    const s1 = await evj(p, 'NOVA.od.state()');
    if (!f || !s1.sweeps.length) { bad.push(waves[w] + ':未起手'); continue; }
    seen.push(waves[w] + '(' + s1.sweeps[0].arm + '×' + s1.sweeps[0].arms + ')');
    await evj(p, 'NOVA.od.step(9)');
    const s2 = await evj(p, 'NOVA.od.state()');
    if (s2.sweeps.length) bad.push(waves[w] + ':未收束');
    if (s2.boss && s2.boss.odPh !== null) bad.push(waves[w] + ':卡在OD');
  }
  const ok = bad.length === 0 && seen.length === 8;
  return `${ok ? 'PASS' : 'FAIL'} 八只全部起手并收束：${seen.join(' ')}` + (bad.length ? ' 异常[' + bad.join(' ') + ']' : '');
});

/* ── 10 视觉：预告 telegraph（方向可读）───────────────────── */
await run('7-14-10-visual-telegraph', ...D, async p => {
  await toBoss(p, 5);
  await evj(p, 'NOVA.od.force()');
  await evj(p, 'NOVA.od.step(0.7)');          // 停在 telegraph 中段
  const s = await evj(p, 'NOVA.od.state()');
  await evj(p, 'cam.x=G.asteroids.find(a=>a.boss).x;cam.y=G.asteroids.find(a=>a.boss).y;');
  await evj(p, 'P.x=cam.x+300;P.y=cam.y;');
  const ok = s.sweeps.length && s.sweeps[0].ph === 'tele';
  return `${ok ? 'PASS' : 'FAIL'} 预告阶段 ph=${s.sweeps[0] && s.sweeps[0].ph}` +
    ` · ${s.sweeps[0] && s.sweeps[0].arms} 条 ${s.sweeps[0] && s.sweeps[0].arm} 臂（虚影 + 方向弧）`;
});

/* ── 11 视觉：扫描中（臂已长出并旋转）────────────────────── */
await run('7-14-11-visual-sweep', ...D, async p => {
  await toBoss(p, 5);
  await evj(p, 'NOVA.od.force()');
  await evj(p, 'NOVA.od.step(2.6)');          // 进入 spin
  const s = await evj(p, 'NOVA.od.state()');
  const b0 = s.sweeps[0] ? s.sweeps[0].base : 0;
  await evj(p, 'NOVA.od.step(0.6)');
  const s2 = await evj(p, 'NOVA.od.state()');
  await evj(p, 'cam.x=G.asteroids.find(a=>a.boss).x;cam.y=G.asteroids.find(a=>a.boss).y;');
  const turned = s2.sweeps[0] ? Math.abs(s2.sweeps[0].base - b0) : 0;
  const ok = s.sweeps.length && s.sweeps[0].ph === 'spin' && s.sweeps[0].grow === 1 && turned > 0.15;
  return `${ok ? 'PASS' : 'FAIL'} 扫描中 ph=${s.sweeps[0] && s.sweeps[0].ph} grow=${s.sweeps[0] && s.sweeps[0].grow}` +
    ` · 0.6s 转过 ${turned.toFixed(2)} rad（臂在动）`;
});

})();
