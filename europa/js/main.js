// 入口：生成世界 → 选国 → 主循环 → 面板。
//
// 这里的职责被压到最小：建世界、跑循环、把地图点击转交给 UI。
// 所有面板与交互都在 ui.js 里，改动游戏内容不必碰这个文件。

import { createWorld } from './world.js';
import { buildPaths } from './paint.js';
import { Renderer } from './render.js';
import { initGame, tick } from './game.js';
import { runSetup } from './setup.js';
import { UI } from './ui.js';

function $(id) { return document.getElementById(id); }
// 让浏览器先把 loading 画出来的宏任务让步。rAF 在后台标签页里永远不触发，
// setTimeout 会被节流到分钟级，MessageChannel 是唯一不被节流的让步手段。
const yieldTask = () => new Promise((r) => {
  const ch = new MessageChannel();
  ch.port1.onmessage = () => { ch.port1.close(); r(); };
  ch.port2.postMessage(0);
});

async function boot() {
  const bootEl = $('boot');
  const msg = $('bootMsg');

  // createWorld 是同步重活（约 1.5–2.5s），先让浏览器把 loading 画出来再开跑
  await yieldTask();
  await yieldTask();

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

  /* ── 日志条 ── */

  function pushLog(text) {
    const el = $('log');
    if (!el) return;
    el.textContent = text;
    el.title = world.log.slice(-8).reverse().join('\n');
  }

  const ui = new UI({ world, renderer, onLog: pushLog });
  world.playerTag = playerTag;
  ui.selProv = world.countries.get(playerTag).capital ?? -1;
  renderer.setSelected(ui.selProv);

  /* ── 地图交互 ── */

  let dragging = false;
  let last = null;

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    if (dragging) {
      renderer.panBy(e.clientX - last[0], e.clientY - last[1]);
      last = [e.clientX, e.clientY];
      return;
    }
    const pid = renderer.pickProv(e.clientX - rect.left, e.clientY - rect.top);
    renderer.setHover(pid);
    showTip(e, pid);
  });

  function showTip(e, pid) {
    const tip = $('hoverTip');
    if (!tip) return;
    if (pid < 0) { tip.hidden = true; return; }
    const p = world.provinces.get(pid);
    if (!p) { tip.hidden = true; return; }
    const owner = p.owner ? world.countries.get(p.owner) : null;
    const occ = p.controller && p.owner && p.controller !== p.owner;
    tip.innerHTML = `<b>${p.name}</b>`
      + (owner ? `<span>${owner.name}</span>` : '<span class="dim">无主之地</span>')
      + (occ ? `<span class="bad">被 ${world.countries.get(p.controller).name} 占领</span>` : '')
      + (p.siege ? `<span class="bad">围城中 ${Math.round((p.siege.progress / (30 + p.fort * 18)) * 100)}%</span>` : '')
      + (p.sea ? '' : `<span class="dim">发展度 ${p.baseTax + p.baseProduction + p.baseManpower}${p.fort ? ` · 要塞 ${p.fort}` : ''}</span>`);
    tip.hidden = false;
    const wrap = canvas.getBoundingClientRect();
    const x = Math.min(e.clientX - wrap.left + 14, wrap.width - tip.offsetWidth - 6);
    const y = Math.min(e.clientY - wrap.top + 14, wrap.height - tip.offsetHeight - 6);
    tip.style.left = Math.max(4, x) + 'px';
    tip.style.top = Math.max(4, y) + 'px';
  }

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1 || e.button === 2 || e.shiftKey) {
      dragging = true;
      last = [e.clientX, e.clientY];
      canvas.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const pid = renderer.pickProv(e.clientX - rect.left, e.clientY - rect.top);
    if (pid < 0) return;

    // 有待下达的命令（移动 / 调动 / 登陆）时，这一次点击算命令
    if (ui.onMapClick(pid)) { ui.markDirty(); return; }

    ui.selProv = pid;
    renderer.setSelected(pid);
    ui.markDirty();
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false; last = null;
    canvas.style.cursor = 'crosshair';
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const f = Math.pow(0.9988, e.deltaY * (e.deltaMode === 1 ? 16 : 1));
    renderer.zoomAt(e.clientX - rect.left, e.clientY - rect.top, f);
  }, { passive: false });

  canvas.addEventListener('mouseleave', () => { renderer.setHover(-1); $('hoverTip').hidden = true; });
  canvas.addEventListener('dblclick', () => { renderer.fit(); renderer.touch(); });

  /* ── 速度与地图模式 ── */

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

  /* ── 键盘 ── */

  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement) return;
    if (e.key === 'Escape') {
      if (ui.modal) { ui.closeModal(); return; }
      if (!ui.cancelPending()) { ui.selProv = -1; renderer.setSelected(-1); ui.markDirty(); }
      return;
    }
    if (ui.modal) return;
    if (e.code === 'Space') { e.preventDefault(); setSpeed(world.paused ? (world.speed || 1) : 0); }
    else if (e.key === '1') setSpeed(1);
    else if (e.key === '2') setSpeed(2);
    else if (e.key === '3' || e.key === '4') setSpeed(4);
  });

  /* ── 主循环：固定步长，速度真正生效 ── */

  const TICK_MS = 480;            // 1× 速度下一个 tick 的间隔
  let acc = 0;
  let lastT = performance.now();

  function doTick() {
    const res = tick(world);
    if (!res) return;
    const el = $('date');
    if (el) el.textContent = res.date;
    ui.markDirty();
    renderer.invalidate();
    // 只播报最后一条，其余在日志条 title 里可翻
    const lastMsg = world.log[world.log.length - 1];
    if (lastMsg) pushLog(lastMsg);
    if (!ui.modal && world.eventQueue.length) ui.showEvent(world.eventQueue.shift());
  }

  function frame(now) {
    const dt = Math.min(now - lastT, 250);   // 切标签页回来别一次补几百个 tick
    lastT = now;
    if (!world.paused && world.speed > 0 && !ui.modal) {
      acc += dt * world.speed;
      let n = 0;
      while (acc >= TICK_MS && n < 4) { acc -= TICK_MS; doTick(); n++; }
      if (acc > TICK_MS * 4) acc = 0;        // 追不上就丢，别雪崩
    } else {
      acc = 0;
    }
    renderer.draw();
    ui.update(now);
  }

  // 前台用 rAF 驱动；后台标签页 rAF 停摆时由定时器看门狗接管，
  // 游戏不至于一切回来发现世界纹丝不动。
  let lastRafAt = 0;
  function loop(now) {
    lastRafAt = performance.now();
    frame(now);
    requestAnimationFrame(loop);
  }
  ui.render(true);
  setSpeed(0);
  pushLog(`${world.countries.get(playerTag).name} 的统治开始了。`);
  requestAnimationFrame(loop);
  setInterval(() => {
    if (performance.now() - lastRafAt > 400) frame(performance.now());
  }, 500);
}

boot().catch((err) => {
  console.error(err);
  const msg = $('bootMsg');
  if (msg) msg.textContent = '初始化失败：' + err.message;
});
