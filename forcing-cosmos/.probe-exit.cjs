/* 强渡宇宙 · 交互出口审计探针（47 条）
   验：每个「进得去」的面板都有「出得来」的口子、按钮不会被 overflow 裁掉、
       手牌不会盖住弹窗（z-index 逃逸回归，L 组）。
   用法：node .probe-exit.cjs                                                   */
'use strict';
const { chromium } = require('playwright-core');
const CHROME = 'C:/Users/www27/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe';
// ⚠️ 端口会漂。跑之前先 curl 一下确认 docroot 就是 forcing-cosmos/（本机长期占 8126）。
const BASE = 'http://127.0.0.1:8126/index.html';

const results = [];
function ok(id, cond, extra) {
  results.push({ id, pass: !!cond });
  console.log((cond ? '  PASS  ' : '  FAIL  ') + id + (extra != null ? '   ' + extra : ''));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-proxy-server', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('page: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const go = async (q, wait = 1400) => { await p.goto(BASE + q, { waitUntil: 'load' }); await p.waitForTimeout(wait); };
  const rect = sel => p.$eval(sel, el => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; });
  const visible = sel => p.$eval(sel, el => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  });
  const modalOpen = () => p.$eval('#modal', el => !el.classList.contains('hidden'));
  // 视口 = #wrap 缩放后的 640x360 区域
  const wrapRect = () => rect('#wrap');

  /* ============ A. 牌组弹窗（用户报的那个） ============ */
  await go('?auto=1&noanim=1');
  await p.click('#btn-deck'); await p.waitForTimeout(400);
  ok('A01 点「牌组」弹出弹窗', await modalOpen());
  ok('A02 弹窗有可见的 × 关闭键', await visible('#modal-x'));
  {
    const b = await rect('#modal-actions button'), w = await wrapRect();
    ok('A03 「关闭」按钮完整落在画面内', b.b >= w.t && b.b <= w.b + 0.5 && b.t >= w.t, JSON.stringify({ btnBottom: Math.round(b.b), wrapBottom: Math.round(w.b) }));
  }
  await p.click('#modal-x'); await p.waitForTimeout(300);
  ok('A04 点 × 能关掉', !(await modalOpen()));
  await p.click('#btn-deck'); await p.waitForTimeout(300);
  await p.click('#modal-actions button'); await p.waitForTimeout(300);
  ok('A05 点「关闭」也能关掉', !(await modalOpen()));

  /* ============ B. 大牌组不被裁切 ============ */
  await go('?auto=1&noanim=1');
  await p.evaluate(() => { while (G.deck.length < 34) G.deck.push(createCardInstance(CARD_DEFS.strike)); });
  await p.click('#btn-deck'); await p.waitForTimeout(500);
  {
    const b = await rect('#modal-actions button'), w = await wrapRect();
    ok('B01 34 张牌时「关闭」仍完整可见', b.b <= w.b + 0.5 && b.b >= w.t, JSON.stringify({ btnBottom: Math.round(b.b), wrapBottom: Math.round(w.b) }));
    ok('B02 × 仍完整可见', await visible('#modal-x'));
    const sc = await p.$eval('#modal-body', el => ({ sh: el.scrollHeight, ch: el.clientHeight }));
    ok('B03 弹窗正文可滚动', sc.sh > sc.ch + 4, JSON.stringify(sc));
    await p.$eval('#modal-body', el => { el.scrollTop = el.scrollHeight; });
    await p.waitForTimeout(250);
    ok('B04 滚到底后「关闭」按钮没被顶走', (await rect('#modal-actions button')).b <= (await wrapRect()).b + 0.5);
    await p.click('#modal-x'); await p.waitForTimeout(250);
    ok('B05 滚过之后 × 依然可点', !(await modalOpen()));
  }

  /* ============ C. ESC / 背景关闭 ============ */
  await go('?auto=1&noanim=1');
  await p.click('#btn-deck'); await p.waitForTimeout(300);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok('C01 ESC 关掉牌组弹窗', !(await modalOpen()));
  ok('C02 ESC 关弹窗时没顺手把暂停也打开', !(await visible('#pause')));
  await p.click('#btn-deck'); await p.waitForTimeout(300);
  // #wrap 缩放后是居中 1280x720（视口 1280x800），所以要点 wrap 内部、面板外的暗背景
  await p.mouse.click(20, 100); await p.waitForTimeout(300);
  ok('C03 点弹窗外背景能关掉', !(await modalOpen()));

  /* ============ D. 强制选择弹窗不给关闭口子 ============ */
  await go('?reward=1&noanim=1');
  ok('D01 战后整理弹窗打开', await modalOpen());
  ok('D02 强制弹窗不显示 ×', !(await visible('#modal-x')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok('D03 ESC 关不掉强制弹窗（必须选一项）', await modalOpen());
  {
    const n = await p.$$eval('#modal-body .opt', els => els.length);
    ok('D04 但选项本身可点（有出路）', n >= 3, n + ' 个选项');
  }

  /* ============ E. 选人界面能返回标题 ============ */
  await go('?charsel=1&noanim=1');
  ok('E01 选人界面有「返回标题」', await p.$('[data-act="title"]') !== null);
  await p.click('#charsel [data-act="title"]'); await p.waitForTimeout(400);
  ok('E02 点它能回到标题', await visible('#title'));

  /* ============ F. 商店取消不扣钱 ============ */
  await go('?shop=1&noanim=1');
  await p.evaluate(() => { G.gold = 500; shopScreen(); });   // 开局只有 40 金，买不起 75 的移除服务
  await p.waitForTimeout(500);
  const gold0 = await p.evaluate(() => G.gold);
  const deck0 = await p.evaluate(() => G.deck.length);
  await p.evaluate(() => {
    const cells = [...document.querySelectorAll('.shopcol')];
    const rm = cells.find(c => c.textContent.includes('移除一张卡'));
    rm.click();
  });
  await p.waitForTimeout(400);
  ok('F01 点「移除一张卡」弹出选卡器', (await p.textContent('#modal-title')).includes('移除'));
  ok('F02 选卡器有 × 可退', await visible('#modal-x'));
  await p.click('#modal-x'); await p.waitForTimeout(400);
  const gold1 = await p.evaluate(() => G.gold);
  ok('F03 取消后金币没被扣', gold1 === gold0, gold0 + ' -> ' + gold1);
  await p.evaluate(() => {
    const cells = [...document.querySelectorAll('.shopcol')];
    cells.find(c => c.textContent.includes('移除一张卡')).click();
  });
  await p.waitForTimeout(400);
  await p.click('#modal-body .card'); await p.waitForTimeout(400);
  const gold2 = await p.evaluate(() => G.gold), deck2 = await p.evaluate(() => G.deck.length);
  ok('F04 真买了才扣 75 金、牌组 -1', gold2 === gold0 - 75 && deck2 === deck0 - 1, gold0 + '->' + gold2 + ' deck ' + deck0 + '->' + deck2);

  /* ============ G. 休整取消退回营地 ============ */
  await go('?rest=1&noanim=1');
  await p.evaluate(() => [...document.querySelectorAll('#modal-body .opt')].find(d => d.textContent.includes('锻打')).click());
  await p.waitForTimeout(400);
  ok('G01 点「锻打」弹出选卡器', (await p.textContent('#modal-title')).includes('升级'));
  await p.click('#modal-x'); await p.waitForTimeout(400);
  ok('G02 取消后回到休整营地（没白白浪费这次休整）', (await p.textContent('#modal-title')).includes('休整'));

  /* ============ H. 异象取消不白扣代价 ============ */
  await go('?event=1&noanim=1');
  await p.evaluate(() => showEvent(EVENTS.find(e => e.id === 'forge')));
  await p.waitForTimeout(300);
  const g0 = await p.evaluate(() => G.gold);
  await p.evaluate(() => [...document.querySelectorAll('#modal-body .opt')].find(d => d.textContent.includes('花 15 金币')).click());
  await p.waitForTimeout(350);
  await p.click('#modal-x'); await p.waitForTimeout(400);
  const g1 = await p.evaluate(() => G.gold);
  ok('H01 熔炉取消升级不扣 15 金', g1 === g0, g0 + ' -> ' + g1);
  ok('H02 取消后回到同一个异象（不重抽）', (await p.textContent('#modal-title')).includes('地下熔炉'));

  await p.evaluate(() => showEvent(EVENTS.find(e => e.id === 'terminal')));
  await p.waitForTimeout(300);
  const deckA = await p.evaluate(() => G.deck.length), curA = await p.evaluate(() => G.deck.filter(c => c.curse).length);
  await p.evaluate(() => [...document.querySelectorAll('#modal-body .opt')].find(d => d.textContent.includes('接入')).click());
  await p.waitForTimeout(350);
  await p.click('#modal-x'); await p.waitForTimeout(400);
  const deckB = await p.evaluate(() => G.deck.length), curB = await p.evaluate(() => G.deck.filter(c => c.curse).length);
  ok('H03 终端取消接入不白吃诅咒', deckB === deckA && curB === curA, 'deck ' + deckA + '->' + deckB + ' 诅咒 ' + curA + '->' + curB);

  /* ============ I. 暂停真的暂停 ============ */
  await go('?auto=1&noanim=1');
  await p.waitForTimeout(600);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok('I01 ESC 打开暂停', await visible('#pause'));
  ok('I02 暂停标志位已置起', await p.evaluate(() => G.paused === true));
  const before = await p.evaluate(() => ({ turn: G.turn, hp: G.player.hp, phase: G.phase, hand: G.hand.length }));
  await p.keyboard.press(' '); await p.waitForTimeout(200);
  ok('I03 暂停时空格不能结束回合', (await p.evaluate(() => G.phase)) === before.phase);
  await p.evaluate(() => {
    const d = document.querySelectorAll('#hand .card')[0];
    if (d && d.onpointerdown) d.onpointerdown(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 0, clientY: 0 }));
  });
  await p.waitForTimeout(250);
  ok('I04 暂停时点牌不出牌', (await p.evaluate(() => G.hand.length)) === before.hand, before.hand + ' 张手牌');
  await p.click('#pause [data-act="resume"]'); await p.waitForTimeout(300);
  ok('I05 点「继续」恢复', !(await visible('#pause')) && await p.evaluate(() => G.paused === false));

  // 暂停跨敌人回合：结束回合后立刻暂停，敌人不该继续打
  await p.evaluate(() => { G.busy = false; G.phase = 'player'; endTurn(); });
  await p.waitForTimeout(120);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  const midTurn = await p.evaluate(() => G.turn);
  await p.waitForTimeout(1800);
  const stillTurn = await p.evaluate(() => G.turn);
  ok('I06 暂停期间敌人回合被挂起', midTurn === stillTurn, midTurn + ' vs ' + stillTurn);
  await p.click('#pause [data-act="resume"]'); await p.waitForTimeout(2200);
  const afterTurn = await p.evaluate(() => G.turn);
  ok('I07 恢复后回合正常推进', afterTurn > stillTurn, stillTurn + ' -> ' + afterTurn);

  /* ============ J. 触摸设备才有暂停键 ============ */
  ok('J01 桌面（鼠标）不显示触摸暂停键', !(await visible('#touch')));
  {
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mp = await m.newPage();
    await mp.goto(BASE + '?auto=1&noanim=1', { waitUntil: 'load' });
    await mp.waitForTimeout(1500);
    const shown = await mp.$eval('#touch', el => getComputedStyle(el).display !== 'none');
    ok('J02 触摸设备显示暂停键', shown);
    if (shown) {
      await mp.click('#touch .tbtn'); await mp.waitForTimeout(400);
      ok('J03 点它能打开暂停', await mp.$eval('#pause', el => !el.classList.contains('hidden')));
    } else { ok('J03 点它能打开暂停', false, '跳过：键没显示'); }
    await m.close();
  }

  /* ============ K. 剧情跳过之后不再继续打字 ============ */
  await go('?noanim=1');
  await p.click('#title [data-act="story"]'); await p.waitForTimeout(700);
  await p.click('#story-skip'); await p.waitForTimeout(600);
  ok('K01 跳过后面板出现「按任意键」', (await p.textContent('#story-text')).includes('按任意键'));
  const lines1 = await p.$$eval('#story-text div', ds => ds.length);
  await p.waitForTimeout(2600);
  const lines2 = await p.$$eval('#story-text div', ds => ds.length);
  ok('K02 跳过之后定时器停了（行数不再增长）', lines1 === lines2, lines1 + ' -> ' + lines2);
  await p.click('.story-box'); await p.waitForTimeout(500);
  ok('K03 点击能回到标题', await visible('#title'));

  /* ============ L. 手牌不许盖住弹窗（z-index 逃逸回归） ============
     ⚠️ 曾经的 bug：手牌卡在 JS 里被赋 z-index 10+i，而 #hand 是 z-index:auto（不产生层叠上下文），
     这些值逃逸到 #wrap 的层叠上下文里，把 z-index:auto 的 .ov 弹窗整个盖住 ——
     开牌组弹窗时战斗手牌浮在最上面，「关闭」按钮被压住看不见（但还能点，所以纯 DOM 断言抓不到，
     必须用 elementFromPoint 做真实命中测试）。 */
  await go('?auto=1&noanim=1');
  await p.waitForTimeout(600);
  const handN = await p.$$eval('#hand .card', els => els.length);
  ok('L01 战斗手牌已铺开', handN > 0, handN + ' 张');
  ok('L02 #hand 自己建立了层叠上下文', await p.$eval('#hand', el => getComputedStyle(el).zIndex !== 'auto'),
     'z-index=' + await p.$eval('#hand', el => getComputedStyle(el).zIndex));
  ok('L03 弹窗层级高于手牌', await p.evaluate(() => {
    const z = s => { const v = parseInt(getComputedStyle(document.querySelector(s)).zIndex, 10); return isNaN(v) ? 0 : v; };
    return z('#modal') > z('#hand');
  }));
  {
    // 手牌正中偏上取一点（避开卡牌间隙），开弹窗后该点必须属于弹窗
    const pt = await p.$eval('#hand .card', el => { const r = el.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + 30)]; });
    await p.click('#btn-deck'); await p.waitForTimeout(500);
    const hit = await p.evaluate(pt => {
      let e = document.elementFromPoint(pt[0], pt[1]);
      const tag = e ? (e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + (e.className || '').toString().split(' ')[0]) : 'null';
      let inModal = false;
      for (let n = e; n; n = n.parentElement) if (n.id === 'modal') { inModal = true; break; }
      return { tag, inModal };
    }, pt);
    ok('L04 开弹窗后手牌位置命中的是弹窗内容', hit.inModal, hit.tag);
    const btnClickable = await p.evaluate(() => {
      const b = document.querySelector('#modal-actions button');
      const r = b.getBoundingClientRect();
      return document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)) === b;
    });
    ok('L05 「关闭」按钮中心点可点（没被任何东西压住）', btnClickable);
    await p.click('#modal-x'); await p.waitForTimeout(300);
  }

  ok('X00 无控制台 / 页面报错', errs.length === 0, errs.slice(0, 3).join(' | '));

  await browser.close();
  const pass = results.filter(r => r.pass).length;
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();
