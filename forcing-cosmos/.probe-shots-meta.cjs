/* 局外进度 UI 的视觉确认截图 → .shots/meta-*.png
   用法：node .probe-shots-meta.cjs   （需本地 8126 服务）   */
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
  const shot = async (name, clip) => { await p.screenshot({ path: OUT + name, clip }); console.log('  → ' + name); };
  const wrap = async () => p.$eval('#wrap', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });

  // 1) 标题页：航行日志按钮 + 继续卡片
  await p.goto(BASE + '?noanim=1', { waitUntil: 'load' }); await p.waitForTimeout(1200);
  await p.evaluate(() => {
    META.unlockedAsc = 4; META.bestAsc = 3;
    META.stats = { runs: 12, wins: 3, kills: 96, floors: 214, gold: 2380 };
    META.log = [
      { at: Date.now(), win: true, asc: 3, charId: 'engineer', floors: 19, wins: 11, deck: 27, dur: 2460000, end: '平衡' },
      { at: Date.now() - 6e5, win: false, asc: 2, charId: 'astronaut', floors: 12, wins: 6, deck: 19, dur: 900000, end: '' },
    ];
    saveMeta(); G.asc = 2; newRun('engineer'); G.gold = 214; G.run.floors = 6; saveGame();
    showTitle(); renderResume();
  });
  await p.waitForTimeout(400);
  await shot('meta-01-title.png', await wrap());

  // 2) 航行日志弹窗
  await p.click('[data-act="log"]'); await p.waitForTimeout(400);
  await shot('meta-02-log.png', await wrap());
  await p.click('#modal-x'); await p.waitForTimeout(250);

  // 3) 选人页梯度选择器（Lv.3）
  await p.goto(BASE + '?charsel=1&noanim=1', { waitUntil: 'load' }); await p.waitForTimeout(900);
  await p.evaluate(() => { META.unlockedAsc = 4; saveMeta(); G.asc = 3; showCharSel(); });
  await p.waitForTimeout(300);
  await shot('meta-03-asc.png', await wrap());

  // 4) 结局面板：解锁横幅
  await p.goto(BASE + '?noanim=1', { waitUntil: 'load' }); await p.waitForTimeout(900);
  await p.evaluate(() => {
    localStorage.removeItem('fc_meta_v1');
    META = JSON.parse(JSON.stringify(META_DEFAULT)); saveMeta();
    G.asc = 2; newRun('engineer'); G.run.floors = 19; G.run.wins = 11; G.run.elites = 3; G.run.events = 2; G.run.shops = 2; G.run.gold = 480;
    gameOver(true);
  });
  await p.waitForTimeout(500);
  await shot('meta-04-unlock.png', await wrap());

  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
