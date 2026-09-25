/* 强渡宇宙 · 出牌演出回归探针
   验：① 出牌不再"瞬间消失"—— 卡牌本体飞向目标，落地才结算
       ② 攻击牌飞敌人 / 护盾牌飞自己
       ③ 多重打击逐击演出（不是一次叠完）
       ④ 伤害预测 === 实际扣血（含力量/虚弱/易伤/护盾/穿盾）
       ⑤ 飘字显示结算后的值，不是传入值
       ⑥ 玩家虚弱真的减伤（回归：以前只给敌人算了虚弱）
       ⑦ 预测 UI 只在攻击牌上出现、不吃点击
   用法：node .probe-play.cjs      （需本地 8126 服务，docroot = forcing-cosmos/） */
'use strict';
const { chromium } = require('playwright-core');
const CHROME = 'C:/Users/www27/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe';
const BASE = 'http://127.0.0.1:8126/index.html';

const results = [];
function ok(id, cond, extra) {
  results.push({ id, pass: !!cond });
  console.log((cond ? '  PASS  ' : '  FAIL  ') + id + (extra != null ? '   ' + extra : ''));
}

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

  await p.goto(BASE + '?auto=1&noanim=1', { waitUntil: 'load' });
  await p.waitForTimeout(1500);   // 等 startBattle 的 420ms 起手回合跑完

  // 页面内通用工具：把战场钉成可控状态（敌人血量/护盾/状态、手牌内容都自己定）
  await p.evaluate(() => {
    window.T = {
      setup(ids, opt = {}) {
        const e = G.enemy, pl = G.player;
        e.baseMaxHp = 9999; e.hp = 9999; e.shield = opt.shield || 0;
        e.status.vulnerable = opt.vulnerable || 0; e.status.burn = 0; e.status.poison = 0;
        pl.baseMaxHp = 9999; pl.hp = 9999; pl.baseBattery = 99; pl.battery = 99;
        pl.status.strength = opt.strength || 0; pl.status.weak = opt.weak || 0;
        pl.shield = 0; pl.damageTakenBonus = 0;
        G.asc = 0; G.turn = 1; G.phase = 'player'; G.busy = false;
        G.hand = ids.map(id => createCardInstance(CARD_DEFS[id]));
        G.draw = []; G.discard = []; G.exhaust = [];
        FX.parts.length = 0; FX.floats.length = 0; FX.rings.length = 0; clearFlyCards();
        renderHand(); updateHud();
      },
      sleep: ms => new Promise(r => setTimeout(r, ms)),
      fly: () => document.querySelectorAll('#fxcards .card'),
      hand: () => document.querySelectorAll('#hand .card'),
      left: el => parseFloat(el.style.left) || 0,
      top: el => parseFloat(el.style.top) || 0,
      floats: () => FX.floats.map(f => f.text),
    };
  });

  /* ================= A. 卡牌本体真的飞了 ================= */
  console.log('\n=== A. 出牌演出：卡牌本体飞行 ===');
  {
    const r = await p.evaluate(async () => {
      T.setup(['laserShot', 'laserShot', 'laserShot']);
      const n0 = G.hand.length, ehp0 = G.enemy.hp;
      playCard(0);
      const out = { handBefore: n0, handAfter: G.hand.length, handDom: T.hand().length };
      await T.sleep(60);                      // 飞行中
      const flying = T.fly();
      out.flyingCount = flying.length;
      out.flyingInHand = [...T.hand()].some(d => d.classList.contains('flying'));
      out.x1 = flying[0] ? T.left(flying[0]) : null;
      out.y1 = flying[0] ? T.top(flying[0]) : null;
      out.pe = flying[0] ? getComputedStyle(flying[0]).pointerEvents : null;
      out.hpMid = G.enemy.hp;
      out.busyMid = G.busy;
      await T.sleep(50);                      // 再飞一会儿
      const f2 = T.fly()[0];
      out.x2 = f2 ? T.left(f2) : null;
      await T.sleep(120);                     // 应该已经落地
      out.hpAfter = G.enemy.hp;
      out.busyAfterArrive = G.busy;
      // ⚠️ 光环 life 只有 300ms —— 必须在落地那一拍取样，等到演出收尾再读就永远是 0
      out.ringAtArrive = FX.rings.length;
      await T.sleep(500);                     // 演出收尾
      out.flyingEnd = T.fly().length;
      out.busyEnd = G.busy;
      return out;
    });
    ok('A01 出牌后手牌立即少一张（状态先落）', r.handAfter === r.handBefore - 1 && r.handDom === r.handAfter,
      r.handBefore + '→' + r.handAfter + ' dom=' + r.handDom);
    ok('A02 飞行中卡牌还在（不是瞬间消失）', r.flyingCount === 1, 'fxcards=' + r.flyingCount);
    ok('A03 飞行的卡已不在 #hand 里', r.flyingInHand === false);
    ok('A04 飞行中卡牌不参与命中测试', r.pe === 'none', r.pe);
    ok('A05 飞行中位置在推进（x 单调靠近敌人）', r.x1 != null && r.x2 != null && r.x2 > r.x1,
      Math.round(r.x1) + ' → ' + Math.round(r.x2));
    ok('A06 到达前敌人还没掉血（效果在落地才结算）', r.hpMid === 9999, 'hp=' + r.hpMid);
    ok('A07 到达后敌人掉血了', r.hpAfter < 9999, 'hp=' + r.hpAfter);
    ok('A08 落地瞬间 G.busy 仍为 true（演出没放行）', r.busyAfterArrive === true);
    ok('A09 演出结束后飞行的卡被回收', r.flyingEnd === 0, 'left=' + r.flyingEnd);
    ok('A10 演出结束后 G.busy 才放开', r.busyEnd === false);
    ok('A11 落地那一拍炸出了光环', r.ringAtArrive > 0, 'rings=' + r.ringAtArrive);
  }

  /* ================= B. 飞向哪一边 ================= */
  console.log('\n=== B. 攻击牌飞敌人 / 护盾牌飞自己 ===');
  {
    const r = await p.evaluate(async () => {
      const LAYX = { ex: LAY.ex, px: LAY.px };
      T.setup(['laserShot']);
      playCard(0); await T.sleep(200);
      const atk = [...FX.cards.length ? [] : []];
      const atkX = null;
      await T.sleep(400);
      // 重新来一遍，这次抓落点
      T.setup(['laserShot']);
      playCard(0);
      await T.sleep(150);
      const a = T.fly()[0];
      const atkLand = a ? T.left(a) : null;
      await T.sleep(400);
      T.setup(['plasmaShield']);
      playCard(0);
      await T.sleep(150);
      const b = T.fly()[0];
      const shdLand = b ? T.left(b) : null;
      await T.sleep(400);
      return { LAYX, atkLand, shdLand, enemyX: LAY.ex - 48, selfX: LAY.px - 48 };
    });
    ok('B01 攻击牌落点在敌人身上', Math.abs(r.atkLand - r.enemyX) < 3,
      'land=' + Math.round(r.atkLand) + ' want≈' + r.enemyX);
    ok('B02 护盾牌落点在自己身上', Math.abs(r.shdLand - r.selfX) < 3,
      'land=' + Math.round(r.shdLand) + ' want≈' + r.selfX);
  }

  /* ================= C. 多重打击逐击演出 ================= */
  console.log('\n=== C. 多重打击逐击演出 ===');
  {
    const r = await p.evaluate(async () => {
      T.setup(['empCannon']);           // 3 伤 × 4 次
      const hp0 = G.enemy.hp;
      playCard(0);
      const samples = [];
      for (let i = 0; i < 24; i++) { await T.sleep(30); samples.push(G.enemy.hp); }
      await T.sleep(300);
      const distinct = [...new Set(samples)];
      return {
        hp0, final: G.enemy.hp, lost: hp0 - G.enemy.hp,
        distinctSteps: distinct.length,
        drops: distinct.map(v => hp0 - v),
        per: cardHitDamage(G.hand[0] || createCardInstance(CARD_DEFS.empCannon), G.enemy),
      };
    });
    ok('C01 四次命中分四拍落地（不是一次叠完）', r.distinctSteps >= 4, 'steps=' + r.distinctSteps + ' drops=' + r.drops.join(','));
    ok('C02 总伤害 = 每击 × 4', r.lost === r.per * 4, r.lost + ' vs ' + r.per + '×4');
  }

  /* ================= D. 预测 === 实际 ================= */
  console.log('\n=== D. 伤害预测与实战扣血一致 ===');
  {
    const r = await p.evaluate(async () => {
      const trial = async (id, opt) => {
        T.setup([id], opt);
        const c = G.hand[0], e = G.enemy;
        const pv = cardPreview(c, e);
        const hp0 = e.hp, sh0 = e.shield;
        playCard(0);
        await T.sleep(900);
        const hpLoss = hp0 - e.hp;
        const shieldLoss = sh0 - e.shield;
        return { id, opt, pvTotal: pv && pv.total, pvPer: pv && pv.per, pvHits: pv && pv.hits,
          hpLoss, shieldLoss, totalDealt: hpLoss + shieldLoss };
      };
      return {
        plain: await trial('laserShot', {}),
        str: await trial('laserShot', { strength: 5 }),
        vuln: await trial('laserShot', { vulnerable: 3 }),
        weak: await trial('laserShot', { weak: 2 }),
        weakStr: await trial('laserShot', { weak: 2, strength: 4 }),
        shield: await trial('laserShot', { shield: 20 }),
        pierce: await trial('piercingBeam', { vulnerable: 3, shield: 20 }),
        multi: await trial('empCannon', {}),
      };
    });
    const eq = (t) => t.pvTotal === t.totalDealt;
    ok('D01 无状态：预测 === 实际', eq(r.plain), r.plain.pvTotal + ' vs ' + r.plain.totalDealt);
    ok('D02 有力量：预测 === 实际', eq(r.str), r.str.pvTotal + ' vs ' + r.str.totalDealt);
    ok('D03 敌人易伤：预测 === 实际', eq(r.vuln), r.vuln.pvTotal + ' vs ' + r.vuln.totalDealt);
    ok('D04 玩家虚弱：预测 === 实际', eq(r.weak), r.weak.pvTotal + ' vs ' + r.weak.totalDealt);
    ok('D05 虚弱+力量：预测 === 实际', eq(r.weakStr), r.weakStr.pvTotal + ' vs ' + r.weakStr.totalDealt);
    ok('D06 敌人有盾：预测 === 实际（盾+血）', eq(r.shield), r.shield.pvTotal + ' vs ' + r.shield.totalDealt);
    ok('D07 穿盾牌：预测 === 实际（不吃易伤不吃盾）', eq(r.pierce), r.pierce.pvTotal + ' vs ' + r.pierce.totalDealt);
    ok('D08 多重打击：预测 === 实际', eq(r.multi), r.multi.pvTotal + ' vs ' + r.multi.totalDealt);
    ok('D09 易伤确实让伤害 ×1.5', r.vuln.pvTotal === Math.floor(6 * 1.5), r.vuln.pvTotal + '（基础 6）');
    ok('D10 虚弱确实让伤害 ×0.75', r.weak.pvTotal === Math.floor(6 * 0.75), r.weak.pvTotal + '（基础 6）');
    ok('D11 虚弱+4力量 = floor((6+4)*0.75)', r.weakStr.pvTotal === Math.floor((6 + 4) * 0.75), r.weakStr.pvTotal);
    ok('D12 敌人护盾真的吃掉了伤害', r.shield.hpLoss === 0 && r.shield.shieldLoss > 0,
      'hpLoss=' + r.shield.hpLoss + ' shieldLoss=' + r.shield.shieldLoss);
    ok('D13 穿盾牌完全无视敌人护盾', r.pierce.shieldLoss === 0 && r.pierce.hpLoss > 0,
      'hpLoss=' + r.pierce.hpLoss + ' shieldLoss=' + r.pierce.shieldLoss);
    ok('D14 多重打击预测带 hits', r.multi.pvHits === 4 && r.multi.pvPer === 3, r.multi.pvPer + '×' + r.multi.pvHits);
  }

  /* ================= E. 虚弱回归（以前只给敌人算） ================= */
  console.log('\n=== E. 玩家虚弱减伤（回归） ===');
  {
    const r = await p.evaluate(async () => {
      const dmg = async (weak) => {
        T.setup(['laserShot'], { weak });
        const hp0 = G.enemy.hp; playCard(0); await T.sleep(900);
        return hp0 - G.enemy.hp;
      };
      return { w0: await dmg(0), w2: await dmg(2) };
    });
    ok('E01 玩家有虚弱时攻击伤害降低', r.w2 < r.w0, r.w0 + ' → ' + r.w2);
    ok('E02 减伤比例正是 ×0.75', r.w2 === Math.floor(r.w0 * 0.75), r.w0 + ' ×0.75 = ' + Math.floor(r.w0 * 0.75));
  }

  /* ================= F. 飘字显示结算后的值 ================= */
  console.log('\n=== F. 飘字数值 ===');
  {
    const r = await p.evaluate(async () => {
      T.setup(['laserShot'], { vulnerable: 3 });
      playCard(0);
      await T.sleep(400);
      return { floats: T.floats(), pv: cardPreview(createCardInstance(CARD_DEFS.laserShot), G.enemy) };
    });
    ok('F01 易伤目标的飘字 = 结算后的伤害（不是传入值 6）',
      r.floats.includes('-9'), JSON.stringify(r.floats) + ' 预测=' + r.pv.total);
  }

  /* ================= G. 预测 UI ================= */
  console.log('\n=== G. 伤害预测 UI ===');
  {
    const vis = () => p.$eval('#dmg-preview', el => !el.classList.contains('hidden'));
    const txt = () => p.$eval('#dmg-preview', el => el.textContent.trim());
    await p.evaluate(() => { T.setup(['laserShot', 'plasmaShield', 'piercingBeam']); });
    await p.waitForTimeout(200);
    const cardBox = i => p.$eval(`#hand .card:nth-child(${i + 1})`, el => {
      const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    let c = await cardBox(0);
    await p.mouse.move(c.x, c.y); await p.waitForTimeout(200);
    ok('G01 hover 攻击牌弹出预测', await vis());
    ok('G02 预测里带具体伤害数字', /\d+/.test(await txt()), await txt());
    ok('G03 预测层不吃点击（pointer-events:none）',
      await p.$eval('#dmg-preview', el => getComputedStyle(el).pointerEvents) === 'none');
    {
      const box = await p.$eval('#dmg-preview', el => { const r = el.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, rr: r.right }; });
      const wrap = await p.$eval('#wrap', el => { const r = el.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, rr: r.right }; });
      ok('G04 预测完整落在画面内', box.t >= wrap.t - 1 && box.b <= wrap.b + 1 && box.l >= wrap.l - 1 && box.rr <= wrap.rr + 1,
        JSON.stringify({ box: [Math.round(box.t), Math.round(box.b)], wrap: [Math.round(wrap.t), Math.round(wrap.b)] }));
    }
    c = await cardBox(1);
    await p.mouse.move(c.x, c.y); await p.waitForTimeout(200);
    ok('G05 hover 护盾牌不显示预测', !(await vis()));
    c = await cardBox(0);
    await p.mouse.move(c.x, c.y); await p.waitForTimeout(200);
    await p.mouse.move(20, 20); await p.waitForTimeout(200);
    ok('G06 移开手牌后预测消失', !(await vis()));
  }

  /* ================= H. 换场景不残留 ================= */
  console.log('\n=== H. 切场景清理 ===');
  {
    const r = await p.evaluate(async () => {
      T.setup(['laserShot']);
      playCard(0);
      await T.sleep(40);                       // 正飞着就切场景
      const mid = T.fly().length;
      setScene('title');
      await T.sleep(100);
      const after = T.fly().length;
      const dom = document.querySelectorAll('#fxcards .card').length;
      return { mid, after, dom, previewHidden: document.getElementById('dmg-preview').classList.contains('hidden') };
    });
    ok('H01 切场景时确实有卡在飞（前置条件成立）', r.mid === 1, 'flying=' + r.mid);
    ok('H02 切场景后飞行队列被清空', r.after === 0 && r.dom === 0, 'queue=' + r.after + ' dom=' + r.dom);
    ok('H03 切场景后预测也收起来了', r.previewHidden === true);
  }

  /* ================= J. 手牌上限 10 ================= */
  console.log('\n=== J. 手牌上限 10（#14） ===');
  // ⚠️ H 段把场景切成了 title，而 #pileinfo 在 #hud 里 —— 不回战斗场景，
  //    后面的牌堆按钮全是 display:none，Playwright 会在「element is not visible」上超时 30 秒。
  await p.evaluate(() => { setScene('battle'); startBattle('normal', 0); });
  await p.waitForTimeout(800);
  {
    const r = await p.evaluate(async () => {
      T.setup(['laserShot']);
      const out = { handMax: HAND_MAX };
      // 手牌 10 张 + 抽牌堆 5 张，抽 3 张
      G.hand = []; G.draw = []; G.discard = [];
      for (let i = 0; i < 10; i++) G.hand.push(createCardInstance(CARD_DEFS.laserShot));
      const drawUids = [];
      for (let i = 0; i < 5; i++) { const c = createCardInstance(CARD_DEFS.plasmaShield); drawUids.push(c.uid); G.draw.push(c); }
      G.draw.reverse();                       // draw 是栈，末尾才是"下一张"
      const before = { hand: G.hand.length, draw: G.draw.length, discard: G.discard.length };
      drawCards(3);
      out.before = before;
      out.after = { hand: G.hand.length, draw: G.draw.length, discard: G.discard.length };
      out.overflowed = G.discard.map(c => c.uid);
      out.stillInDraw = G.draw.map(c => c.uid).filter(u => out.overflowed.includes(u));
      updateHud();                            // 上面直接改了 G.hand/G.draw，绕过了游戏自己的刷新点
      out.hud = document.getElementById('hand-count').textContent;
      out.floatTexts = T.floats();
      // 手牌不满时正常抽
      G.hand.length = 8;
      drawCards(1);
      out.normalDraw = { hand: G.hand.length, draw: G.draw.length };
      return out;
    });
    ok('J01 手牌上限是 10', r.handMax === 10, 'HAND_MAX=' + r.handMax);
    ok('J02 手牌满时抽 3 张，手牌仍是 10', r.after.hand === 10, r.before.hand + '→' + r.after.hand);
    ok('J03 溢出抽到的牌进了弃牌堆', r.after.discard === 3, 'discard=' + r.after.discard);
    ok('J04 抽牌堆相应减少 3 张', r.after.draw === r.before.draw - 3, r.before.draw + '→' + r.after.draw);
    ok('J05 ⚠️ 溢出抽到的牌没有留在抽牌堆（否则抽牌变永动机）', r.stillInDraw.length === 0, JSON.stringify(r.stillInDraw));
    ok('J06 手牌满时给了飘字提示', r.floatTexts.some(t => /手牌已满/.test(t)), JSON.stringify(r.floatTexts));
    ok('J07 HUD 显示手 N/10', /手 10\/10/.test(r.hud), r.hud);
    ok('J08 手牌不满时正常抽牌', r.normalDraw.hand === 9 && r.normalDraw.draw === r.after.draw - 1,
      JSON.stringify(r.normalDraw));
  }

  /* ================= K. 牌堆可查看 ================= */
  console.log('\n=== K. 抽牌堆 / 弃牌堆 / 消耗堆可查看（#11） ===');
  {
    const modalOpen = () => p.$eval('#modal', el => !el.classList.contains('hidden'));
    await p.evaluate(() => {
      T.setup(['laserShot']);
      G.hand = []; G.draw = []; G.discard = []; G.exhaust = [];
      for (let i = 0; i < 12; i++) G.draw.push(createCardInstance(CARD_DEFS[i % 2 ? 'laserShot' : 'plasmaShield']));
      for (let i = 0; i < 4; i++) G.discard.push(createCardInstance(CARD_DEFS.plasmaShield));
      for (let i = 0; i < 2; i++) G.exhaust.push(createCardInstance(CARD_DEFS.empCannon));
      updateHud();
    });
    await p.waitForTimeout(200);
    ok('K01 三个牌堆按钮都在', await p.$$eval('#pileinfo .pile', els => els.length) === 3);
    ok('K02 抽/弃/耗 计数正确', await p.$eval('#draw-pile', el => el.textContent.trim()) === '抽 12'
      && await p.$eval('#discard-pile', el => el.textContent.trim()) === '弃 4'
      && await p.$eval('#exhaust-pile', el => el.textContent.trim()) === '耗 2',
      [await p.$eval('#draw-pile', e => e.textContent), await p.$eval('#discard-pile', e => e.textContent), await p.$eval('#exhaust-pile', e => e.textContent)].join(' / '));
    ok('K03 按钮真的点得到（elementFromPoint）',
      await p.$eval('#draw-pile', el => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!t && (el === t || el.contains(t));
      }));

    // 抽牌堆
    const realOrder = await p.evaluate(() => G.draw.map(c => c.uid));
    await p.click('#draw-pile'); await p.waitForTimeout(350);
    ok('K04 点「抽」弹出抽牌堆', await modalOpen()
      && /抽牌堆/.test(await p.$eval('#modal-title', el => el.textContent)), await p.$eval('#modal-title', el => el.textContent));
    ok('K05 列出 12 张', await p.$$eval('#modal-body .grid .card', els => els.length) === 12);
    ok('K06 明说了顺序已打乱', /顺序已打乱/.test(await p.$eval('#modal-body', el => el.textContent)));
    {
      const shown = await p.$$eval('#modal-body .grid .card', els => els.map(e => +e.dataset.uid));
      ok('K07 ⚠️ 显示的抽牌堆顺序 ≠ 真实顺序（不泄漏下一张）',
        shown.join(',') !== realOrder.join(','), 'shown[0..2]=' + shown.slice(0, 3) + ' real[0..2]=' + realOrder.slice(0, 3));
      ok('K08 显示的是同一批牌（多重集合一致）',
        shown.slice().sort((a, b) => a - b).join(',') === realOrder.slice().sort((a, b) => a - b).join(','));
    }
    {
      const after = await p.evaluate(() => G.draw.map(c => c.uid));
      ok('K09 ⚠️ 打开抽牌堆没有改变真实的抽牌顺序', after.join(',') === realOrder.join(','),
        after.slice(0, 3).join(',') + ' vs ' + realOrder.slice(0, 3).join(','));
    }
    await p.click('#modal-x'); await p.waitForTimeout(250);

    // 弃牌堆 / 消耗堆
    await p.click('#discard-pile'); await p.waitForTimeout(350);
    ok('K10 点「弃」弹出弃牌堆', /弃牌堆/.test(await p.$eval('#modal-title', el => el.textContent))
      && await p.$$eval('#modal-body .grid .card', els => els.length) === 4, await p.$eval('#modal-title', el => el.textContent));
    ok('K11 弃牌堆不标注打乱（本来就无序）', !/顺序已打乱/.test(await p.$eval('#modal-body', el => el.textContent)));
    await p.click('#modal-x'); await p.waitForTimeout(250);
    await p.click('#exhaust-pile'); await p.waitForTimeout(350);
    ok('K12 点「耗」弹出消耗堆', /消耗堆/.test(await p.$eval('#modal-title', el => el.textContent))
      && await p.$$eval('#modal-body .grid .card', els => els.length) === 2, await p.$eval('#modal-title', el => el.textContent));
    await p.click('#modal-x'); await p.waitForTimeout(250);

    // 空牌堆
    await p.evaluate(() => { G.exhaust = []; updateHud(); });
    await p.click('#exhaust-pile'); await p.waitForTimeout(350);
    ok('K13 空牌堆显示「空的。」', /空的/.test(await p.$eval('#modal-body', el => el.textContent)));
    await p.click('#modal-x'); await p.waitForTimeout(250);
    ok('K14 弹窗能正常关掉', !(await modalOpen()));
  }

  console.log('\n=== I. 无脚本错误 ===');
  ok('I01 全程零 pageerror / console.error', errs.length === 0, errs.slice(0, 3).join(' | '));

  await browser.close();
  const pass = results.filter(r => r.pass).length;
  console.log('\n' + (pass === results.length ? 'ALL PASS' : 'FAILED') + '  ' + pass + '/' + results.length);
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error('PROBE ERROR', e); process.exit(2); });
