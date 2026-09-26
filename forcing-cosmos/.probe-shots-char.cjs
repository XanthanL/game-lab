/* 职业专属卡的视觉确认截图 → .shots/char-*.png
   每个乘员 4 张专属卡各来一张，外加一张四职业对比图。
   用法：node .probe-shots-char.cjs   （需本地 8126 服务）   */
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

  const show = (ids, label) => p.evaluate(([ids, label]) => {
    const e = G.enemy, pl = G.player;
    e.baseMaxHp = 400; e.hp = 400; e.shield = 0;
    pl.baseMaxHp = 400; pl.hp = 400; pl.baseBattery = 9; pl.battery = 9;
    pl.shield = 12;                       // 让「盾击」的预测有东西可算
    G.phase = 'player'; G.busy = false; G.playedThisTurn = 2;
    G.hand = ids.map(id => createCardInstance(CARD_DEFS[id]));
    G.draw = []; G.discard = []; G.exhaust = [];
    clearFlyCards(); FX.floats.length = 0;
    renderHand(); updateHud();
    $('act-label').textContent = label;
  }, [ids, label]);

  const DECKS = {
    astronaut: ['aeroShot', 'aeroGuard', 'driftThrust', 'orbitalScan'],
    engineer: ['rivetShot', 'bulkhead', 'thornPlating', 'shieldBash'],
    mutant: ['sporeBolt', 'chitin', 'mutagen', 'mutagenicCloud'],
    assault: ['burstFire', 'quickGuard', 'fragGrenade', 'comboFinisher'],
  };
  const NAMES = { astronaut: '宇航员 · 平衡的探索者', engineer: '工程兵 · 护盾大师', mutant: '异变者 · 状态操控者', assault: '突击兵 · 连击杀手' };

  for (const id of Object.keys(DECKS)) {
    await show(DECKS[id], '▸ ' + NAMES[id]);
    await p.waitForTimeout(300);
    // 悬停第一张，把伤害预测也拍进去
    const c = await p.$eval('#hand .card:nth-child(1)', el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.mouse.move(c.x, c.y);
    await p.waitForTimeout(350);
    await shot('char-' + id + '.png');
  }

  // 四职业对比：每家出一张，外加两张通用卡
  await show(['aeroShot', 'bulkhead', 'sporeBolt', 'burstFire'], '▸ 四职业专属卡 vs 通用卡');
  await p.waitForTimeout(350);
  await shot('char-00-mixed.png');

  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
