/* 强渡宇宙 · 遗物扩容回归探针（P1 #7：8 → 24 件）
   验：① 遗物表完整性（24 件、id 唯一、图标全部能烘焙、24 个图标互不相同）
       ② randomRelic 不会给出已拥有的
       ③ ⚠️ 每一件遗物的 effect 键都在 game.js 里真的接了 hook（静态守卫，防"拿到了但没效果"）
       ④ 每个 hook 的行为都实测一遍（战斗开始 / 结算 / 出牌 / 条件加伤 / 防御 / 经济）
   用法：node .probe-relic.cjs      （需本地 8126 服务，docroot = forcing-cosmos/） */
'use strict';
const { chromium } = require('playwright-core');
const CHROME = 'C:/Users/www27/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe';
const BASE = 'http://127.0.0.1:8126/index.html';

const results = [];
function ok(id, cond, extra) {
  results.push({ id, pass: !!cond });
  console.log((cond ? '  PASS  ' : '  FAIL  ') + id + (extra != null ? '   ' + extra : ''));
}

/* game.js / entities.js 里真正被 relicBonus('...') 读到的键。
   ⚠️ 这张表是手写的，但**两边都要对**：
      - RELICS 里出现的键 ⊆ HANDLED（否则那件遗物是死的）
      - HANDLED ⊆ RELICS 里出现的键（否则表里留了已废弃的键，说明有人在别处偷读） */
const HANDLED = [
  'maxHp', 'maxBattery', 'turnShield', 'statusCut', 'extraDraw', 'turnHeal', 'strengthDouble', 'potionDouble',
  'startShield', 'startStrength', 'startVuln', 'startThorns', 'firstTurnEnergy',
  'battleGold', 'healOnKill',
  'shieldCardBonus', 'attackShield', 'firstAttackBonus',
  'enrageBelow', 'enrageBonus', 'curseDamage',
  'noShieldCut', 'exhaustHeal',
  'priceCut', 'restBonus',
];

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

  await p.evaluate((HANDLED) => {
    window.HANDLED = HANDLED;
    window.T = {
      sleep: ms => new Promise(r => setTimeout(r, ms)),
      /* 把战斗场景钉死：所有"打一张牌看结果"的用例都必须先调它。
         不钉死的话敌人回合会插进来，读到的就不是被测行为的结果了。 */
      setup(ids, opt = {}) {
        const e = G.enemy, pl = G.player;
        e.baseMaxHp = 9999; e.hp = 9999; e.shield = 0;
        e.status.vulnerable = 0; e.status.poison = 0; e.status.burn = 0; e.status.weak = 0; e.status.strength = 0;
        pl.baseMaxHp = 9999; pl.hp = 9999; pl.baseBattery = 99; pl.battery = 99;
        pl.status.strength = 0; pl.status.weak = 0; pl.status.thorns = 0; pl.shield = opt.shield || 0;
        G.asc = 0; G.turn = 1; G.phase = 'player'; G.busy = false;
        G.playedThisTurn = 0; G.attacksThisTurn = 0;
        G.hand = ids.map(id => createCardInstance(CARD_DEFS[id]));
        G.draw = []; G.discard = []; G.exhaust = [];
        FX.parts.length = 0; FX.floats.length = 0; clearFlyCards();
        renderHand(); updateHud();
      },
      /* 开一局、只带指定遗物、开一场战斗、等起手回合结束。
         ⚠️ passive 必须清掉 —— 宇航员的「回合开始 10% 得 1 盾」会让护盾类断言随机飘 ±1。 */
      fresh(charId, relicIds) {
        META.unlockedAsc = 0; saveMeta();
        G.asc = 0;
        newRun(charId || 'assault');
        G.player.passive = 'none';
        G.player.relics = [];
        for (const r of (relicIds || [])) G.player.addRelic(r);
      },
      floats: () => FX.floats.map(f => f.text),
    };
  }, HANDLED);

  /* ================= A. 遗物表完整性 ================= */
  console.log('\n=== A. 遗物表（8 → 24 件） ===');
  {
    const r = await p.evaluate(() => {
      const ids = RELIC_IDS.slice();
      const bad = [], noIcon = [], sigs = {};
      for (const id of ids) {
        const d = RELICS[id];
        if (!d || d.id !== id || !d.name || !d.desc || !d.col || !d.effect || !Object.keys(d.effect).length) bad.push(id);
        const s = SPR['r_' + d.icon];
        if (!s || !s.r || !s.r[0]) { noIcon.push(d.icon); continue; }
        // 图标真的画了东西吗：扫一遍像素，全透明 = 空白图标
        const cn = s.r[0], g = cn.getContext('2d');
        const px = g.getImageData(0, 0, cn.width, cn.height).data;
        let opaque = 0;
        for (let i = 3; i < px.length; i += 4) if (px[i] > 0) opaque++;
        if (opaque === 0) noIcon.push(d.icon + '(空白)');
        // 像素签名：宽高 + 每个不透明像素的坐标与颜色 —— 用来抓"复制粘贴忘改"
        let sig = cn.width + 'x' + cn.height + ':';
        for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 0) sig += i + '.' + px[i] + ',' + px[i + 1] + ',' + px[i + 2] + ';';
        (sigs[sig] = sigs[sig] || []).push(id);
      }
      const dup = Object.keys(sigs).filter(k => sigs[k].length > 1).map(k => sigs[k]);
      const keys = new Set();
      for (const id of ids) for (const k in RELICS[id].effect) keys.add(k);
      return {
        n: ids.length, uniq: new Set(ids).size, bad, noIcon, dup,
        usedKeys: [...keys].sort(), iconCount: new Set(ids.map(i => RELICS[i].icon)).size,
      };
    });
    ok('A01 遗物总数 = 24', r.n === 24, r.n + ' 件');
    ok('A02 id 无重复', r.uniq === r.n, r.uniq + '/' + r.n);
    ok('A03 每件都有 id/name/desc/col/effect', r.bad.length === 0, JSON.stringify(r.bad));
    ok('A04 每件图标都烘焙出了非空像素', r.noIcon.length === 0, JSON.stringify(r.noIcon));
    ok('A05 ⚠️ 24 件图标互不相同（防复制粘贴忘改）', r.dup.length === 0, JSON.stringify(r.dup));
    ok('A06 24 件用了 24 个不同 icon', r.iconCount === 24, r.iconCount + ' 个');

    // ③ 静态守卫：effect 键必须有 hook
    const used = new Set(r.usedKeys), handled = new Set(HANDLED);
    const dead = [...used].filter(k => !handled.has(k));
    const stale = [...handled].filter(k => !used.has(k));
    ok('A07 ⚠️ 所有 effect 键都接了 hook（没有"拿到但没效果"的遗物）', dead.length === 0, JSON.stringify(dead));
    ok('A08 ⚠️ 没有已废弃的 hook 键', stale.length === 0, JSON.stringify(stale));
  }

  /* ================= B. randomRelic ================= */
  console.log('\n=== B. randomRelic ===');
  {
    const r = await p.evaluate(() => {
      const all = RELIC_IDS.slice();
      let hit = 0;
      for (let i = 0; i < 300; i++) { const x = randomRelic([]); if (x && all.includes(x)) hit++; }
      const none = randomRelic(all.slice());
      let leak = 0;
      const owned = all.slice(0, 20);
      for (let i = 0; i < 300; i++) { const x = randomRelic(owned); if (x && owned.includes(x)) leak++; }
      return { hit, none, leak, spread: new Set(Array.from({ length: 400 }, () => randomRelic([]))).size };
    });
    ok('B01 无遗物时 300 次都抽得到', r.hit === 300, r.hit + '/300');
    ok('B02 集齐 24 件后返回 null', r.none === null, String(r.none));
    ok('B03 ⚠️ 已拥有的永远不会被再抽到', r.leak === 0, r.leak + ' 次泄漏');
    ok('B04 400 次抽卡覆盖到 24 件', r.spread === 24, r.spread + '/24');
  }

  /* ================= C. 战斗开始类 ================= */
  console.log('\n=== C. 战斗开始类（startShield / startStrength / startVuln / startThorns / firstTurnEnergy）===');
  {
    const r = await p.evaluate(async () => {
      const trial = async (relics) => {
        T.fresh('assault', relics);
        startBattle('normal', 0);
        await T.sleep(1000);
        return {
          shield: G.player.shield, str: G.player.getStatus('strength'),
          thorns: G.player.getStatus('thorns'), vuln: G.enemy.getStatus('vulnerable'),
          batt: G.player.battery, maxBatt: G.player.maxBattery, turn: G.turn,
        };
      };
      const base = await trial([]);
      const aegis = await trial(['aegisPlate']);
      const banner = await trial(['warBanner']);
      const crown = await trial(['thornCrown']);
      const beacon = await trial(['scoutBeacon']);
      const first = await trial(['firstStrike']);
      // 第二回合：先手电量必须回落到上限，不能每回合都 +1
      const second = await (async () => { startPlayerTurn(false); await T.sleep(200); return { batt: G.player.battery, maxBatt: G.player.maxBattery }; })();
      return { base, aegis, banner, crown, beacon, first, second };
    });
    ok('C01 基线：无遗物开局 0 盾 0 力量 0 反伤', r.base.shield === 0 && r.base.str === 0 && r.base.thorns === 0,
      JSON.stringify(r.base));
    ok('C02 ⚠️ 神盾装甲板：开局 8 盾（不被 resetTurn 清零）', r.aegis.shield === 8, '盾=' + r.aegis.shield);
    ok('C03 战旗：开局 +2 力量', r.banner.str === 2, '力量=' + r.banner.str);
    ok('C04 荆棘王冠：开局 +3 反伤', r.crown.thorns === 3, '反伤=' + r.crown.thorns);
    ok('C05 侦察信标：敌人开局 +2 易伤', r.beacon.vuln === 2 && r.base.vuln === 0, '易伤=' + r.beacon.vuln);
    ok('C06 先手协议：首回合电量 = 上限 +1', r.first.batt === r.first.maxBatt + 1,
      r.first.batt + ' / 上限 ' + r.first.maxBatt);
    ok('C07 ⚠️ 先手协议只在首回合，第二回合回落到上限', r.second.batt === r.second.maxBatt,
      r.second.batt + ' / 上限 ' + r.second.maxBatt);
  }

  /* ================= D. 战斗结算类 ================= */
  console.log('\n=== D. 战斗结算类（battleGold / healOnKill）===');
  {
    const r = await p.evaluate(async () => {
      const trial = async (relics) => {
        T.fresh('assault', relics);
        startBattle('normal', 0);
        await T.sleep(1000);
        G.player.baseMaxHp = 100; G.player.hp = 50;
        const g0 = G.gold, h0 = G.player.hp;
        G.enemy.hp = 0; G.enemy.shield = 0;
        winBattle();
        await T.sleep(1400);
        return { gold: G.gold - g0, hp: G.player.hp - h0 };
      };
      return { base: await trial([]), rig: await trial(['salvageRig']), rec: await trial(['recycler']) };
    });
    ok('D01 基线：普通战 +15 金', r.base.gold === 15, '+' + r.base.gold);
    ok('D02 打捞索具：+15+20 = 35 金', r.rig.gold === 35, '+' + r.rig.gold);
    ok('D03 基线：胜利不回血', r.base.hp === 0, r.base.hp);
    ok('D04 再生装置：胜利回 5 血', r.rec.hp === 5, '+' + r.rec.hp);
  }

  /* ================= E. 出牌时类 ================= */
  console.log('\n=== E. 出牌时类（shieldCardBonus / attackShield / firstAttackBonus）===');
  {
    const r = await p.evaluate(async () => {
      // 护盾牌
      const shieldCard = async (relics) => {
        T.fresh('assault', relics);
        T.setup(['aeroGuard'], { shield: 0 });
        playCard(0); await T.sleep(900);
        return G.player.shield;
      };
      // 攻击牌 + 护盾
      const atkShield = async (relics) => {
        T.fresh('assault', relics);
        T.setup(['aeroShot'], { shield: 0 });
        playCard(0); await T.sleep(900);
        return G.player.shield;
      };
      // 每回合第一张攻击牌
      const firstAtk = async (relics) => {
        T.fresh('assault', relics);
        T.setup(['aeroShot', 'aeroShot']);
        const pv1 = cardPreview(G.hand[0], G.enemy).total;
        playCard(0); await T.sleep(900);
        const pv2 = cardPreview(G.hand[0], G.enemy).total;
        return { pv1, pv2, atk: G.attacksThisTurn };
      };
      const base = await shieldCard([]), rein = await shieldCard(['reinforcer']);
      const aBase = await atkShield([]), coil = await atkShield(['kineticCoil']);
      const fBase = await firstAtk([]), fOver = await firstAtk(['overclock']);
      return { base, rein, aBase, coil, fBase, fOver };
    });
    ok('E01 基线：气动护壁 6 盾', r.base === 6, r.base);
    ok('E02 加固骨架：护盾牌 6+1 = 7 盾', r.rein === 7, r.rein);
    ok('E03 基线：攻击牌不加盾', r.aBase === 0, r.aBase);
    ok('E04 动能线圈：攻击牌 +1 盾', r.coil === 1, r.coil);
    ok('E05 基线：攻击牌 7 伤', r.fBase.pv1 === 7 && r.fBase.pv2 === 7, r.fBase.pv1 + '/' + r.fBase.pv2);
    ok('E06 超频芯片：本回合第一张攻击牌 7+3 = 10', r.fOver.pv1 === 10, r.fOver.pv1);
    ok('E07 ⚠️ 超频芯片：第二张攻击牌不再加成', r.fOver.pv2 === 7, r.fOver.pv2);
    ok('E08 出牌后计数 = 1', r.fOver.atk === 1, r.fOver.atk);
  }

  /* ================= F. 条件加伤类 ================= */
  console.log('\n=== F. 条件加伤类（enrageBonus / curseDamage）===');
  {
    const r = await p.evaluate(async () => {
      const trial = async (relics, hpRatio, curses) => {
        T.fresh('assault', relics);
        T.setup(['aeroShot'], { shield: 0 });
        G.player.baseMaxHp = 100; G.player.hp = Math.round(100 * hpRatio);
        G.deck = [];
        for (let i = 0; i < (curses || 0); i++) G.deck.push(createCurseCard());
        return cardPreview(G.hand[0], G.enemy).total;
      };
      return {
        full: await trial([], 1.0), lowNoRelic: await trial([], 0.2),
        low: await trial(['lastStand'], 0.2), high: await trial(['lastStand'], 0.9),
        c0: await trial(['hexNail'], 1.0, 0), c2: await trial(['hexNail'], 1.0, 2),
      };
    });
    ok('F01 基线：满血 7 伤', r.full === 7, r.full);
    ok('F02 基线：低血但无遗物仍是 7', r.lowNoRelic === 7, r.lowNoRelic);
    ok('F03 背水一战：20% 血时 7+5 = 12', r.low === 12, r.low);
    ok('F04 ⚠️ 背水一战：90% 血时不加成', r.high === 7, r.high);
    ok('F05 咒钉：无诅咒时 7', r.c0 === 7, r.c0);
    ok('F06 咒钉：2 张诅咒时 7+2 = 9', r.c2 === 9, r.c2);
  }

  /* ================= G. 防御 / 资源类 ================= */
  console.log('\n=== G. 防御 / 资源类（noShieldCut / exhaustHeal）===');
  {
    const r = await p.evaluate(async () => {
      // 无盾减伤：把敌人钉成固定 20 伤，走一遍真实 enemyTurn
      const hit = async (relics, shield) => {
        T.fresh('assault', relics);
        startBattle('normal', 0);
        await T.sleep(1000);
        const e = G.enemy;
        e.pattern = 'FIXED'; e.baseDamage = 20; e.dmgMul = 1; e.status.strength = 0; e.status.weak = 0;
        G.player.baseMaxHp = 100; G.player.hp = 100; G.player.shield = shield;
        G.player.damageTakenBonus = 0; G.player.status.weak = 0; G.player.status.vulnerable = 0;
        G.curseAmp = false; G.hand = [];
        G.phase = 'enemy'; G.busy = false;
        enemyTurn();
        await T.sleep(1200);
        return 100 - G.player.hp;
      };
      const exhaust = async (relics) => {
        T.fresh('assault', relics);
        T.setup(['curvatureSlingshot'], { shield: 0 });
        G.player.baseMaxHp = 100; G.player.hp = 40;
        playCard(0); await T.sleep(900);
        return { hp: G.player.hp - 40, exhaustN: G.exhaust.length };
      };
      return {
        noShieldBase: await hit([], 0), noShieldRelic: await hit(['guardianCore'], 0),
        withShield: await hit(['guardianCore'], 10),
        eBase: await exhaust([]), eVault: await exhaust(['ashVault']),
      };
    });
    ok('G01 基线：无盾吃 20 伤', r.noShieldBase === 20, r.noShieldBase);
    ok('G02 守护者核心：无盾时 20-3 = 17 伤', r.noShieldRelic === 17, r.noShieldRelic);
    ok('G03 ⚠️ 守护者核心：有盾时不减伤（吃 10 盾后 10 伤）', r.withShield === 10, r.withShield);
    ok('G04 基线：消耗牌不回血', r.eBase.hp === 0 && r.eBase.exhaustN === 1, JSON.stringify(r.eBase));
    ok('G05 灰烬保险库：消耗一张回 2 血', r.eVault.hp === 2, '+' + r.eVault.hp);
  }

  /* ================= H. 经济类 ================= */
  console.log('\n=== H. 经济类（priceCut / restBonus）===');
  {
    const r = await p.evaluate(async () => {
      const shop = async (relics) => {
        T.fresh('assault', relics);
        G.gold = 9999;
        shopScreen();
        await T.sleep(200);
        return [...document.querySelectorAll('#modal-body .price')].map(x => x.textContent.trim());
      };
      const rest = async (relics) => {
        T.fresh('assault', relics);
        G.player.baseMaxHp = 100; G.player.hp = 10;
        restSite();
        await T.sleep(200);
        const t = document.querySelector('#modal-body .opt .on');
        return t ? t.textContent : '';
      };
      return { shopBase: await shop([]), shopCut: await shop(['creditChip']), restBase: await rest([]), restPack: await rest(['rationPack']) };
    });
    ok('H01 基线商店价：3 卡 50 / 2 遗物 120 / 药水 40 / 移除 75',
      r.shopBase.join(',') === '◆ 50,◆ 50,◆ 50,◆ 120,◆ 120,◆ 40,◆ 75', r.shopBase.join(' | '));
    ok('H02 信用芯片：商店价 ×0.8 = 40 / 96 / 32 / 60',
      r.shopCut.join(',') === '◆ 40,◆ 40,◆ 40,◆ 96,◆ 96,◆ 32,◆ 60', r.shopCut.join(' | '));
    ok('H03 基线休整恢复 30（100 血上限）', /恢复 30 生命/.test(r.restBase), r.restBase);
    ok('H04 口粮包：休整恢复 30×1.5 = 45', /恢复 45 生命/.test(r.restPack), r.restPack);
  }

  /* ================= I. HUD 不炸 ================= */
  console.log('\n=== I. 满遗物 HUD ===');
  {
    const r = await p.evaluate(async () => {
      T.fresh('assault', []);
      for (const id of RELIC_IDS) G.player.addRelic(id);
      startBattle('normal', 0);
      await T.sleep(1000);
      updateHud(); renderHand();
      return { n: G.player.relics.length, batt: G.player.battery, maxBatt: G.player.maxBattery, hp: G.player.hp };
    });
    ok('I01 24 件遗物全部挂上', r.n === 24, r.n);
    ok('I02 ⚠️ 24 件 + 先手电量不会把 HUD 撑爆（无 pageerror）', errs.length === 0, errs.slice(0, 2).join(' | '));
    ok('I03 全遗物下血量/电量仍是有限数', Number.isFinite(r.hp) && Number.isFinite(r.batt), JSON.stringify(r));
  }

  console.log('\n=== J. 无脚本错误 ===');
  ok('J01 全程零 pageerror / console.error', errs.length === 0, errs.slice(0, 3).join(' | '));

  await browser.close();
  const pass = results.filter(r => r.pass).length;
  console.log('\n' + (pass === results.length ? 'ALL PASS' : 'FAILED') + '  ' + pass + '/' + results.length);
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error('PROBE ERROR', e); process.exit(2); });
