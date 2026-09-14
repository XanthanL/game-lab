/* Phase 4.1 验证 —— 新增四种敌型（播雷者 / 干扰者 / 孵育体 / 裂解者）
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase4-1-check.js
 * 产出：../.workbuddy/shots/phase4/4-1-*.png + 每行状态断言
 *
 * 每张图独立浏览器实例（file:// 下 localStorage 跨 context 共享）。
 * 所有游戏作用域访问经 NOVA.* 钩子（IIFE 不可见 G/ENEMY_DEFS/EN_UNLOCK）。
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const OUT = path.join(__dirname, 'phase4');
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

const D = [1280, 900];

(async () => {
  // 1) 六表同步：24 型，EN_UNLOCK / EN_ZH / EN_EN / EN_TRAIT / ENEMY_DEFS 一个都不能缺
  await run('4-1-01-table-sync', ...D, async p => {
    return await p.evaluate(() => {
      const list = NOVA.enemy.list();
      const miss = NOVA.enemy.missing();
      const defs = NOVA.enemy.defs();
      const orphan = defs.filter(t => list.indexOf(t) < 0);
      return `n=${list.length} missing=${JSON.stringify(miss)} orphanDefs=${JSON.stringify(orphan)}`;
    });
  });

  // 2) 解锁波次：四新型落在 15/18/22/25，且全部 ≤ WIN_WAVE(30) —— 主线里真能遇到
  await run('4-1-02-unlock-waves', ...D, async p => {
    return await p.evaluate(() => {
      const u = NOVA.enemy.unlock();
      const nw = { sower: u.sower, jammer: u.jammer, brood: u.brood, sunder: u.sunder };
      const all = Object.values(u);
      return `new=${JSON.stringify(nw)} allLE30=${all.every(v => v <= 30)} max=${Math.max(...all)}`;
    });
  });

  // 3) 定义完整性：四型都要有 r / hp / spd / dmg / sc / xp / c
  await run('4-1-03-defs-complete', ...D, async p => {
    return await p.evaluate(() => {
      return NOVA.debug(`(function(){
        const need=['r','hp','spd','dmg','sc','xp','c'];
        const out={};
        for(const t of ['sower','jammer','brood','sunder']){
          const d=ENEMY_DEFS[t]||{};
          out[t]=need.filter(k=>d[k]===undefined);
        }
        return JSON.stringify(out);
      })()`);
    });
  });

  // 4) 编队归属：四型都至少进了一个 SQUADS（否则波次生成永远抽不到）
  await run('4-1-04-squad-coverage', ...D, async p => {
    return await p.evaluate(() => {
      const sq = NOVA.enemy.squads();
      const out = {};
      for (const t of ['sower', 'jammer', 'brood', 'sunder']) {
        out[t] = sq.filter(s => s.w && s.w.indexOf(t) >= 0).map(s => s.id);
      }
      const noCov = Object.keys(out).filter(t => out[t].length === 0);
      return `${JSON.stringify(out)} uncovered=${JSON.stringify(noCov)}`;
    });
  });

  // 5) 生成可用：每型 spawn 一只，数量 +1 且 hp > 0
  await run('4-1-05-spawnable', ...D, async p => {
    return await p.evaluate(() => {
      return NOVA.debug(`(function(){
        startGame(HULLS[0]);G.mode='play';
        const out={};
        for(const t of ['sower','jammer','brood','sunder']){
          const n0=G.enemies.length;
          spawnEnemy(t,P.x+300,P.y);
          const e=G.enemies[G.enemies.length-1];
          out[t]={added:G.enemies.length-n0,hpOk:e.hp>0,type:e.type};
          G.enemies.length=0;
        }
        return JSON.stringify(out);
      })()`);
    });
  });

  // 6) 播雷者：推进 ~10 秒逻辑后，场上应当出现 mine（且不超过单只上限 6）
  await run('4-1-06-sower-mines', ...D, async p => {
    return await p.evaluate(() => {
      return NOVA.debug(`(function(){
        startGame(HULLS[0]);G.mode='play';G.enemies.length=0;
        spawnEnemy('sower',P.x+300,P.y);
        for(let k=0;k<900;k++)updateEnemies(1/60);
        const mines=G.enemies.filter(e=>e.type==='mine').length;
        const sower=G.enemies.filter(e=>e.type==='sower')[0];
        return JSON.stringify({mines,sown:sower?sower.sown:null,total:G.enemies.length});
      })()`);
    });
  });

  // 7) 干扰场：贴身时 P.jamT 被续期；拉开后 0.4s 内自动解除
  await run('4-1-07-jam-field', ...D, async p => {
    return await p.evaluate(() => {
      const inField = NOVA.enemy.jamProbe();
      return `inField=${inField.inField} outField=${inField.outField} jamR=${inField.jamR}`;
    });
  });

  // 8) 干扰真的拖慢射速：真实走 updatePlayer，比较 fireCd（应为 1/JAM_FIRE ≈ 1.538 倍）
  await run('4-1-08-jam-fire-rate', ...D, async p => {
    return await p.evaluate(() => {
      return NOVA.debug(`(function(){
        startGame(HULLS[0]);G.mode='play';G.enemies.length=0;
        P.fireRate=3.6;P.rateT=0;P.jamT=0;P.invuln=999;
        mouse.down=true;
        P.fireCd=0;updatePlayer(1/60);const clean=P.fireCd;
        // 4.2 起 jamT 只管时长、倍率另存 jamF/jamS —— 断言必须按真实施加者那样三件套一起写，
        // 只写 jamT 会得到 ratio=1 的假绿（4.1-08 曾因此静默失效）
        P.fireCd=0;P.jamT=1;P.jamF=JAM_FIRE;P.jamS=JAM_SPD;updatePlayer(1/60);const jammed=P.fireCd;
        mouse.down=false;P.invuln=0;
        const ratio=+(jammed/clean).toFixed(3);
        return JSON.stringify({clean:+clean.toFixed(4),jammed:+jammed.toFixed(4),ratio,
          ok:Math.abs(ratio-1/JAM_FIRE)<0.01,JAM_FIRE:JAM_FIRE,JAM_SPD:JAM_SPD});
      })()`);
    });
  });

  // 9) 孵育体：推进后应当孵出 reaver，且受「单巢 10 + 场上 70」双上限约束
  await run('4-1-09-brood-hatch', ...D, async p => {
    return await p.evaluate(() => {
      return NOVA.debug(`(function(){
        startGame(HULLS[0]);G.mode='play';G.enemies.length=0;
        spawnEnemy('brood',P.x+380,P.y);
        for(let k=0;k<1800;k++)updateEnemies(1/60);
        const reavers=G.enemies.filter(e=>e.type==='reaver').length;
        const b=G.enemies.filter(e=>e.type==='brood')[0];
        return JSON.stringify({reavers,hatched:b?b.hatched:null,total:G.enemies.length});
      })()`);
    });
  });

  // 10) 裂解者撕盾：50 护盾 → 撕掉 SUNDER_STRIP(22) 剩 28；无盾时不报错
  await run('4-1-10-sunder-strip', ...D, async p => {
    return await p.evaluate(() => {
      return NOVA.debug(`(function(){
        startGame(HULLS[0]);G.mode='play';G.enemies.length=0;
        const a=NOVA.enemy.stripProbe();
        P.shield=0;sunderShield();
        return JSON.stringify({after:a.after,strip:a.strip,emptyShieldOk:P.shield===0});
      })()`);
    });
  });

  // 11) 图鉴自动收录：航行日志敌型图鉴应当有 24 格
  await run('4-1-11-bestiary', ...D, async p => {
    await p.evaluate(() => { NOVA.logbook.open(); });
    await p.waitForTimeout(400);
    return await p.evaluate(() => {
      const cells = document.querySelectorAll('#lbEnemies .lbcell').length;
      const names = [...document.querySelectorAll('#lbEnemies .lbcell')]
        .map(c => c.textContent.replace(/\s+/g, ' ').trim()).slice(-4);
      return `cells=${cells} tail=${JSON.stringify(names)}`;
    });
  });

  // 12) 回归：前序各系统数据规模不缩水 + 敌型总数 20 → 24
  await run('4-1-12-regress', ...D, async p => {
    return await p.evaluate(() => {
      const c = NOVA.counts();
      return `mods=${c.mods} syn=${c.syn} ach=${c.ach} enemies=${c.enemies} meta=${NOVA.meta.tree().length}`;
    });
  });
})();