// 回归检查：蹦极僵尸（speed=0）必须能自行离场。
// 它不走进草坪，一旦留在场上 checkWin() 的 zombies.length===0 就永远不成立，
// 4-2 / 4-3 / 4-4 这三关会卡在最后一波无法通关（迷雾关里它还被雾遮住，玩家无从发现）。
global.window = global;
global.document = undefined;

const noop = () => {};
const ctxStub = new Proxy({}, {
  get: (t, p) => (p === 'canvas' ? ctxStub : noop),
  set: () => true
});

const files = [
  'js/config.js', 'js/anim.js', 'js/art/draw.js', 'js/art/sprites.js',
  'js/systems/collision.js',
  'js/systems/save.js', 'js/systems/audio.js',
  'js/entities/plant.js', 'js/entities/zombie.js', 'js/entities/projectile.js',
  'js/entities/effect.js', 'js/systems/sun.js', 'js/systems/seed.js', 'js/game.js'
];
files.forEach(f => require(require('path').resolve(f)));

const DT = 1 / 30;
const G = PVZ.config;
let assertions = [];
function check(name, cond) {
  assertions.push(`${cond ? 'PASS' : 'FAIL'} ${name}`);
  if (!cond) process.exitCode = 1;
}

function bareGame(id) {
  const g = new PVZ.Game({ levelId: id, onWin: noop, onLose: noop });
  g.waves = [];
  g.activeWave = null;
  g._win = false;
  g._lose = false;
  g.onWin = () => { g._win = true; };
  g.onLose = () => { g._lose = true; };
  return g;
}

// --- 生命周期：下降 -> 摘走植物 -> 升空离场 ---
{
  const g = bareGame(0);
  g.plantAt(4, 2, 'wallnut');
  g.spawnZombie('bungee');
  const z = g.zombies[0];
  check('bungee drops onto the planted cell', z.row === 2 && g.grid[2][4] !== null);

  let stoleAt = null, goneAt = null;
  for (let i = 0; i < 60 / DT && goneAt === null; i++) {
    g.update(DT);
    if (stoleAt === null && !g.grid[2][4]) stoleAt = g.time;
    if (!g.zombies.includes(z)) goneAt = g.time;
  }
  check('bungee uproots the plant it lands on', stoleAt !== null);
  check('bungee leaves the lawn under its own power', goneAt !== null && goneAt < 12);
  check('wave can be declared clear once bungee is gone', (() => {
    for (let i = 0; i < 200 / DT && !g._win; i++) g.update(DT);
    return g._win;
  })());
}

// --- 空中也可被击落，玩家永远有解 ---
{
  const g = bareGame(0);
  g.spawnZombie('bungee');
  const z = g.zombies[0];
  for (let c = 0; c < 5; c++) g.plantAt(c, z.row, 'repeater');
  for (let i = 0; i < 40 / DT && z.state !== 'dead'; i++) g.update(DT);
  check('bungee is shootable while suspended', z.state === 'dead');
}

// --- 三个迷雾关：单边防线（右侧两列不放植物）也必须能打完 ---
['4-2', '4-3', '4-4'].forEach(id => {
  const idx = G.LEVEL_LIST.findIndex(l => l.id === id);
  const g = new PVZ.Game({ levelId: idx, onWin: noop, onLose: noop });
  g._win = false;
  g._lose = false;
  g.onWin = () => { g._win = true; };
  g.onLose = () => { g._lose = true; };
  g.sun = 99999;
  for (let r = 0; r < G.gridRows; r++)
    for (let c = 0; c < G.gridCols - 2; c++) g.plantAt(c, r, 'repeater');
  g.spawnZombie('bungee'); // 保证本局一定出现蹦极，不让断言空转
  for (let i = 0; i < 420 / DT && !g._win && !g._lose; i++) {
    g.sun = 99999;
    g.seedBar.cards.forEach(card => { card.cd = 0; });
    for (let r = 0; r < G.gridRows; r++)
      for (let c = 0; c < G.gridCols - 2; c++) if (!g.grid[r][c]) g.plantAt(c, r, 'repeater');
    g.update(DT);
  }
  const left = g.zombies.map(z => z.type).join(',');
  check(`${id} finishes with a one-sided defense (left: ${left || 'none'})`, g._win && !g._lose);
});

console.log(assertions.join('\n'));
const fails = assertions.filter(a => a.startsWith('FAIL'));
console.log(`\n${assertions.length - fails.length}/${assertions.length} PASS`);
