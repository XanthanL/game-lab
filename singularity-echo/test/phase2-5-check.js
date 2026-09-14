/* Phase 2.5 验证 —— UI 转场统一（缓动 token 化 / 分节组件共用 / 入场一致性）
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase2-5-check.js
 * 产出：../.workbuddy/shots/phase5/2-5-*.png + 状态断言
 *
 * 断言优先：转场参数从 getComputedStyle 读实际生效值，不读源码字符串。
 * 每张图独立浏览器实例。
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const OUT = path.join(__dirname, 'phase5');
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}

async function run(tag, vw, vh, job, dsf) {
  const b = await chromium.launch({ executablePath: EXE });
  const c = await b.newContext({
    viewport: { width: vw, height: vh }, deviceScaleFactor: dsf || 1,
    hasTouch: vw < 700, isMobile: vw < 700,
  });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.goto(GAME, { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  let note = '';
  try { note = (await job(p)) || ''; } catch (e) { errs.push('JOB:' + e.message.slice(0, 160)); }
  await p.screenshot({ path: path.join(OUT, tag + '.png'), fullPage: false });
  await c.close(); await b.close();
  console.log(tag.padEnd(24), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}

(async () => {
  const D = [1280, 900], M = [390, 844];

  // 1) 入场曲线：所有覆盖层应共用同一条曲线（读 computed style 的动画参数）
  await run('2-5-01-overlay-easing', ...D, async p => {
    const r = await p.evaluate(() => {
      const ids = ['menu', 'over', 'pause', 'cards', 'hulls', 'victory', 'logbook', 'saves', 'settings'];
      const out = {};
      for (const id of ids) {
        const e = document.getElementById(id);
        if (!e) continue;
        e.hidden = false;
        void e.offsetWidth;                 // force reflow 让 animation 真正挂上
        const cs = getComputedStyle(e);
        out[id] = { anim: cs.animationName, dur: cs.animationDuration, ease: cs.animationTimingFunction };
        e.hidden = true;
      }
      return out;
    });
    const eases = [...new Set(Object.values(r).map(v => v.ease))];
    const durs = [...new Set(Object.values(r).map(v => v.dur))];
    const names = [...new Set(Object.values(r).map(v => v.anim))];
    return `layers=${Object.keys(r).length} animNames=${JSON.stringify(names)} durs=${JSON.stringify(durs)} eases=${JSON.stringify(eases)}`;
  });

  // 2) 裸缓动残留：CSS 段里 transition/animation 上不该再有裸 ease-out/linear（环境动画除外）
  await run('2-5-02-no-bare-easing', ...D, async p => {
    const r = await p.evaluate(() => {
      // 用 CSSOM 读规则，比正则匹配源码可靠
      const bad = [];
      for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch (e) { continue; }
        if (!rules) continue;
        for (const rule of rules) {
          if (!rule.style) continue;
          for (const prop of ['transition', 'animation', 'animationTimingFunction', 'transitionTimingFunction']) {
            const v = rule.style.getPropertyValue(prop);
            if (!v) continue;
            // 找裸关键字（不含 var( ））
            const stripped = v.replace(/var\([^)]*\)/g, '');
            const m = stripped.match(/(?<![\w-])(ease-out|ease-in|linear|ease)(?![\w-])/g);
            if (m) bad.push({ sel: rule.selectorText.slice(0, 60), prop, m: [...new Set(m)] });
          }
        }
      }
      return bad;
    });
    return `bareCount=${r.length} ${r.length ? JSON.stringify(r.slice(0, 4)) : '(clean)'}`;
  });

  // 3) 分节组件共用：logbook 与 over 都用 .sec-head，且视觉规格一致
  await run('2-5-03-sec-head-shared', ...D, async p => {
    await p.evaluate(() => NOVA.launch(0));
    await p.waitForTimeout(400);
    await p.evaluate(() => NOVA.death.kill('env', 140));
    await p.waitForTimeout(120);
    await p.evaluate(() => NOVA.death.finish());
    await p.waitForTimeout(500);
    const overHead = await p.evaluate(() => {
      const e = document.querySelector('#overCause .sec-head');
      if (!e) return null;
      const cs = getComputedStyle(e);
      return { fs: cs.fontSize, ls: cs.letterSpacing, color: cs.color };
    });
    // 再看 logbook
    await p.evaluate(() => { const o = document.getElementById('over'); o.hidden = true; NOVA.logbook.open(); });
    await p.waitForTimeout(600);
    const lbHead = await p.evaluate(() => {
      const e = document.querySelector('#logbook .sec-head');
      if (!e) return null;
      const cs = getComputedStyle(e);
      return { fs: cs.fontSize, ls: cs.letterSpacing, color: cs.color };
    });
    const match = overHead && lbHead && overHead.fs === lbHead.fs && overHead.ls === lbHead.ls;
    return `over=${JSON.stringify(overHead)} lb=${JSON.stringify(lbHead)} specMatch=${match}`;
  });

  // 4) over 新增块完整（回归 2.4）+ 转场后仍可见
  await run('2-5-04-over-regress', ...D, async p => {
    await p.evaluate(() => NOVA.launch(0));
    await p.waitForTimeout(400);
    await p.evaluate(() => { NOVA.build('overdrive', 2); NOVA.build('tesla', 1); });
    await p.evaluate(() => NOVA.wave(12));
    await p.waitForTimeout(2500);
    await p.evaluate(() => NOVA.death.kill('wraith', 130));
    await p.waitForTimeout(120);
    await p.evaluate(() => NOVA.death.finish());
    await p.waitForTimeout(600);
    const o = await p.evaluate(() => NOVA.death.over());
    const vis = await p.evaluate(() => {
      const c = document.querySelector('#overCause'), x = document.querySelector('#overExtra');
      return { cause: c && c.offsetHeight > 0, extra: x && x.offsetHeight > 0 };
    });
    return `cause=${!!o.cause} extra=${!!o.extra} chips=${o.chips} visible=${JSON.stringify(vis)}`;
  });

  // 5) logbook 六分区标题全部沿用 .sec-head（分节语法统一）
  await run('2-5-05-logbook-sections', ...D, async p => {
    await p.evaluate(() => { try { localStorage.setItem('nova-stats', JSON.stringify({ k: 4200, g: 37, w: 30, t: 7200, sc: 980000 })); } catch (e) {} });
    await p.evaluate(() => NOVA.logbook.open());
    await p.waitForTimeout(700);
    const r = await p.evaluate(() => {
      const heads = [...document.querySelectorAll('#logbook .sec-head')];
      return { count: heads.length, texts: heads.map(h => h.textContent.replace(/\s+/g, ' ').trim()) };
    });
    return `sections=${r.count} texts=${JSON.stringify(r.texts)}`;
  });

  // 6) 竖屏：over 面板三块 + 转场后在窄屏不溢出
  await run('2-5-06-mobile-over', ...M, async p => {
    await p.evaluate(() => NOVA.launch(0));
    await p.waitForTimeout(400);
    await p.evaluate(() => NOVA.wave(10));
    await p.waitForTimeout(800);
    await p.evaluate(() => NOVA.death.kill('boss:eye', 150));
    await p.waitForTimeout(120);
    await p.evaluate(() => NOVA.death.finish());
    await p.waitForTimeout(600);
    const m = await p.evaluate(() => {
      const r = document.querySelector('#over .panel').getBoundingClientRect();
      return { panelW: Math.round(r.width), vw: innerWidth, overflowX: Math.round(r.right - innerWidth) };
    });
    const o = await p.evaluate(() => NOVA.death.over());
    return `cause=${!!o.cause} chips=${o.chips} ${JSON.stringify(m)}`;
  });

  // 7) 竖屏 logbook：分节标题 + 面板不溢出
  await run('2-5-07-mobile-logbook', ...M, async p => {
    await p.evaluate(() => { try { localStorage.setItem('nova-stats', JSON.stringify({ k: 4200, g: 37, w: 30, t: 7200, sc: 980000 })); } catch (e) {} });
    await p.evaluate(() => NOVA.logbook.open());
    await p.waitForTimeout(700);
    const m = await p.evaluate(() => {
      const r = document.querySelector('#logbook .panel').getBoundingClientRect();
      const heads = document.querySelectorAll('#logbook .sec-head').length;
      return { panelW: Math.round(r.width), vw: innerWidth, overflowX: Math.round(r.right - innerWidth), heads };
    });
    return JSON.stringify(m);
  });

  // 8) 英文：分节标题在 EN 下也走同一组件（不塌行）
  await run('2-5-08-en-sections', ...D, async p => {
    await p.evaluate(() => NOVA.launch(0));
    await p.waitForTimeout(400);
    await p.evaluate(() => NOVA.death.lang('en'));
    await p.evaluate(() => NOVA.death.kill('seeker', 130));
    await p.waitForTimeout(120);
    await p.evaluate(() => NOVA.death.finish());
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
      const h = document.querySelector('#overCause .sec-head');
      const em = h && h.querySelector('em');
      return { txt: h ? h.textContent.replace(/\s+/g, ' ').trim() : null,
        emRight: em ? Math.round(em.getBoundingClientRect().right) : null,
        headRight: h ? Math.round(h.getBoundingClientRect().right) : null };
    });
    return JSON.stringify(r);
  });

  // 9) 转场不打断：连续开关同一面板 3 次，动画名与时长保持一致（无累积/漂移）
  await run('2-5-09-toggle-stable', ...D, async p => {
    const r = await p.evaluate(async () => {
      const out = [];
      const e = document.getElementById('logbook');
      for (let i = 0; i < 3; i++) {
        NOVA.logbook.open(); await new Promise(r => setTimeout(r, 500));
        const cs = getComputedStyle(e);
        out.push([cs.animationName, cs.animationDuration, cs.animationTimingFunction]);
        e.hidden = true; await new Promise(r => setTimeout(r, 120));
      }
      return out;
    });
    const same = r.every(x => JSON.stringify(x) === JSON.stringify(r[0]));
    return `runs=${r.length} stable=${same} sample=${JSON.stringify(r[0])}`;
  }, 2);

  // 10) 全量回归：2.3 / 2.4 的关键计数仍对
  await run('2-5-10-regress-counts', ...D, async p => {
    await p.evaluate(() => { try { localStorage.setItem('nova-stats', JSON.stringify({ k: 4200, g: 37, w: 30, t: 7200, sc: 980000 })); } catch (e) {} });
    await p.evaluate(() => NOVA.logbook.open());
    await p.waitForTimeout(700);
    const c = await p.evaluate(() => NOVA.logbook.counts());
    const secs = await p.evaluate(() => document.querySelectorAll('#logbook .sec-head').length);
    return `counts=${JSON.stringify(c)} secHeads=${secs}`;
  });

  // 11) keyframes 完整性：CSSOM 里每个 animation-name 都必须有同名 @keyframes
  //     （曾有 `@keyframesbootSweep` 缺空格 → 规则整条失效、扫光动画静默死掉）
  await run('2-5-11-keyframes-intact', ...D, async p => {
    const r = await p.evaluate(() => {
      const defined = new Set();
      const used = [];
      for (const sheet of document.styleSheets) {
        let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
        if (!rules) continue;
        for (const rule of rules) {
          if (rule.constructor.name === 'CSSKeyframesRule' || rule.type === 7) defined.add(rule.name);
          if (rule.style) {
            const n = rule.style.getPropertyValue('animation-name');
            // 解析简写 animation 里的第一个标识符（跳过时间/函数关键字）
            const shorthand = rule.style.getPropertyValue('animation');
            const raw = n || shorthand;
            for (const tok of raw.split(',')) {
              const first = tok.trim().split(/\s+/)[0];
              if (!first) continue;
              if (/^\d|^(linear|ease|ease-in|ease-out|ease-in-out|infinite|none|both|forwards|backwards|alternate|normal|reverse)$/.test(first)) continue;
              used.push({ sel: rule.selectorText ? rule.selectorText.slice(0, 50) : '?', name: first });
            }
          }
        }
      }
      const missing = used.filter(u => u.name !== 'none' && !defined.has(u.name));
      return { defined: [...defined], used: [...new Set(used.map(u => u.name))], missing };
    });
    return `defined=${r.defined.length} used=${JSON.stringify(r.used)} missing=${JSON.stringify(r.missing)}`;
  });
})();
