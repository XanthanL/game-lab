// 入口：生成世界 → 选国 → 进入主循环
import { createWorld } from './world.js';
import { buildPaths } from './paint.js';
import { Renderer } from './render.js';
import { initGame, tick } from './game.js';
import { createArmy, moveArmy } from './military.js';
import { fabricateClaim } from './diplomacy.js';
import { takeTech } from './economy.js';
import { runSetup } from './setup.js';

function $(id) { return document.getElementById(id); }

/* ── 面板写入全部走脏检查：数值没变就不碰 DOM ── */
const paneCache = new Map();
function setText(id, v) {
  const s = String(v);
  if (paneCache.get(id) === s) return;
  paneCache.set(id, s);
  const el = $(id);
  if (el) el.textContent = s;
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

async function boot() {
  const bootEl = $('boot');
  const msg = $('bootMsg');

  // createWorld 是同步重活（约 1.5–2.5s），先让浏览器把 loading 画出来再开跑
  await nextFrame();
  await nextFrame();

  const t0 = performance.now();
  const world = createWorld({ seed: 'europa-1444' });
  const paths = buildPaths(world.map);
  console.info(`[europa] 世界生成 ${(performance.now() - t0).toFixed(0)}ms · ` +
    `${world.map.provinces.length} 陆省 / ${world.map.seas.length} 海域`);

  msg.textContent = '世界已就绪';
  bootEl.classList.add('gone');
  setTimeout(() => { bootEl.style.display = 'none'; }, 240);

  const playerTag = await runSetup(world, paths);
  initGame(world, { playerTag });

  const canvas = $('map');
  const renderer = new Renderer(canvas, world, paths);

  /* ── 面板 ── */

  function renderPanels() {
    const c = world.countries.get(world.playerTag);
    if (!c) return;
    setText('countryName', c.name);
    setText('countryName2', c.name);
    setText('countryTag', c.tag);
    setText('treasury', Math.floor(c.treasury));
    setText('income', (c.stats.income - c.stats.expense).toFixed(1));
    setText('manpower', `${Math.floor(c.manpower)} / ${c.maxManpower}`);
    setText('forceLimit', c.forceLimit);
    setText('adm', c.powers.adm);
    setText('dip', c.powers.dip);
    setText('mil', c.powers.mil);
    setText('stability', c.stability);
    setText('prestige', c.prestige.toFixed(0));
    setText('legitimacy', c.legitimacy.toFixed(0));
    setText('warExhaustion', c.warExhaustion.toFixed(1));
    setText('development', c.development);
    setText('provinces', c.provinces.size);
    setText('techAdm', c.tech.adm);
    setText('techDip', c.tech.dip);
    setText('techMil', c.tech.mil);

    const sp = world.provinces.get(renderer.selectedId);
    if (sp && !sp.sea) {
      setText('provName', sp.name);
      setText('provOwner', '所有者：' + (sp.owner ? world.countries.get(sp.owner).name : '无'));
      setText('provController', '控制者：' + (sp.controller ? world.countries.get(sp.controller).name : '无'));
      setText('provReligion', '宗教：' + (sp.religion || '—'));
      setText('provCulture', '文化：' + (sp.culture || '—'));
      setText('provTerrain', '地形：' + (sp.terrain || '—'));
      setText('provGood', '贸易品：' + (sp.tradeGood || '—'));
      setText('provTax', sp.baseTax);
      setText('provProd', sp.baseProduction);
      setText('provMan', sp.baseManpower);
      $('provActions').style.display = sp.owner === world.playerTag ? 'none' : 'block';
    } else {
      setText('provName', '未选中省份');
      $('provActions').style.display = 'none';
    }
  }

  function updateDate() {
    setText('date', `${world.date.y} 年 ${world.date.m} 月 ${world.date.d} 日`);
  }

  function pushLog(msg) {
    if (!msg) return;
    world.log.push(msg);
    if (world.log.length > 200) world.log.shift();
    const el = $('log');
    el.textContent = msg;
    el.title = world.log.slice(-6).reverse().join('\n');
  }

  /* ── 地图交互 ── */

  let selectedArmy = null;
  let dragging = false;
  let dragButton = -1;
  let last = null;

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    if (dragging) {
      renderer.panBy(e.clientX - last[0], e.clientY - last[1]);
      last = [e.clientX, e.clientY];
      return;
    }
    renderer.setHover(renderer.pickProv(e.clientX - rect.left, e.clientY - rect.top));
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1 || e.button === 2 || e.shiftKey) {
      dragging = true; dragButton = e.button;
      last = [e.clientX, e.clientY];
      canvas.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const pid = renderer.pickProv(e.clientX - rect.left, e.clientY - rect.top);
    if (pid < 0) return;
    const p = world.provinces.get(pid);
    if (!p || p.sea) return;
    renderer.setSelected(pid);
    if (selectedArmy) {
      moveArmy(world, selectedArmy, pid);
      selectedArmy = null;
      canvas.style.cursor = 'crosshair';
    }
    renderPanels();
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false; dragButton = -1; last = null;
    canvas.style.cursor = 'crosshair';
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const f = Math.pow(0.9988, e.deltaY * (e.deltaMode === 1 ? 16 : 1));
    renderer.zoomAt(e.clientX - rect.left, e.clientY - rect.top, f);
  }, { passive: false });

  canvas.addEventListener('mouseleave', () => renderer.setHover(-1));

  // 双击复位视图
  canvas.addEventListener('dblclick', () => { renderer.fit(); renderer.touch(); });

  /* ── 速度与模式 ── */

  const speedBtns = [...document.querySelectorAll('.speed button')];
  function setSpeed(s) {
    world.speed = s;
    world.paused = s === 0;
    for (const b of speedBtns) b.classList.toggle('active', Number(b.dataset.speed) === s);
  }
  for (const btn of speedBtns) btn.addEventListener('click', () => setSpeed(Number(btn.dataset.speed)));

  for (const btn of document.querySelectorAll('.map-modes button')) {
    btn.addEventListener('click', () => {
      for (const b of document.querySelectorAll('.map-modes button')) b.classList.remove('active');
      btn.classList.add('active');
      renderer.setMode(btn.dataset.mode);
    });
  }

  /* ── 行动按钮 ── */

  $('btnRaise').addEventListener('click', () => {
    const c = world.countries.get(world.playerTag);
    const size = Math.min(1000, Math.floor(c.manpower * 0.3));
    const a = createArmy(world, world.playerTag, c.capital, size);
    pushLog(a ? `${c.name} 在 ${world.provinces.get(c.capital).name} 招募了 ${size} 人` : '招募失败：人力或资金不足');
    renderPanels();
    renderer.invalidate();
  });

  $('btnTech').addEventListener('click', () => {
    const branches = ['adm', 'dip', 'mil'];
    const br = branches[Math.floor(Math.random() * branches.length)];
    const ok = takeTech(world, world.playerTag, br);
    pushLog(ok ? `提升了 ${br.toUpperCase()} 科技` : '君主点数不足以提升科技');
    renderPanels();
  });

  $('btnClaim').addEventListener('click', () => {
    const p = world.provinces.get(renderer.selectedId);
    if (!p || p.owner === world.playerTag) return;
    const ok = fabricateClaim(world, world.playerTag, renderer.selectedId);
    pushLog(ok ? `已对 ${p.name} 伪造宣称` : '无法伪造宣称');
    renderPanels();
  });

  $('btnMove').addEventListener('click', () => {
    const c = world.countries.get(world.playerTag);
    const armies = c.armies.filter((a) => !a.movement);
    if (!armies.length) { pushLog('没有可移动的军队'); return; }
    selectedArmy = armies[0];
    canvas.style.cursor = 'move';
    pushLog('已选中一支军队，点击相邻省份下达移动命令（Esc 取消）');
  });

  /* ── 事件弹窗：弹出时自动暂停 ── */

  let eventOpen = false;
  function showEvent(ev) {
    eventOpen = true;
    world.paused = true;
    for (const b of speedBtns) b.classList.remove('active');
    const m = $('eventModal');
    $('evTitle').textContent = ev.title;
    $('evText').textContent = ev.text;
    const opts = $('evOptions');
    opts.innerHTML = '';
    for (const opt of ev.options) {
      const b = document.createElement('button');
      b.textContent = opt.text;
      b.addEventListener('click', () => {
        try { opt.effects(); } catch (err) { console.error(err); }
        m.style.display = 'none';
        eventOpen = false;
        renderPanels();
        renderer.invalidate();
      });
      opts.appendChild(b);
    }
    m.style.display = 'flex';
  }

  /* ── 键盘 ── */

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === 'Escape') {
      if (selectedArmy) { selectedArmy = null; canvas.style.cursor = 'crosshair'; }
      else renderer.setSelected(-1);
    } else if (e.code === 'Space') {
      e.preventDefault();
      setSpeed(world.paused ? (world.speed || 1) : 0);
    } else if (e.key === '1') setSpeed(1);
    else if (e.key === '2') setSpeed(2);
    else if (e.key === '3' || e.key === '4') setSpeed(4);
  });

  /* ── 主循环：requestAnimationFrame 驱动，固定步长，速度真正生效 ── */

  const TICK_MS = 480;            // 1× 速度下一个 tick 的间隔
  let acc = 0;
  let lastT = performance.now();

  function doTick() {
    const res = tick(world);
    if (!res) return;
    updateDate();
    renderPanels();
    renderer.invalidate();
    for (const b of res.battles) {
      pushLog(`${world.countries.get(b.a).name} 与 ${world.countries.get(b.b).name} 在 ${world.provinces.get(b.pid).name} 交战`);
    }
    for (const s of res.sieges) {
      pushLog(`${world.countries.get(s.tag).name} 攻占了 ${world.provinces.get(s.pid).name}`);
    }
    if (!eventOpen && world.eventQueue.length) showEvent(world.eventQueue.shift());
  }

  function frame(now) {
    const dt = Math.min(now - lastT, 250);   // 切标签页回来别一次补几百个 tick
    lastT = now;
    if (!world.paused && world.speed > 0 && !eventOpen) {
      acc += dt * world.speed;
      let n = 0;
      while (acc >= TICK_MS && n < 4) { acc -= TICK_MS; doTick(); n++; }
      if (acc > TICK_MS * 4) acc = 0;        // 追不上就丢，别雪崩
    } else {
      acc = 0;
    }
    renderer.draw();
    requestAnimationFrame(frame);
  }

  renderPanels();
  updateDate();
  setSpeed(0);
  pushLog(`${world.countries.get(world.playerTag).name} 的统治开始了。`);
  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error(err);
  const msg = $('bootMsg');
  if (msg) msg.textContent = '初始化失败：' + err.message;
});
