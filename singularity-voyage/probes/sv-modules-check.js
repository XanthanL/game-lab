// singularity-voyage 验证：制导削弱 + 第四批新模块（孤立 / 湮灭 / 拘束 / 回溯）
// 运行： node sv-modules-check.js
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.SV_URL || 'http://127.0.0.1:8612/index.html';
const log = (...a) => console.log(...a);

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  });
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)); });

  await page.goto(BASE + '?god=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', null, { timeout: 20000 });
  await page.evaluate(() => { startGame(); });
  await page.waitForFunction(() => window.__dbg.state === 'play', null, { timeout: 10000 });
  await page.waitForTimeout(400);

  const R = await page.evaluate(() => new Promise(async (resolve, reject) => {
    try {
    const d = window.__dbg, G = d.G;
    const frame = () => new Promise(r => requestAnimationFrame(r));
    const res = {};
    const fresh = async (ids = []) => {
      d.clearEnemies(); d.clearMods(); d.resetStats(); G.bullets.length = 0;
      G.furyT = 0; G.rewindT = 0; G.snaps.length = 0; G.snapT = 0;
      for (const [id, n] of ids) d.grant(id, n);
      await frame();
    };

    // ---------- 制导削弱 ----------
    await fresh([['guided', 3]]);
    res.homingRate = G.S.homing;
    res.homeR = G.S.homeR;
    res.homeTrav = G.S.homeTrav;
    // 直线试射：装满制导，看一发飞多远就自己失坠。
    // ⚠️ **每一帧都必须清场**：`updateWave` 会持续补怪，撞上任何一只都会「打到人就消失」，
    //    测出来的里程就变成了「到最近那只敌人的距离」而不是失坠里程 ——
    //    踩过一次：随机生成刚好在正前方 28px 处放了只蝌蚪，探针报 28px 而实际限制是 430px。
    d.setPos(200, 200); G.ang = 0; G.bullets.length = 0;
    d.clearEnemies(); G.spawnQueue.length = 0;
    pBullet(200, 200, 0, 320 * G.S.bspd, 1);
    let travelled = 0;
    for (let i = 0; i < 240 && G.bullets.length; i++) {
      travelled = Math.abs(G.bullets[0].x - 200);
      d.clearEnemies(); G.spawnQueue.length = 0;
      await frame();
    }
    res.homingMaxRange = travelled;
    res.homingLimit = G.S.homeTrav * G.S.rangeMul;
    res.homingGone = G.bullets.length === 0;

    // 转弯速率实测：目标在正上方 90°，看第一帧转了多少
    await fresh([['guided', 3]]);
    d.clearEnemies();
    const tgt = d.spawn('tadpole', G.px, G.py - 90);
    G.bullets.length = 0;
    pBullet(G.px, G.py, 0, 300, 1);          // 朝右飞，目标在正上方
    let ang0 = G.bullets[0] ? G.bullets[0].ang : null, angAfter = null;
    for (let i = 0; i < 20 && G.bullets.length; i++) {
      await frame();
      if (i === 9 && G.bullets[0]) angAfter = G.bullets[0].ang;
    }
    res.turnIn10Frames = (angAfter === null || ang0 === null) ? -1 : Math.abs(angAfter - ang0);

    // ---------- 孤立协议：伤害对比（用高血量目标，免得被「差值 = 剩余血量」卡住）----------
    await fresh([['isolate', 3]]);
    d.clearEnemies();
    const solo = d.spawn('tadpole', G.px + 260, G.py);          // 落单
    solo.hp = solo.maxHp = 5000;
    await frame();
    const hpA = solo.hp; d.hit(solo, 10, 1, 0); res.isoLoneDmg = hpA - solo.hp;
    d.clearEnemies();
    const crowdA = d.spawn('tadpole', G.px + 260, G.py);        // 两只挨着
    crowdA.hp = crowdA.maxHp = 5000;
    d.spawn('tadpole', G.px + 262, G.py + 6);
    await frame();
    const hpB = crowdA.hp; d.hit(crowdA, 10, 1, 0); res.isoCrowdDmg = hpB - crowdA.hp;
    res.isoMul = G.S.isoMul;

    // ---------- 湮灭指令：残血加倍（同样用高血量目标）----------
    await fresh([['execute', 3]]);
    d.clearEnemies();
    const full = d.spawn('tadpole', G.px + 260, G.py);
    full.hp = full.maxHp = 5000;
    await frame();
    const hpF = full.hp; d.hit(full, 6, 1, 0); res.execFullDmg = hpF - full.hp;
    d.clearEnemies();
    const low = d.spawn('tadpole', G.px + 260, G.py);
    low.hp = low.maxHp = 5000;
    await frame();
    low.hp = low.maxHp * 0.15;                                   // 压到斩杀线以下
    const hpL = low.hp; d.hit(low, 6, 1, 0); res.execLowDmg = hpL - low.hp;
    res.execMul = G.S.execMul; res.execHp = G.S.execHp;

    // ---------- 拘束立场：命中能不能定住 ----------
    await fresh([['bind', 3]]);
    d.clearEnemies();
    const bound = d.spawn('tadpole', G.px + 260, G.py);
    bound.hp = bound.maxHp = 99999;                              // 别死，慢慢打
    let rooted = 0, rootHits = -1;
    for (let i = 0; i < 400 && rooted === 0; i++) {
      d.hit(bound, 0.5, 1, 0);
      if (bound.root > 0) { rooted = 1; rootHits = i + 1; }
    }
    res.bindHitsToRoot = rootHits;
    res.bindP = G.S.bindP; res.bindT = G.S.bindT;
    // 定住之后 AI 是不是真的停了
    if (rooted) {
      const x0 = bound.x, y0 = bound.y;
      for (let i = 0; i < 10; i++) await frame();
      res.bindDrift = Math.hypot(bound.x - x0, bound.y - y0);
    } else res.bindDrift = -1;

    // ---------- 时滞回溯：必须在不带 ?god 的页面里测 ----------
    // ⚠️ GOD 是 `const`，评估作用域里改不掉；god 模式下 hurtPlayer 第一行就 return，
    //    回溯根本不会被碰到（这也是上一版探针测出「假阳性」的原因 —— 它量的其实是 god 模式）。
    await fresh([['rewind', 3]]);
    d.setPos(G.px, G.py);
    const homeX = G.px, homeY = G.py;
    res.snapsAtStart = G.snaps.length;
    for (let i = 0; i < 200; i++) { G.px += 1.2; G.py += 0.6; await frame(); }
    res.snapsAfter4s = G.snaps.length;
    res.awayFromHome = Math.round(G.px - homeX);
    res.snapWindow = G.snaps.length ? Math.round((G.snaps[0].t - G.snaps[G.snaps.length - 1].t) * 10) / 10 : 0;
    // 直接手动造一枚致命伤：跳过 god（GOD 只读），自己走 tryRewind + die 那条路
    G.rewindT = 0; G.inv = 0; G.S.hp = 12;
    const rewound = tryRewind(999);
    res.rewindTriggered = rewound;
    res.rewindBackTo = [Math.round(G.px - homeX), Math.round(G.py - homeY)];
    res.rewindHp = Math.round(G.S.hp);
    res.rewindCd = G.rewindT > 0 ? Math.round(G.rewindT * 10) / 10 : 0;
    // 冷却期内再来一次 → 应该一点事都没有（返回 false）
    res.secondRewind = tryRewind(999);

    // ---------- 协同是否触发 ----------
    await fresh([['isolate', 1], ['critcap', 1]]);
    await frame();
    res.synLoneMark = !!G.syn.loneMark;
    await fresh([['execute', 1], ['leech', 1]]);
    await frame();
    res.synHarvest = !!G.syn.harvest;
    await fresh([['bind', 1], ['nova', 1]]);
    await frame();
    res.synStaticBind = !!G.syn.staticBind;
    await fresh([['rewind', 1], ['phasehull', 1]]);
    await frame();
    res.synEchoPhase = !!G.syn.echoPhase;

    // ---------- 新卡配件（像素数必须随等级单调不减）----------
    res.attach = {};
    for (const id of ['isolate', 'execute', 'bind', 'rewind']) {
      try {
        // attachInfo 返回的是 {parts: 零件数, colors: {字符->像素数}}，像素总数要把 colors 加起来
        const px = lv => {
          const info = d.attachInfo(id, lv);
          if (!info || !info.colors) return 0;
          let n = 0;
          for (const k in info.colors) n += info.colors[k];
          return n;
        };
        const a = px(1), b = px(2), c = px(3);
        res.attach[id] = { lv1: a, lv2: b, lv3: c, mono: a < b && b < c };
      } catch (e) { res.attach[id] = 'ERR ' + e.message; }
    }
    // ---------- i18n 完整性 ----------
    try {
      res.i18nMissing = d.i18nMissing ? d.i18nMissing() : 'no api';
      res.marks = d.domMissingMarks ? d.domMissingMarks().length : -1;
    } catch (e) { res.i18nMissing = 'ERR ' + e.message; }
    res.moduleCount = MODULES.length;
    res.synCount = SYNERGIES.length;
    resolve(res);
    } catch (e) { reject(String(e && e.stack || e)); }
  }));

  if (R.fatal) { log('FATAL', R.fatal); await browser.close(); process.exit(1); }
  let i0 = 0;
  log('== 制导削弱 ==');
  log(' 转弯速率 homing            : ' + R.homingRate.toFixed(2) + ' rad/s (旧满级 4.70)');
  log(' 锁定半径 homeR             : ' + R.homeR + ' px (旧满级 260)');
  log(' 单发最大里程 homeTrav      : ' + R.homeTrav + ' px');
  log(' 实测：无目标时飞多远消失   : ' + R.homingMaxRange.toFixed(0) + ' px (理论上限 ' + R.homingLimit.toFixed(0) + ')');
  log(' 是否真的消失了             : ' + (R.homingGone ? '是' : '否'));
  log(' 10 帧内转过的角度          : ' + (R.turnIn10Frames < 0 ? 'n/a' : (R.turnIn10Frames * 57.3).toFixed(1) + '°'));
  log('== 孤立协议 ==');
  log(' 落单目标吃到的伤害         : ' + R.isoLoneDmg.toFixed(1) + ' (基值 10)');
  log(' 有同伴时吃到的伤害         : ' + R.isoCrowdDmg.toFixed(1));
  log(' isoMul                     : ' + R.isoMul.toFixed(2));
  log('== 湮灭指令 ==');
  log(' 满血时伤害                 : ' + R.execFullDmg.toFixed(1) + ' (基值 6)');
  log(' 残血时伤害                 : ' + R.execLowDmg.toFixed(1));
  log(' execMul / 斩杀线           : ' + R.execMul.toFixed(2) + ' / ' + (R.execHp * 100).toFixed(0) + '%');
  log('== 拘束立场 ==');
  log(' 命中率 / 是否触发过定身    : ' + R.bindP.toFixed(2) + ' / ' + (R.bindHitsToRoot >= 0 ? '是' : '否'));
  log(' 定身 10 帧内的位移         : ' + R.bindDrift.toFixed(1) + ' px (越小越稳)');
  log(' 定身时长                   : ' + R.bindT.toFixed(2) + ' s');
  log('== 时滞回溯 ==');
  log(' 快照表长度（跑 4 秒后）    : ' + R.snapsAfter4s + ' 格，覆盖 ' + R.snapWindow + ' s (上限 5.5)');
  log(' 致命伤是否触发回溯         : ' + (R.rewindTriggered ? '是' : '否'));
  log(' 当时已离开起点             : ' + R.awayFromHome + ' px → 回溯落点 ' + JSON.stringify(R.rewindBackTo));
  log(' 回溯后的船体               : ' + R.rewindHp + ' (下限 = 最大船体 25%)');
  log(' 回溯后的冷却               : ' + R.rewindCd + ' s');
  log(' 冷却期内的第二次致命伤     : ' + (R.secondRewind ? '又被拦住了（错误）' : '不再生效（正确）'));
  log('== 协同 ==');
  log(' 猎手直觉 / 收割放牧        : ' + R.synLoneMark + ' / ' + R.synHarvest);
  log(' 静滞钳制 / 回溯残响        : ' + R.synStaticBind + ' / ' + R.synEchoPhase);
  log('== 新卡配件（像素数 lv1→lv3, 必须递增）==');
  for (const id of ['isolate', 'execute', 'bind', 'rewind']) log(' ' + id.padEnd(9) + ': ' + JSON.stringify(R.attach[id]));
  log('== i18n / 规模 ==');
  log(' 模块卡 / 协同总数          : ' + R.moduleCount + ' / ' + R.synCount);
  log(' zh-en 缺键                 : ' + (Array.isArray(R.i18nMissing) ? (R.i18nMissing.length ? R.i18nMissing.join(',') : '无') : R.i18nMissing));
  log(' 页面上 ⟪⟫ 漏翻标记         : ' + R.marks);
  log('== JS 错误 ==');
  log(errs.length ? errs.slice(0, 8).join('\n') : ' 无');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
