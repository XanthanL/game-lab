/* 遗物扩容的视觉确认截图 → .shots/relic-*.png
   ① 24 件遗物图标对照表（直接在 #wrap 上贴一张临时画布，不依赖游戏内 UI）
   ② 战斗 HUD：挂 8 件 / 24 件遗物时的排布（验换行不压敌人、不越界）
   用法：node .probe-shots-relic.cjs   （需本地 8126 服务）   */
'use strict';
const { chromium } = require('playwright-core');
const CHROME = 'C:/Users/www27/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe';
const BASE = 'http://127.0.0.1:8126/index.html';
const OUT = 'E:/Code/game-lab/forcing-cosmos/.shots/';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-proxy-server', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(BASE + '?auto=1&noanim=1', { waitUntil: 'load' });
  await p.waitForTimeout(1600);
  const wrap = await p.$eval('#wrap', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  const clip = { x: wrap.x, y: wrap.y, width: wrap.width, height: wrap.height };
  const shot = async n => { await p.screenshot({ path: OUT + n, clip }); console.log('  → ' + n); };

  /* ① 图标对照表：临时把 #wrap 内容换掉（截图后不再恢复，本探针只截图不回归） */
  await p.evaluate(() => {
    document.querySelectorAll('#wrap > *').forEach(el => { el.style.display = 'none'; });
    const cv = document.createElement('canvas');
    cv.id = '__relicsheet';            // ⚠️ 必须给 id —— 下一步只删自己贴的这张，
    cv.width = 640; cv.height = 360;   //    无差别删 #wrap canvas 会把游戏画布一起删掉（战场全黑）
    cv.style.cssText = 'position:absolute;left:0;top:0;width:640px;height:360px;image-rendering:pixelated;background:#0b0e18;z-index:99';
    document.getElementById('wrap').appendChild(cv);
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0b0e18'; g.fillRect(0, 0, 640, 360);
    g.font = '9px monospace';
    RELIC_IDS.forEach((id, i) => {
      const r = RELICS[id];
      const col = i % 8, row = (i / 8) | 0;
      const x = 14 + col * 78, y = 12 + row * 58;
      const s = SPR['r_' + r.icon];
      if (s) g.drawImage(s.r[0], x + 18, y, s.r[0].width * 3, s.r[0].height * 3);
      g.fillStyle = r.col; g.fillText(r.name, x, y + 44);
      g.fillStyle = '#566c86'; g.fillText(r.icon, x, y + 54);
    });
    g.fillStyle = '#73eff7'; g.fillText('RELIC ICONS  ' + RELIC_IDS.length, 14, 220);
    // 尺寸标注：最小的图标有多大
    const sizes = RELIC_IDS.map(i => { const s = SPR['r_' + RELICS[i].icon]; return s ? s.r[0].width + 'x' + s.r[0].height : '?'; });
    g.fillStyle = '#566c86'; g.fillText(sizes.join(' '), 14, 236);
  });
  await p.waitForTimeout(300);
  await shot('relic-icons.png');

  /* ② 战斗 HUD 排布 */
  const showHud = (n, label) => p.evaluate(([n, label]) => {
    const sheet = document.getElementById('__relicsheet'); if (sheet) sheet.remove();
    document.querySelectorAll('#wrap > *').forEach(el => { el.style.display = ''; });
    G.player.relics = RELIC_IDS.slice(0, n);
    G.player.baseMaxHp = 100; G.player.hp = 72; G.player.baseBattery = 3; G.player.battery = 4;
    G.player.status.strength = 2; G.player.status.vulnerable = 1;
    G.phase = 'player'; G.busy = false;
    G.hand = []; G.draw = []; G.discard = []; G.exhaust = [];
    $('act-label').textContent = label;
    updateHud(); renderHand();
  }, [n, label]);

  for (const n of [8, 24]) {
    await p.evaluate(() => {
      META.unlockedAsc = 0; saveMeta(); G.asc = 0;
      newRun('assault');
      G.player.passive = 'none';
      startBattle('normal', 0);
    });
    await p.waitForTimeout(1000);
    await showHud(n, n === 8 ? '▸ 8 件遗物（旧上限）' : '▸ 24 件遗物（换行后）');
    await p.waitForTimeout(350);
    await shot('relic-hud-' + n + '.png');
  }

  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
