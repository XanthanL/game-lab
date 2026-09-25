/* 出牌演出 / 伤害预测 / 牌堆查看 的视觉确认截图 → .shots/play-*.png
   用法：node .probe-shots-play.cjs   （需本地 8126 服务）   */
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
  const shot = async (name) => { await p.screenshot({ path: OUT + name, clip }); console.log('  → ' + name); };

  // 战场钉成可控状态：血量拉高，手牌给几张代表性卡
  const stage = (ids, opt = {}) => p.evaluate(([ids, opt]) => {
    const e = G.enemy, pl = G.player;
    e.baseMaxHp = 400; e.hp = opt.ehp == null ? 400 : opt.ehp; e.shield = opt.eshield || 0;
    e.status.vulnerable = opt.vulnerable || 0;
    pl.baseMaxHp = 400; pl.hp = 400; pl.baseBattery = 9; pl.battery = 9;
    pl.status.strength = opt.strength || 0; pl.status.weak = 0; pl.shield = opt.pshield || 0;
    G.hand = ids.map(id => createCardInstance(CARD_DEFS[id]));
    G.draw = []; G.discard = []; G.exhaust = [];
    for (let i = 0; i < opt.draw || 0; i++) G.draw.push(createCardInstance(CARD_DEFS.laserShot));
    for (let i = 0; i < opt.discard || 0; i++) G.discard.push(createCardInstance(CARD_DEFS.plasmaShield));
    for (let i = 0; i < opt.exhaust || 0; i++) G.exhaust.push(createCardInstance(CARD_DEFS.empCannon));
    G.phase = 'player'; G.busy = false; clearFlyCards();
    renderHand(); updateHud();
  }, [ids, opt]);

  // 1) 伤害预测（悬停攻击牌）
  await stage(['overchargeBlast', 'laserShot', 'plasmaShield', 'piercingBeam'], { strength: 3, vulnerable: 2, eshield: 5, draw: 6, discard: 4, exhaust: 2 });
  await p.waitForTimeout(250);
  {
    const c = await p.$eval('#hand .card:nth-child(1)', el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.mouse.move(c.x, c.y);
  }
  await p.waitForTimeout(400);
  await shot('play-01-preview.png');

  // 2) 飞行中（电磁脉冲炮，多重打击）
  await stage(['empCannon', 'plasmaShield', 'overchargeBlast', 'piercingBeam'], { draw: 6, discard: 4, exhaust: 2 });
  await p.waitForTimeout(200);
  await p.evaluate(() => playCard(0));
  await p.waitForTimeout(80);
  await shot('play-02-fly.png');
  await p.waitForTimeout(120);
  await shot('play-03-impact.png');
  await p.waitForTimeout(260);
  await shot('play-04-multihit.png');

  // 3) 牌堆按钮 + 手牌计数
  await stage(['laserShot', 'laserShot', 'plasmaShield'], { draw: 12, discard: 4, exhaust: 2 });
  await p.waitForTimeout(300);
  await shot('play-05-piles.png');

  // 4) 抽牌堆弹窗
  await p.click('#draw-pile');
  await p.waitForTimeout(450);
  await shot('play-06-pile-modal.png');

  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
