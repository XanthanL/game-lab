/* 手机端端到端探针（永久保留）
   竖屏 390x844 / 横屏 844x390，isMobile + hasTouch + dsf 2，全部用**真实触摸**。
   ⚠️ 只用 element.click() 是抓不到遮挡类 bug 的（程序化点击绕过命中测试）。
      这里每次点之前都先用 elementFromPoint 确认「手指落点上的确实是它」。
   覆盖：
     A 竖屏自动转 90° 且铺满屏幕；横屏正常居中；提示文案按输入方式切换
     B 地图节点有效命中区（含 CSS ::before 扩出来的部分）≥ 40px
     C 暂停键只在 battle/map 出现
     D 真触摸走完一整幕：战斗→战后整理→地图→…→BOSS→幕终，地图上永不出现零可点节点 */
'use strict';
const { chromium } = require('playwright-core');
const CHROME = 'C:/Users/www27/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
// 默认打本地；验线上就 PROBE_BASE=https://xanthanl.github.io/game-lab/forcing-cosmos/index.html
const BASE = process.env.PROBE_BASE || 'http://127.0.0.1:8126/index.html';
const SHOTS = 'E:/Code/game-lab/forcing-cosmos/.shots/';

let fail = 0;
const chk = (ok, label, extra) => { console.log((ok ? '  ✓ ' : '  ✗ ') + label + (extra ? '  ' + extra : '')); if (!ok) fail++; };

/* 求元素矩形 + 命中校验，返回中心坐标。
   ⚠️ 必须传「函数」而不是字符串：Playwright 收到字符串会当表达式求值，第二个参数根本传不进去。 */
const probeEl = (src) => {
  const el = (new Function('return (' + src + ')'))();
  if (!el) return { r: 'missing' };
  const b = el.getBoundingClientRect();
  if (b.width < 1 || b.height < 1) return { r: 'hidden' };
  const x = Math.round(b.left + b.width / 2), y = Math.round(b.top + b.height / 2);
  const hit = document.elementFromPoint(x, y);
  const ok = !!hit && (hit === el || el.contains(hit));
  return { r: ok ? 'ok' : 'blocked', x, y, w: Math.round(b.width), h: Math.round(b.height),
           hit: hit ? (hit.id || hit.className || hit.tagName) : 'null' };
};

const SCENE = () => ({
  scene: G.scene,
  open: !document.getElementById('modal').classList.contains('hidden'),
  title: document.getElementById('modal-title').textContent,
  opts: [...document.querySelectorAll('#modal-body .opt')].map(d => d.textContent.trim()),
  acts: [...document.querySelectorAll('#modal-actions .btn')].map(b => b.textContent.trim()),
  cards: document.querySelectorAll('#modal-body .card').length,
  reach: [...document.querySelectorAll('.mnode')].filter(d => d.classList.contains('reach') && !d.classList.contains('visited')).length,
});

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-proxy-server', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  for (const [label, vp, wantPortrait] of [['竖屏 390x844', { width: 390, height: 844 }, true], ['横屏 844x390', { width: 844, height: 390 }, false]]) {
    console.log('\n===== ' + label + ' =====');
    const tag = wantPortrait ? 'port' : 'land';
    const ctx = await b.newContext({ viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push('page: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    const go = async q => { await p.goto(BASE + q, { waitUntil: 'load' }); await p.waitForTimeout(1500); };

    const tapExpr = async (expr, what) => {
      const r = await p.evaluate(probeEl, expr);
      if (r.r !== 'ok') { console.log('    ! ' + what + ' → ' + r.r + (r.hit ? ' 落点上是 <' + r.hit + '>' : '') + ' (' + expr + ')'); return r.r; }
      await p.touchscreen.tap(r.x, r.y);
      return 'ok';
    };

    /* ---------- A 标题页布局 ---------- */
    await go('?noanim=1');
    const lay = await p.evaluate(() => {
      const r = document.getElementById('wrap').getBoundingClientRect();
      return {
        vw: window.innerWidth, vh: window.innerHeight,
        portrait: document.documentElement.classList.contains('portrait'),
        coarse: document.documentElement.classList.contains('coarse'),
        wrap: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
        tf: document.getElementById('wrap').style.transform,
        rotHint: document.getElementById('rot').classList.contains('show'),
        hint: document.getElementById('ctrl-hint').textContent,
        enter: document.getElementById('enter-hint').textContent,
        touch: getComputedStyle(document.getElementById('touch')).display,
      };
    });
    console.log('  布局:', JSON.stringify(lay));
    chk(lay.coarse, 'html.coarse 已置位（触摸设备识别成功）');
    chk(lay.portrait === wantPortrait, 'html.portrait = ' + wantPortrait);
    if (wantPortrait) {
      chk(lay.wrap[2] >= lay.vw * 0.98, '竖屏画面铺满宽度（不再只剩中间一条）', 'wrap宽=' + lay.wrap[2] + ' / 视口宽=' + lay.vw);
      chk(lay.wrap[3] > lay.wrap[2], '画面是转过来的（高 > 宽）');
      chk(lay.rotHint, '竖屏提示已弹出');
    } else {
      chk(lay.wrap[3] >= lay.vh * 0.98, '横屏画面铺满高度', 'wrap高=' + lay.wrap[3]);
    }
    chk(lay.touch === 'none', '标题页没有那个按了没反应的暂停键', 'display=' + lay.touch);
    chk(lay.hint.indexOf('点选卡牌') >= 0 && lay.enter.indexOf('ENTER') < 0, '提示文案已切成触摸版', JSON.stringify(lay.hint));
    await p.screenshot({ path: SHOTS + 'mobile-' + tag + '-title.png' });

    /* ---------- B 地图节点命中区 ---------- */
    await go('?map=1&noanim=1');
    const tp = await p.evaluate(() => getComputedStyle(document.getElementById('touch')).display);
    chk(tp !== 'none', '地图场景暂停键可见', 'display=' + tp);
    const hs = await p.evaluate(() => {
      const n = [...document.querySelectorAll('.mnode')].find(d => d.classList.contains('reach'));
      if (!n) return null;
      const r = n.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const probe = (dx, dy) => { const h = document.elementFromPoint(cx + dx, cy + dy); return h === n || n.contains(h); };
      let rx = 0; while (rx < 60 && probe(rx + 1, 0)) rx++;
      let ry = 0; while (ry < 60 && probe(0, ry + 1)) ry++;
      return { visual: [Math.round(r.width), Math.round(r.height)], eff: [Math.round(r.width + 2 * rx), Math.round(r.height + 2 * ry)] };
    });
    console.log('  地图节点命中区: 视觉 ' + hs.visual.join('x') + ' → 有效 ' + hs.eff.join('x'));
    chk(hs.eff[0] >= 40 && hs.eff[1] >= 40, '节点有效命中区 ≥ 40px（手指点得着）', hs.eff.join('x'));
    await p.screenshot({ path: SHOTS + 'mobile-' + tag + '-map.png' });

    /* ---------- D 真触摸走完一整幕 ---------- */
    await go('?auto=1&noanim=1');
    const path = [];
    let steps = 0, stuck = 0;

    /* 通用「把当前弹窗走出来」：按项目自己的出口约定来
       1 补给站 → 点「离开补给站」
       2 有出口语义的选项（离开/不开门/绕开/关闭/休眠/跳过）→ 点它
       3 有卡就点卡（提交，而不是点「返回」弹回去）
       4 按钮行里优先点非「返回」的那个
       5 都没有 → 轮换选项（同一个弹窗反复出现时换下一个，避免原地打转） */
    const EXIT_RE = /离开|不开门|绕开|收手|关闭|休眠|跳过|不买/;
    const clearModal = async (label) => {
      const seen = {};
      for (let i = 0; i < 8; i++) {
        const s = await p.evaluate(SCENE);
        if (!s.open || s.scene === 'map') return true;
        let expr = null;
        if (s.title.indexOf('补给站') >= 0) {
          expr = `[...document.querySelectorAll('#modal-actions .btn')].find(b => b.textContent.includes('离开'))`;
        } else if (s.opts.some(t => EXIT_RE.test(t))) {
          const k = s.opts.findIndex(t => EXIT_RE.test(t));
          expr = `[...document.querySelectorAll('#modal-body .opt')][${k}]`;
        } else if (s.cards) {
          expr = `document.querySelector('#modal-body .card')`;
        } else if (s.acts.length) {
          expr = `[...document.querySelectorAll('#modal-actions .btn')].find(b => !b.textContent.includes('返回')) || [...document.querySelectorAll('#modal-actions .btn')].pop()`;
        } else if (s.opts.length) {
          const n = seen[s.title] = (seen[s.title] || 0) + 1;
          expr = `[...document.querySelectorAll('#modal-body .opt')][${(n - 1) % s.opts.length}]`;
        }
        if (!expr) { console.log('    ! ' + label + ' 弹窗没有任何出口: ' + JSON.stringify(s)); return false; }
        if (await tapExpr(expr, label + ' 出口#' + i) !== 'ok') return false;
        await p.waitForTimeout(700);
      }
      console.log('    ! ' + label + ' 弹窗 8 步没走出来: ' + JSON.stringify(await p.evaluate(SCENE)));
      return false;
    };

    while (steps++ < 40) {
      const st = await p.evaluate(SCENE);
      if (st.scene === 'actclear' || st.scene === 'over') { path.push('幕终:' + st.scene); break; }

      if (st.scene === 'battle') {
        await p.evaluate(() => { G.enemy.hp = 0; winBattle(); });
        await p.waitForTimeout(1400);
        const sc = await p.evaluate(SCENE);
        if (sc.scene === 'actclear' || sc.scene === 'over') { path.push('BOSS→' + sc.scene); break; }
        if (!sc.open) { console.log('    ! 战后没弹结算面板 ' + JSON.stringify(sc)); stuck++; break; }
        path.push('战');
        if (!await clearModal('战后整理')) { stuck++; break; }
        if (await p.evaluate(() => G.scene) !== 'map') { console.log('    ! 战后整理没回地图'); stuck++; break; }
        continue;
      }

      if (st.scene === 'map') {
        if (!st.reach) { console.log('    ! 地图零可点节点（死路）'); stuck++; break; }
        if (await tapExpr(`[...document.querySelectorAll('.mnode')].find(d => d.classList.contains('reach') && !d.classList.contains('visited'))`, '地图可达节点') !== 'ok') { stuck++; break; }
        await p.waitForTimeout(1200);
        const nk = await p.evaluate(SCENE);
        path.push('图→' + nk.scene);
        if (nk.scene === 'battle' || nk.scene === 'map') continue;
        if (nk.open && !await clearModal(nk.scene)) { stuck++; break; }
        const fin = await p.evaluate(() => G.scene);
        if (fin !== 'map') { console.log('    ! ' + nk.scene + ' 没能回到地图，scene=' + fin); stuck++; break; }
        continue;
      }
      console.log('    ? 意外场景 ' + st.scene);
      stuck++; break;
    }
    console.log('  路径:', path.join(' → '));
    chk(stuck === 0, '一整幕走完没有卡死（含所有弹窗都靠真实触摸自己走出来）', 'steps=' + steps);
    const endScene = await p.evaluate(() => G.scene);
    chk(endScene === 'actclear' || endScene === 'over', '抵达幕终 / 结局', 'scene=' + endScene);

    console.log('  errs =', JSON.stringify(errs.slice(0, 3)));
    chk(errs.length === 0, '无运行时报错');
    await p.screenshot({ path: SHOTS + 'mobile-' + tag + '-battle.png' });
    await ctx.close();
  }

  await b.close();
  console.log(fail === 0 ? '\nALL PASS' : '\n' + fail + ' FAILED');
  process.exit(fail === 0 ? 0 : 1);
})();
