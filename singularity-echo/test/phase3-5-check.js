/* Phase 3.5 验证 —— 局外解锁树（星尘货币 / 解锁树 / 开局加成）
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase3-5-check.js
 * 产出：../.workbuddy/shots/phase3/3-5-*.png + 每行状态断言
 *
 * 每张图独立浏览器实例（file:// 下 localStorage 跨 context 共享）。
 * 所有游戏作用域访问经 NOVA.* 钩子（IIFE 不可见 G/MODULES/SYN/META）。
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const OUT = path.join(__dirname, 'phase3');
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}

async function run(tag, vw, vh, job) {
  const b = await chromium.launch({ executablePath: EXE });
  const c = await b.newContext({
    viewport: { width: vw, height: vh }, deviceScaleFactor: 2,
    hasTouch: vw < 700, isMobile: vw < 700,
  });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 220)));
  await p.goto(GAME, { waitUntil: 'load' });
  /* ⚠️ 启动遮罩 #boot 加上 .out 之后才 pointer-events:none；没退场就点节点会被它吃掉，
     点击断言会随机失败（4.3b 在 4-3b-13 撞到过一次）。先等它淡出。 */
  await p.waitForFunction(
    () => { const b = document.getElementById('boot'); return !b || b.classList.contains('out'); },
    null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(1400);
  let note = '';
  try { note = (await job(p)) || ''; } catch (e) { errs.push('JOB:' + e.message.slice(0, 180)); }
  await p.screenshot({ path: path.join(OUT, tag + '.png'), fullPage: false });
  await c.close(); await b.close();
  console.log(tag.padEnd(28), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}

const D = [1280, 900], M = [390, 844];

(async () => {
  // 1) 树结构：13 节点（1 根 + 4×3）· req 合法 · 坐标唯一
  await run('3-5-01-tree-structure', ...D, async p => {
    return await p.evaluate(() => {
      const t = NOVA.meta.tree();
      const ids = new Set(t.map(m => m.id));
      const badReq = t.filter(m => m.req && !ids.has(m.req)).map(m => m.id);
      const pos = new Set(t.map(m => m.x + ',' + m.y));
      // 4.3b 纵向版式：不再按「行」分组（横向版式的 y 就是行号），改为按支（br）+ 层（dp）分组
      const branches = {};
      for (const m of t) {
        const k = (m.br === undefined ? (m.anchor || '?') : 'br' + m.br);
        branches[k] = (branches[k] || 0) + 1;
      }
      // 纵向语义自检：子节点 y 必须严格大于父节点 y
      const byId = Object.fromEntries(t.map(m => [m.id, m]));
      const bad = [];
      for (const m of t) if (m.req && byId[m.req] && !(m.y > byId[m.req].y)) bad.push(m.id + '<=' + m.req);
      const cv = NOVA.meta.canvas();
      return `n=${t.length} reqMissing=${JSON.stringify(badReq)} uniquePos=${pos.size === t.length} `
        + `branches=${JSON.stringify(branches)} 非向下=${bad.length} 画布=${cv.w}x${cv.h}(${cv.cols}列)`;
    });
  });

  // 2) 默认档：0 星尘 + 仅 mroot 已解锁
  await run('3-5-02-default-state', ...D, async p => {
    return await p.evaluate(() => {
      NOVA.meta.reset();
      const st = NOVA.meta.state();
      return `dust=${st.dust} unlocked=${JSON.stringify(st.unlocked)} mrootUnlocked=${st.nodes.mroot.unlocked}`;
    });
  });

  // 3) 星尘产出公式（不写盘）
  await run('3-5-03-dust-formula', ...D, async p => {
    return await p.evaluate(() => {
      const cases = [[0, 0], [500, 20], [1500, 60], [9000, 300], [45000, 1200]];
      const out = cases.map(c => `${c[0]}分/${c[1]}杀→${NOVA.meta.earnFor(c[0], c[1])}`);
      return out.join(' | ');
    });
  });

  // 4) 解锁扣费：解锁 hp1（cost 10）→ dust 减 10 + 进 unlocked
  await run('3-5-04-unlock-spend', ...D, async p => {
    return await p.evaluate(() => {
      NOVA.meta.reset();
      NOVA.meta.grant(50);
      const before = NOVA.meta.state().dust;
      const r = NOVA.meta.unlock('hp1');
      const after = NOVA.meta.state();
      return `before=${before} ok=${r.ok} cost=${r.cost} after=${after.dust} has=${after.unlocked.indexOf('hp1') >= 0}`;
    });
  });

  // 5) 前置未解锁 → 失败且不扣费
  await run('3-5-05-req-guard', ...D, async p => {
    return await p.evaluate(() => {
      NOVA.meta.reset();
      NOVA.meta.grant(999);
      const before = NOVA.meta.state().dust;
      const r = NOVA.meta.unlock('hp2'); // 前置 hp1 未解锁
      const after = NOVA.meta.state().dust;
      return `ok=${r.ok} reason=${r.reason} dustUnchanged=${before === after}`;
    });
  });

  // 6) 星尘不足 → 失败且不扣费
  await run('3-5-06-dust-guard', ...D, async p => {
    return await p.evaluate(() => {
      NOVA.meta.reset(); // 0 星尘
      const r = NOVA.meta.unlock('hp1'); // cost 10 > 0
      return `ok=${r.ok} reason=${r.reason} dust=${NOVA.meta.state().dust}`;
    });
  });

  // 7) 重复解锁 → 失败
  await run('3-5-07-dup-guard', ...D, async p => {
    return await p.evaluate(() => {
      NOVA.meta.reset();
      NOVA.meta.grant(500);
      NOVA.meta.unlock('hp1');
      const r = NOVA.meta.unlock('hp1');
      return `ok=${r.ok} reason=${r.reason}`;
    });
  });

  // 8) 开局加成生效：解锁 hp1/sh1/dmg1 后 startGame → P 应带加成
  await run('3-5-08-start-bonus', ...D, async p => {
    return await p.evaluate(() => {
      return NOVA.debug(`(function(){
        NOVA.meta.reset();
        NOVA.meta.grant(1000);
        for (const id of ['hp1','hp2','sh1','dmg1','spd1','mag1','lv1']) NOVA.meta.unlock(id);
        startGame(HULLS[0]);
        return JSON.stringify({
          maxHp: P.maxHp, hp: P.hp, shieldMax: P.shieldMax, shield: P.shield,
          dmg: +P.dmg.toFixed(3), maxSpeed: Math.round(P.maxSpeed),
          magnet: Math.round(P.magnet), level: P.level,
        });
      })()`);
    });
  });

  // 9) 未解锁时开局 = 基线（100 HP / 1 dmg / LV1）
  await run('3-5-09-baseline', ...D, async p => {
    return await p.evaluate(() => {
      return NOVA.debug(`(function(){
        NOVA.meta.reset();
        startGame(HULLS[0]);
        return JSON.stringify({maxHp:P.maxHp, dmg:+P.dmg.toFixed(3),
          maxSpeed:Math.round(P.maxSpeed), magnet:Math.round(P.magnet), level:P.level});
      })()`);
    });
  });

  // 10) 存储往返：save → 重开页面后 load 一致
  await run('3-5-10-storage', ...D, async p => {
    return await p.evaluate(() => {
      NOVA.meta.save({ dust: 321, unlocked: ['mroot', 'hp1', 'dmg1'] });
      const d = NOVA.meta.load();
      const raw = localStorage.getItem('nova-meta');
      return `dust=${d.dust} unlocked=${JSON.stringify(d.unlocked)} raw=${raw}`;
    });
  });

  // 11) 三态视觉：locked / ready / done 类名 + 星尘读数
  await run('3-5-11-visual-states', ...D, async p => {
    return await p.evaluate(() => {
      NOVA.meta.reset();
      NOVA.meta.grant(60);       // 够 hp1(10)/dmg1(12)/spd1(10)/lv1(18) 不够 hp2(22 但前置)
      NOVA.meta.unlock('hp1');
      const r = NOVA.meta.draw();
      const dust = document.getElementById('mDust').textContent.trim();
      const nodes = [...document.querySelectorAll('#mTreeNodes .lbnode')];
      const cls = {};
      for (const n of nodes) { const c = n.className.replace('lbnode ', ''); cls[c] = (cls[c] || 0) + 1; }
      const hp1 = document.querySelector('[data-meta="hp1"]');
      const hp2 = document.querySelector('[data-meta="hp2"]');
      const mroot = document.querySelector('[data-meta="mroot"]');
      return `dust="${dust}" total=${r.total} unlocked=${r.unlocked} cls=${JSON.stringify(cls)} hp1=${hp1 && hp1.className} hp2=${hp2 && hp2.className} mroot=${mroot && mroot.className}`;
    });
  });

  // 12) 点击解锁链路（真实点击 → 扣费 + 重绘）
  //     两个前提：① 先开日志，否则节点 0 尺寸；② 先滚到「解锁星图」，
  //     否则节点落在面板滚动区之外，force 点击会打到覆盖其上的元素（曾静默失败）。
  await run('3-5-12-click-unlock', ...D, async p => {
    await p.evaluate(() => {
      NOVA.meta.reset();
      NOVA.meta.grant(100);
      NOVA.logbook.open();
      NOVA.meta.draw();
      NOVA.meta.fit();
      const h = document.querySelector('[data-node-id="lbsec7"]');
      if (h && h.scrollIntoView) h.scrollIntoView({ block: 'center' });
    });
    await p.waitForTimeout(600);
    await p.click('[data-meta="dmg1"]', { force: true });
    await p.waitForTimeout(300);
    return await p.evaluate(() => {
      const st = NOVA.meta.state();
      const n = document.querySelector('[data-meta="dmg1"]');
      return `ok=${st.unlocked.indexOf('dmg1') >= 0} dust=${st.dust} cls=${n && n.className.replace('lbnode ', '')}`;
    });
  });

  // 13) 竖屏布局：解锁树缩放适配 + 无横向溢出（同样要先开日志）
  await run('3-5-13-mobile', ...M, async p => {
    return await p.evaluate(() => {
      NOVA.meta.reset();
      NOVA.meta.grant(500);
      NOVA.logbook.open();
      NOVA.meta.draw();
      const f = NOVA.meta.fit();
      const tree = document.getElementById('mTree');
      const r = tree.getBoundingClientRect();
      return `vw=${window.innerWidth} fit=${JSON.stringify(f)} tree=${r.width.toFixed(0)}x${r.height.toFixed(0)} overflowX=${(r.right - window.innerWidth).toFixed(0)}`;
    });
  });

  // 14) 回归：前序 phase 数据规模 + 菜单按钮
  await run('3-5-14-regress', ...D, async p => {
    return await p.evaluate(() => {
      const c = NOVA.counts();
      const ids = ['btnLaunch', 'btnDaily', 'btnLogbook', 'mTree', 'mDust'];
      const vis = ids.map(id => !!document.getElementById(id));
      return `mods=${c.mods} syn=${c.syn} ach=${c.ach} meta=${NOVA.meta.tree().length} els=${vis.filter(Boolean).length}/${ids.length}`;
    });
  });

  // 15) 坠毁面板星尘行（3.5c）：本局产出 + 可用余额都要显示出来
  await run('3-5-15-over-dust', ...D, async p => {
    await p.evaluate(() => NOVA.debug(`(function(){
      NOVA.meta.reset();
      startGame(HULLS[0]);
      G.score=9000; G.kills=300;
      P.hp=0; die();
      setTimeout(function(){ snapshotCause(); showOver(); }, 60);
    })()`));
    await p.waitForTimeout(700);
    return await p.evaluate(() => {
      const n = document.getElementById('overDust');
      const txt = n ? n.textContent.replace(/\s+/g, ' ').trim() : 'MISSING';
      return `overShown=${!document.getElementById('over').hidden} txt="${txt}" dust=${NOVA.meta.state().dust}`;
    });
  });

  // 16) 通关面板星尘行（3.5c）：+8000 通关奖励也要计入产出
  await run('3-5-16-victory-dust', ...D, async p => {
    await p.evaluate(() => NOVA.debug(`(function(){
      NOVA.meta.reset();
      startGame(HULLS[0]);
      G.score=20000; G.kills=800; Wv.n=30;
      showVictory();
    })()`));
    await p.waitForTimeout(700);
    return await p.evaluate(() => {
      const n = document.getElementById('vicDust');
      const txt = n ? n.textContent.replace(/\s+/g, ' ').trim() : 'MISSING';
      return `vicShown=${!document.getElementById('victory').hidden} txt="${txt}" dust=${NOVA.meta.state().dust}`;
    });
  });

  // 17) 切英文后星尘行重绘，不能中英混排
  await run('3-5-17-dust-i18n', ...D, async p => {
    await p.evaluate(() => NOVA.debug(`(function(){
      NOVA.meta.reset();
      startGame(HULLS[0]);
      G.score=3000; G.kills=120;
      P.hp=0; die();
      setTimeout(function(){ snapshotCause(); showOver(); }, 60);
    })()`));
    await p.waitForTimeout(700);
    await p.evaluate(() => document.getElementById('btnLang').click());
    await p.waitForTimeout(300);
    return await p.evaluate(() => {
      const t = document.getElementById('overDust').textContent.replace(/\s+/g, ' ').trim();
      return `en="${t}" cjk=${/[一-龥]/.test(t)}`;
    });
  });
})();