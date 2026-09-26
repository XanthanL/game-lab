/* 强渡宇宙 · 「文字装进框」回归探针
   起因：敌人意图框「▲3 伤害」戳出右边框 —— 框宽按 label.length * 6 估，
        但这个字体里 CJK / ★▲ 是 12px 宽、ASCII 是 6px，六种意图形态全部短 11px。
        顺着查出状态图标行也坏：数字从框底挂出去 5px，且 3 位数会盖住图标。
   验：① canvas 自绘框 + 框内文字（意图框 / 状态图标行 / 血条数字）文字必须落在框内
       ② 全部场景的 DOM：overflow:hidden 的容器不许把**字墨**裁掉
       ③ 框不许戳出画布边界
       ④ 像素字号必须是 12 的整数倍（静态读 CSS + 运行时读 computedStyle，含 html.coarse 档）
   手法：劫持 CanvasRenderingContext2D 的 fillText / fillRect，录一帧真实绘制调用再对账 ——
        量的是"真的画出来的东西"，不是另写一份估算（另写一份就会和实现一起错）。
   ⚠️ 两个坑（都踩过）：
      ① 绘制是**双描边**（先 #05060d 阴影再彩色主体），同一串文字会录到两条 —— 必须按 fill 去重；
      ② DOM 的 `scrollHeight > clientHeight` **不能**当"被裁"的判据：
         12px 像素字的内容盒（fAsc 14 + fDesc 4 = 18）比 line-height:12px 的行盒高 6px，
         多出来的是**空的降部**，字墨其实落在行盒 [1, 12] 里、一点没切。
         必须按**字墨**算：inkTop = (L - fAsc - fDesc)/2 + fAsc - actualAsc，再看它是否越界。
         本探针 D 组自带一个"故意裁切"的自检用例，证明这个判定不是空转。
   用法：node .probe-overflow.cjs      （需本地 8126 服务，docroot = forcing-cosmos/） */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
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

  /* ---------- 绘制录制器 ----------
     ⚠️ p.goto() 是整页重载，注入会被清掉 —— 必须封成函数、每次导航后重装。
        漏装一次的症状是 `window.__rec is not a function` / 录到空数组。 */
  const installRec = () => p.evaluate(() => {
    const P = CanvasRenderingContext2D.prototype;
    const of = P.fillText, or = P.fillRect;
    window.__rec = null;
    P.fillText = function (t, x, y, ...rest) {
      if (window.__rec) {
        const w = this.measureText(t).width, a = this.textAlign;
        let x0 = x; if (a === 'center') x0 = x - w / 2; else if (a === 'right') x0 = x - w;
        window.__rec.texts.push({ t, x0, x1: x0 + w, y, align: a, font: this.font, fill: String(this.fillStyle) });
      }
      return of.call(this, t, x, y, ...rest);
    };
    P.fillRect = function (x, y, w, h) {
      if (window.__rec) window.__rec.rects.push({ x, y, w, h, fill: String(this.fillStyle) });
      return or.call(this, x, y, w, h);
    };
    // 字墨相对 textBaseline='top' 的 y 的上下偏移（像素扫描实测，不是算出来的）
    window.__ink = { top: -1, bot: 9 };
  });
  await installRec();


  const capBattle = () => p.evaluate(() => {
    window.__rec = { texts: [], rects: [] };
    drawBattle(G, performance.now(), true);
    const r = window.__rec; window.__rec = null;
    // 双描边去重：只留主体（阴影色 #05060d），并把墨迹范围算出来
    const main = r.texts.filter(t => t.fill !== '#05060d' && t.fill !== 'rgb(5, 6, 13)');
    return { rects: r.rects, texts: main };
  });
  const contains = (box, t) => t.x0 >= box.x - 0.5 && t.x1 <= box.x + box.w + 0.5;
  const fitsVert = (box, t) => t.y + window.__inkTop >= box.y - 0.5 && t.y + window.__inkBot <= box.y + box.h + 0.5;

  /* ================= A. 敌人意图框 ================= */
  console.log('\n=== A. 敌人意图框：文字必须落在框内 ===');
  {
    const cases = [
      ['A01 attack 个位', { pattern: 'FIXED', baseDamage: 3 }],
      ['A02 attack 三位', { pattern: 'FIXED', baseDamage: 128 }],
      ['A03 attack 四位', { pattern: 'FIXED', baseDamage: 1500 }],
      ['A04 defend', { pattern: 'ALTERNATING', actions: [{ shield: 12 }, { dmg: 5 }], turnCount: 0 }],
      ['A05 charge', { pattern: 'BOSS_CHARGE', chargeTurns: 3, chargeDamage: 30, currentCharge: 0 }],
      ['A06 charged 致命', { pattern: 'BOSS_CHARGE', chargeTurns: 0, chargeDamage: 1200, currentCharge: 0 }],
    ];
    for (const [id, cfg] of cases) {
      const r = await p.evaluate(async (cfg) => {
        const e = G.enemy;
        Object.assign(e, cfg);
        if (cfg.actions) e.actions = cfg.actions;
        if (cfg.turnCount != null) e.turnCount = cfg.turnCount;
        e.dmgMul = 1;
        const it = e.getIntent();
        const label = intentLabel(e, it);
        const rec = (() => {
          window.__rec = { texts: [], rects: [] };
          drawBattle(G, performance.now(), true);
          const x = window.__rec; window.__rec = null; return x;
        })();
        // 意图框底：全项目只有意图框用 rgba(5,6,13,.8) + 高 16
        const box = rec.rects.find(q => /rgba\(5, 6, 13/.test(q.fill) && q.h === 16);
        const texts = rec.texts.filter(q => q.t === label && q.fill !== '#05060d');
        return { itType: it.type, label, box, texts, L: intentLayout(e, LAY.ex, LAY.intentY) };
      }, cfg);
      const boxOk = !!r.box;
      const inX = boxOk && r.texts.length === 1 && contains(r.box, r.texts[0]);
      const inY = boxOk && r.texts.length === 1
        && r.texts[0].y - 1 >= r.box.y - 0.5 && r.texts[0].y + 9 <= r.box.y + r.box.h + 0.5;
      const ov = (boxOk && r.texts.length) ? Math.round((r.texts[0].x1 - (r.box.x + r.box.w)) * 10) / 10 : '?';
      ok(id + ' 「' + r.label + '」装得下', boxOk && inX && inY,
        '文字 ' + (r.texts[0] ? Math.round(r.texts[0].x0) + '..' + Math.round(r.texts[0].x1) : '?')
        + ' 框 ' + (r.box ? Math.round(r.box.x) + '..' + Math.round(r.box.x + r.box.w) : '?')
        + ' 横向溢出=' + ov);
      ok(id + 'b 文字不与左侧图标重叠', boxOk && r.texts.length === 1 && r.texts[0].x0 >= r.box.x + 10,
        r.texts[0] ? '文字左=' + Math.round(r.texts[0].x0) + ' 框左=' + Math.round(r.box.x) : '?');
    }
    {
      const r = await p.evaluate(() => {
        const e = G.enemy; e.pattern = 'FIXED'; e.baseDamage = 1500; e.dmgMul = 1;
        window.__rec = { texts: [], rects: [] };
        drawBattle(G, performance.now(), true);
        const x = window.__rec; window.__rec = null; return x;
      });
      const box = r.rects.find(q => /rgba\(5, 6, 13/.test(q.fill) && q.h === 16);
      ok('A07 意图框不戳出 640 宽画布', box && box.x >= 0 && box.x + box.w <= 640,
        box ? 'x=' + Math.round(box.x) + ' 右边=' + Math.round(box.x + box.w) : 'no box');
    }
  }

  /* ================= B. 状态图标行 ================= */
  console.log('\n=== B. 状态图标行：数字要落在框内、不盖图标、不压下一行 ===');
  {
    const r = await p.evaluate(() => {
      const pl = G.player;
      pl.status.burn = 999; pl.status.poison = 12; pl.status.vulnerable = 1;
      pl.status.strength = 0; pl.status.weak = 0; pl.status.thorns = 0;
      window.__rec = { texts: [], rects: [] };
      drawBattle(G, performance.now(), true);
      const x = window.__rec; window.__rec = null;
      const boxes = x.rects.filter(q => (q.fill === '#0e1022' || q.fill === 'rgb(14, 16, 34)') && q.h === 14)
        .sort((a, b) => a.x - b.x);
      const nums = x.texts.filter(q => /^\d+$/.test(q.t) && q.fill !== '#05060d' && q.y > LAY.barY + 5 && q.y < LAY.barY + 30)
        .sort((a, b) => a.x0 - b.x0);
      return { boxes, nums, battY: LAY.barY + 32, ICON_W: 6 };
    });
    ok('B01 三个状态各画一个框', r.boxes.length === 3, r.boxes.length + ' 个');
    ok('B02 每个框里恰有一个数字（双描边已去重）', r.nums.length === 3, r.nums.length + ' 个');
    let inX = true, inY = true, clearIcon = true, detail = [];
    for (let i = 0; i < Math.min(r.boxes.length, r.nums.length); i++) {
      const b = r.boxes[i], t = r.nums[i];
      if (!contains(b, t)) inX = false;
      if (t.y - 1 < b.y - 0.5 || t.y + 9 > b.y + b.h + 0.5) inY = false;
      if (t.x0 < b.x + 2 + r.ICON_W) clearIcon = false;
      detail.push('[' + t.t + '] 框' + Math.round(b.x) + '..' + Math.round(b.x + b.w) + ' 字' + Math.round(t.x0) + '..' + Math.round(t.x1));
    }
    ok('B03 数字横向装得进状态框', inX, detail.join(' | '));
    ok('B04 ⚠️ 数字纵向装得进状态框（不再从框底挂出去）', inY, detail.join(' | '));
    ok('B05 ⚠️ 数字不盖住状态图标', clearIcon, detail.join(' | '));
    // 状态行不能压到下面的电量格
    const maxBot = Math.max(...r.boxes.map(b => b.y + b.h));
    ok('B06 状态行不压电量格', maxBot <= r.battY, '状态行底=' + maxBot + ' 电量格顶=' + r.battY);
    // 满状态时不能顶到敌人区
    const wide = await p.evaluate(() => {
      const pl = G.player;
      for (const k in STATUS_INFO) pl.status[k] = 999;
      window.__rec = { texts: [], rects: [] };
      drawBattle(G, performance.now(), true);
      const x = window.__rec; window.__rec = null;
      const boxes = x.rects.filter(q => (q.fill === '#0e1022' || q.fill === 'rgb(14, 16, 34)') && q.h === 14);
      return { right: Math.max(...boxes.map(b => b.x + b.w)), n: boxes.length, eBarX: LAY.eBarX };
    });
    ok('B07 六个满层状态也不越过敌人血条左边界', wide.right < wide.eBarX, '最右=' + Math.round(wide.right) + ' 敌人条左=' + wide.eBarX);
  }

  /* ================= C. 血条数字 ================= */
  console.log('\n=== C. 血条：cur/max 装得进条内 ===');
  {
    const r = await p.evaluate(() => {
      G.player.baseMaxHp = 9999; G.player.hp = 9999;
      G.enemy.baseMaxHp = 9999; G.enemy.hp = 1234;
      G.player.status.burn = 0; G.player.status.poison = 0; G.player.status.vulnerable = 0;
      window.__rec = { texts: [], rects: [] };
      drawBattle(G, performance.now(), true);
      const x = window.__rec; window.__rec = null;
      const bars = x.rects.filter(q => (q.fill === '#29366f' || q.fill === 'rgb(41, 54, 111)') && q.h === LAY.barH).sort((a, b) => a.x - b.x);
      const texts = x.texts.filter(q => /^\d+\/\d+$/.test(q.t) && q.fill !== '#05060d').sort((a, b) => a.x0 - b.x0);
      return { bars, texts };
    });
    ok('C01 两条血条都画了', r.bars.length === 2, r.bars.length);
    ok('C02 两条血条各有一个数字', r.texts.length === 2, r.texts.length);
    let bad = [];
    for (let i = 0; i < r.bars.length; i++) {
      const b = r.bars[i], t = r.texts[i];
      if (!t || !contains(b, t) || t.y - 1 < b.y - 0.5 || t.y + 9 > b.y + b.h + 0.5) bad.push(t ? t.t : '?');
    }
    ok('C03 ⚠️ 9999/9999 与 1234/9999 都装得进血条', bad.length === 0, bad.join(','));
  }

  /* ================= D. DOM 溢出扫描（全场景） ================= */
  console.log('\n=== D. 全场景 DOM：overflow:hidden 的容器不许裁掉字墨 ===');
  {
    /* 页面内注入「按字墨判裁切」的扫描器。
       ⚠️ 每次 p.goto() 都是整页重载，注入的东西会被清掉 —— 所以封成函数、每次导航后重装。
          漏装一次的症状是 `window.__scanClip is not a function`。 */
    const install = () => p.evaluate(() => {
      window.__scanClip = () => {
        const cv = document.createElement('canvas').getContext('2d');
        const bad = [];
        const hasScroller = el => [...el.querySelectorAll('*')].some(d => {
          const c = getComputedStyle(d);
          return /auto|scroll/.test(c.overflowY) || /auto|scroll/.test(c.overflowX);
        });
        document.querySelectorAll('#wrap *').forEach(el => {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          const hidX = cs.overflowX === 'hidden', hidY = cs.overflowY === 'hidden';
          if (!hidX && !hidY) return;
          // 只查「自己直接装字」的元素。容器型的 overflow:hidden（.panel / #wrap / html）
          // 是**包含性裁剪**（圆角/防溢出），真正的滚动交给内部的 #modal-body ——
          // 把它们的后代文字也算进来会满屏误报。
          const texts = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
          if (!texts.length) return;
          if (hasScroller(el)) return;
          const direct = texts.map(n => n.textContent).join('').trim();
          // 横向：scrollWidth 就是内联内容的推进宽度，超了就是真的被切
          const dx = hidX ? el.scrollWidth - el.clientWidth : 0;
          // 纵向：必须按**字墨**算，不能拿内容盒当判据（多出来的是空的降部）
          let dy = 0;
          if (hidY) {
            const L = parseFloat(cs.lineHeight);
            if (Number.isFinite(L) && L > 0) {
              cv.font = cs.fontSize + ' FP, monospace';
              const m = cv.measureText(direct.slice(0, 40));
              const half = (L - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2;
              const inkTop = half + m.fontBoundingBoxAscent - m.actualBoundingBoxAscent;
              const inkBot = half + m.fontBoundingBoxAscent + m.actualBoundingBoxDescent;
              // ⚠️ 行数必须用 Range 的真实行盒数。拿 `scrollHeight / lineHeight` 猜会被
              //    **弹性盒子**坑死：`.ds{flex:1}` 的 scrollHeight 至少等于 clientHeight，
              //    单行描述会被算成 3 行 → 假 FAIL。
              let lines = 0;
              for (const n of texts) {
                const rr = document.createRange(); rr.selectNodeContents(n);
                lines += Math.max(1, [...rr.getClientRects()].length);
              }
              const h = el.clientHeight;
              if (inkTop < -0.5) dy = Math.max(dy, -inkTop);
              const over = inkBot + (Math.max(1, lines) - 1) * L - h;
              if (over > 0.5) dy = Math.max(dy, over);
            }
          }
          if (dx > 1 || dy > 0.5) {
            bad.push({
              sel: el.id ? '#' + el.id : el.className ? '.' + String(el.className).split(' ')[0] : el.tagName.toLowerCase(),
              x: Math.round(dx), y: Math.round(dy * 10) / 10,
              txt: direct.replace(/\s+/g, ' ').slice(0, 26),
            });
          }
        });
        return bad;
      };
    });

    // 自检：故意造两个被裁的元素，判定必须抓到（证明 D 组不是空转）
    {
      await install();
      const self = await p.evaluate(() => {
        const host = document.createElement('div');
        host.id = '__selftest';
        host.style.cssText = 'position:absolute;left:0;top:0;width:100px';
        host.innerHTML =
          '<div id="__stX" style="width:20px;overflow:hidden;white-space:nowrap">攻击攻击攻击</div>'
          + '<div id="__stY" style="width:100px;height:6px;overflow:hidden;line-height:12px">攻击</div>';
        document.getElementById('wrap').appendChild(host);
        const hit = window.__scanClip().filter(b => b.sel === '#__stX' || b.sel === '#__stY');
        host.remove();
        return hit.map(b => b.sel + '(x' + b.x + '/y' + b.y + ')');
      });
      ok('D00 自检：故意裁切的元素确实被抓到', self.length === 2, self.join(' '));
    }

    const SCENES = [
      ['title', '?noanim=1'],
      ['story', '?noanim=1'],
      ['help', '?noanim=1'],
      ['charsel', '?charsel=1&noanim=1'],
      ['map', '?map=1&noanim=1'],
      ['battle', '?auto=1&noanim=1'],
      ['battle-boss', '?auto=1&boss=1&act=2&noanim=1'],
      ['reward', '?reward=1&noanim=1'],
      ['shop', '?shop=1&noanim=1'],
      ['rest', '?rest=1&noanim=1'],
      ['event', '?event=1&noanim=1'],
      ['over-win', '?over=win&noanim=1'],
      ['over-end', '?over=end&noanim=1'],
    ];
    const fmt = b => b.sel + '(x' + b.x + '/y' + b.y + ')' + (b.txt ? ' 「' + b.txt + '」' : '');
    let total = 0;
    for (const [name, q] of SCENES) {
      await p.goto(BASE + q, { waitUntil: 'load' });
      await p.waitForTimeout(1400);
      await install();
      // 大牌组 / 长名字 / 满遗物 这类极端输入也扫一遍
      if (name === 'battle') {
        await p.evaluate(() => {
          while (G.deck.length < 40) G.deck.push(createCardInstance(CARD_DEFS.singularityCollapse));
          G.gold = 99999; G.player.baseMaxHp = 9999; G.player.hp = 9999;
          G.player.status.burn = 999; G.player.status.poison = 99;
          G.player.baseBattery = 9; G.player.battery = 9;
          for (const id of RELIC_IDS) G.player.addRelic(id);
          updateHud();
        });
        await p.waitForTimeout(300);
      }
      const bad = await p.evaluate(() => window.__scanClip());
      total += bad.length;
      ok('D ' + name + ' 无字墨被裁', bad.length === 0, bad.map(fmt).join('  '));
    }
    // 弹窗类：全在战斗场景里点开
    await p.goto(BASE + '?auto=1&noanim=1', { waitUntil: 'load' });
    await p.waitForTimeout(1400);
    await install();
    const MODALS = [
      ['牌组弹窗', async () => { await p.click('#btn-deck'); }],
      ['抽牌堆', async () => { await p.click('#modal-x').catch(() => {}); await p.waitForTimeout(250); await p.click('[data-pile="draw"]'); }],
      ['弃牌堆', async () => { await p.click('#modal-x').catch(() => {}); await p.waitForTimeout(250); await p.click('[data-pile="discard"]'); }],
      ['消耗堆', async () => { await p.click('#modal-x').catch(() => {}); await p.waitForTimeout(250); await p.click('[data-pile="exhaust"]'); }],
      ['暂停面板', async () => { await p.click('#modal-x').catch(() => {}); await p.waitForTimeout(250); await p.keyboard.press('Escape'); }],
      ['伤害预测', async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(250);
        await p.evaluate(() => { showDmgPreview(G.hand.find(c => cardDealsDamage(c)) || G.hand[0]); }); }],
    ];
    for (const [mname, fn] of MODALS) {
      await fn();
      await p.waitForTimeout(450);
      const b2 = await p.evaluate(() => window.__scanClip());
      total += b2.length;
      ok('D battle·' + mname + ' 无字墨被裁', b2.length === 0, b2.map(fmt).join('  '));
    }
    // 航行日志在标题页
    await p.goto(BASE + '?noanim=1', { waitUntil: 'load' });
    await p.waitForTimeout(1400);
    await install();
    await p.click('[data-act="log"]');
    await p.waitForTimeout(500);
    {
      const b3 = await p.evaluate(() => window.__scanClip());
      total += b3.length;
      ok('D title·航行日志 无字墨被裁', b3.length === 0, b3.map(fmt).join('  '));
    }
    console.log('  —— 全场景被裁容器总数：' + total);
  }

  /* ================= E. 像素字号必须是 12 的整数倍 ================= */
  console.log('\n=== E. 像素字号必须是 12 的整数倍（像素字体铁律） ===');
  {
    /* 字体 FP = Fusion Pixel 12，只有 12px 一档。非整数倍缩放会把笔画劈成不等宽 ——
       实测（像素扫描）：.tb-pause 14px →「II」两条竖笔画 30/29；
                        #dmg-preview 11px →「伤」字笔画断开。
       两道守卫：① 静态读 style.css 的 font-size / font: 声明（覆盖永不激活的规则）
                ② 运行时读 computedStyle（证明规则真的落到元素上，含 html.coarse 档） */
    const isMult12 = v => Math.abs(v / 12 - Math.round(v / 12)) < 1e-6;

    // ① 静态：直接读磁盘上的 CSS
    const css = fs.readFileSync(__dirname + '/style.css', 'utf8');
    const decls = [];
    for (const m of css.matchAll(/(?:^|[;{\s])font-size\s*:\s*([\d.]+)px/g)) decls.push(['font-size', +m[1]]);
    // font: 12px/16px FP, monospace 这种简写；font: inherit 不匹配（没有 px）。
    // ⚠️ 不能写成 /font\s*:/ 然后放宽 —— font-family / font-display / -webkit-font-smoothing 都会误匹配。
    for (const m of css.matchAll(/(?:^|[;{\s])font\s*:\s*(?:[\w-]+\s+)?([\d.]+)px/g)) decls.push(['font', +m[1]]);
    const badDecl = decls.filter(d => !isMult12(d[1]));
    ok('E01 静态：style.css 里字号声明全是 12 的整数倍', badDecl.length === 0 && decls.length >= 6,
      badDecl.map(d => d[0] + ':' + d[1] + 'px').join(' ') + '  （共扫到 ' + decls.length + ' 条声明）');

    // ② 运行时：默认档 + 触屏档
    // ⚠️ 只查**真正用像素字体**的元素（computedStyle.fontFamily 含 FP）。
    //    html / body / head / meta / script 继承的是浏览器默认 16px —— 它们跟像素 UI 无关，
    //    不滤掉就是 7 条假 FAIL。
    const installFontScan = () => p.evaluate(() => {
      window.__scanFont = () => {
        const bad = [];
        document.querySelectorAll('*').forEach(el => {
          const cs = getComputedStyle(el);
          if (!/FP/.test(cs.fontFamily)) return;
          const fs = parseFloat(cs.fontSize);
          if (!Number.isFinite(fs) || fs <= 0) return;
          if (Math.abs(fs / 12 - Math.round(fs / 12)) < 1e-6) return;
          bad.push((el.id ? '#' + el.id : el.className ? '.' + String(el.className).split(' ')[0] : el.tagName.toLowerCase())
            + '=' + cs.fontSize);
        });
        return [...new Set(bad)];
      };
    });
    await p.goto(BASE + '?auto=1&noanim=1', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await installFontScan();
    const badDom = await p.evaluate(() => window.__scanFont());
    ok('E02 运行时（默认档）字号全是 12 的整数倍', badDom.length === 0, badDom.join(' '));

    // 触屏档：html.coarse 会改一批尺寸 + 字号（.tb-pause 就藏在这里），必须单独扫
    const badCoarse = await p.evaluate(() => {
      document.documentElement.classList.add('coarse', 'canpause');
      // 顺带证明触屏暂停键真的可见（否则 E03 是在扫一个不存在的元素）
      const tp = document.querySelector('.tb-pause');
      const r = tp && tp.getBoundingClientRect();
      return { bad: window.__scanFont(),
        tpVisible: !!tp && getComputedStyle(tp).display !== 'none',
        tpFont: tp ? getComputedStyle(tp).fontSize : null,
        tpBox: r ? Math.round(r.width) + 'x' + Math.round(r.height) : null };
    });
    ok('E03 运行时（触屏 coarse 档）字号全是 12 的整数倍', badCoarse.bad.length === 0,
      badCoarse.bad.join(' ') + '  .tb-pause=' + badCoarse.tpFont + ' (' + badCoarse.tpBox + ')');
    ok('E04 触屏暂停键在 coarse 档下确实可见（证明 E03 不是空转）', badCoarse.tpVisible && badCoarse.tpFont === '24px',
      'font=' + badCoarse.tpFont);

    // ③ canvas 侧：录制一帧，检查所有用过的 font 串
    await p.goto(BASE + '?auto=1&noanim=1', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await installRec();
    const fonts = await p.evaluate(() => {
      window.__rec = { texts: [], rects: [] };
      drawBattle(G, performance.now(), true);
      const x = window.__rec; window.__rec = null;
      return [...new Set(x.texts.map(t => t.font))];
    });
    const badFont = fonts.filter(f => { const m = /(\d+(?:\.\d+)?)px/.exec(f); return !m || !isMult12(+m[1]); });
    ok('E05 canvas 绘制用过的字号全是 12 的整数倍', fonts.length > 0 && badFont.length === 0,
      badFont.join(' ') + '  全部：' + fonts.join(' , '));
  }

  /* ================= F. 无脚本错误 ================= */
  console.log('\n=== F. 无脚本错误 ===');
  ok('F01 全程零 pageerror / console.error', errs.length === 0, errs.slice(0, 3).join(' | '));

  await browser.close();
  const pass = results.filter(r => r.pass).length;
  console.log('\n' + (pass === results.length ? 'ALL PASS' : 'FAILED') + '  ' + pass + '/' + results.length);
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error('PROBE ERROR', e); process.exit(2); });
