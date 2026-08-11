// 无头渲染全部关卡（横屏 + 竖屏两套布局），捕获任何渲染期错误
global.window = global;
global.document = undefined;
const noop = () => {};
const gradStub = { addColorStop: noop };
const ctxStub = new Proxy({}, {
  get: (t, p) => p === 'canvas' ? ctxStub
    : (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') ? (() => gradStub)
      : noop,
  set: () => true
});
['js/config.js', 'js/anim.js', 'js/art/draw.js', 'js/art/sprites.js',
 'js/systems/collision.js', 'js/systems/save.js', 'js/systems/audio.js',
 'js/entities/plant.js', 'js/entities/zombie.js', 'js/entities/projectile.js', 'js/entities/effect.js',
 'js/systems/sun.js', 'js/systems/seed.js', 'js/game.js'
].forEach(f => require(require('path').resolve(f)));

const C = PVZ.config;
const N = C.LEVEL_LIST.length;

function checkLayout(mode) {
  C._mode = mode;
  const w = C.canvasWidth, h = C.canvasHeight;
  const lawnEndX = C.lawnOffsetX + C.gridCols * C.cellWidth;
  const lawnEndY = C.lawnOffsetY + C.gridRows * C.cellHeight;
  const ok = lawnEndX <= w + 0.5 && lawnEndY <= h + 0.5
    && C.cellWidth > 0 && C.cellHeight > 0 && C.lawnOffsetX >= 0 && C.lawnOffsetY >= 0;
  if (!ok) console.log(`[LAYOUT ${mode}] FAIL lawnEndX=${lawnEndX.toFixed(0)}/${w} lawnEndY=${lawnEndY.toFixed(0)}/${h}`);
  return ok;
}

let fails = 0;
for (const mode of ['landscape', 'portrait']) {
  if (!checkLayout(mode)) fails++;
  for (let i = 0; i < N; i++) {
    C._mode = mode;
    try {
      const g = new PVZ.Game({ onWin: noop, onLose: noop, levelId: i });
      g.useDomDock = (mode === 'portrait'); // 竖屏走 DOM dock 路径
      g.waves = [];
      g.spawnZombie('normal'); g.spawnZombie('cone');
      if (g.level.boss) g.spawnZombie(g.level.boss);
      g.explodeAt(4, 2, 1800, 1);
      for (let f = 0; f < 8; f++) { g.update(0.05); g.render(ctxStub); }
    } catch (e) {
      fails++;
      console.log(`[${mode}] L${i} (${C.LEVEL_LIST[i].id}) ERR: ${e.message}`);
    }
  }
}
console.log(fails === 0 ? `ALL 23 LEVELS x 2 MODES RENDER OK` : `${fails} CASES FAILED`);
process.exitCode = fails ? 1 : 0;
