// cursed-house 行为回归探针：17 项断言（五章通关 / 提示-交互一致性 / 结算链 / 触屏信息层次）
// 用法: node tools/probe-cursed-house.cjs
// 依赖: puppeteer-core（本机装在 ~/.workbuddy/verify/node_modules，脚本会自动找）+ 本机 Chrome / Edge
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
let puppeteer;
try { puppeteer = require('puppeteer-core'); }
catch (e) { puppeteer = require(path.join(os.homedir(), '.workbuddy/verify/node_modules/puppeteer-core')); }
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'local-only');
const SHOT = n => path.join(OUT, n);
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const PORT = 8794;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!path.resolve(f).startsWith(path.resolve(ROOT))) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404).end('404'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const URL = `http://127.0.0.1:${PORT}/cursed-house/index.html`;

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--mute-audio'] });
  const R = { errors: [], checks: [], perf: {}, shots: [] };
  const add = (name, ok, detail) => R.checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });

  const makePage = async (vp, mobile) => {
    const p = await browser.newPage();
    p.on('pageerror', e => R.errors.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') R.errors.push('console: ' + m.text()); });
    await p.setRequestInterception(true);
    p.on('request', r => { if (r.url().startsWith('http://127.0.0.1:')) r.continue(); else r.respond({ status: 200, contentType: 'text/css', body: '' }); });
    await p.setViewport(vp);
    if (mobile) await p.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36');
    await p.goto(URL + '?cb=' + Date.now(), { waitUntil: 'domcontentloaded' });
    await sleep(600);
    return p;
  };

  // ---------- 桌面：通关路径 / 提示一致性 / 结算流程 / 性能 ----------
  const page = await makePage({ width: 1280, height: 720 }, false);
  const game = await page.evaluate(() => {
    const O = { paths: {}, drift: [], flow: {}, perf: {} };
    const press = () => { ePressed = true; update(0.016); };
    const pressUntil = (pred, max = 4) => { for (let i = 0; i < max && !pred(); i++) press(); return !!pred(); };
    const goto = (x, y, L) => { if (L !== undefined) lvl = L; player.x = x; player.y = y; };
    const stun = () => { if (ghost) ghost.stunT = 1e9; };
    const start = ch => { startChapter(ch, true); state = 'playing'; seq = null; notesFound = []; stun(); flashBlack = 0; toast = { text: '', t: 0 }; };

    // --- 五章通关（E 会先捡纸条，pressUntil 模拟玩家连按）---
    start(1);
    let ok = true;
    for (const d of dolls) { goto(d.x, d.y, d.lvl); ok = pressUntil(() => d.taken) && ok; }
    goto(keyItem.x, keyItem.y, keyItem.lvl);
    const keyHint1 = computeHint().t;                       // 纸条与钥匙同点：提示必须如实
    press(); const after1 = { hasKey, notes: notesFound.length };
    const keyHint2 = computeHint().t;
    press();
    const dr = findTile(0, 'D');
    goto(dr.x + 1, dr.y, 0); player.dirX = -1; player.dirY = 0; player.planeX = 0; player.planeY = 0.66;
    const doorOk = pressUntil(() => seq && seq.mode === 'win');
    O.paths.ch1 = { dolls: dollsTaken, hasKey, doorOk, keyHint1, keyHint2, after1 };

    start(2);
    for (let i = 0; i < 6; i++) { goto(ALTAR_X, ALTAR_Y, 2); pressUntil(() => ritualN > i); }
    goto(FIRE_X, FIRE_Y, 2);
    O.paths.ch2 = { ritualN, fireSpawned, win: pressUntil(() => seq && seq.mode === 'win') };

    start(3);
    for (const tb of tablets) { goto(tb.x, tb.y, 3); pressUntil(() => tb.taken); }
    goto(SHRINE_X, SHRINE_Y, 3); pressUntil(() => tabsPlaced >= 3);
    goto(DOOR_X, DOOR_Y, 3);
    O.paths.ch3 = { tabsPlaced, win: pressUntil(() => seq && seq.mode === 'win') };

    start(0);
    for (const t of ch0Tasks) { goto(t.x, t.y, 4); pressUntil(() => t.done); }
    goto(WELL_X, WELL_Y, 4);
    O.paths.ch0 = { errands, win: pressUntil(() => seq && seq.mode === 'win') };

    start(4);
    let sunk = 0;
    for (const o of offerings) {
      goto(o.x, o.y, 5); pressUntil(() => o.taken);
      goto(WELL_X, WELL_Y, 5); pressUntil(() => offerSunk > sunk);
      sunk = offerSunk;
    }
    goto(WELL_X, WELL_Y, 5);
    O.paths.ch4 = { offerSunk, bucketSpawned, win: pressUntil(() => seq && seq.mode === 'win') };

    // --- 提示/交互一致性：全点位扫描 ---
    const snap = () => [
      dollsTaken, hasKey, keyItem.taken, errands, ritualN, Math.round(oil), tabsCarried, tabsPlaced,
      offerSunk, carried.length, notesFound.length, lvl, hiding, seq && seq.mode, fireSpawned, bucketSpawned,
      dolls.filter(d => d.taken).length, keyItem.taken, oilJars.filter(j => j.taken).length,
      tablets.filter(t => t.taken).length, offerings.filter(o => o.taken).length,
      ch0Tasks.filter(t => t.done).length, toast.text
    ].join('|');
    const probe = (ch, label, x, y, L, setup) => {
      startChapter(ch, true); state = 'title'; seq = null; notesFound = []; stun();
      if (L !== undefined) lvl = L;
      if (setup) setup();
      player.x = x; player.y = y; flashBlack = 0; toast = { text: '', t: 0 };
      const hint = computeHint().t;
      const before = snap();
      try { interact(); } catch (e) { O.drift.push({ label, hint, verdict: 'THROW', err: String(e) }); return; }
      const changed = snap() !== before;
      const actionable = /^E /.test(hint);
      O.drift.push({ label, hint, verdict: (actionable && !changed) ? 'PROMPT_NO_ACTION' : (changed && !actionable) ? 'ACTION_NO_PROMPT' : 'ok' });
    };
    ch0Tasks.forEach((t, i) => probe(0, 'ch0-task' + i, t.x, t.y, 4));
    probe(0, 'ch0-well-busy', WELL_X, WELL_Y, 4);
    probe(0, 'ch0-well-done', WELL_X, WELL_Y, 4, () => { errands = 3; });
    dolls.forEach((d, i) => probe(1, 'ch1-doll' + i, d.x, d.y, d.lvl));
    probe(1, 'ch1-key', keyItem.x, keyItem.y, keyItem.lvl);
    probe(1, 'ch1-door', dr.x + 1, dr.y, 0, () => { player.dirX = -1; player.dirY = 0; player.planeX = 0; player.planeY = 0.66; });
    const up = findTile(0, 'U');
    probe(1, 'ch1-stairs', up.x, up.y + 1, 0, () => { player.dirX = 0; player.dirY = -1; player.planeX = 0.66; player.planeY = 0; });
    probe(2, 'ch2-altar', ALTAR_X, ALTAR_Y, 2);
    probe(2, 'ch2-fire', FIRE_X, FIRE_Y, 2, () => { fireSpawned = true; });
    const cTile = (() => { const t = tiles[2]; for (let y = 0; y < t.length; y++) for (let x = 0; x < t[0].length; x++) if (t[y][x] === 'C') return { x: x + 0.5, y: y + 1.5 }; })();
    if (cTile) probe(2, 'ch2-wardrobe', cTile.x, cTile.y, 2, () => { player.dirX = 0; player.dirY = -1; player.planeX = 0.66; player.planeY = 0; });
    probe(2, 'ch2-hiding', ALTAR_X, ALTAR_Y, 2, () => { hiding = true; });
    oilJars.filter(j => j.lvl === 3).forEach((j, i) => probe(3, 'ch3-jar' + i, j.x, j.y, 3));
    tablets.forEach((t, i) => probe(3, 'ch3-tablet' + i, t.x, t.y, 3));
    probe(3, 'ch3-shrine', SHRINE_X, SHRINE_Y, 3, () => { tabsCarried = 1; });
    probe(3, 'ch3-door', DOOR_X, DOOR_Y, 3, () => { tabsPlaced = 3; });
    offerings.forEach((o, i) => probe(4, 'ch4-offer' + i, o.x, o.y, 5));
    oilJars.filter(j => j.lvl === 5).forEach((j, i) => probe(4, 'ch4-jar' + i, j.x, j.y, 5));
    probe(4, 'ch4-well-carry', WELL_X, WELL_Y, 5, () => { carried.push('doll'); });
    probe(4, 'ch4-well-empty', WELL_X, WELL_Y, 5);
    NOTES.forEach((n, i) => probe(n.lvl === 0 ? 1 : (n.lvl === 2 ? 2 : (n.lvl === 3 ? 3 : 0)), 'note' + i, n.x, n.y, n.lvl));

    // --- 结算流程：下一章链 / 再玩一次 / 死亡原地重开 ---
    const labels = {};
    for (const ch of [0, 1, 2, 3, 4]) {
      startChapter(ch, true); state = 'playing'; seq = { mode: 'win', t: 2.7 }; update(0.1);
      const el = document.getElementById('goNext');
      labels[ch] = { state, text: el.textContent, hidden: el.classList.contains('hidden') };
    }
    O.flow.labels = labels;
    // 再玩一次本章
    startChapter(3, true); state = 'playing'; seq = { mode: 'win', t: 2.7 }; update(0.1);
    document.getElementById('replay').click();
    O.flow.replay = { state, chapter, seq: seq && seq.mode };
    // 下一章
    startChapter(1, true); state = 'playing'; seq = { mode: 'win', t: 2.7 }; update(0.1);
    document.getElementById('goNext').click();
    O.flow.next = { state, chapter };
    // 终章 → 回选章
    startChapter(4, true); state = 'playing'; seq = { mode: 'win', t: 2.7 }; update(0.1);
    document.getElementById('goNext').click();
    O.flow.final = { state, titleVisible: document.getElementById('title').style.display };
    // 死亡重开：给页面打标记，若 location.reload 会丢失
    window.__chMarker = 42;
    startChapter(1, true); state = 'dead'; document.getElementById('dead').style.display = 'flex';
    document.getElementById('dead').click();
    O.flow.dead = { state, chapter, marker: window.__chMarker, deadHidden: document.getElementById('dead').style.display };

    // --- 渲染耗时（软件渲染，取中位）---
    for (const ch of [0, 1, 2, 3, 4]) {
      startChapter(ch, true); state = 'playing'; seq = null;
      const ts = [];
      for (let i = 0; i < 24; i++) { const t = performance.now(); render(i * 0.033); ts.push(performance.now() - t); }
      ts.sort((a, b) => a - b);
      O.perf[ch] = +ts[12].toFixed(2);
    }
    return O;
  });

  const p = game.paths;
  add('ch1 通关路径(6偶+钥匙+门)', p.ch1.dolls === 6 && p.ch1.hasKey && p.ch1.doorOk, JSON.stringify(p.ch1));
  add('钥匙/纸条同点：先提示纸条再提示钥匙', p.ch1.keyHint1 === 'E 拾起纸条' && p.ch1.after1.hasKey === false && p.ch1.keyHint2 === 'E 捡起钥匙', p.ch1.keyHint1 + ' → ' + p.ch1.keyHint2);
  add('ch2 通关路径(送还6+点火)', p.ch2.ritualN === 6 && p.ch2.fireSpawned && p.ch2.win, JSON.stringify(p.ch2));
  add('ch3 通关路径(3牌位+神龛+门)', p.ch3.tabsPlaced === 3 && p.ch3.win, JSON.stringify(p.ch3));
  add('ch0 通关路径(3差事+井)', p.ch0.errands === 3 && p.ch0.win, JSON.stringify(p.ch0));
  add('ch4 通关路径(3祭品+沉桶)', p.ch4.offerSunk === 3 && p.ch4.bucketSpawned && p.ch4.win, JSON.stringify(p.ch4));
  const bad = game.drift.filter(d => d.verdict !== 'ok');
  add('提示/交互一致性 ' + game.drift.length + ' 点位', bad.length === 0, bad.length ? JSON.stringify(bad) : 'all ok');
  const L = game.flow.labels;
  add('全章「继续 · 下一章」链', L[0].text.includes('生还') && L[1].text.includes('归宅') && L[2].text.includes('义庄') && L[3].text.includes('封井') && L[4].text.includes('回到章节选择') && Object.values(L).every(v => !v.hidden && v.state === 'win'), JSON.stringify(L));
  add('「再玩一次本章」原地重开', game.flow.replay.state === 'playing' && game.flow.replay.chapter === 3, JSON.stringify(game.flow.replay));
  add('第一章「继续」进入第二章', game.flow.next.chapter === 2, JSON.stringify(game.flow.next));
  add('终章「回到章节选择」', game.flow.final.state === 'title' && game.flow.final.titleVisible === 'flex', JSON.stringify(game.flow.final));
  add('死亡原地重开（不 reload）', game.flow.dead.state === 'playing' && game.flow.dead.chapter === 1 && game.flow.dead.marker === 42 && game.flow.dead.deadHidden === 'none', JSON.stringify(game.flow.dead));
  R.perf = game.perf;
  await page.evaluate(() => { startChapter(1, true); state = 'playing'; seq = { mode: 'win', t: 2.7 }; update(0.1); });
  await page.screenshot({ path: SHOT('ch_win_desktop.png') });
  R.shots.push(SHOT('ch_win_desktop.png'));
  await page.close();

  // ---------- 手机：首屏信息层次 ----------
  const mp = await makePage({ width: 390, height: 844, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }, true);
  const lay = await mp.evaluate(() => {
    startChapter(1, true); state = 'playing'; flashBlack = 0; toast = { text: '', t: 0 };
    showLookHint();
    updateHud();                                  // 让 DOM HUD 真正显示，再量它的底边
    const lk = document.querySelector('#lookHint .lkBox');
    const hint = document.getElementById('lookHint');
    const hud = document.getElementById('mobileHud');
    const lr = lk.getBoundingClientRect(), hr = hud.getBoundingClientRect();
    const ay = 96, labelY = (ay - 16) * window.innerHeight / VH;   // 引导标签逻辑坐标 → CSS 像素
    const ui = () => ({ touch: document.getElementById('touch').style.display, hud: document.getElementById('mobileHud').style.display });
    const playingUI = ui();
    openPause(); const pausedUI = ui(); closePause();
    returnToTitle(); const titleUI = ui();
    startChapter(1, true); state = 'playing'; seq = { mode: 'win', t: 2.7 }; update(0.1);
    const winUI = ui(), winSeq = seq;
    startChapter(1, true); state = 'playing'; flashBlack = 0; toast = { text: '', t: 0 }; showLookHint(); updateHud();
    return {
      flexDir: getComputedStyle(hint).flexDirection,
      textWidth: Math.round(lr.width), textHeight: Math.round(lr.height),
      noWrap: lk.scrollWidth <= lk.clientWidth + 1,
      hudBottom: Math.round(hr.bottom), guideLabelY: Math.round(labelY),
      gap: Math.round(labelY - hr.bottom),
      playingUI, pausedUI, titleUI, winUI, winSeq,
    };
  });
  add('lookHint 竖排不折行', lay.flexDir === 'column' && lay.noWrap && lay.textHeight > 40 && lay.textHeight < 140, JSON.stringify(lay));
  add('触屏引导标签避开顶部 HUD', lay.gap > 8, 'gap=' + lay.gap + 'px');
  add('触屏按键只在游戏中显示', lay.playingUI.touch === 'block' && lay.playingUI.hud === 'flex'
    && ['pausedUI', 'titleUI', 'winUI'].every(k => lay[k].touch === 'none' && lay[k].hud === 'none'),
    JSON.stringify({ p: lay.playingUI, pause: lay.pausedUI, title: lay.titleUI, win: lay.winUI }));
  add('结算后停止世界渲染', lay.winSeq === null, 'seq=' + lay.winSeq);
  await mp.evaluate(() => { flashBlack = 0; toast = { text: '', t: 0 }; render(3.2); });
  await mp.screenshot({ path: SHOT('ch_mobile_after.png') });
  R.shots.push(SHOT('ch_mobile_after.png'));
  await mp.evaluate(() => { startChapter(1, true); state = 'playing'; seq = { mode: 'win', t: 2.7 }; update(0.1); });
  await mp.screenshot({ path: SHOT('ch_win_mobile.png') });
  R.shots.push(SHOT('ch_win_mobile.png'));
  await mp.close();

  add('无控制台错误', R.errors.length === 0, R.errors.join(' | '));
  const failed = R.checks.filter(c => !c.ok);
  R.summary = (R.checks.length - failed.length) + '/' + R.checks.length + ' passed';
  console.log(JSON.stringify(R, null, 2));
  await browser.close(); server.close();
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('ERR', e.stack); server.close(); process.exit(1); });
