// singularity-voyage 验证：第六批「海克斯 / 英雄技能」6 张卡
//   冰封长箭 crystal / 瓦解射线 beam / 爆头协议 headshot
//   无尽怒火 undying / 死亡印记 mark / 荆棘甲壳 thorns
// 运行： 起服务（python -m http.server 8612）后 node sv-lol6-check.js
// ⚠️ 不开 ?god —— god 模式下 hurtPlayer 第一行就 return，荆棘 / 怒火根本测不到。
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.SV_URL || 'http://127.0.0.1:8612/index.html';
const log = (...a) => console.log(...a);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  });
  const errs = [];
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 520 });
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)); });

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', { timeout: 20000 });
  await page.evaluate(() => { startGame(); });
  await page.waitForFunction(() => window.__dbg.state === 'play', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 400));

  const res = await page.evaluate(() => new Promise(async (resolve, reject) => {
    try {
      const d = window.__dbg, G = d.G;
      const frame = () => new Promise(r => requestAnimationFrame(r));
      const res = {};
      // ⚠️ 非 god 模式：每帧都要清场，否则 updateWave 补的怪会干扰伤害读数。
      const idle = async (n = 2) => {
        for (let i = 0; i < n; i++) { d.clearEnemies(); G.spawnQueue.length = 0; G.bullets.length = 0; await frame(); }
      };
      const fresh = async (ids = []) => {
        d.clearEnemies(); G.spawnQueue.length = 0; d.clearMods(); d.resetStats();
        G.bullets.length = 0; G.arrows.length = 0; G.ebullets.length = 0;
        G.undyingT = 0; G.undyingCdT = 0; G.thornCd = 0; G.shotN = 0;
        G.beamCh = 0; G.beamFire = 0; G.beamT = 0; G.odT = 0;
        for (const [id, n] of ids) d.grant(id, n);
        await idle(1);
      };

      // ================= 冰封长箭 =================
      await fresh([['crystal', 3]]);
      res.cryCd = G.S.crystalCd;
      // 等它自己射出来（crystalT 初值 0 → 第一帧就发）
      let arrows = 0;
      for (let i = 0; i < 20 && !arrows; i++) { d.clearEnemies(); await frame(); arrows = G.arrows.length; }
      res.crySpawned = arrows;
      // 近 / 远两发，验证「越飞越疼」
      const shotAt = async (dist) => {
        await fresh([['crystal', 3]]);
        d.setPos(300, 300);
        const e = d.spawn('tadpole', 300 + dist, 300);
        e.hp = e.maxHp = 99999; e.ai = null; e.root = 99;   // 不许动，也不许死
        G.arrows.length = 0; fireArrow();
        let hitAt = -1;
        for (let i = 0; i < 90 && hitAt < 0; i++) {
          e.root = 99; e.hp = 99999;                        // 每帧按回去，只读「这一跳掉了多少」
          await frame();
          if (!G.arrows.length) { hitAt = 1; break; }
        }
        return hitAt;
      };
      // 直接量：手动造两支箭，一支刚出膛、一支飞了 300px，比较同一目标吃到的伤害
      const dmgAt = async (trav) => {
        await fresh([['crystal', 3]]);
        // ⚠️ 必须把自动发射的冷却推远：crystalT 初值是 0，下一帧 updateAbilities 会自己
        //    再射一支，测出来的就是「两支箭的伤害和」而不是这一支的。
        G.S.crystalT = 999;
        d.setPos(300, 300);
        const e = d.spawn('tadpole', 300 + trav + 8, 300);
        e.maxHp = 99999; e.root = 99;
        G.arrows.length = 0; fireArrow();
        if (G.arrows.length) { G.arrows[0].trav = trav; G.arrows[0].x = 300 + trav; }
        const hp0 = e.hp = 99999;
        for (let i = 0; i < 12; i++) { e.root = 99; await frame(); if (G.arrows.length === 0) break; }
        return hp0 - e.hp;
      };
      res.cryDmgNear = await dmgAt(20);
      res.cryDmgFar = await dmgAt(320);
      // 冻结：非 Boss 目标应该被定住
      await fresh([['crystal', 3]]);
      G.S.crystalT = 999;
      d.setPos(300, 300);
      const fz = d.spawn('tadpole', 380, 300); fz.maxHp = 99999;
      G.arrows.length = 0; fireArrow();
      for (let i = 0; i < 30 && !(fz.root > 0); i++) { fz.hp = fz.maxHp; await frame(); }
      res.cryFreeze = fz.root > 0 ? +fz.root.toFixed(2) : 0;
      // 冻结对 Boss 无效（spawnBoss 没有返回值，得从 G.boss 拿）
      await fresh([['crystal', 3]]);
      G.S.crystalT = 999;
      d.setPos(300, 300);
      d.spawnBoss('motherrock');
      const bz = G.boss;
      if (bz) { bz.x = G.px + 80; bz.y = G.py; bz.maxHp = 99999; }
      G.arrows.length = 0; fireArrow();
      for (let i = 0; i < 30; i++) { if (bz) bz.hp = bz.maxHp; await frame(); }
      res.cryBossRoot = bz ? (bz.root || 0) : -1;
      res.cryBossSeen = !!bz;

      // ================= 瓦解射线 =================
      await fresh([['beam', 3]]);
      res.beamCd = G.S.beamCd; res.beamLen = G.S.beamLen; res.beamDmg = G.S.beamDmg;
      d.setPos(300, 300); G.aim = 0; G.vx = 0; G.vy = 0;
      for (let i = 0; i < 60 && G.beamFire <= 0; i++) { d.clearEnemies(); await frame(); }
      res.beamCharged = G.beamFire > 0;
      // 站桩发射：光束里的敌人应该掉血
      await fresh([['beam', 3]]);
      d.setPos(300, 300); G.aim = 0;
      const bt = d.spawn('tadpole', 300 + 120, 300); bt.maxHp = 99999; bt.root = 99; bt.hp = 99999;
      for (let i = 0; i < 60 && G.beamFire <= 0; i++) { bt.root = 99; await frame(); }
      const bhp0 = bt.hp;
      for (let i = 0; i < 24; i++) { bt.root = 99; await frame(); }
      res.beamDealt = +(bhp0 - bt.hp).toFixed(1);
      // 一动就断
      await fresh([['beam', 3]]);
      d.setPos(300, 300); G.aim = 0;
      for (let i = 0; i < 60 && G.beamFire <= 0; i++) { d.clearEnemies(); await frame(); }
      const fireBefore = G.beamFire;
      G.vx = 200; G.vy = 0;
      await frame(); await frame();
      res.beamFireBefore = +fireBefore.toFixed(2);
      res.beamCutByMove = G.beamFire <= 0;
      res.beamCdAfterCut = +G.beamT.toFixed(2);      // 中断后冷却减半
      // 质变：蒸发经过的敌弹
      await fresh([['beam', 3]]);
      G.S.beamGold = 1; d.setPos(300, 300); G.aim = 0; G.vx = 0; G.vy = 0;
      for (let i = 0; i < 60 && G.beamFire <= 0; i++) { d.clearEnemies(); G.ebullets.length = 0; await frame(); }
      d.ebullet(300 + 100, 300, Math.PI, 0, 4);       // 光束正上方一枚不动的敌弹
      const eb0 = G.ebullets.length;
      for (let i = 0; i < 6 && G.ebullets.length; i++) await frame();
      res.beamGoldEats = eb0 + '/' + G.ebullets.length;

      // ================= 爆头协议 =================
      await fresh([['headshot', 3]]);
      res.hsEvery = G.S.hsEvery; res.hsMul = G.S.hsMul;
      let hsN = 0, tot = 0;
      for (let v = 0; v < 8; v++) {
        G.bullets.length = 0; d.fire(0);
        for (const b of G.bullets) { tot++; if (b.crit === true) hsN++; }
      }
      res.hsShots = hsN + '/' + tot;
      // 爆头弹必须更粗、更能穿
      await fresh([['headshot', 3]]);
      G.bullets.length = 0; d.fire(0);
      const plain = G.bullets[0];
      res.hsR = +plain.r.toFixed(2); res.hsPierce = plain.pierce;
      G.bullets.length = 0; G.shotN = G.S.hsEvery - 1; d.fire(0);
      const hs = G.bullets[0];
      res.hsHeadR = +hs.r.toFixed(2); res.hsHeadPierce = hs.pierce;
      res.hsDmgRatio = +(hs.dmg / plain.dmg).toFixed(2);

      // ================= 死亡印记 =================
      await fresh([['mark', 3]]);
      res.markPct = +G.S.markPct.toFixed(2); res.markT = G.S.markT;
      d.clearEnemies();
      const mk = d.spawn('tadpole', 560, 300); mk.hp = mk.maxHp = 5000;
      mk.root = 99;
      d.hit(mk, 100, 1, 0);
      res.markAcc = +(mk.markAcc || 0).toFixed(1);
      const mkHp0 = mk.hp;
      for (let i = 0; i < 200 && mk.markT > 0; i++) { mk.root = 99; await frame(); }
      res.markDmg = +(mkHp0 - mk.hp).toFixed(1);
      res.markExpect = +(100 * G.S.markPct).toFixed(1);
      // 上限夹：maxHp × 0.5
      await fresh([['mark', 3]]);
      d.clearEnemies();
      const mk2 = d.spawn('tadpole', 560, 300); mk2.hp = mk2.maxHp = 5000; mk2.root = 99;
      d.hit(mk2, 4800, 1, 0);
      mk2.hp = mk2.maxHp;                       // 只保留账目，把血补回满，好读纯引爆值
      const mk2Hp0 = mk2.hp;
      for (let i = 0; i < 200 && mk2.markT > 0; i++) { mk2.root = 99; await frame(); }
      res.markCapDmg = +(mk2Hp0 - mk2.hp).toFixed(1);
      res.markCap = +(mk2.maxHp * 0.5).toFixed(1);

      // ================= 荆棘甲壳 =================
      await fresh([['thorns', 3]]);
      res.thornPct = +G.S.thornPct.toFixed(2); res.thornR = G.S.thornR;
      d.clearEnemies();
      const tn = d.spawn('tadpole', G.px + 40, G.py); tn.hp = tn.maxHp = 99999; tn.root = 99;
      G.inv = 0; G.S.hp = 500; G.S.maxHp = 500;
      const tnHp0 = tn.hp;
      d.hurt(100);
      res.thornBack = +(tnHp0 - tn.hp).toFixed(1);
      // 节流：同一帧连吃两次只弹一次
      const tnHp1 = tn.hp;
      G.inv = 0; d.hurt(100);
      res.thornThrottled = +((tnHp1 - tn.hp)).toFixed(1);
      // 至多 4 个目标
      await fresh([['thorns', 3]]);
      d.clearEnemies();
      const many = [];
      for (let i = 0; i < 8; i++) { const e = d.spawn('tadpole', G.px + 30 + i * 8, G.py); e.hp = e.maxHp = 99999; e.root = 99; many.push(e); }
      G.inv = 0; G.S.hp = 500;
      const before = many.map(e => e.hp);
      d.hurt(100);
      res.thornTargets = many.filter((e, i) => before[i] - e.hp > 0).length;

      // ================= 无尽怒火 =================
      await fresh([['undying', 3]]);
      res.undCd = G.S.undyingCd; res.undDur = G.S.undyingDur;
      d.clearEnemies();
      G.inv = 0; G.S.hp = 8; G.S.maxHp = 100;
      d.hurt(500);
      res.undTriggered = G.undyingT > 0;
      res.undHp = G.S.hp;
      res.undT = +G.undyingT.toFixed(1);
      // 怒火期间：单发致死不会死（血锁 1）
      G.inv = 0; d.hurt(9999);
      res.undSurvive = !G.dead && G.S.hp === 1;
      // 怒火期间的机动 / 射速倍率
      //    ⚠️ 倍率在 updatePlayer 里算，必须过一帧才读得到；
      //    ⚠️ 而 hurtPlayer / tryUndying 都会 freeze()（G.hitstop > 0 → step 直接 return），
      //       所以先手动把凝滞清掉，否则连过十几帧都是在空转。
      G.hitstop = 0; d.clearEnemies();
      await frame(); G.hitstop = 0; await frame();
      res.undMul = +G.rampageMul.toFixed(2);
      // ================= 新卡配件（像素数必须随等级单调不减）=================
      res.attach = {};
      for (const id of ['crystal', 'beam', 'headshot', 'undying', 'mark', 'thorns']) {
        try {
          const px = lv => {
            const info = d.attachInfo(id, lv);
            if (!info || !info.colors) return 0;
            let n = 0;
            for (const k in info.colors) n += info.colors[k];
            return n;
          };
          const a = px(1), b = px(2), c = px(3);
          res.attach[id] = { lv1: a, lv2: b, lv3: c, mono: a > 0 && a < b && b < c };
        } catch (e) { res.attach[id] = 'ERR ' + e.message; }
      }

      // ================= 协同 =================
      const syn = async (a, b) => { await fresh([[a, 1], [b, 1]]); return Object.keys(G.syn); };
      res.synIceBind = (await syn('crystal', 'bind')).includes('iceBind');
      res.synMotionTwin = (await syn('beam', 'spin')).includes('motionTwin');
      res.synHeadshotCrit = (await syn('headshot', 'critcap')).includes('headshotCrit');
      res.synLastStand = (await syn('undying', 'execute')).includes('lastStand');
      res.synMarkBurst = (await syn('mark', 'hesh')).includes('markBurst');
      res.synThornPlate = (await syn('thorns', 'armor')).includes('thornPlate');

      // ================= 规模 / i18n =================
      res.moduleCount = MODULES.length;
      res.synCount = SYNERGIES.length;
      res.abilityCount = MODULES.filter(m => m.type === 'ability').length;
      try {
        res.i18nMissing = d.i18nMissing ? d.i18nMissing() : 'no api';
      } catch (e) { res.i18nMissing = 'ERR ' + e.message; }

      // ⚠️ 放在**最后**：这一测会让玩家真的死掉（die() 里还有 setTimeout(gameOver, 900)），
      //    放前面会污染后面所有用例的状态。
      await fresh([['undying', 3]]);
      d.clearEnemies();
      G.inv = 0; G.S.hp = 8;
      d.hurt(500);                                  // 触发怒火
      G.undyingT = 0;                               // 强制结束怒火 → 冷却仍在
      G.inv = 0; G.S.hp = 8;
      d.hurt(500);
      res.undSecond = G.dead ? '死了（正确）' : '没死（错误）';
      resolve(res);
    } catch (e) { reject(String(e && e.stack || e)); }
  }));

  const ok = (b) => b ? 'OK  ' : 'FAIL';
  log('== 冰封长箭（艾希 魔法水晶箭）==');
  log(' 冷却 / 是否射出         : ' + res_1(res.cryCd) + 's / ' + ok(res.crySpawned > 0));
  log(' 伤害 近20px → 远320px   : ' + res.cryDmgNear.toFixed(1) + ' → ' + res.cryDmgFar.toFixed(1) + '  ' + ok(res.cryDmgFar > res.cryDmgNear));
  log(' 命中冻结时长 / Boss 不被冻: ' + res.cryFreeze + 's ' + ok(res.cryFreeze > 0) + ' / root=' + res.cryBossRoot + ' ' + ok(res.cryBossSeen && res.cryBossRoot === 0));
  log('== 瓦解射线（维克兹 生命形态瓦解射线）==');
  log(' 冷却 / 长度 / 每跳伤害  : ' + res_1(res.beamCd) + 's / ' + res.beamLen + 'px / ' + res.beamDmg);
  log(' 站定蓄满并射出          : ' + ok(res.beamCharged));
  log(' 发射 24 帧造成的伤害    : ' + res.beamDealt + '  ' + ok(res.beamDealt > 0));
  log(' 移动是否打断 / 打断后冷却: ' + ok(res.beamCutByMove) + ' / ' + res.beamCdAfterCut + 's (应 ≈ 满冷却一半 ' + res_1(res.beamCd / 2) + 's)');
  log(' 质变蒸发敌弹（前/后）   : ' + res.beamGoldEats + '  ' + ok(res.beamGoldEats.endsWith('/0')));
  log('== 爆头协议（女警/烬 爆头）==');
  log(' 每 N 次齐射 / 倍率      : ' + res.hsEvery + ' / ' + res.hsMul + 'x');
  log(' 8 次齐射里的必暴弹      : ' + res.hsShots + '  ' + ok(res.hsShots === '2/8'));
  log(' 半径 / 穿透 普通→爆头   : ' + res.hsR + '/' + res.hsPierce + ' → ' + res.hsHeadR + '/' + res.hsHeadPierce + '  ' + ok(res.hsHeadR > res.hsR && res.hsHeadPierce > res.hsPierce));
  log(' 爆头弹伤害倍率实测      : ' + res.hsDmgRatio + 'x  ' + ok(Math.abs(res.hsDmgRatio - res.hsMul) < 0.01));
  log('== 死亡印记（劫 死亡印记）==');
  log(' 引爆比例 / 记账窗口     : ' + res.markPct + ' / ' + res.markT + 's');
  log(' 记账 100 → 实际引爆     : ' + res.markDmg + ' (期望 ' + res.markExpect + ')  ' + ok(Math.abs(res.markDmg - res.markExpect) < 1));
  log(' 上限夹（应 = maxHp×0.5）: ' + res.markCapDmg + ' (上限 ' + res.markCap + ')  ' + ok(res.markCapDmg <= res.markCap + 1));
  log('== 荆棘甲壳（拉莫斯 尖刺防御）==');
  log(' 反伤比例 / 半径         : ' + res.thornPct + ' / ' + res.thornR + 'px');
  log(' 吃 100 伤害弹回         : ' + res.thornBack + '  ' + ok(Math.abs(res.thornBack - 100 * res.thornPct) < 1));
  log(' 同帧第二次（节流应为 0）: ' + res.thornThrottled + '  ' + ok(res.thornThrottled === 0));
  log(' 一次最多弹几个目标（≤4）: ' + res.thornTargets + '  ' + ok(res.thornTargets > 0 && res.thornTargets <= 4));
  log('== 无尽怒火（泰达米尔 无尽怒火）==');
  log(' 冷却 / 持续             : ' + res.undCd + 's / ' + res.undDur + 's');
  log(' 致死伤是否触发 / 血锁   : ' + ok(res.undTriggered) + ' / hp=' + res.undHp + '  ' + ok(res.undHp === 1));
  log(' 怒火期间再吃致死伤      : ' + ok(res.undSurvive) + '（不死且血锁 1）');
  log(' 怒火期间的机动/射速倍率 : ' + res.undMul + 'x  ' + ok(res.undMul > 1.5));
  log(' 冷却期内的第二次致死伤  : ' + res.undSecond);
  log('== 协同 ==');
  log(' 冰封钳制 / 一动一静     : ' + ok(res.synIceBind) + ' / ' + ok(res.synMotionTwin));
  log(' 致命一击 / 背水一战     : ' + ok(res.synHeadshotCrit) + ' / ' + ok(res.synLastStand));
  log(' 印记爆破 / 重装荆棘     : ' + ok(res.synMarkBurst) + ' / ' + ok(res.synThornPlate));
  log('== 新卡配件（像素数 lv1→lv3, 必须递增且非零）==');
  for (const id of ['crystal', 'beam', 'headshot', 'undying', 'mark', 'thorns']) log(' ' + id.padEnd(9) + ': ' + JSON.stringify(res.attach[id]));
  log('== 规模 / i18n ==');
  log(' 模块 / 协同 / 其中能力型 : ' + res.moduleCount + ' / ' + res.synCount + ' / ' + res.abilityCount);
  log(' zh-en 缺键              : ' + (Array.isArray(res.i18nMissing) ? (res.i18nMissing.length ? res.i18nMissing.join(',') : '无') : res.i18nMissing));
  log('== JS 错误 ==');
  log(errs.length ? errs.slice(0, 10).join('\n') : ' 无');
  await browser.close();
  function res_1(v) { return Math.round(v * 10) / 10; }
})().catch(e => { console.error('FATAL', e); process.exit(1); });
