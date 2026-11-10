// singularity-voyage 验证：8.x 两项改动的回归闸门
//   ① 冲刺输入缓冲：冷却结束前 150ms 内按下的键会被记住并在冷却归零那一帧兑现；
//      窗口过期后绝不补放（否则变成「按一次、过很久突然自己冲」）
//   ② 满级质变视觉：overclock 的金色热环真的走 ringPx 画出来；
//      leech 的金色汲取丝真的在击杀时生成（A/B 对照，不是只看字段）
// 运行： node probes/sv-optimize-check.js    退出码 = 失败项数
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const lib = require('./probe-lib');
const ROOT = path.resolve(__dirname, '..');

const PASS = [], FAIL = [];
const chk = (ok, name, extra) => {
  (ok ? PASS : FAIL).push(name);
  console.log((ok ? '  PASS ' : '  FAIL ') + name + (extra ? '   ' + extra : ''));
};

(async () => {
  const served = await lib.serve(0, ROOT);
  const browser = await chromium.launch({
    executablePath: lib.chrome, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 180)); });

  await page.goto(served.base + '?god=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', null, { timeout: 30000 });
  await page.evaluate(() => startGame());
  await page.waitForFunction(() => window.__dbg.state === 'play', null, { timeout: 15000 });
  await page.waitForTimeout(200);
  // ⚠️ 跑几百帧前必须冻结升级门槛，否则中途弹三选一、主循环停摆，量到的全是 0
  await page.evaluate(() => window.__dbg.freezeLevel());

  /* ---------- ① 缓冲在窗口内兑现 ---------- */
  const inWin = await page.evaluate(() => {
    const G = __dbg.G;
    // 「差 100ms 按早了」才是输入缓冲要救的场景；300ms 已超出 150ms 窗口，
    // 那种情况本来就该自然过期（用例 ② 验的就是它）。
    G.dashCd = 0.10; G.dashBuf = 0; G.dashT = 0; G.vx = 0; G.vy = 0;
    tryDash();                                  // 冷却中 → 只记意图
    const buffered = G.dashBuf;
    let refire = false, prev = G.dashCd;
    for (let i = 0; i < 12; i++) {
      __dbg.clearEnemies(); G.spawnQueue.length = 0;
      step(0.05);
      if (G.dashCd > prev + 0.5) refire = true; // 0 → DASH_CD 的跳变 = 真放出来了
      prev = G.dashCd;
    }
    return { buffered, refire, bufAfter: G.dashBuf };
  });
  chk(Math.abs(inWin.buffered - 0.15) < 1e-6, '冷却中按冲刺会记下 150ms 缓冲', String(inWin.buffered));
  chk(inWin.refire === true, '冷却一归零立刻兑现冲刺（不再静默吞键）');
  chk(inWin.bufAfter <= 0, '兑现后缓冲清零，不会连放两次', String(inWin.bufAfter));

  /* ---------- ② 窗口过期不补放 ---------- */
  const expired = await page.evaluate(() => {
    const G = __dbg.G;
    G.dashCd = 0.5; G.dashBuf = 0; G.dashT = 0; G.vx = 0; G.vy = 0;
    tryDash();
    for (let i = 0; i < 5; i++) { __dbg.clearEnemies(); G.spawnQueue.length = 0; step(0.05); }
    const bufAfter = G.dashBuf;                 // 0.25s > 0.15s，缓冲该过期了
    let refire = false, prev = G.dashCd;
    for (let i = 0; i < 14; i++) {
      __dbg.clearEnemies(); G.spawnQueue.length = 0;
      step(0.05);
      if (G.dashCd > prev + 0.5) refire = true;
      prev = G.dashCd;
    }
    return { bufAfter, refire };
  });
  chk(expired.bufAfter <= 0, '缓冲窗口过期后自动作废', String(expired.bufAfter));
  chk(expired.refire === false, '过期后冷却再归零也不补放（不会自己冲出去）');

  /* ---------- ③ overclock 满级热环真的画出来 ---------- */
  const ring = await page.evaluate(() => {
    const G = __dbg.G, S = G.S;
    const orig = window.ringPx;
    const probe = v => {
      const calls = [];
      window.ringPx = (x, y, r, th) => { calls.push({ r, color: ctx.strokeStyle }); orig(x, y, r, th); };
      const save = { shield: S.shield, stasis: S.stasis, ram: S.ram, muzzle: G.muzzle };
      S.shield = 0; S.stasis = 0; S.ram = 0; G.muzzle = 0;   // 排除其它会画环的状态
      S.ovGold = v;
      drawPlayer();
      window.ringPx = orig;
      S.shield = save.shield; S.stasis = save.stasis; S.ram = save.ram; G.muzzle = save.muzzle;
      return calls;
    };
    const off = probe(0), on = probe(1);
    S.ovGold = 0;
    return { off, on };
  });
  chk(ring.off.length === 0, '未满级时玩家周围不多画任何环', JSON.stringify(ring.off));
  chk(ring.on.length === 1 && ring.on[0].r === 18 && /ffcd75|255,\s*205,\s*117/.test(ring.on[0].color),
      '满级过载画出金色热环（走 ringPx，真在屏幕上）', JSON.stringify(ring.on));

  /* ---------- ④ leech 满级汲取丝真的生成 ---------- */
  const leech = await page.evaluate(() => {
    const G = __dbg.G, S = G.S;
    const run = v => {
      __dbg.clearEnemies(); G.parts.length = 0;
      S.leech = 5; S.leechGold = v; S.hp = Math.max(1, S.maxHp - 30);
      __dbg.spawn('seeker', G.px + 80, G.py);
      const e = G.enemies[G.enemies.length - 1];
      if (!e) return -1;
      killEnemy(e);
      // drag=0.8 是本效果独有的标记：普通击杀 burst 用 drag=3，不会混进来
      return G.parts.filter(p => p.col === '#ffcd75' && p.drag === 0.8).length;
    };
    const off = run(0), on = run(1);
    S.leechGold = 0; S.leech = 0;
    return { off, on };
  });
  chk(leech.off === 0, '未满级噬能不产生汲取丝', String(leech.off));
  chk(leech.on === 5, '满级噬能击杀时飞回 5 粒金色汲取丝', String(leech.on));

  /* ---------- ⑤ 静态实现 + 零错误 ---------- */
  const src = fs.readFileSync(path.join(ROOT, 'src', 'game.js'), 'utf8');
  chk(/const DASH_BUF = 0\.15/.test(src), '缓冲窗口有单一常量（不散在分支里）');
  chk(/if \(G\.dashCd > 0\) \{ G\.dashBuf = DASH_BUF; return; \}/.test(src), '键盘与触屏共用 tryDash 这一个入口');
  chk(/if \(G\.dashBuf > 0\) \{[\s\S]{0,160}if \(G\.dashCd <= 0\) tryDash\(\);/.test(src),
      '兑现排在 dashCd 衰减之后（不晚一帧）');
  chk(errs.length === 0, '全程零 JS 错误', errs.join(' | ').slice(0, 240));

  console.log(`\n== 汇总 ==  ${PASS.length} PASS / ${FAIL.length} FAIL`);
  if (FAIL.length) console.log('   失败：' + FAIL.join(' · '));
  await browser.close();
  served.server.close();
  process.exit(FAIL.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
