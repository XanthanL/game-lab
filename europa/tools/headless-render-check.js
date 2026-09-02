// 无头渲染自检：用最小 Canvas/DOM 桩跑通 paint.js 与 render.js 的全部绘制路径。
// 目的是在没有浏览器的情况下抓出 ReferenceError / TypeError / 未定义方法这类硬错误，
// 不校验画面内容。node tools/headless-render-check.js

const calls = new Map();
function tally(name) { calls.set(name, (calls.get(name) || 0) + 1); }

class Ctx2D {
  constructor() { this.calls = 0; }
  setTransform() { tally('setTransform'); }
  fillRect() { tally('fillRect'); }
  clearRect() { tally('clearRect'); }
  translate() { tally('translate'); }
  scale() { tally('scale'); }
  save() { tally('save'); }
  restore() { tally('restore'); }
  clip() { tally('clip'); }
  beginPath() { tally('beginPath'); }
  closePath() { tally('closePath'); }
  moveTo() { tally('moveTo'); }
  lineTo() { tally('lineTo'); }
  arc() { tally('arc'); }
  rect() { tally('rect'); }
  fill() { tally('fill'); this.calls++; }
  stroke() { tally('stroke'); this.calls++; }
  drawImage() { tally('drawImage'); }
  fillText() { tally('fillText'); }
  strokeText() { tally('strokeText'); }
  /** 宽度按「字数 × 字号」近似——中文注记够用，只为跑通放得下判断 */
  measureText(t) { const size = parseFloat(this.font) || 10; return { width: String(t).length * size }; }
}
for (const k of ['fillStyle', 'strokeStyle', 'lineWidth', 'lineJoin', 'imageSmoothingEnabled']) {
  Object.defineProperty(Ctx2D.prototype, k, { get() { return this['_' + k]; }, set(v) { this['_' + k] = v; }, configurable: true });
}

class Path2DStub {
  constructor() { this.n = 0; }
  moveTo() { this.n++; } lineTo() { this.n++; } closePath() { this.n++; }
  rect() { this.n++; } arc() { this.n++; }
  addPath(p) { this.n += p ? p.n : 0; }
}

function makeCanvas(w = 1200, h = 760) {
  const c = {
    width: w, height: h,
    clientWidth: w, clientHeight: h,
    style: {},
    parentElement: null,
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    getContext: () => new Ctx2D(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
  };
  c.parentElement = { clientWidth: w, clientHeight: h, style: {}, appendChild() {}, addEventListener() {} };
  return c;
}

const canvas = makeCanvas();
globalThis.Path2D = Path2DStub;
globalThis.document = {
  createElement: () => makeCanvas(),
  getElementById: () => null,
  addEventListener() {},
};
globalThis.window = {
  devicePixelRatio: 2,
  addEventListener() {},
  removeEventListener() {},
};
globalThis.performance = globalThis.performance || { now: () => Date.now() };
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), 0);

const { createWorld } = await import('../js/world.js');
const { buildPaths, paintBase, fitView, pathOfIds, provinceColor } = await import('../js/paint.js');
const { Renderer } = await import('../js/render.js');
const { WORLD_W, WORLD_H } = await import('../js/geo.js');

let fail = 0;
const ok = (label, fn) => {
  try { fn(); console.log('  ✓', label); }
  catch (e) { fail++; console.log('  ✗', label, '\n     ', e.message, '\n', e.stack.split('\n')[1]); }
};

console.log('生成世界…');
const t0 = Date.now();
const world = createWorld({ seed: 'europa-1444' });
console.log(`  ${world.map.provinces.length} 陆省 / ${world.map.seas.length} 海域 · ${Date.now() - t0}ms`);

const paths = buildPaths(world.map);
console.log(`  Path2D 构建完成：${paths.provPaths.size} 条省路径`);

world.playerTag = 'FRA';

console.log('\n绘制路径自检：');
ok('paintBase · 全部 7 种模式', () => {
  for (const mode of ['political', 'terrain', 'religion', 'culture', 'trade', 'unrest', 'tradenode']) {
    paintBase(new Ctx2D(), world, paths, mode, fitView(WORLD_W, WORLD_H, 1200, 760), { w: 1200, h: 760, dpr: 2 });
  }
});
ok('provinceColor · 荒地/未殖民/海域省', () => {
  let n = 0;
  for (const p of world.provinces.values()) {
    for (const m of ['political', 'terrain', 'religion', 'culture', 'trade', 'unrest', 'tradenode']) {
      const c = provinceColor(p, world, m);
      if (typeof c !== 'string' || !c) throw new Error(`模式 ${m} 在省 ${p.id} 返回了 ${c}`);
    }
    n++;
  }
  if (n < 2000) throw new Error('省份数量异常：' + n);
});
ok('pathOfIds · 空集合与整国', () => {
  pathOfIds(paths, []);
  const c = world.countries.get('FRA');
  pathOfIds(paths, [...c.provinces]);
});

const renderer = new Renderer(canvas, world, paths);
console.log('\n渲染器自检：');
ok('fit / clampPan / pickProv', () => {
  renderer.fit();
  const v = renderer.view;
  if (!(v.zoom > 0) || !Number.isFinite(v.panX) || !Number.isFinite(v.panY)) {
    throw new Error('fit 后视图参数非法：' + JSON.stringify(v));
  }
  const [sx, sy] = renderer.worldToScreen(WORLD_W / 2, WORLD_H / 2);
  const pid = renderer.pickProv(sx, sy);
  if (typeof pid !== 'number') throw new Error('pickProv 未返回数字');
});
ok('draw · 首帧烘焙', () => { renderer.draw(); });
ok('draw · 第二帧命中缓存（不重烘焙）', () => {
  const before = calls.get('fill') || 0;
  renderer.overlayDirty = false;
  renderer.draw();
  const after = calls.get('fill') || 0;
  if (after !== before) throw new Error(`静止时仍重绘了 ${after - before} 次 fill`);
});
ok('zoomAt / panBy → 位图变换而非重烘焙', () => {
  renderer.zoomAt(600, 380, 1.4);
  renderer.panBy(40, -25);
  renderer.draw();
});
ok('setMode · 7 种模式切换', () => {
  for (const m of ['terrain', 'religion', 'culture', 'trade', 'unrest', 'tradenode', 'political']) {
    renderer.setMode(m);
    renderer.bakeAt = 0;
    renderer.draw();
  }
});
ok('focusOn · 飞向国家并居中收敛', () => {
  const c = world.countries.get('FRA');
  renderer.focusOn([...c.provinces], { margin: 0.8, dur: 400 });
  if (!renderer.anim) throw new Error('focusOn 没有建立动画');
  if (!Number.isFinite(renderer.view.zoom) || renderer.view.zoom <= renderer.fitZoom) {
    throw new Error('聚焦缩放非法或未真正放大：' + renderer.view.zoom);
  }
  // 模拟动画结束：把起始时间推到很久以前再 draw 一帧，应清空 anim 且 pan 合法
  renderer.anim.t0 = performance.now() - 100000;
  renderer.draw();
  if (renderer.anim) throw new Error('动画结束后 anim 未清空');
  if (!Number.isFinite(renderer.view.panX) || !Number.isFinite(renderer.view.panY)) {
    throw new Error('聚焦后 pan 非法');
  }
});
ok('focusOn · 玩家拖拽立即打断动画', () => {
  const c = world.countries.get('OTT');
  renderer.focusOn([...c.provinces]);
  if (!renderer.anim) throw new Error('聚焦未建立动画');
  renderer.panBy(30, -20);                 // 模拟玩家拖拽
  if (renderer.anim) throw new Error('拖拽后动画未被取消');
});
ok('setHover / setSelected ± 无效 id', () => {
  const some = world.map.provinces[0].id;
  for (const id of [some, -1, 999999, some]) { renderer.setHover(id); renderer.setSelected(id); renderer.draw(); }
});
ok('mapVersion 变化先标记、过节流窗口后重烘焙', () => {
  world.mapVersion++;
  renderer.draw();                                   // 这一步只置脏，烘焙被节流挡住
  if (!renderer.baseDirty) throw new Error('归属变化后没有标脏底图');
  if (renderer.bakeAt <= performance.now()) throw new Error('易主时应当延后重烘焙（节流），不是立即');
  const before = calls.get('fill') || 0;
  renderer.bakeAt = 0;
  renderer.draw();                                   // 节流窗口过去后才真正重画
  if ((calls.get('fill') || 0) <= before) throw new Error('过了节流窗口仍没有重烘焙');
});
ok('resize 到极小尺寸不崩', () => {
  canvas.parentElement.clientWidth = 320;
  canvas.parentElement.clientHeight = 240;
  renderer.cssW = 0; renderer.cssH = 0;
  renderer.resize();
  renderer.bakeAt = 0;
  renderer.draw();
});
ok('玩家国界随 playerTag 切换重建', () => {
  world.playerTag = 'OTT';
  world.mapVersion++;
  renderer.draw();
  renderer.bakeAt = 0;
  renderer.draw();
  if (renderer.playerBorder.tag !== 'OTT') throw new Error('玩家国界没有跟着换: ' + renderer.playerBorder.tag);
});

console.log('\n绘制调用统计（越少越好）：');
for (const k of ['fill', 'stroke', 'clip', 'drawImage']) console.log(`  ${k.padEnd(10)} ${calls.get(k) || 0}`);

console.log(fail === 0 ? '\n✓ 渲染自检全部通过' : `\n✗ ${fail} 项失败`);
process.exit(fail === 0 ? 0 : 1);
