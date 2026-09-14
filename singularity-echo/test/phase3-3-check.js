/* Phase 3.3 验证 —— 每日挑战（RNG 种子化 / 规则池 / 入口与结算）
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase3-3-check.js
 * 产出：../.workbuddy/shots/phase3/3-3-*.png + 每行状态断言
 *
 * 每张图独立浏览器实例（file:// 下 localStorage 跨 context 共享）。
 * 所有游戏作用域访问经 NOVA.* 钩子（IIFE 不可见 G/MODULES/SYN）。
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
  await p.waitForTimeout(1400);
  let note = '';
  try { note = (await job(p)) || ''; } catch (e) { errs.push('JOB:' + e.message.slice(0, 180)); }
  await p.screenshot({ path: path.join(OUT, tag + '.png'), fullPage: false });
  await c.close(); await b.close();
  console.log(tag.padEnd(28), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}

const D = [1280, 900], M = [390, 844];

(async () => {
  // 1) RNG 默认状态：未 setSeed → rand 仍走 Math.random，两次采样大概率不同
  await run('3-3-01-rng-default', ...D, async p => {
    const a = await p.evaluate(() => NOVA.rng.sequence(8));
    const b = await p.evaluate(() => NOVA.rng.sequence(8));
    return `a=${JSON.stringify(a)} b=${JSON.stringify(b)} diff=${JSON.stringify(a)!==JSON.stringify(b)}`;
  });

  // 2) RNG 种子确定性：同一种子 → 同一序列
  await run('3-3-02-rng-deterministic', ...D, async p => {
    return await p.evaluate(() => {
      NOVA.rng.set(42);
      const a = NOVA.rng.sequence(8);
      NOVA.rng.set(42);
      const b = NOVA.rng.sequence(8);
      return `seed=42 相同=${JSON.stringify(a)===JSON.stringify(b)} 样本=${JSON.stringify(a)}`;
    });
  });

  // 3) RNG 不同种子 → 不同序列
  await run('3-3-03-rng-distinct', ...D, async p => {
    return await p.evaluate(() => {
      NOVA.rng.set(42); const a = NOVA.rng.sequence(8);
      NOVA.rng.set(99); const b = NOVA.rng.sequence(8);
      return `a=${JSON.stringify(a)} b=${JSON.stringify(b)} diff=${JSON.stringify(a)!==JSON.stringify(b)}`;
    });
  });

  // 4) RNG clearSeed 后还原默认
  await run('3-3-04-rng-clearseed', ...D, async p => {
    return await p.evaluate(() => {
      NOVA.rng.set(42);
      const a = NOVA.rng.sequence(8);
      NOVA.rng.clear();
      const b1 = NOVA.rng.sequence(8);
      const b2 = NOVA.rng.sequence(8);
      const state = NOVA.rng.state();
      return `seeded=${JSON.stringify(a)} state=${JSON.stringify(state)} postClearDiff=${JSON.stringify(b1)!==JSON.stringify(b2)}`;
    });
  });

  // 5) DAILY_RULES 池 = 4 条 + pickDailyRules(seed) 返回 2 条 + 同种子稳定
  await run('3-3-05-daily-rules', ...D, async p => {
    return await p.evaluate(() => {
      const r1 = NOVA.daily.rules(20260911);
      const r2 = NOVA.daily.rules(20260911);
      const r3 = NOVA.daily.rules(20261225);
      const ids1 = r1.map(r=>r.id);
      const ids2 = r2.map(r=>r.id);
      const ids3 = r3.map(r=>r.id);
      return `pool=${r1.length===2} samesame=${JSON.stringify(ids1)===JSON.stringify(ids2)} diffseed=${JSON.stringify(ids1)!==JSON.stringify(ids3)} s1=${ids1.join('+')}`;
    });
  });

  // 6) dailySeed 是 32-bit 整数 + 同日不变
  await run('3-3-06-daily-seed', ...D, async p => {
    return await p.evaluate(() => {
      const s1 = NOVA.daily.seed();
      const s2 = NOVA.daily.seed();
      return `s1=${s1} s2=${s2} same=${s1===s2} int=${Number.isInteger(s1)} range=${s1>=0&&s1<=4294967295}`;
    });
  });

  // 7) rollChoices 尊重 G.noRepair
  await run('3-3-07-no-repair', ...D, async p => {
    return await p.evaluate(() => {
      // G.noRepair 在 IIFE 内 → 用 debug 路径
      return NOVA.debug(`(function(){
        G.build={};G.noRepair=true;
        let withRepair=0,total=300;
        for(let i=0;i<total;i++){const c=rollChoices();if(c.some(x=>x.id==='repair'))withRepair++;}
        return JSON.stringify({noRepair:G.noRepair, withRepair, total, ok:withRepair===0});
      })()`);
    });
  });

  // 8) startDaily：设 G.daily + 应用规则 + 装模块
  await run('3-3-08-start-daily', ...D, async p => {
    return await p.evaluate(() => {
      return NOVA.debug(`(function(){
        startDaily(HULLS[0]);
        return JSON.stringify({
          daily: !!G.daily,
          rules: G.daily?.rules?.length,
          ids: G.daily?.rules?.map(r=>r.id).join('+'),
          loader: G.build.loader||0,
          aegis: G.build.aegis||0,
        });
      })()`);
    });
  });

  // 9) renderDaily 写入 #menuDaily
  await run('3-3-09-render-daily', ...D, async p => {
    return await p.evaluate(() => {
      NOVA.dailyStore.save({'2026-09-11':{score:12580,wave:8,kills:120,rules:['startLoader','swiftStar']}});
      NOVA.daily.render();
      const txt = document.getElementById('menuDaily').textContent.replace(/\\s+/g,' ').trim();
      return `hidden=${document.getElementById('menuDaily').hidden} text="${txt.slice(0,80)}"`;
    });
  });

  // 10) 死亡时 commitDaily 写入 nova-daily + 显示 daily 徽章
  await run('3-3-10-death-commit', ...D, async p => {
    return await p.evaluate(() => {
      return NOVA.debug(`(function(){
        NOVA.dailyStore.clear();
        startDaily(HULLS[0]);
        G.score=9999; Wv.n=12; G.kills=200;
        commitDaily();
        const stored = loadDaily();
        const today = new Date().toISOString().slice(0,10);
        const entry = stored[today];
        const badge = buildCause();
        return JSON.stringify({entry, hasBadge: badge.includes('daily-badge')});
      })()`);
    });
  });

  // 11) 之前所有 phase 回归：菜单按钮 + 模块 + 协同 + 成就
  await run('3-3-11-regress', ...D, async p => {
    return await p.evaluate(() => {
      const ids = ['btnLaunch','btnContinue','btnDaily','btnSaves','btnLogbook','btnSettings'];
      const visible = ids.map(id => !!document.getElementById(id));
      const c = NOVA.counts();
      return `menuBtns=${visible.filter(Boolean).length}/${ids.length} (${visible.join(',')}) mods=${c.mods} syn=${c.syn} ach=${c.ach}`;
    });
  });

  // 12) 移动端菜单 + 每日面板布局
  await run('3-3-12-mobile', ...M, async p => {
    return await p.evaluate(() => {
      NOVA.dailyStore.save({'2026-09-11':{score:4321,wave:5,kills:80,rules:['startLoader','noRepair']}});
      NOVA.daily.render();
      const r = document.getElementById('menuDaily').getBoundingClientRect();
      return `vw=${window.innerWidth} panel=${r.width.toFixed(0)}x${r.height.toFixed(0)} overflowX=${r.right-window.innerWidth}`;
    });
  });
})();