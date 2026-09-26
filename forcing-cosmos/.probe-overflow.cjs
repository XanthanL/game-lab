/* 强渡宇宙 · 「文字装进框」回归探针
   起因：敌人意图框「▲3 伤害」戳出右边框 —— 框宽是按 label.length * 6 估的，
        但这个字体里 CJK / ★▲ 是 12px 宽、ASCII 是 6px，每个意图框都短了整整一个字。
   验：① canvas 上所有"自绘框 + 框内文字"（意图框 / 状态图标行 / 血条数字）文字必须落在框内
       ② 全部场景的 DOM：凡是 overflow:hidden 的容器，不许有内容被裁掉
       ③ 框不许戳出画布边界
   手法：劫持 CanvasRenderingContext2D 的 fillText / fillRect，录一帧真实绘制调用再对账 ——
        量的是"真的画出来的东西"，不是另写一份估算（另写一份就会和实现一起错）。
   用法：node .probe-overflow.cjs      （需本地 8126 服务，docroot = forcing-cosmos/） */
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

  /* ---------- 绘制录制器 ---------- */
  await p.evaluate(() => {
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
  });

  /* 录一帧战场绘制 */
  const capBattle = () => p.evaluate(() => {
    window.__rec = { texts: [], rects: [] };
    drawBattle(G, performance.now(), true);
    const r = window.__rec; window.__rec = null;
    return r;
  });
  const near = (a, b, eps = 1) => Math.abs(a - b) <= eps;
  const contains = (box, t) => t.x0 >= box.x - 0.5 && t.x1 <= box.x + box.w + 0.5;

  /* ================= A. 敌人意图框 ================= */
  console.log('\n=== A. 敌人意图框：文字必须落在框内 ===');
  {
    const cases = [
      { id: 'A01 attack 个位', pattern: 'FIXED', baseDamage: 3, kind: 'attack' },
      { id: 'A02 attack 三位', pattern: 'FIXED', baseDamage: 128, kind: 'attack' },
      { id: 'A03 attack 四位', pattern: 'FIXED', baseDamage: 1500, kind: 'attack' },
      { id: 'A04 defend', pattern: 'ALTERNATING', actions: [{ shield: 12 }, { dmg: 5 }], kind: 'defend' },
      { id: 'A05 charge', pattern: 'BOSS_CHARGE', chargeTurns: 3, chargeDamage: 30, kind: 'charge' },
      { id: 'A06 charged 致命', pattern: 'BOSS_CHARGE', chargeTurns: 0, chargeDamage: 1200, kind: 'charged' },
    ];
    for (const c of cases) {
      const r = await p.evaluate(async (c) => {
        const e = G.enemy;
        e.pattern = c.pattern;
        if (c.actions) e.actions = c.actions;
        if (c.baseDamage != null) e.baseDamage = c.baseDamage;
        if (c.chargeTurns != null) e.chargeTurns = c.chargeTurns;
        if (c.chargeDamage != null) { e.chargeDamage = c.chargeDamage; e.chargeDamageNow = c.chargeDamage; }
        e.currentCharge = c.pattern === 'BOSS_CHARGE' ? 0 : e.currentCharge;
        e.dmgMul = 1;
        // charge 形态：getIntent 在 currentCharge < chargeTurns 时返回 charge
        const it = e.getIntent();
        const label = it.type === 'defend' ? '防御 ' + it.value
          : it.type === 'charge' ? '蓄能 ' + it.left + '/' + e.chargeTurns
            : it.type === 'charged' ? '致命 ' + it.value
              : it.value + ' 伤害';
        const rec = await (async () => {
          window.__rec = { texts: [], rects: [] };
          drawBattle(G, performance.now(), true);
          const x = window.__rec; window.__rec = null; return x;
        })();
        // 意图框底：fill = rgba(5, 6, 13, .8) 且高 16（全项目只有意图框用这个色）
        const box = rec.rects.find(q => /rgba\(5, 6, 13/.test(q.fill) && q.h === 16);
        const texts = rec.texts.filter(q => q.t === label);
        return { itType: it.type, label, box, texts, intentY: LAY.intentY, ex: LAY.ex };
      }, c);
      const boxOk = !!r.box;
      const inside = boxOk && r.texts.length > 0 && r.texts.every(t => contains(r.box, t));
      const widest = r.texts.length ? Math.max(...r.texts.map(t => Math.round((t.x1 - t.x0) * 10) / 10)) : 0;
      ok(c.id + ' 「' + r.label + '」装得下', boxOk && inside,
        '文字宽=' + widest + ' 框宽=' + (r.box ? r.box.w : '?') + ' 溢出=' + (boxOk && r.texts.length ? Math.round((Math.max(...r.texts.map(t => t.x1)) - (r.box.x + r.box.w)) * 10) / 10 : '?'));
    }
    // 框不能戳出画布
    {
      const r = await p.evaluate(async () => {
        const e = G.enemy;
        e.pattern = 'FIXED'; e.baseDamage = 1500; e.dmgMul = 1;
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
  console.log('\n=== B. 状态图标行：数字不能盖住图标、不能戳出框 ===');
  {
    const r = await p.evaluate(async () => {
      const pl = G.player;
      pl.status.burn = 1; pl.status.poison = 12; pl.status.vulnerable = 999;
      pl.status.strength = 0; pl.status.weak = 0; pl.status.thorns = 0;
      window.__rec = { texts: [], rects: [] };
      drawBattle(G, performance.now(), true);
      const x = window.__rec; window.__rec = null;
      // 状态框底：fill = #0e1022 且 14x14（全项目只有状态行用这个色）
      const boxes = x.rects.filter(q => q.fill === 'rgb(14, 16, 34)' && q.w === 14 && q.h === 14)
        .sort((a, b) => a.x - b.x);
      const texts = x.texts.filter(q => /^\d+$/.test(q.t) && q.y > LAY.barY + 10 && q.y < LAY.barY + 30)
        .sort((a, b) => a.x0 - b.x0);
      return {
        boxes, texts,
        ICON_W: 6,
      };
    });
    ok('B01 三个状态各画一个框', r.boxes.length === 3, r.boxes.length + ' 个');
    ok('B02 每个框里都有数字', r.texts.length === 3, r.texts.length + ' 个数字');
    let allIn = true, allClear = true, detail = [];
    for (let i = 0; i < Math.min(r.boxes.length, r.texts.length); i++) {
      const b = r.boxes[i], t = r.texts[i];
      if (!contains(b, t)) allIn = false;
      // 数字左边界必须让开图标区（图标画在框内 x+1..x+1+ICON_W）
      if (t.x0 < b.x + 1 + r.ICON_W) allClear = false;
      detail.push('[' + t.t + '] 框' + Math.round(b.x) + '..' + Math.round(b.x + b.w) + ' 字' + Math.round(t.x0) + '..' + Math.round(t.x1));
    }
    ok('B03 数字装得进状态框', allIn, detail.join(' | '));
    ok('B04 ⚠️ 数字不盖住状态图标', allClear, detail.join(' | '));
  }

  /* ================= C. 血条数字 ================= */
  console.log('\n=== C. 血条：cur/max 装得进条内 ===');
  {
    const r = await p.evaluate(async () => {
      G.player.baseMaxHp = 9999; G.player.hp = 9999;
      G.enemy.baseMaxHp = 9999; G.enemy.hp = 1234;
      window.__rec = { texts: [], rects: [] };
      drawBattle(G, performance.now(), true);
      const x = window.__rec; window.__rec = null;
      const bars = x.rects.filter(q => q.fill === 'rgb(41, 54, 111)' && q.h === LAY.barH).sort((a, b) => a.x - b.x);
      const texts = x.texts.filter(q => /^\d+\/\d+$/.test(q.t)).sort((a, b) => a.x0 - b.x0);
      return { bars, texts };
    });
    ok('C01 两条血条都画了', r.bars.length === 2, r.bars.length);
    let bad = [];
    for (let i = 0; i < r.bars.length; i++) {
      const b = r.bars[i], t = r.texts[i];
      if (!t || !contains(b, t)) bad.push((t ? t.t : '?'));
    }
    ok('C02 ⚠️ 9999/9999 与 1234/9999 都装得进血条', bad.length === 0, bad.join(','));
  }

  /* ================= D. DOM 溢出扫描（全场景） ================= */
  console.log('\n=== D. 全场景 DOM：overflow:hidden 的容器不许裁掉内容 ===');
  {
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
    const scan = () => p.evaluate(() => {
      const bad = [];
      document.querySelectorAll('#wrap *').forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const clippedX = (cs.overflowX === 'hidden') && el.scrollWidth > el.clientWidth + 1;
        const clippedY = (cs.overflowY === 'hidden') && el.scrollHeight > el.clientHeight + 1;
        if (clippedX || clippedY) {
          bad.push({
            sel: el.id ? '#' + el.id : el.className ? '.' + String(el.className).split(' ')[0] : el.tagName.toLowerCase(),
            x: clippedX ? el.scrollWidth - el.clientWidth : 0,
            y: clippedY ? el.scrollHeight - el.clientHeight : 0,
            txt: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 28),
          });
        }
      });
      return bad;
    });
    const extra = [
      ['牌组弹窗', async () => { await p.click('#btn-deck'); await p.waitForTimeout(400); }],
      ['抽牌堆弹窗', async () => { await p.click('#modal-x').catch(() => {}); await p.waitForTimeout(200); await p.click('[data-pile="draw"]'); await p.waitForTimeout(400); }],
      ['弃牌堆弹窗', async () => { await p.click('#modal-x').catch(() => {}); await p.waitForTimeout(200); await p.click('[data-pile="discard"]'); await p.waitForTimeout(400); }],
      ['消耗堆弹窗', async () => { await p.click('#modal-x').catch(() => {}); await p.waitForTimeout(200); await p.click('[data-pile="exhaust"]'); await p.waitForTimeout(400); }],
      ['航行日志', async () => { await p.click('#modal-x').catch(() => {}); await p.waitForTimeout(200); await p.click('[data-act="log"]'); await p.waitForTimeout(400); }],
      ['暂停面板', async () => { await p.click('#modal-x').catch(() => {}); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(400); }],
    ];
    let total = 0;
    for (const [name, q] of SCENES) {
      await p.goto(BASE + q, { waitUntil: 'load' });
      await p.waitForTimeout(1400);
      const bad = await scan();
      total += bad.length;
      ok('D ' + name + ' 无内容被裁', bad.length === 0, bad.map(b => b.sel + '(x' + b.x + '/y' + b.y + ')' + (b.txt ? ' 「' + b.txt + '」' : '')).join('  '));
      // 战斗场景再扫一遍所有弹窗
      if (name === 'battle') {
        for (const [mname, fn] of extra) {
          await fn();
          const b2 = await scan();
          total += b2.length;
          ok('D battle·' + mname + ' 无内容被裁', b2.length === 0,
            b2.map(x => x.sel + '(x' + x.x + '/y' + x.y + ')' + (x.txt ? ' 「' + x.txt + '」' : '')).join('  '));
        }
      }
    }
    console.log('  —— 全场景被裁容器总数：' + total);
  }

  /* ================= E. 无脚本错误 ================= */
  console.log('\n=== E. 无脚本错误 ===');
  ok('E01 全程零 pageerror / console.error', errs.length === 0, errs.slice(0, 3).join(' | '));

  await browser.close();
  const pass = results.filter(r => r.pass).length;
  console.log('\n' + (pass === results.length ? 'ALL PASS' : 'FAILED') + '  ' + pass + '/' + results.length);
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error('PROBE ERROR', e); process.exit(2); });
