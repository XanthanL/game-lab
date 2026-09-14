/* Phase 2.4 验证 —— 死亡结算升级（死因 / 关键统计 / 构筑回顾）
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase2-4-check.js
 * 产出：../.workbuddy/shots/phase4/2-4-*.png + 每行状态断言
 *
 * 断言优先于截图：死因归属 / 统计读数 / 词缀标签直接从 NOVA.death.* 读。
 * 每张图独立浏览器实例（file:// 下 localStorage 跨 context 共享）。
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const OUT = path.join(__dirname, 'phase4');
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
  await p.waitForTimeout(1400);
  let note = '';
  try { note = (await job(p)) || ''; } catch (e) { errs.push('JOB:' + e.message.slice(0, 160)); }
  await p.screenshot({ path: path.join(OUT, tag + '.png'), fullPage: false });
  await c.close(); await b.close();
  console.log(tag.padEnd(24), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}

/* 开一局 → 可选装配模块 → 可选推进波次 → 打死玩家 → 跳过 dying → 读结算面板。
   注意 G.mode==='dying' 期间会跑 1.5s 动画，测试里直接 finish() 跳过。 */
const dieWith = async (p, { mods = [], wave = 0, src = 'env', dmg = 1e9, lang = 'zh' } = {}) => {
  await p.evaluate(() => NOVA.launch(0));
  await p.waitForTimeout(400);
  if (lang !== 'zh') await p.evaluate(l => NOVA.death.lang(l), lang);
  if (wave) { await p.evaluate(w => NOVA.wave(w), wave); await p.waitForTimeout(500); }
  for (const [id, n] of mods) await p.evaluate(([i, k]) => NOVA.build(i, k), [id, n]);
  await p.evaluate(([s, d]) => NOVA.death.kill(s, d), [src, dmg]);
  await p.waitForTimeout(120);
  await p.evaluate(() => NOVA.death.finish());
  await p.waitForTimeout(500);
  return p.evaluate(() => NOVA.death.over());
};

(async () => {
  const D = [1280, 900], M = [390, 844];

  // 1) 环境死：不传来源（撞小行星/残骸累积）→ 应归为「星尘与残骸」
  await run('2-4-01-cause-env', ...D, async p => {
    await p.evaluate(() => { try { localStorage.removeItem('nova-stats'); } catch (e) {} });
    // 用真实量级的伤害，避免 1e9 这种测试值出现在截图上
    const o = await dieWith(p, { src: 'env', dmg: 140 });
    const c = await p.evaluate(() => NOVA.death.cause());
    return `cause=${JSON.stringify(c)} text=${JSON.stringify(o.cause)}`;
  });

  // 2) 普通敌型死：幽灵打死 → 名称应为「幽灵 / Wraith」，特征一句在场
  await run('2-4-02-cause-enemy', ...D, async p => {
    const o = await dieWith(p, { wave: 10, src: 'wraith', dmg: 120 });
    const c = await p.evaluate(() => NOVA.death.cause());
    const L = await p.evaluate(() => NOVA.death.line());
    return `cause=${JSON.stringify(c)} name=${L.name} trait=${L.trait}`;
  });

  // 3) 巨像死：第 20 波九首巨兽打死 → 应显示巨像中文名 + 英文小标
  await run('2-4-03-cause-boss', ...D, async p => {
    const o = await dieWith(p, { wave: 20, src: 'boss:hydra', dmg: 160 });
    const c = await p.evaluate(() => NOVA.death.cause());
    return `cause=${JSON.stringify(c)} text=${JSON.stringify(o.cause)} tags=${JSON.stringify(o.tags)}`;
  });

  // 4) 词缀标签：带 volatile 词缀的来源 → 应出现「爆 词缀」标签
  await run('2-4-04-cause-affix', ...D, async p => {
    // 直接构造带词缀的来源走 causeLine（applyAffix 才会挂 affix 字段，测试里手工给）
    const L = await p.evaluate(() => NOVA.death.line({ kind: 'enemy', type: 'nova', affix: 'volatile', cum: 42 }));
    // 同时跑一次真实结算：把场上生成的 nova 打上 volatile 词缀再当来源
    await p.evaluate(() => NOVA.launch(0));
    await p.waitForTimeout(400);
    await p.evaluate(() => NOVA.spawnAt('nova', 0, 0));
    await p.evaluate(() => NOVA.debug(`(function(){
      const e=G.enemies[G.enemies.length-1]; e.affix='volatile'; e.volatile=true; return e.type;
    })()`));
    await p.evaluate(() => NOVA.death.kill('nova', 130));
    await p.waitForTimeout(150);
    await p.evaluate(() => NOVA.death.finish());
    await p.waitForTimeout(400);
    const over = await p.evaluate(() => NOVA.death.over());
    return `line.affix=${JSON.stringify(L.affix)} tags=${JSON.stringify(over.tags)}`;
  });

  // 5) 关键统计：本局输出 / 承伤 / 峰值威胁 / 换伤比 —— 都是本局可比的硬数
  await run('2-4-05-stats', ...D, async p => {
    await p.evaluate(() => NOVA.launch(0));
    await p.waitForTimeout(400);
    await p.evaluate(() => NOVA.wave(8));
    await p.waitForTimeout(2500);
    // 玩家自动火力不一定够得着 → 直接对场上的敌人/巨像结算几笔真实伤害（走 hurtEn/hurtAst 同一个出口）
    await p.evaluate(() => NOVA.debug(`(function(){
      const es=G.enemies.slice(0,3);
      for(const e of es){e.hp=e.maxHp=1e6;hurtEn(e,120,e.x,e.y,true);}
      const bs=G.asteroids.filter(a=>a.boss||a.champ);
      if(bs.length)hurtAst(bs[0],300,bs[0].x,bs[0].y,false);
      return es.length;
    })()`));
    // 再让玩家挨几下真实的（护盾先吃掉一部分也无所谓，dmgIn 记的是实扣）
    await p.evaluate(() => NOVA.debug(`(function(){
      P.shield=P.shieldMax=0;P.shieldTmp=0;
      P.invuln=0;hurtPlayer(18,P.x+60,P.y,G.enemies[0]||null);
      P.invuln=0;hurtPlayer(22,P.x+60,P.y,G.enemies[0]||null);
      return 1;
    })()`));
    await p.waitForTimeout(300);
    const st = await p.evaluate(() => NOVA.death.stats());
    await p.evaluate(() => NOVA.death.kill('env', 140));
    await p.waitForTimeout(120);
    await p.evaluate(() => NOVA.death.finish());
    await p.waitForTimeout(400);
    const extra = (await p.evaluate(() => NOVA.death.over())).extra;
    const ok = st.dmgOut > 0 && st.dmgIn > 0 && st.peak > 0;
    return `stats=${JSON.stringify(st)} allPositive=${ok} extra=${JSON.stringify(extra)}`;
  }, 2);

  // 6) 三块内容同屏：死因块 / 关键统计行 / 构筑回顾 chips 都要非空
  await run('2-4-06-all-blocks', ...D, async p => {
    const o = await dieWith(p, {
      mods: [['overdrive', 2], ['crit', 1], ['tesla', 1], ['nova', 1]], wave: 14, src: 'stalker', dmg: 130
    });
    return `cause=${!!o.cause} extra=${!!o.extra} chips=${o.chips} secTitle=${JSON.stringify(o.secTitle)}`;
  });

  // 7) 英文：同一来源在 EN 下应输出 Seeker / Chases straight at you
  await run('2-4-07-en', ...D, async p => {
    const o = await dieWith(p, { wave: 8, src: 'seeker', dmg: 120, lang: 'en' });
    return `text=${JSON.stringify(o.cause)} sec=${JSON.stringify(o.secTitle)}`;
  });

  // 8) 竖屏：结算面板在 390×844 不横向溢出，三块都在
  await run('2-4-08-mobile', ...M, async p => {
    const o = await dieWith(p, { mods: [['overdrive', 3], ['aegis', 2]], wave: 12, src: 'boss:warden', dmg: 150 });
    const m = await p.evaluate(() => {
      const r = document.querySelector('#over .panel').getBoundingClientRect();
      return { panelW: Math.round(r.width), vw: innerWidth, overflowX: Math.round(r.right - innerWidth) };
    });
    return `cause=${!!o.cause} extra=${!!o.extra} chips=${o.chips} ${JSON.stringify(m)}`;
  });

  // 9) 回归：语言切换后结算面板要重绘（否则中英混排）
  await run('2-4-09-lang-switch', ...D, async p => {
    await dieWith(p, { wave: 10, src: 'wraith', dmg: 120 });
    const before = (await p.evaluate(() => NOVA.death.over())).cause;
    await p.evaluate(() => NOVA.death.lang('en'));
    await p.waitForTimeout(400);
    const after = (await p.evaluate(() => NOVA.death.over())).cause;
    return `zh=${JSON.stringify(before)} en=${JSON.stringify(after)} changed=${before !== after}`;
  });

  // 10) 计数一致性：cause 的 kind/type 与传入来源匹配，且 G.cause 被固化
  await run('2-4-10-cause-solid', ...D, async p => {
    const o = await dieWith(p, { wave: 25, src: 'boss:warden', dmg: 160 });
    const c = await p.evaluate(() => NOVA.death.cause());
    const ok = c && c.kind === 'boss' && c.type === 'warden';
    // 再来一刀：死后不该改写 G.cause（die() 里 snapshot 之后 hurtPlayer 已不可能触发）
    await p.evaluate(() => { try { NOVA.death.kill('seeker', 1e9); } catch (e) {} });
    await p.waitForTimeout(150);
    const c2 = await p.evaluate(() => NOVA.death.cause());
    return `kind=${c.kind} type=${c.type} ok=${ok} stable=${c2.type === 'warden'}`;
  });
})();
