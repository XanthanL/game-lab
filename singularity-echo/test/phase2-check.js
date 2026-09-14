/* Phase 2 验证 —— 首局分步引导（2.1）+ 升级卡牌信息重构（2.2）
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase2-check.js
 * 产出：../.workbuddy/shots/phase2/*.png + 每行的状态断言
 *
 * 断言优先于截图：引导「当前第几步」直接从 NOVA.guide.current() 读，
 * 截图只用来核对版式。每张图独立浏览器实例（file:// 下 localStorage 跨 context 共享）。
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const OUT = path.join(__dirname, 'phase2');
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}

async function run(tag, vw, vh, job, dsf) {
  const b = await chromium.launch({ executablePath: EXE });
  const c = await b.newContext({
    viewport: { width: vw, height: vh }, deviceScaleFactor: dsf || 1,
    hasTouch: vw < 700, isMobile: vw < 700,
  });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await p.goto(GAME, { waitUntil: 'load' });
  await p.waitForTimeout(1300);
  await p.evaluate(() => { try { localStorage.removeItem('nova-guide'); } catch (e) {} });
  let note = '';
  try { note = (await job(p)) || ''; } catch (e) { errs.push('JOB:' + e.message.slice(0, 150)); }
  await p.screenshot({ path: path.join(OUT, tag + '.png') });
  await c.close(); await b.close();
  console.log(tag.padEnd(20), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}

const launch = async p => { await p.evaluate(() => NOVA.launch(0)); await p.waitForTimeout(1400); };
const gt = p => p.evaluate(() => NOVA.guide.text());
const step = p => p.evaluate(() => NOVA.guide.current());

(async () => {
  const D = [1280, 800], M = [390, 844];

  // 1) 刚出击：应停在第 1 步「移动」
  await run('01-guide-move', ...D, async p => {
    await launch(p);
    const t = await gt(p);
    return `step=${await step(p)} on=${t.on} tag="${t.tag}" txt="${t.txt.slice(0, 22)}"`;
  });

  // 2) 按住 W 推进 → 第 1 步达成，停在第 2 步「开火」
  await run('02-guide-fire', ...D, async p => {
    await launch(p);
    await p.keyboard.down('KeyW'); await p.waitForTimeout(2600); await p.keyboard.up('KeyW');
    const t = await gt(p);
    return `step=${await step(p)} txt="${t.txt.slice(0, 22)}"`;
  });

  // 3) 移动 + 开火 → 停在第 3 步「拾取」
  await run('03-guide-collect', ...D, async p => {
    await launch(p);
    await p.keyboard.down('KeyW'); await p.keyboard.down('Space');
    await p.waitForTimeout(3000);
    await p.keyboard.up('Space'); await p.keyboard.up('KeyW');
    const t = await gt(p);
    return `step=${await step(p)} txt="${t.txt.slice(0, 22)}"`;
  });

  // 4) 升级面板：核对「读数行 + 协同块」是否真的渲染出来
  await run('04-cards', ...D, async p => {
    await launch(p);
    await p.evaluate(() => NOVA.giveXp(25)); await p.waitForTimeout(1200);
    const info = await p.evaluate(() => {
      const cs = document.querySelectorAll('#cardrow .card');
      const c = cs[0];
      const rd = c && c.querySelector('.rd');
      const syn = c && c.querySelector('.syn');
      return {
        cards: cs.length,
        rd: rd ? rd.textContent.replace(/\s+/g, ' ').trim() : '(none)',
        syn: syn ? syn.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) : '(none)',
        synLive: !!(syn && syn.classList.contains('live')),
        cardH: c ? Math.round(c.getBoundingClientRect().height) : 0,
      };
    });
    return JSON.stringify(info);
  }, 2);

  // 5) 选掉卡 → 引导跳到「清波」
  await run('05-guide-wave', ...D, async p => {
    await launch(p);
    // 模拟「已学会前 3 步」的玩家：先标掉 move/fire/collect，再看选完卡是否推进到「清波」
    await p.evaluate(() => NOVA.debug('GUIDE_STEPS.slice(0,3).forEach(s=>guideMark(s.id))'));
    await p.evaluate(() => NOVA.giveXp(25)); await p.waitForTimeout(1000);
    await p.click('#cardrow .card'); await p.waitForTimeout(1000);
    const t = await gt(p);
    return `step=${await step(p)} on=${t.on} txt="${t.txt.slice(0, 24)}"`;
  });

  // 6) 竖屏：引导条必须让开右下 FIRE（不能叠在一起）
  await run('06-guide-mobile', ...M, async p => {
    await launch(p);
    await p.evaluate(() => NOVA.debug('setTouch(true)')); // 无头里没有真实触点，手动进触屏模式
    await p.waitForTimeout(400);
    const box = await p.evaluate(() => {
      const g = document.querySelector('#guide').getBoundingClientRect();
      const f = document.querySelector('#firebtn').getBoundingClientRect();
      return {
        isTouch: 'see-firebtn',
        fireHidden: document.querySelector('#firebtn').hidden,
        guide: [Math.round(g.top), Math.round(g.bottom)],
        fire: [Math.round(f.top), Math.round(f.bottom)],
        overlap: !(g.bottom < f.top || g.top > f.bottom),
        w: Math.round(g.width),
      };
    });
    return JSON.stringify(box);
  }, 2);

  // 7) 竖屏手牌：名片高度是否放得下新增的读数 + 协同
  await run('07-cards-mobile', ...M, async p => {
    await launch(p);
    await p.evaluate(() => NOVA.giveXp(25)); await p.waitForTimeout(1200);
    const info = await p.evaluate(() => {
      const row = document.querySelector('#cardrow');
      const c = row.querySelector('.card');
      return { deck: row.classList.contains('deck'), rowH: Math.round(row.getBoundingClientRect().height),
        cardH: c ? Math.round(c.getBoundingClientRect().height) : 0,
        overflow: c ? Math.max(0, Math.round(c.getBoundingClientRect().bottom - row.getBoundingClientRect().bottom)) : 0 };
    });
    return JSON.stringify(info);
  }, 2);

  // 10) 穷举全部模块：未持有 / 持有 LV1 两种状态下调 modStats 都不能抛、都不能误报
  //     （卡片是随机三选一，任何一张卡都可能触发这类崩溃，必须全覆盖）
  await run('10-modstats-sweep', ...D, async p => {
    await launch(p);
    // MODULES / modStats 都在游戏 IIFE 闭包里，页面全局拿不到 —— 必须借 NOVA.debug 的 eval
    const rows = await p.evaluate(() => {
      const raw = NOVA.debug(
        "(()=>{const out=[];for(const m of MODULES){if(m.max===Infinity)continue;" +
        "const before=modStats(m.id).join(' / ');try{m.apply(1);}catch(e){}" +
        "const after=modStats(m.id).join(' / ');out.push({id:m.id,before,after});}" +
        "return JSON.stringify(out);})()");
      return JSON.parse(raw);
    });
    const err = rows.filter(r => /ERR/.test(r.before + r.after)).map(r => r.id);
    const stillBlank = rows.filter(r => /尚未装配|Not fitted/.test(r.after)).map(r => r.id);
    const nBlank = rows.filter(r => /尚未装配|Not fitted/.test(r.before)).length;
    return `modules=${rows.length} 未持有时空读数=${nBlank} 持有后仍空=${JSON.stringify(stillBlank)} ERR=${JSON.stringify(err)}`;
  });

  // 9) 强制构造「选中即可激活协同」的卡面 —— 协同块有数据时才偶发出现，必须定点验证标亮
  await run('09-cards-synergy', ...D, async p => {
    await launch(p);
    const info = await p.evaluate(() => {
      NOVA.debug("G.build.stasis=1;G.choices=[MOD_BY_ID.lance,MOD_BY_ID.stasis,MOD_BY_ID.drone];renderCards();G.mode='levelup';el.cards.hidden=false;");
      const c = document.querySelectorAll('#cardrow .card')[0];
      const syn = c.querySelector('.syn');
      return {
        live: !!(syn && syn.classList.contains('live')),
        rows: [...c.querySelectorAll('.synrow')].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
        on: [...c.querySelectorAll('.synrow')].map(r => r.classList.contains('on')),
      };
    });
    await p.waitForTimeout(500);
    return JSON.stringify(info);
  }, 2);

  // 8) 全部达成 → 引导应该彻底沉默（hidden），而不是继续显示最后一步
  await run('08-all-done', ...D, async p => {
    await launch(p);
    await p.evaluate(() => NOVA.debug('GUIDE_STEPS.forEach(s=>guideMark(s.id))'));
    await p.waitForTimeout(900);
    const t = await gt(p);
    return `hidden=${t.hidden} on=${t.on} seen=${await p.evaluate(() => NOVA.guide.seen().length)}`;
  });
})();
