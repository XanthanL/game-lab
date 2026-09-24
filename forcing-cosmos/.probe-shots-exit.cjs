/* 交互修复后的视觉确认截图 → .shots/ */
'use strict';
const fs = require('fs');
const { chromium } = require('playwright-core');
const CHROME = 'C:/Users/www27/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe';
const OUT = 'E:/Code/game-lab/forcing-cosmos/.shots/';
const BASE = 'http://127.0.0.1:8126/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-proxy-server', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const shot = async name => {
    const cdp = await ctx.newCDPSession(p);
    // ⚠️ 必须 captureBeyondViewport:false —— 默认 true 会临时改视口高度，
    // 而本作按 window.innerHeight 算 fit() 缩放，截出来跟真实视图完全对不上。
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(OUT + name, Buffer.from(data, 'base64'));
    await cdp.detach();
    console.log('wrote', name);
  };

  await p.goto(BASE + '?auto=1&noanim=1', { waitUntil: 'load' });
  await p.waitForTimeout(1800);
  await p.click('#btn-deck'); await p.waitForTimeout(500);
  await shot('exit-1-deck-x.png');

  await p.evaluate(() => { while (G.deck.length < 30) G.deck.push(createCardInstance(CARD_DEFS.strike)); });
  await p.click('#modal-actions button'); await p.waitForTimeout(200);
  await p.click('#btn-deck'); await p.waitForTimeout(500);
  await shot('exit-2-deck-big.png');
  await p.evaluate(() => { const el = document.getElementById('modal-body'); el.scrollTop = el.scrollHeight; });
  await p.waitForTimeout(300);
  await shot('exit-3-deck-scrolled.png');

  await p.goto(BASE + '?charsel=1&noanim=1', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await shot('exit-4-charsel-back.png');

  await p.goto(BASE + '?rest=1&noanim=1', { waitUntil: 'load' });
  await p.waitForTimeout(1400);
  await shot('exit-5-rest.png');

  await b.close();
  console.log('DONE');
})();
