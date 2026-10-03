// singularity-voyage 冲刺方向验证：冲刺只沿机头 G.ang
// 运行： node sv-dash-dir.js
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.SV_URL || 'http://127.0.0.1:8612/index.html';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  });
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)); });

  await page.goto(BASE + '?god=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', null, { timeout: 20000 });
  await page.evaluate(() => { startGame(); });
  await page.waitForFunction(() => window.__dbg.state === 'play', null, { timeout: 10000 });
  await page.waitForTimeout(400);

  const R = await page.evaluate(() => new Promise(async resolve => {
    const d = window.__dbg, G = d.G;
    const frame = () => new Promise(r => requestAnimationFrame(r));
    const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const rows = [];

    d.clearEnemies(); d.clearMods(); d.resetStats(); G.hitstop = 0;

    // 一次冲刺：给定机头角 ang、初速 (vx,vy)、按住的键 held
    async function dash(ang, vx, vy, held = []) {
      // ⚠️ 每例都要清场：跑得久了 updateWave 会继续补敌人，撞上来的接触伤害会往 G.vx/vy 上
      //    加一记互推（`G.vx += ux * 40`），量出来就成了「方向偏了几度」—— 那是场上有怪，不是 dash 的 bug。
      d.clearEnemies(); G.spawnQueue.length = 0;
      d.setPos(G.px, G.py);
      G.vx = vx; G.vy = vy; G.ang = ang; G.aim = ang + 1.2;   // 故意让准星偏离机头
      G.dashCd = 0; G.dashT = 0; G.hitstop = 0;
      for (const k of held) d.hold(k, true);
      const x0 = G.px, y0 = G.py;
      tryDash();
      const mv = Math.hypot(G.vx, G.vy);
      const moveAng = Math.atan2(G.vy, G.vx);
      for (let i = 0; i < 200; i++) { await frame(); if (G.vx === 0 && G.vy === 0) break; }
      for (const k of held) d.hold(k, false);
      const dx = G.px - x0, dy = G.py - y0;
      return {
        err: Math.abs(norm(moveAng - ang)) * 180 / Math.PI,      // 速度方向与机头的夹角
        dist: Math.hypot(dx, dy),
        dirErr: Math.abs(norm(Math.atan2(dy, dx) - ang)) * 180 / Math.PI, // 实际位移方向与机头的夹角
        peak: mv,
      };
    }

    // 1) 静止，8 个方向
    for (let i = 0; i < 8; i++) {
      const ang = i / 8 * Math.PI * 2;
      rows.push({ case: '静止 ' + Math.round(ang * 180 / Math.PI) + '°', ...await dash(ang, 0, 0) });
    }
    // 2) 垂直侧移时冲刺（机头朝右，正在向正下方全速移动）
    rows.push({ case: '侧移中东冲', ...await dash(0, 0, 160) });
    // 3) 全速倒退时冲刺（机头朝右，速度朝左）
    rows.push({ case: '倒退中东冲', ...await dash(0, -160, 0) });
    // 4) 按住 WASD 干扰：机头朝下(-Y)，却按住 W（旧实现会朝上冲）
    rows.push({ case: '机头朝下+按W', ...await dash(Math.PI / 2, 0, 0, ['KeyW']) });
    rows.push({ case: '机头朝右+按A', ...await dash(0, 0, 0, ['KeyA']) });
    // 5) 鼠标准星偏离（aimMode=mouse 时不该跟鼠标准星跑）
    rows.push({ case: '准星偏离+鼠标模式', ...await dash(-Math.PI / 4, 0, 0) });

    resolve(rows);
  }));

  console.log('== 冲刺方向（机头 = 唯一基准）==');
  console.log(' 用例                     速度方向偏差   位移方向偏差   位移      峰值速度');
  let worst = 0, worstCase = '';
  for (const r of R) {
    worst = Math.max(worst, r.err, r.dirErr);
    if (worst === Math.max(r.err, r.dirErr)) worstCase = r.case;
    console.log(' ' + r.case.padEnd(22) + '  ' + r.err.toFixed(2).padStart(8) + '°  '
      + r.dirErr.toFixed(2).padStart(10) + '°  ' + r.dist.toFixed(1).padStart(7) + 'px  '
      + r.peak.toFixed(0).padStart(7) + ' px/s');
  }
  console.log('\n 最大方向偏差 : ' + worst.toFixed(3) + '°  (' + worstCase + ')  阈值 1°');

  // 旧实现的对照断言：倒退时冲刺，旧代码会保留 -160 的反向分量，位移会朝左
  const back = R.find(r => r.case === '倒退中东冲');
  console.log(' 倒退冲刺的实际位移方向 : ' + (back.dirErr < 1 ? '沿机头 ✓' : '被倒退速度拽偏 ✗'));

  console.log('== JS 错误 ==');
  console.log(errs.length ? errs.slice(0, 8).join('\n') : ' 无');
  await browser.close();
  if (worst > 1) process.exit(1);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
