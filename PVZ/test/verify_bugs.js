// Regression checks for the two reported bugs:
//  1) Lawnmower now works: triggers on house breach, kills the breaching zombie,
//     and sweeps the row to clear remaining zombies.
//  2) Shovel now works: toggles shovel mode, and removes a planted cell.
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

let assertions = [];
function check(name, cond) {
  assertions.push(`${cond ? 'PASS' : 'FAIL'} ${name}`);
  if (!cond) process.exitCode = 1;
}

// --- Bug 1: lawnmower ---
{
  const g = new PVZ.Game({ onWin: noop, onLose: noop });
  let lost = false;
  g.onLose = () => { lost = true; };
  // breacher in row 0 (close to house), plus a second zombie further right in same row
  const breacher = new PVZ.Zombie('normal', 0, 150);
  const follower = new PVZ.Zombie('normal', 0, 700);
  g.zombies.push(breacher, follower);

  let swept = false;
  for (let t = 0; t < 500 && !swept; t++) {
    g.update(0.05);
    if (follower.state === 'dead' && g.lawnmowers[0].state === 'active') swept = true;
  }
  check('lawnmower triggers on breach', g.lawnmowers[0].state === 'active' || g.lawnmowers[0].state === 'used');
  check('breaching zombie killed by mower (no instant lose)', breacher.state === 'dead' && !lost);
  check('lawnmower sweeps row and kills follower', follower.state === 'dead');
  check('row not lost while mower present', !lost);
}

// --- Bug 2: shovel ---
{
  const g = new PVZ.Game({ onWin: noop, onLose: noop });
  g.plantAt(4, 2, 'sunflower');
  check('plant placed for shovel test', g.grid[2][4] !== null);
  // toggle shovel mode by clicking the shovel button
  const sb = g.shovelBtnRect();
  g.onPointerDown(sb.x + sb.w / 2, sb.y + sb.h / 2);
  check('shovel mode toggled on', g.shovelMode === true);
  // click the planted cell to remove it
  const cell = g.cellToPixel(4, 2);
  g.onPointerDown(cell.x + 40, cell.y + 50);
  check('plant removed by shovel', g.grid[2][4] === null);
  check('shovel mode stays on for consecutive removal', g.shovelMode === true);
  // click shovel button again to turn off
  g.onPointerDown(sb.x + sb.w / 2, sb.y + sb.h / 2);
  check('shovel mode toggled off', g.shovelMode === false);
}

console.log(assertions.join('\n'));
const fails = assertions.filter(a => a.startsWith('FAIL'));
console.log(`\n${assertions.length - fails.length}/${assertions.length} PASS`);
