/* 强渡宇宙 · 职业专属卡回归探针
   验：① 四个乘员各有自己的一套基础牌，互不重叠
       ② 卡牌带职业色（--ch 覆盖外框色，通用卡仍是类型色）
       ③ 奖励池只给「通用卡 + 本职业 starter」，绝不混进别人的职业卡
       ④ 新机制：工程兵「盾击」（伤害=护盾×系数）、突击兵「连击终结」（每张已出牌 +N）
       ⑤ 新卡的预测 === 实战扣血
       ⑥ 四职业各开一局都能正常出牌
   用法：node .probe-char.cjs      （需本地 8126 服务，docroot = forcing-cosmos/） */
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
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    window.T = {
      sleep: ms => new Promise(r => setTimeout(r, ms)),
      setup(ids, opt = {}) {
        const e = G.enemy, pl = G.player;
        e.baseMaxHp = 9999; e.hp = 9999; e.shield = 0;
        e.status.vulnerable = 0; e.status.poison = 0; e.status.burn = 0; e.status.weak = 0;
        pl.baseMaxHp = 9999; pl.hp = 9999; pl.baseBattery = 99; pl.battery = 99;
        pl.status.strength = 0; pl.status.weak = 0; pl.shield = opt.shield || 0;
        G.asc = 0; G.turn = 1; G.phase = 'player'; G.busy = false; G.playedThisTurn = 0;
        G.hand = ids.map(id => createCardInstance(CARD_DEFS[id]));
        G.draw = []; G.discard = []; G.exhaust = [];
        FX.parts.length = 0; FX.floats.length = 0; clearFlyCards();
        renderHand(); updateHud();
      },
      floats: () => FX.floats.map(f => f.text),
    };
  });

  /* ================= A. 四个职业各有一套牌 ================= */
  console.log('\n=== A. 职业专属基础牌组 ===');
  {
    const r = await p.evaluate(() => {
      const out = {};
      for (const id in CHARACTERS) {
        const c = CHARACTERS[id];
        const deck = buildStarterDeck(id);
        out[id] = {
          n: deck.length,
          ids: [...new Set(deck.map(x => x.id))],
          chars: [...new Set(deck.map(x => CARD_DEFS[x.id].char))],
          colours: deck.map(x => CARD_DEFS[x.id].char),
        };
      }
      return out;
    });
    const ids = Object.keys(r);
    ok('A01 四个职业都有初始牌组', ids.length === 4, ids.join(','));
    for (const id of ids) ok('A02 ' + id + ' 初始牌组 10 张', r[id].n === 10, r[id].n + ' 张');
    for (const id of ids) ok('A03 ' + id + ' 每张牌都标着本职业', r[id].chars.length === 1 && r[id].chars[0] === id,
      JSON.stringify(r[id].chars));
    // 互不重叠：任何一张卡都不能同时出现在两个职业的初始牌组里
    const seen = {};
    for (const id of ids) for (const cid of r[id].ids) (seen[cid] = seen[cid] || []).push(id);
    const shared = Object.keys(seen).filter(k => seen[k].length > 1);
    ok('A04 ⚠️ 四个职业的基础牌互不重叠', shared.length === 0, JSON.stringify(shared));
    const uniq = new Set(ids.flatMap(id => r[id].ids));
    ok('A05 一共 16 张不同的职业卡', uniq.size === 16, uniq.size + ' 张');
    void Object.assign; // noop
  }

  /* ================= B. 卡牌职业色 ================= */
  console.log('\n=== B. 卡面职业色 ===');
  {
    await p.evaluate(() => T.setup(['aeroShot', 'rivetShot', 'sporeBolt', 'burstFire', 'laserShot', 'overchargeBlast']));
    await p.waitForTimeout(250);
    const r = await p.evaluate(() => {
      const read = i => {
        const el = document.querySelectorAll('#hand .card')[i];
        const cs = getComputedStyle(el);
        return { cls: el.className, ch: cs.getPropertyValue('--ch').trim(), shadow: cs.boxShadow };
      };
      return { a: read(0), e: read(1), m: read(2), s: read(3), g1: read(4), g2: read(5) };
    });
    ok('B01 宇航员卡带 ch-astronaut', /ch-astronaut/.test(r.a.cls), r.a.cls);
    ok('B02 工程兵卡带 ch-engineer', /ch-engineer/.test(r.e.cls), r.e.cls);
    ok('B03 异变者卡带 ch-mutant', /ch-mutant/.test(r.m.cls), r.m.cls);
    ok('B04 突击兵卡带 ch-assault', /ch-assault/.test(r.s.cls), r.s.cls);
    ok('B05 通用卡不带 ch-* 类', !/\bch-/.test(r.g1.cls) && !/\bch-/.test(r.g2.cls), r.g1.cls);
    const want = { a: '#41a6f6', e: '#38b764', m: '#c070f0', s: '#e04060' };
    ok('B06 宇航员卡主色 = 蓝 #41a6f6', r.a.ch === want.a, r.a.ch);
    ok('B07 工程兵卡主色 = 绿 #38b764', r.e.ch === want.e, r.e.ch);
    ok('B08 异变者卡主色 = 紫 #c070f0', r.m.ch === want.m, r.m.ch);
    ok('B09 突击兵卡主色 = 红 #e04060', r.s.ch === want.s, r.s.ch);
    ok('B10 四个职业的主色互不相同', new Set([r.a.ch, r.e.ch, r.m.ch, r.s.ch]).size === 4,
      [r.a.ch, r.e.ch, r.m.ch, r.s.ch].join(' '));
    {
      // 外框真的用了职业色（渲染后的 box-shadow 里要出现对应的 rgb）
      const rgb = { '#41a6f6': 'rgb(65, 166, 246)', '#38b764': 'rgb(56, 183, 100)', '#c070f0': 'rgb(192, 112, 240)', '#e04060': 'rgb(224, 64, 96)' };
      ok('B11 卡面外框真的用了职业色', r.a.shadow.includes(rgb[want.a]) && r.e.shadow.includes(rgb[want.e])
        && r.m.shadow.includes(rgb[want.m]) && r.s.shadow.includes(rgb[want.s]), r.a.shadow.slice(0, 60));
    }
  }

  /* ================= C. 奖励池按职业过滤 ================= */
  console.log('\n=== C. 奖励池不含别人的职业卡 ===');
  {
    const check = await p.evaluate(() => {
      const out = {};
      for (const id in CHARACTERS) {
        const pool = rewardPool(id);
        const own = pool.filter(k => CARD_DEFS[k].char === id);
        const others = pool.filter(k => CARD_DEFS[k].char && CARD_DEFS[k].char !== id);
        const generic = pool.filter(k => !CARD_DEFS[k].char && CARD_DEFS[k].rarity !== 'starter');
        out[id] = { n: pool.length, own: own.length, others: others.length, generic: generic.length };
      }
      const pn = rewardPool(null);
      out._none = { n: pn.length, anyChar: pn.filter(k => CARD_DEFS[k].char).length };
      return out;
    });
    for (const id of ['astronaut', 'engineer', 'mutant', 'assault']) {
      ok('C01 ' + id + ' 奖励池含自己的专属卡', check[id].own === 4, 'own=' + check[id].own);
      ok('C02 ' + id + ' 奖励池不含别人的专属卡', check[id].others === 0, 'others=' + check[id].others);
      ok('C03 ' + id + ' 奖励池含通用卡', check[id].generic >= 30, 'generic=' + check[id].generic);
    }
    ok('C04 不传职业时奖励池不含任何职业卡', check._none.anyChar === 0, 'anyChar=' + check._none.anyChar);
  }

  /* ================= D. 工程兵「盾击」 ================= */
  console.log('\n=== D. 盾击：伤害 = 护盾 × 系数 ===');
  {
    const r = await p.evaluate(async () => {
      const trial = async (shield) => {
        T.setup(['shieldBash'], { shield });
        const c = G.hand[0], e = G.enemy;
        const pv = cardPreview(c, e);
        const hp0 = e.hp;
        playCard(0);
        await T.sleep(900);
        return { shield, pv: pv && pv.total, dealt: hp0 - e.hp, floats: T.floats() };
      };
      return { s0: await trial(0), s10: await trial(10), s25: await trial(25) };
    });
    ok('D01 有 10 盾时盾击 = floor(10×0.6)=6', r.s10.dealt === 6, 'dealt=' + r.s10.dealt);
    ok('D02 有 25 盾时盾击 = floor(25×0.6)=15', r.s25.dealt === 15, 'dealt=' + r.s25.dealt);
    ok('D03 预测 === 实际（10 盾）', r.s10.pv === r.s10.dealt, r.s10.pv + ' vs ' + r.s10.dealt);
    ok('D04 预测 === 实际（25 盾）', r.s25.pv === r.s25.dealt, r.s25.pv + ' vs ' + r.s25.dealt);
    ok('D05 ⚠️ 没护盾时 0 伤，且不给 "-0" 飘字', r.s0.dealt === 0 && !r.s0.floats.includes('-0')
      && r.s0.floats.some(t => /没有护盾/.test(t)), JSON.stringify(r.s0.floats));
    ok('D06 盾击飞向敌人', await p.evaluate(() => cardTargetSide(createCardInstance(CARD_DEFS.shieldBash))) === 'enemy');
  }

  /* ================= E. 突击兵「连击终结」 ================= */
  console.log('\n=== E. 连击终结：每张已出牌 +3 ===');
  {
    const r = await p.evaluate(async () => {
      // 先手打两张无关的牌，再打连击终结
      T.setup(['quickGuard', 'quickGuard', 'comboFinisher']);
      const e = G.enemy;
      const pvBefore = cardPreview(G.hand[2], e).total;
      playCard(0); await T.sleep(700);
      playCard(0); await T.sleep(700);
      const played = G.playedThisTurn;
      const pvAfter = cardPreview(G.hand[0], e).total;
      const hp0 = e.hp;
      playCard(0); await T.sleep(900);
      return { pvBefore, pvAfter, played, dealt: hp0 - e.hp };
    });
    ok('E01 回合开始已出牌数为 0', r.pvBefore === 10, 'pv=' + r.pvBefore);
    ok('E02 打出两张后计数 = 2', r.played === 2, 'played=' + r.played);
    ok('E03 连击加成生效：10 + 2×3 = 16', r.pvAfter === 16, 'pv=' + r.pvAfter);
    ok('E04 预测 === 实际', r.pvAfter === r.dealt, r.pvAfter + ' vs ' + r.dealt);
    ok('E05 回合开始重置计数', await p.evaluate(async () => {
      T.setup(['comboFinisher']);
      G.playedThisTurn = 5;
      startPlayerTurn(false);
      return G.playedThisTurn;
    }) === 0);
  }

  /* ================= F. 异变者被动 + 全员可玩 ================= */
  console.log('\n=== F. 四职业各开一局都能出牌 ===');
  {
    for (const id of ['astronaut', 'engineer', 'mutant', 'assault']) {
      const r = await p.evaluate(async (id) => {
        META.unlockedAsc = 0; saveMeta();
        G.asc = 0;
        newRun(id);
        // ⚠️ newRun 结尾是 enterAct → showMap（地图场景），手牌是空的。
        //    要测出牌必须先真的开一场战斗，并等它的起手回合抽完牌。
        startBattle('normal', 0);
        await T.sleep(900);
        const e = G.enemy, pl = G.player;
        e.baseMaxHp = 9999; e.hp = 9999;
        pl.baseMaxHp = 9999; pl.hp = 9999; pl.baseBattery = 99; pl.battery = 99;
        G.phase = 'player'; G.busy = false; G.playedThisTurn = 0;
        renderHand(); updateHud();
        const n0 = G.hand.length, hp0 = e.hp;
        // 打第一张能打的牌
        const i = G.hand.findIndex(c => !c.unplayable && pl.battery >= c.cost);
        if (i >= 0) playCard(i);
        await T.sleep(900);
        return { char: G.run.charId, deck: G.deck.length, hand0: n0, hand1: G.hand.length, hp0, hp1: e.hp, played: i >= 0 };
      }, id);
      ok('F01 ' + id + ' 建局与出牌正常', r.char === id && r.deck === 10 && r.played && r.hand1 === r.hand0 - 1,
        'deck=' + r.deck + ' hand ' + r.hand0 + '→' + r.hand1);
    }
  }

  /* ================= G. 新卡升级全覆盖 ================= */
  console.log('\n=== G. 升级表 ===');
  {
    const r = await p.evaluate(() => {
      const missing = Object.keys(CARD_DEFS).filter(k => CARD_DEFS[k].rarity !== 'curse' && !UPGRADES[k]);
      const charCards = Object.keys(CARD_DEFS).filter(k => CARD_DEFS[k].char);
      const upOK = charCards.filter(k => {
        const c = createCardInstance(CARD_DEFS[k]), u = upgradeCard(c);
        return u && u.upgraded && u.name.endsWith('+');
      });
      return { missing, charCount: charCards.length, upOK: upOK.length };
    });
    ok('G01 所有非诅咒卡都有升级', r.missing.length === 0, JSON.stringify(r.missing));
    ok('G02 16 张职业卡都能升级', r.charCount === 16 && r.upOK === 16, r.upOK + '/' + r.charCount);
  }

  console.log('\n=== H. 无脚本错误 ===');
  ok('H01 全程零 pageerror / console.error', errs.length === 0, errs.slice(0, 3).join(' | '));

  await browser.close();
  const pass = results.filter(r => r.pass).length;
  console.log('\n' + (pass === results.length ? 'ALL PASS' : 'FAILED') + '  ' + pass + '/' + results.length);
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error('PROBE ERROR', e); process.exit(2); });
