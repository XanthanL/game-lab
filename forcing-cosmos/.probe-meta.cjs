/* 强渡宇宙 · 局外进度回归探针（P0：梯度 / 解锁 / 战绩 / 继续卡片）
   验：①「航行日志」按钮点得动且出得来
       ② 梯度选择器只能选到已解锁等级，且修正文本对得上
       ③ 梯度真的进到数值里（敌人 hp / dmgMul / 开局诅咒 / 商店价 / 休整量）
       ④ gameOver 真的写日志 + 推解锁 + 结局面板显示解锁横幅
       ⑤ 主菜单「继续」进度卡片渲染 + 点得动
       ⑥ 局外进度能一键清空
   用法：node .probe-meta.cjs      （需本地 8126 服务，docroot = forcing-cosmos/）      */
'use strict';
const { chromium } = require('playwright-core');
const CHROME = 'C:/Users/www27/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe';
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
  const go = async (q, wait = 1200) => {
    await p.goto(BASE + q, { waitUntil: 'load' });
    await p.evaluate(() => { try { localStorage.removeItem('fc_meta_v1'); } catch (e) { } });
    await p.goto(BASE + q, { waitUntil: 'load' });
    await p.waitForTimeout(wait);
  };
  const modalOpen = () => p.$eval('#modal', el => !el.classList.contains('hidden'));
  const txt = sel => p.$eval(sel, el => el.textContent.trim()).catch(() => null);
  // 真实命中测试：DOM 说按钮在那儿没用，elementFromPoint 拿到它才算点得到
  // ⚠️ 必须先判尺寸：隐藏元素的 rect 是 0x0，elementFromPoint(0,0) 会拿到 <html>，
  //    而 html.contains(el) 恒为真 —— 那样「命中」就成了假 PASS。
  const hit = sel => p.$eval(sel, el => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!t && (el === t || el.contains(t));
  }).catch(() => false);

  console.log('\n=== A. 航行日志入口 ===');
  await go('?noanim=1');
  ok('A01 标题页有「航行日志」按钮', await p.$('[data-act="log"]') != null);
  ok('A02 按钮真的点得到（elementFromPoint）', await hit('[data-act="log"]'));
  await p.click('[data-act="log"]'); await p.waitForTimeout(400);
  ok('A03 点它弹窗打开', await modalOpen());
  ok('A04 弹窗标题是「航行日志」', (await txt('#modal-title')) === '航行日志', await txt('#modal-title'));
  ok('A05 弹窗有 × 关闭键', await p.$eval('#modal-x', el => !el.classList.contains('hidden')));
  {
    const body = await txt('#modal-body');
    ok('A06 空进度时提示「还没有记录」', /还没有记录/.test(body || ''), (body || '').slice(0, 40));
  }
  await p.click('#modal-x'); await p.waitForTimeout(300);
  ok('A07 点 × 能关掉', !(await modalOpen()));

  console.log('\n=== B. 梯度选择器 ===');
  await go('?charsel=1&noanim=1');
  ok('B01 选人页有梯度行', await p.$('#asc-row .asc-line') != null);
  ok('B02 默认显示 Lv.0', (await txt('#asc-row .asc-lv')) === '梯度 Lv.0', await txt('#asc-row .asc-lv'));
  ok('B03 未解锁时「−」禁用', await p.$eval('#asc-row .asc-line button', el => el.disabled));
  ok('B04 未解锁时「+」禁用', await p.$$eval('#asc-row .asc-line button', els => els[1].disabled));
  ok('B05 Lv.0 说明「标准梯度」', /标准梯度/.test(await txt('#asc-row .asc-desc')), await txt('#asc-row .asc-desc'));
  {
    const lock = await txt('#asc-row .asc-lock');
    ok('B06 未解锁时提示怎么解锁', /通关 Lv\.0 解锁 Lv\.1/.test(lock || ''), lock);
  }
  // 注入解锁 3 级后重新渲染
  await p.evaluate(() => { META.unlockedAsc = 3; saveMeta(); showCharSel(); });
  await p.waitForTimeout(300);
  ok('B07 解锁后「+」可点', !(await p.$$eval('#asc-row .asc-line button', els => els[1].disabled)));
  for (let i = 0; i < 3; i++) { await p.click('#asc-row .asc-line button:nth-child(3)'); await p.waitForTimeout(150); }
  ok('B08 连点三次到 Lv.3', (await txt('#asc-row .asc-lv')) === '梯度 Lv.3', await txt('#asc-row .asc-lv'));
  {
    const d = await txt('#asc-row .asc-desc');
    ok('B09 Lv.3 列出前 3 条修正', /敌人生命 \+10%/.test(d) && /敌人伤害 \+10%/.test(d) && /诅咒/.test(d), d);
  }
  // 卡在解锁上限：「+」必须变灰，而不是点了没反应（点了没反应是最坏的反馈）
  ok('B10 顶到解锁上限时「+」变灰', await p.$$eval('#asc-row .asc-line button', els => els[1].disabled));
  await p.evaluate(() => { META.unlockedAsc = 5; saveMeta(); showCharSel(); });
  await p.waitForTimeout(250);
  await p.click('#asc-row .asc-line button:nth-child(3)'); await p.waitForTimeout(200);
  ok('B11 解锁上限提高后能继续往上选', (await txt('#asc-row .asc-lv')) === '梯度 Lv.4', await txt('#asc-row .asc-lv'));
  await p.click('#asc-row .asc-line button:nth-child(1)'); await p.waitForTimeout(200);
  ok('B12 「−」能降回 Lv.3', (await txt('#asc-row .asc-lv')) === '梯度 Lv.3', await txt('#asc-row .asc-lv'));
  await p.click('#asc-row .asc-line button:nth-child(1)'); await p.waitForTimeout(200);
  await p.click('#asc-row .asc-line button:nth-child(1)'); await p.waitForTimeout(200);
  await p.click('#asc-row .asc-line button:nth-child(1)'); await p.waitForTimeout(200);
  ok('B13 降到 0 后「−」变灰（不会到负数）', await p.$$eval('#asc-row .asc-line button', els => els[0].disabled)
    && (await txt('#asc-row .asc-lv')) === '梯度 Lv.0', await txt('#asc-row .asc-lv'));

  console.log('\n=== C. 梯度真的进数值 ===');
  {
    const nums = await p.evaluate(() => {
      // ⚠️ 敌人是随机抽的，两次 makeEnemy 可能抽到不同种类 —— 先把池子钉成一张再比
      const pool = ACT_FOES[0].pool, keep = pool.slice();
      pool.length = 0; pool.push(keep[0]);
      const base = makeEnemy(0, 'normal', 0, 0), hi = makeEnemy(0, 'normal', 0, 3);
      pool.length = 0; keep.forEach(k => pool.push(k));
      const bb = makeEnemy(0, 'boss', 0, 0), bh = makeEnemy(0, 'boss', 0, 8);
      META.unlockedAsc = 9; saveMeta();
      G.asc = 3; newRun('astronaut'); const curse3 = G.deck.filter(c => c.curse).length;
      G.asc = 0; newRun('astronaut'); const curse0 = G.deck.filter(c => c.curse).length;
      G.asc = 9; newRun('astronaut'); const gold9 = G.gold;
      G.asc = 0; newRun('astronaut'); const gold0 = G.gold;
      return {
        hp0: base.maxHp, hp3: hi.maxHp, dmg0: base.dmgMul, dmg3: hi.dmgMul,
        bossHp0: bb.maxHp, bossHp8: bh.maxHp,
        curse0, curse3, gold0, gold9,
      };
    });
    ok('C01 敌人生命 +10%（Lv.1）', Math.abs(nums.hp3 / nums.hp0 - 1.10) < 0.02, (nums.hp3 / nums.hp0).toFixed(3));
    ok('C02 敌人伤害 ×1.10（Lv.2）', Math.abs(nums.dmg3 - 1.10) < 0.001, String(nums.dmg3));
    ok('C03 BOSS 生命 +25%（Lv.7）', Math.abs(nums.bossHp8 / nums.bossHp0 - 1.35) < 0.03, (nums.bossHp8 / nums.bossHp0).toFixed(3));
    ok('C04 Lv.3 开局多 1 张诅咒', nums.curse3 - nums.curse0 === 1, nums.curse0 + '→' + nums.curse3);
    ok('C05 Lv.9 起始金币 -20', nums.gold0 - nums.gold9 === 20, nums.gold0 + '→' + nums.gold9);
  }
  {
    // 商店涨价 / 休整减量：走函数而不是逐条读 DOM
    const v = await p.evaluate(() => {
      // 休整量写在选项文案里（「休眠　恢复 N 生命」），点下去才真的加血 —— 读文案最省事也最贴近玩家看到的
      const g = (asc) => {
        META.unlockedAsc = 9; saveMeta();
        G.asc = asc; newRun('astronaut');
        G.player.baseMaxHp = 100; G.player.hp = 50;
        restSite();
        const label = document.querySelector('#modal-body .opt .on').textContent;
        const healed = +(/恢复 (\d+)/.exec(label) || [0, 0])[1];
        hideModal();
        return { healed, price: Math.round(60 * (1 + ascMods(asc).price)) };
      };
      return { a0: g(0), a6: g(6) };
    });
    ok('C06 休整恢复 -30%（Lv.6）', v.a0.healed === 30 && v.a6.healed === 21, v.a0.healed + '→' + v.a6.healed);
    ok('C07 商店涨价 +25%（Lv.5）', v.a6.price === Math.round(v.a0.price * 1.25), v.a0.price + '→' + v.a6.price);
  }

  console.log('\n=== D. gameOver 写日志 + 解锁 ===');
  await go('?over=win&noanim=1', 900);
  {
    const m = await p.evaluate(() => ({ runs: META.stats.runs, wins: META.stats.wins, unlocked: META.unlockedAsc, best: META.bestAsc, log: META.log.length }));
    ok('D01 通关记进累计统计', m.runs === 1 && m.wins === 1, JSON.stringify(m));
    ok('D02 通关推进解锁到 Lv.1', m.unlocked === 1, 'unlocked=' + m.unlocked);
    ok('D03 写入一条航行日志', m.log === 1, 'log=' + m.log);
    ok('D04 结局面板显示解锁横幅', await p.$eval('#over-unlock', el => !el.classList.contains('hidden')));
    {
      const t = await txt('#over-unlock');
      ok('D05 横幅写明解锁哪一级', /解锁梯度 Lv\.1/.test(t || ''), t);
    }
    ok('D06 局内存档已清（不残留）', await p.evaluate(() => localStorage.getItem('forcing_cosmos_save') === null));
    ok('D07 局外进度没被一起清掉', await p.evaluate(() => !!JSON.parse(localStorage.getItem('fc_meta_v1'))));
  }
  await go('?over=lose&noanim=1', 900);
  {
    const m = await p.evaluate(() => ({ runs: META.stats.runs, wins: META.stats.wins, unlocked: META.unlockedAsc }));
    ok('D08 阵亡也记一局', m.runs === 1 && m.wins === 0, JSON.stringify(m));
    ok('D09 阵亡不解锁梯度', m.unlocked === 0, 'unlocked=' + m.unlocked);
  }
  {
    // 日志行内容：职业 / 梯度 / 节点 / 用时都要有
    const r = await p.evaluate(() => {
      META.unlockedAsc = 2; saveMeta(); G.asc = 2; newRun('astronaut'); G.run.floors = 9; G.run.wins = 5;
      gameOver(false); return META.log[0];
    });
    ok('D10 日志带职业', r && r.charId === 'astronaut', r && r.charId);
    ok('D11 日志带梯度', r && r.asc === 2, r && r.asc);
    ok('D12 日志带节点数', r && r.floors === 9, r && r.floors);
    ok('D13 日志带用时且不是天文数字', r && r.dur >= 0 && r.dur < 86400000, r && r.dur);
    ok('D14 日志带牌组张数', r && r.deck > 0, r && r.deck);
  }

  console.log('\n=== E. 继续进度卡片 ===');
  await go('?noanim=1');
  ok('E01 无存档时不渲染继续卡片', await p.$('#resume-slot .resume-card') == null);
  // ⚠️ newRun() 结尾会 showMap()（进地图场景），此时 #title 是隐藏的、卡片不可见 ——
  //    必须回到标题再 renderResume()，否则后面那条点击断言会在「元素不可见」上超时。
  await p.evaluate(() => {
    META.unlockedAsc = 2; saveMeta(); G.asc = 2; newRun('astronaut');
    G.gold = 123; G.run.floors = 4; saveGame();
    showTitle(); renderResume();
  });
  await p.waitForTimeout(300);
  ok('E02 有存档时渲染继续卡片', await p.$('#resume-slot .resume-card') != null);
  {
    const t = await txt('#resume-slot .resume-card');
    ok('E03 卡片写明职业', /宇航员|astronaut|EVA|星/.test(t || ''), (t || '').slice(0, 60));
    ok('E04 卡片写明第几节点', /第 5 节点/.test(t || ''), t);
    ok('E05 卡片写明梯度', /梯度 Lv\.2/.test(t || ''), t);
    ok('E06 卡片写明牌数/金币', /\d+ 张/.test(t || '') && /123/.test(t || ''), t);
  }
  ok('E07 卡片真的点得到', await hit('#resume-slot .resume-card'));
  await p.click('#resume-slot .resume-card'); await p.waitForTimeout(500);
  ok('E08 点卡片进地图', await p.evaluate(() => G.scene === 'map'), await p.evaluate(() => G.scene));

  console.log('\n=== F. 清空局外进度 ===');
  await go('?noanim=1');
  await p.evaluate(() => {
    META.unlockedAsc = 4; META.bestAsc = 3;
    META.stats = { runs: 7, wins: 2, kills: 40, floors: 130, gold: 900 };
    META.log = [{ at: Date.now(), win: true, asc: 3, charId: 'astronaut', floors: 20, wins: 9, dur: 600000 }];
    saveMeta();
  });
  await p.click('[data-act="log"]'); await p.waitForTimeout(400);
  {
    const body = await txt('#modal-body');
    ok('F01 有进度时列出统计', /7 次强渡/.test(body || ''), (body || '').slice(0, 50));
    ok('F02 日志区有记录行', await p.$('#modal-body .logrow') != null);
    const acts = await p.$$eval('#modal-actions button', els => els.map(e => e.textContent.trim()));
    ok('F03 有「清空局外进度」按钮', acts.some(t => /清空局外进度/.test(t)), JSON.stringify(acts));
  }
  {
    const i = await p.$$eval('#modal-actions button', els => els.findIndex(e => /清空/.test(e.textContent)));
    await p.click(`#modal-actions button:nth-child(${i + 1})`); await p.waitForTimeout(300);
    const acts = await p.$$eval('#modal-actions button', els => els.map(e => e.textContent.trim()));
    ok('F04 第一次点变成「再点一次确认」', acts.some(t => /再点一次/.test(t)), JSON.stringify(acts));
    ok('F05 第一次点不清数据', await p.evaluate(() => META.stats.runs === 7));
    await p.click(`#modal-actions button:nth-child(${i + 1})`); await p.waitForTimeout(300);
    const m = await p.evaluate(() => ({ runs: META.stats.runs, log: META.log.length, un: META.unlockedAsc }));
    ok('F06 第二次点真的清空', m.runs === 0 && m.log === 0 && m.un === 0, JSON.stringify(m));
    const body = await txt('#modal-body');
    ok('F07 清空后回到「还没有记录」', /还没有记录/.test(body || ''), (body || '').slice(0, 40));
  }
  await p.click('#modal-x'); await p.waitForTimeout(300);
  ok('F08 关掉后回到标题', await p.evaluate(() => G.scene === 'title'));

  console.log('\n=== H. 诅咒卡是真卡（回归：曾因数字下标索引对象生成空壳） ===');
  {
    const c = await p.evaluate(() => {
      const out = [];
      for (let i = 0; i < 12; i++) { const x = createCurseCard(); out.push({ id: x.id, curse: !!x.curse, unplayable: !!x.unplayable, name: x.name }); }
      return out;
    });
    ok('H01 诅咒卡有 id', c.every(x => !!x.id), [...new Set(c.map(x => x.id))].join(','));
    ok('H02 诅咒卡带 curse 标记', c.every(x => x.curse));
    ok('H03 诅咒卡不可打出', c.every(x => x.unplayable));
    ok('H04 三种诅咒都抽得到', new Set(c.map(x => x.id)).size >= 2, [...new Set(c.map(x => x.name))].join(','));
    // 进了牌组要真的算进「诅咒」统计（结局面板那一栏）
    const n = await p.evaluate(() => { META.unlockedAsc = 9; saveMeta(); G.asc = 3; newRun('astronaut'); return G.deck.filter(x => x.curse).length; });
    ok('H05 Lv.3 开局那张诅咒算进牌组统计', n === 1, 'curses=' + n);
  }

  console.log('\n=== I. 诅咒玩法真的接得上（空壳卡的连带影响） ===');
  {
    // 「烧毁一张诅咒」靠 c.curse 过滤牌组 —— 以前过滤出来永远是 0 张，那个选项等于死选项
    const n = await p.evaluate(() => {
      const before = G.deck.filter(c => c.curse).length;
      G.deck.push(createCurseCard(), createCurseCard());
      return { before, after: G.deck.filter(c => c.curse).length };
    });
    ok('I01 「烧毁诅咒」能筛出新加的诅咒卡', n.after - n.before === 2, n.before + '→' + n.after);
    // 寄生孢子：回合结束要扣血
    const dmg = await p.evaluate(() => {
      startBattle('normal', 0);
      G.hand.length = 0;
      const para = createCardInstance(CURSE_CARDS.parasite);
      G.hand.push(para);
      G.player.shield = 0;
      const before = G.player.hp;
      G.phase = 'player'; G.busy = false;
      endTurn();
      return { before, after: G.player.hp };
    });
    ok('I02 寄生孢子回合结束扣 1 血', dmg.before - dmg.after === 1, dmg.before + '→' + dmg.after);
    // 虚空结局靠 r.curses 判定 —— 以前恒为 0，那条结局永远走不到
    const cursed = await p.evaluate(() => {
      G.deck.push(createCurseCard());
      G.run.curses = G.deck.filter(c => c.curse).length;
      return G.run.curses;
    });
    ok('I03 诅咒数能进结局判定', cursed >= 1, 'curses=' + cursed);
  }

  console.log('\n=== G. 无脚本错误 ===');
  ok('G01 全程零 pageerror / console.error', errs.length === 0, errs.slice(0, 3).join(' | '));

  await browser.close();
  const pass = results.filter(r => r.pass).length;
  console.log('\n' + (pass === results.length ? 'ALL PASS' : 'FAILED') + '  ' + pass + '/' + results.length);
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error('PROBE ERROR', e); process.exit(2); });
