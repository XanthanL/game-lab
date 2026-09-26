/* 强渡宇宙 · 「文字装进框」视觉验收截图（眼睛工具，不是断言工具）
   断言在 .probe-overflow.cjs，这里只负责把修完的样子拍下来给人看。
   产出（.shots/）：
     overflow-hud.png       战斗 HUD 全景（意图框 128 伤害 + 状态行 999/12/1）
     overflow-hud-coarse.png 同一画面在触屏 coarse 档下的样子（暂停键 24px）
     overflow-dmgpreview.png 伤害预测特写（4× 设备像素，验像素字笔画不断）
     overflow-pause.png     触屏暂停键特写（4×，验 24px 两竖等宽）
   用法：node .probe-shots-overflow.cjs */
'use strict';
const { chromium } = require('playwright-core');
const CHROME = 'C:/Users/www27/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe';
const BASE = 'http://127.0.0.1:8126/index.html';
const OUT = __dirname + '/.shots/';
const ARGS = ['--no-proxy-server', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

const EXTREME = () => {
  G.player.baseMaxHp = 9999; G.player.hp = 9999;
  G.player.status.burn = 999; G.player.status.poison = 12; G.player.status.vulnerable = 1;
  G.enemy.pattern = 'FIXED'; G.enemy.baseDamage = 128; G.enemy.dmgMul = 1; G.enemy.shield = 5;
  updateHud(); drawBattle(G, performance.now(), true);
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ARGS });

  /* ---------- 1×：HUD 全景（默认档 + coarse 档） ---------- */
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '?auto=1&noanim=1', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await p.evaluate(EXTREME);
  await p.waitForTimeout(200);
  await p.locator('#wrap').screenshot({ path: OUT + 'overflow-hud.png' });

  await p.evaluate(() => { document.documentElement.classList.add('coarse', 'canpause'); });
  await p.waitForTimeout(200);
  await p.locator('#wrap').screenshot({ path: OUT + 'overflow-hud-coarse.png' });

  /* ---------- 4×：特写（验笔画） ---------- */
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 4 });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + '?auto=1&noanim=1', { waitUntil: 'load' });
  await p2.waitForTimeout(1500);

  // 伤害预测：clip 是**页面坐标**，得用 getBoundingClientRect
  await p2.evaluate(() => {
    G.enemy.pattern = 'FIXED'; G.enemy.baseDamage = 12; G.enemy.dmgMul = 1; G.enemy.shield = 5;
    showDmgPreview(G.hand.find(c => cardDealsDamage(c)) || G.hand[0]);
  });
  await p2.waitForTimeout(250);
  const box = sel => p2.evaluate(s => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, sel);
  const dp = await box('#dmg-preview');
  await p2.screenshot({ path: OUT + 'overflow-dmgpreview.png', clip: { x: dp.x - 2, y: dp.y - 2, width: dp.width + 4, height: dp.height + 4 } });

  // 触屏暂停键。⚠️ 别 dispatchEvent(resize) —— updatePointerMode() 会按 isCoarse() 重算，
  //    无头桌面端 matches=false，刚加上的 coarse 会被当场摘掉（按钮变 0x0）。
  await p2.evaluate(() => { document.documentElement.classList.add('coarse', 'canpause'); });
  await p2.waitForTimeout(200);
  const tp = await box('.tb-pause');
  await p2.screenshot({ path: OUT + 'overflow-pause.png', clip: { x: tp.x - 3, y: tp.y - 3, width: tp.width + 6, height: tp.height + 6 } });

  // 顺带记一下三处实测值，方便对照
  const info = await p2.evaluate(() => ({
    dmg: { fs: getComputedStyle(document.getElementById('dmg-preview')).fontSize,
      lh: getComputedStyle(document.getElementById('dmg-preview')).lineHeight,
      text: document.getElementById('dmg-preview').textContent },
    pause: { fs: getComputedStyle(document.querySelector('.tb-pause')).fontSize,
      box: document.querySelector('.tb-pause').getBoundingClientRect().width + 'x' + document.querySelector('.tb-pause').getBoundingClientRect().height },
  }));
  console.log(JSON.stringify(info));

  await browser.close();
  console.log('shots written to .shots/');
})().catch(e => { console.error('SHOT ERROR', e); process.exit(2); });
