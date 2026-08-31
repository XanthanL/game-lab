import { createWorld } from './world.js';
import { Renderer } from './render.js';
import { initGame, tick, SPEEDS } from './game.js';
import { createArmy, moveArmy } from './military.js';
import { fabricateClaim, declareWar } from './diplomacy.js';
import { takeTech } from './economy.js';

const world = createWorld({ seed: 'europa-1444', playerTag: 'FRA' });
initGame(world, { playerTag: 'FRA' });

const canvas = document.getElementById('map');
const renderer = new Renderer(canvas, world);

let selectedArmy = null;

function $(id) { return document.getElementById(id); }

function renderPanels() {
  const c = world.countries.get(world.playerTag);
  $('countryName').textContent = c.name;
  $('treasury').textContent = Math.floor(c.treasury);
  $('income').textContent = (c.stats.income - c.stats.expense).toFixed(1);
  $('manpower').textContent = Math.floor(c.manpower);
  $('forceLimit').textContent = c.forceLimit;
  $('adm').textContent = c.powers.adm;
  $('dip').textContent = c.powers.dip;
  $('mil').textContent = c.powers.mil;
  $('stability').textContent = c.stability;
  $('prestige').textContent = c.prestige.toFixed(0);
  $('legitimacy').textContent = c.legitimacy.toFixed(0);
  $('warExhaustion').textContent = c.warExhaustion.toFixed(1);
  $('development').textContent = c.development;
  $('provinces').textContent = c.provinces.size;
  $('techAdm').textContent = c.tech.adm;
  $('techDip').textContent = c.tech.dip;
  $('techMil').textContent = c.tech.mil;

  const sp = world.provinces.get(renderer.selectedId);
  if (sp && !sp.sea) {
    $('provName').textContent = sp.name;
    $('provOwner').textContent = '所有者：' + (sp.owner ? world.countries.get(sp.owner).name : '无');
    $('provController').textContent = '控制者：' + (sp.controller ? world.countries.get(sp.controller).name : '无');
    $('provReligion').textContent = '宗教：' + sp.religion;
    $('provCulture').textContent = '文化：' + sp.culture;
    $('provTerrain').textContent = '地形：' + sp.terrain;
    $('provGood').textContent = '贸易品：' + sp.tradeGood;
    $('provTax').textContent = sp.baseTax;
    $('provProd').textContent = sp.baseProduction;
    $('provMan').textContent = sp.baseManpower;
    $('provActions').style.display = sp.owner === world.playerTag ? 'none' : 'block';
  } else {
    $('provName').textContent = '省份';
    $('provActions').style.display = 'none';
  }
}

function updateDate() {
  $('date').textContent = `${world.date.y} 年 ${world.date.m} 月 ${world.date.d} 日`;
}

function pushLog(msg) {
  if (!msg) return;
  world.log.push(msg);
  if (world.log.length > 50) world.log.shift();
  $('log').textContent = world.log[world.log.length - 1];
}

// 地图交互
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const pid = renderer.pickProv(e.clientX - rect.left, e.clientY - rect.top);
  renderer.setHover(pid);
});
canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const pid = renderer.pickProv(e.clientX - rect.left, e.clientY - rect.top);
  if (pid < 0) return;
  const p = world.provinces.get(pid);
  if (p.sea) return;
  renderer.setSelected(pid);
  if (selectedArmy) {
    moveArmy(world, selectedArmy, pid);
    selectedArmy = null;
    canvas.style.cursor = 'crosshair';
  }
  renderPanels();
  renderer.dirty = true;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  renderer.zoom *= factor;
  renderer.dirty = true;
});
let dragging = false, last = null;
canvas.addEventListener('mousedown', (e) => { if (e.button === 1 || e.shiftKey) { dragging = true; last = [e.clientX, e.clientY]; } });
window.addEventListener('mouseup', () => { dragging = false; last = null; });
window.addEventListener('mousemove', (e) => {
  if (!dragging || !last) return;
  renderer.pan.x += e.clientX - last[0];
  renderer.pan.y += e.clientY - last[1];
  last = [e.clientX, e.clientY];
  renderer.dirty = true;
});

// 速度
for (const btn of document.querySelectorAll('.speed button')) {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.speed button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const s = Number(btn.dataset.speed);
    world.speed = s;
    world.paused = s === 0;
  });
}

// 地图模式
for (const btn of document.querySelectorAll('.map-modes button')) {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.map-modes button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    renderer.setMode(btn.dataset.mode);
  });
}

// 行动按钮
$('btnRaise').addEventListener('click', () => {
  const c = world.countries.get(world.playerTag);
  const size = Math.min(1000, Math.floor(c.manpower * 0.3));
  const a = createArmy(world, world.playerTag, c.capital, size);
  if (a) pushLog(`${c.name} 在 ${world.provinces.get(c.capital).name} 招募了 ${size} 人`);
  else pushLog('招募失败：人力或资金不足');
  renderPanels();
  renderer.dirty = true;
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
});

// 事件弹窗
function showEvent(ev) {
  const m = $('eventModal');
  $('evTitle').textContent = ev.title;
  $('evText').textContent = ev.text;
  const opts = $('evOptions');
  opts.innerHTML = '';
  for (const opt of ev.options) {
    const b = document.createElement('button');
    b.textContent = opt.text;
    b.addEventListener('click', () => { opt.effects(); m.style.display = 'none'; renderPanels(); renderer.dirty = true; });
    opts.appendChild(b);
  }
  m.style.display = 'flex';
}

// 主循环
let lastT = performance.now();
function loop(t) {
  const dt = t - lastT;
  lastT = t;
  // 约 250ms 一次 tick（4 tick/月）
  if (!world.paused && dt > 0) {
    // 用固定时间步
  }
  renderer.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// 定时 tick
setInterval(() => {
  if (world.paused) return;
  const res = tick(world);
  if (res) {
    updateDate();
    renderPanels();
    renderer.dirty = true;
    if (res.battles.length) pushLog(res.battles.map((b) => `${world.provinces.get(b.pid).name} 发生战斗`).join('；'));
    // 事件
    while (world.eventQueue.length) showEvent(world.eventQueue.shift());
  }
}, 250);

renderPanels();
updateDate();
