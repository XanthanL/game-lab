// Boss-level render verification: reproduces the `c is not defined` path
// (boss spawn -> flash overlay -> boss bars) and asserts render() never throws.
global.window = global;
global.document = undefined;

const noop = () => {};
const gradStub = { addColorStop: noop };
const ctxStub = new Proxy({}, {
  get: (t, p) => {
    if (p === 'canvas') return ctxStub;
    if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => gradStub;
    return noop;
  },
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

// Boss levels: indices 12 (3-4), 20 (5-3), 22 (6-1) per config.js
for (const lvl of [12, 20, 22]) {
  let threw = null;
  try {
    const g = new PVZ.Game({ onWin: noop, onLose: noop, levelId: lvl });
    g.waves = [];
    // spawn both boss types through the real path (pushes into this.bosses)
    g.spawnZombie('gargantuar');
    g.spawnZombie('zombot');
    check(`L${lvl} bosses registered`, g.bosses.length === 2);
    // trigger flash overlay (the block that referenced undefined `c`)
    g.explodeAt(4, 2, 1800, 1);
    check(`L${lvl} flash armed`, g._flash > 0);
    // render many frames (flash decay + boss bars + boss zombie bodies)
    for (let i = 0; i < 30; i++) {
      g.update(0.05);
      g.render(ctxStub);
    }
  } catch (e) {
    threw = e;
  }
  check(`L${lvl} render without error`, threw === null);
  if (threw) console.log(`   -> ${threw.message}`);
}

// Direct gargantuar/zombot zombie body render (covers art hooks)
{
  let threw = null;
  try {
    const g = new PVZ.Game({ onWin: noop, onLose: noop, levelId: 22 });
    const z1 = new PVZ.Zombie('gargantuar', 1, 600, 1);
    const z2 = new PVZ.Zombie('zombot', 3, 600, 1);
    g.zombies.push(z1, z2);
    g.bosses.push(z1, z2);
    for (let i = 0; i < 10; i++) { g.update(0.05); g.render(ctxStub); }
  } catch (e) { threw = e; }
  check('gargantuar+zombot body render ok', threw === null);
  if (threw) console.log(`   -> ${threw.message}`);
}

console.log(assertions.join('\n'));
const fails = assertions.filter(a => a.startsWith('FAIL'));
console.log(`\n${assertions.length - fails.length}/${assertions.length} PASS`);
