// singularity-voyage 验证：可组合子弹外观系统（2026-10-03 新增）
// 自包含：自己起静态服务 + 拉起本地 Chrome，跑完收尾。
// 运行： NODE_PATH=<node-workspace>/node_modules CHROME_EXE=<chrome> node probes/sv-bulletskin-check.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8612;
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.writeHead(404); res.end('nf'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

const log = (...a) => console.log(...a);

(async () => {
  await new Promise(r => server.listen(PORT, r));
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: CHROME, headless: true,
      args: ['--no-sandbox', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
    });
    const errs = [];
    const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
    page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)); });

    await page.goto(`http://127.0.0.1:${PORT}/index.html?god=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', null, { timeout: 20000 });
    await page.evaluate(() => { startGame(); });
    await page.waitForFunction(() => window.__dbg.state === 'play', null, { timeout: 10000 });
    await page.waitForTimeout(300);

    const R = await page.evaluate(() => new Promise(async (resolve, reject) => {
      try {
        const d = window.__dbg, G = d.G;
        const res = { fatal: null };
        const frame = () => new Promise(r => requestAnimationFrame(r));

        // ---- 隔离 helper：直接摆好 G.mods / G.S 的 gold 标志 / G.syn，再调解析器 ----
        // 这样测的是「外观层」本身，不被进度系统污染（数值逻辑由别的探针管）。
        function lookWith(mods, syn, Sflags, kind) {
          for (const k in G.mods) delete G.mods[k];
          Object.assign(G.mods, mods || {});
          for (const k in G.S) { if (/Gold$/.test(k)) G.S[k] = false; }
          Object.assign(G.S, Sflags || {});
          for (const k in G.syn) G.syn[k] = false;
          Object.assign(G.syn, syn || {});
          return bulletLookSpec(kind || 'main');
        }

        // ① 家族矩阵：单卡逐级 + 组合
        const famMatrix = [
          ['无卡', {}], ['穿甲1', { piercer: 1 }], ['穿甲3', { piercer: 3 }],
          ['高爆2', { hesh: 2 }], ['裂变2', { fission: 2 }], ['制导2', { guided: 2 }],
          ['穿甲+高爆2', { piercer: 2, hesh: 2 }], ['穿甲+口径2', { piercer: 2, caliber: 2 }],
          ['穿甲+制导2', { piercer: 2, guided: 2 }], ['跳弹+高爆2', { ricochet: 2, hesh: 2 }],
          ['裂变+高爆2', { fission: 2, hesh: 2 }],
        ];
        res.family = famMatrix.map(([name, mods]) => {
          const s = lookWith(mods, null, null, 'main');
          return { name, family: s.family, tier: s.tier };
        });

        // ② 逐级 tier 必须随等级单调
        res.tierMono = [1, 2, 3].map(n => {
          const s = lookWith({ piercer: n }, null, null, 'main');
          return s.tier;
        });

        // ③ 来源配色（基础 + 质变金）
        res.tint = {};
        res.tint.main = lookWith({}, null, null, 'main').tint;          // 默认 cyan
        res.tint.rear = lookWith({}, null, null, 'rear').tint;           // 默认 amber
        res.tint.spray = lookWith({}, null, null, 'spray').tint;         // 默认 ice
        res.tint.shard = lookWith({}, null, null, 'shard').tint;         // 默认 amber
        res.tint.drone = lookWith({}, null, null, 'drone').tint;         // 固定 gold
        res.tint.mainGold = lookWith({ caliber: 3 }, null, { caliberGold: true }, 'main').tint;
        res.tint.rearGold = lookWith({ backshot: 3 }, null, { backGold: true }, 'rear').tint;
        res.tint.fissionGold = lookWith({ fission: 3 }, null, { fissionGold: true }, 'shard').tint;
        res.tint.sprayGold = lookWith({ spray: 3 }, null, { sprayGold: true }, 'spray').tint;

        // ④ 协同装饰 / 配色覆盖
        res.syn = {};
        const sHeavy = lookWith({ piercer: 2 }, { heavyBore: true }, null, 'main');
        res.syn.heavyBore = { deco: sHeavy.deco, aura: !!sHeavy.aura };
        const sRes = lookWith({ piercer: 1 }, { resonance: true }, null, 'main');
        res.syn.resonance = { tint: sRes.tint, deco: sRes.deco };
        const sHarv = lookWith({ execute: 1 }, { harvest: true }, null, 'main');
        res.syn.harvest = { tint: sHarv.tint, deco: sHarv.deco };
        const sVolley = lookWith({ piercer: 1 }, { volley: true }, null, 'main');
        res.syn.volley = { deco: sVolley.deco };
        const sLance = lookWith({ lance: 2 }, { lancePierce: true }, null, 'main');
        res.syn.lancePierce = { deco: sLance.deco };

        // ⑤ 单卡高阶装饰
        res.modDeco = {};
        res.modDeco.bind = lookWith({ bind: 2 }, null, null, 'main').deco;
        res.modDeco.isolate = lookWith({ isolate: 2 }, null, null, 'main').deco;
        res.modDeco.execute = lookWith({ execute: 2 }, null, null, 'main').deco;
        res.modDeco.bindLv1 = lookWith({ bind: 1 }, null, null, 'main').deco;  // 应无（lv<2）

        // ⑥ 已弹过 → 更烫（bounceN>0 时的临时装饰）
        res.bounced = BDECO_BOUNCED;
        res.bouncedLook = bulletLookSpec('main', BDECO_BOUNCED).deco;

        // ⑦ 每个家族 × 3 级的轮廓都非空白，且 make 出的精灵是 24 向、有尺寸
        const fams = BulletSkin.families();
        res.shapeAllOk = true; res.shapeBad = [];
        for (const f of fams) {
          for (let t = 1; t <= 3; t++) {
            const rows = BulletSkin.rows({ family: f, tier: t });
            const filled = rows.join('').replace(/\./g, '').length;
            const look = BulletSkin.make({ family: f, tier: t, size: 0, tint: 'cyan' });
            const ok = filled > 0 && look.set.imgs.length === 24 && look.set.half > 0 && look.set.size > 0;
            if (!ok) { res.shapeAllOk = false; res.shapeBad.push(f + ':' + t); }
          }
        }

        // ⑧ 缓存有界：穷举所有组合后，shape 缓存不得超过 BCACHE_MAX(56)
        const tints = BulletSkin.tints();
        let built = 0;
        for (const f of fams) for (let t = 1; t <= 3; t++) for (let sz = 0; sz <= 3; sz++)
          for (const ti of tints) { BulletSkin.make({ family: f, tier: t, size: sz, tint: ti }); built++; }
        for (const dc of BulletSkin.decos()) BulletSkin.make({ family: 'plain', tier: 1, size: 0, tint: 'cyan', deco: dc });
        res.cacheBuilt = built;
        res.cacheSize = BulletSkin.cacheSize();

        // ⑨ 真实对局里 drawPBullets 不报错：开火 1.5 秒，再统计 JS 错误（见 errs）
        G.bullets.length = 0;
        await frame(); await frame();
        const t0 = performance.now();
        for (let i = 0; i < 90; i++) await frame();   // ~1.5s @60fps
        res.playFrames = 90; res.playMs = Math.round(performance.now() - t0);

        // ⑩ 总览图：把每个家族 × 3 级画到一张 canvas，返回 dataURL
        const SCALE = 5, CELL = 130, COLS = 6;
        const rows = Math.ceil(fams.length / COLS);
        const cv = document.createElement('canvas');
        cv.width = COLS * CELL; cv.height = rows * CELL;
        const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
        fams.forEach((f, idx) => {
          const cx = (idx % COLS) * CELL + 8, cy = Math.floor(idx / COLS) * CELL + 6;
          x.fillStyle = '#0a0e14'; x.fillRect(cx - 4, cy - 4, CELL - 8, CELL - 8);
          for (let t = 1; t <= 3; t++) {
            const look = BulletSkin.make({ family: f, tier: t, size: 0, tint: 'cyan' });
            const img = look.set.imgs[0];
            const ox = cx + (t - 1) * 38, oy = cy + 40;
            x.drawImage(img, ox, oy, img.width * SCALE, img.height * SCALE);
          }
          x.fillStyle = '#cfe8ff'; x.font = '10px monospace';
          x.fillText(f, cx, cy + 14);
        });
        res.overview = cv.toDataURL('image/png');

        res.errs = window.__dbgErrs || null;
        resolve(res);
      } catch (e) { reject(String(e && e.stack || e)); }
    }));

    await browser.close();
    await new Promise(r => server.close(r));

    if (errs.length) {
      log('== 页面 JS 错误 ==');
      errs.slice(0, 10).forEach(e => log('  ' + e));
      process.exitCode = 1;
    }
    if (R.fatal) { log('FATAL', R.fatal); process.exit(1); }

    log('== ① 家族矩阵（来源=main）==');
    R.family.forEach(r => log('  ' + (r.name + '                ').slice(0, 16) + ' → family=' + r.family + ' tier=' + r.tier));
    log('== ② 穿甲逐级 tier（应 1,2,3）== ' + JSON.stringify(R.tierMono));
    log('== ③ 来源配色 ==');
    for (const k in R.tint) log('  ' + (k + '            ').slice(0, 14) + ' → ' + R.tint[k]);
    log('== ④ 协同装饰/配色 ==');
    log('  heavyBore : deco=' + R.syn.heavyBore.deco + ' aura=' + R.syn.heavyBore.aura);
    log('  resonance : tint=' + R.syn.resonance.tint + ' deco=' + R.syn.resonance.deco);
    log('  harvest   : tint=' + R.syn.harvest.tint + ' deco=' + R.syn.harvest.deco);
    log('  volley    : deco=' + R.syn.volley.deco);
    log('  lancePierce: deco=' + R.syn.lancePierce.deco);
    log('== ⑤ 单卡高阶装饰（lv2 才有，lv1 无）==');
    log('  bind lv2=' + R.modDeco.bind + ' | isolate lv2=' + R.modDeco.isolate + ' | execute lv2=' + R.modDeco.execute + ' | bind lv1=' + R.modDeco.bindLv1);
    log('== ⑥ 已弹过装饰 == bounced=' + R.bounced + ' look=' + R.bouncedLook);
    log('== ⑦ 所有家族×3级轮廓非空白 & make 24向 == ' + (R.shapeAllOk ? '全部 OK' : '失败 ' + JSON.stringify(R.shapeBad)));
    log('== ⑧ 缓存有界 == 穷举 ' + R.cacheBuilt + ' 种组合后 shape缓存=' + R.cacheSize.shape + ' deco缓存=' + R.cacheSize.deco + ' (上限 56)');
    log('== ⑨ 真实对局 drawPBullets 跑 ' + R.playFrames + ' 帧 / ' + R.playMs + 'ms ==');

    if (R.overview) {
      const b64 = R.overview.split(',')[1];
      fs.writeFileSync(path.join(__dirname, 'bullet-overview.png'), Buffer.from(b64, 'base64'));
      log('== ⑩ 已写出总览图 probes/bullet-overview.png ==');
    }
    if (errs.length) process.exitCode = 1;
  } catch (e) {
    log('PROBE ERROR', e);
    if (browser) await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
    process.exit(1);
  }
})();
