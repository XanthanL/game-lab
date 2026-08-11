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

const DT = 0.05;
let assertions = [];
function check(name, cond) {
  assertions.push(`${cond ? 'PASS' : 'FAIL'} ${name}`);
  if (!cond) process.exitCode = 1;
}

// 1. 向日葵产出 50 阳光并可收集
{
  const g = new PVZ.Game({ onWin: noop, onLose: noop });
  g.seedBar.selected = 'sunflower';
  g.plantAt(4, 2, 'sunflower');
  let produced = null;
  let rose = false;
  for (let t = 0; t < 300 && !produced; t++) {
    g.update(DT);
    const found = g.sunSystem.suns.find(s => s.value === 50);
    if (found) {
      if (!produced && found.y < found.y0) rose = true; // 向上弹出
      if (found.state === 'idle') produced = found;
    }
  }
  check('sunflower produces sun', !!produced);
  check('produced sun pops up above plant', rose);
  const before = g.sun;
  check('sun collectable', produced && g.sunSystem.tryCollect(produced.x, produced.y) && g.sun === before + 50);
}

// 2. 僵尸啃食坚果（无射手干扰）
{
  const g = new PVZ.Game({ onWin: noop, onLose: noop });
  g.plantAt(1, 2, 'wallnut');
  const z = new PVZ.Zombie('normal', 2, 700);
  g.zombies.push(z);
  let sawEat = false;
  for (let t = 0; t < 900 && !sawEat; t++) {
    g.update(DT);
    if (z.state === 'eat') sawEat = true;
  }
  check('zombie eats wallnut', sawEat);
  check('wallnut not dead after 45s', g.grid[2][1] !== null);
}

// 3. 豌豆打死僵尸 → 清场胜利
{
  const g = new PVZ.Game({ onWin: noop, onLose: noop });
  let win = false, lose = false;
  g.onWin = () => { win = true; };
  g.onLose = () => { lose = true; };
  g.waves = [];
  g.plantAt(3, 2, 'peashooter');
  const z = new PVZ.Zombie('normal', 2, 900);
  g.zombies.push(z);
  let died = false;
  for (let t = 0; t < 900 && !win && !lose; t++) {
    g.update(DT);
    if (z.state === 'dead') died = true;
  }
  check('zombie killed by peas', died);
  check('win after clearing all waves', win && !lose);
}

// 4. 僵尸进家 → 触发割草机（新机制）
{
  const g = new PVZ.Game({ onWin: noop, onLose: noop });
  let lmTriggered = false;
  g.lose = () => { /* 割草机模式下暂不判负 */ };
  // 僵尸从较近位置出发，确保在测试时间内到达
  const z = new PVZ.Zombie('normal', 0, 150);
  g.zombies.push(z);
  for (let t = 0; t < 500 && !lmTriggered; t++) {
    g.update(DT);
    if (g.lawnmowers[0].state !== 'idle') lmTriggered = true;
  }
  check('lawnmower triggers when zombie reaches house', lmTriggered);
}

// 5. 种植消耗阳光 + 冷却
{
  const g = new PVZ.Game({ onWin: noop, onLose: noop });
  g.sun = 100;
  g.seedBar.selected = 'peashooter';
  check('plant succeeds and costs 100', g.seedBar.tryPlant(0, 0) && g.sun === 0);
  check('cannot plant with 0 sun', g.seedBar.tryPlant(1, 0) === false);
  check('cell occupied blocks plant', (g.sun = 100) >= 0 && g.seedBar.tryPlant(0, 0) === false);
}

// 6. 天空阳光随机掉落
{
  const g = new PVZ.Game({ onWin: noop, onLose: noop });
  for (let t = 0; t < 400; t++) {
    g.update(DT);
    if (g.sunSystem.suns.some(s => s.value === 25)) break;
  }
  check('sky sun drops', g.sunSystem.suns.some(s => s.value === 25));
}

// 7. 寒冰射手减速
{
  const g = new PVZ.Game({ onWin: noop, onLose: noop });
  g.waves = [];
  g.plantAt(3, 1, 'snowpea');
  const z = new PVZ.Zombie('normal', 1, 800);
  g.zombies.push(z);
  let slowed = false;
  for (let t = 0; t < 900 && !slowed; t++) {
    g.update(DT);
    if (z.slowT > 0) slowed = true;
  }
  check('snowpea slows zombie', slowed);
  check('ice bullet applied', g.peas.length === 0 && z.slowT <= 4.01);
}

// 8. 双发射手齐射两颗
{
  const g = new PVZ.Game({ onWin: noop, onLose: noop });
  g.waves = [];
  g.plantAt(3, 1, 'repeater');
  const z = new PVZ.Zombie('normal', 1, 800);
  g.zombies.push(z);
  let twoPeas = false;
  for (let t = 0; t < 300 && !twoPeas; t++) {
    g.update(DT);
    if (g.peas.length === 2) twoPeas = true;
  }
  check('repeater fires 2 peas', twoPeas);
}

// 9. 樱桃炸弹 3×3 范围爆炸
{
  const g = new PVZ.Game({ onWin: noop, onLose: noop });
  g.waves = [];
  // 在草坪中心放置樱桃炸弹（确保在新布局下坐标有效）
  g.plantAt(4, 2, 'cherrybomb');
  const zs = [1, 2, 3].map(row => {
    const z = new PVZ.Zombie('normal', row, 500);
    g.zombies.push(z);
    return z;
  });
  let exploded = false;
  for (let t = 0; t < 120 && !exploded; t++) {
    g.update(DT);
    if (g.effects.some(e => e instanceof PVZ.Explosion)) exploded = true;
  }
  check('cherrybomb explodes after delay', exploded);
  // 爆炸范围：radius=1 → (4±1, 2±1) 覆盖 col 3-5, row 1-3
  // 僵尸在 row 1-3, x=500 → col ≈ floor((500-102)/80) = 4-5，应在范围内
  check('explosion kills zombies in range', zs.every(z => z.state === 'dead'));
  check('cherrybomb removed after explosion', g.grid[2][4] === null);
}

// 10. 新僵尸血量（含护甲系统的 base HP）
{
  check('cone hp 370', new PVZ.Zombie('cone', 0, 0).hp === 370);
  check('bucket hp 650', new PVZ.Zombie('bucket', 0, 0).hp === 650);
  check('cone headgear', new PVZ.Zombie('cone', 0, 0).headgear === 'cone');
}

// 11. 关卡配置：speedMul 生效、deck 生效
{
  const g = new PVZ.Game({ onWin: noop, onLose: noop, levelId: 2 });
  check('level 1-3 deck has 8 cards', g.seedBar.cards.length === 8);
  const z = new PVZ.Zombie('normal', 0, 0, g.level.speedMul);
  check('speedMul applied', z.speed === 20 * 1.1);
}

// 12. 存档解锁（内存模式）
{
  PVZ.save.load();
  check('level 0 unlocked initially', PVZ.save.isUnlocked(0));
  check('level 1 locked initially', !PVZ.save.isUnlocked(1));
  PVZ.save.markCleared(0);
  check('level 1 unlocked after clear', PVZ.save.isUnlocked(1));
  check('star recorded', PVZ.save.starOf(0) === 1);
}

// 13. 土豆雷：武装后爆炸单格
{
  const g = new PVZ.Game({ onWin: noop, onLose: noop });
  g.waves = [];
  g.plantAt(3, 2, 'potatomine');
  const z = new PVZ.Zombie('normal', 2, 900);
  g.zombies.push(z);
  let boom = false;
  for (let t = 0; t < 1200 && !boom; t++) {
    g.update(DT);
    if (g.effects.some(e => e instanceof PVZ.Explosion)) boom = true;
  }
  check('potatomine explodes on armed zombie', boom);
  check('potatomine kills nearby zombie', z.state === 'dead');
  check('potatomine removed', g.grid[2][3] === null);
}

// 14. 土豆雷武装前不爆炸（僵尸走过）
{
  const g = new PVZ.Game({ onWin: noop, onLose: noop });
  g.waves = [];
  // 把土豆雷放在右侧，僵尸放在更左边，确保僵尸在武装前走过
  g.plantAt(7, 2, 'potatomine');
  const z = new PVZ.Zombie('normal', 2, 950);
  g.zombies.push(z);
  let boom = false;
  // 只跑 12 秒（240 帧），土豆雷 15 秒才武装，僵尸还到不了
  for (let t = 0; t < 240; t++) {
    g.update(DT);
    if (g.effects.some(e => e instanceof PVZ.Explosion)) boom = true;
  }
  check('potatomine does not explode before armed', !boom && z.state !== 'dead');
}

// 15. 窝瓜砸死同排僵尸
{
  const g = new PVZ.Game({ onWin: noop, onLose: noop });
  g.waves = [];
  g.plantAt(3, 1, 'squash');
  const z = new PVZ.Zombie('normal', 1, 700);
  g.zombies.push(z);
  let crushed = false;
  for (let t = 0; t < 900 && !crushed; t++) {
    g.update(DT);
    if (z.state === 'dead') crushed = true;
  }
  check('squash crushes zombie', crushed);
  check('squash removed', g.grid[1][3] === null);
}

// 16. 高坚果血量 + 撑杆跳僵尸跳过植物
{
  check('tallnut hp 8000', PVZ.config.PLANTS.tallnut.hp === 8000);
  const g = new PVZ.Game({ onWin: noop, onLose: noop });
  g.waves = [];
  g.plantAt(4, 3, 'wallnut');
  g.plantAt(2, 3, 'wallnut');
  const z = new PVZ.Zombie('pole', 3, 800);
  g.zombies.push(z);
  let jumped = false, ateAfter = false;
  for (let t = 0; t < 1200; t++) {
    g.update(DT);
    if (z.state === 'jump') jumped = true;
    if (z.poleUsed && z.state === 'eat') ateAfter = true;
  }
  check('pole zombie jumps', jumped);
  check('pole zombie eats after jump', ateAfter);
}

// 17. 暂停不推进逻辑，变速推进
{
  const g = new PVZ.Game({ onWin: noop, onLose: noop });
  g.waves = [];
  const z = new PVZ.Zombie('normal', 0, 800);
  g.zombies.push(z);
  const x0 = z.x;
  g.paused = true;
  for (let t = 0; t < 100; t++) g.update(DT);
  check('paused game does not advance', z.x === x0);
  g.paused = false;
  g.timeScale = 2;
  for (let t = 0; t < 100; t++) g.update(DT * 2);
  check('timeScale 2 advances faster', z.x < x0 - 60);
  g.timeScale = 1;
  check('speed cycle 1->2', g.cycleSpeed() === 2);
  check('speed cycle 2->4', g.cycleSpeed() === 4);
  check('speed cycle 4->8', g.cycleSpeed() === 8);
  check('speed cycle 8->1', g.cycleSpeed() === 1);
}

// 18. 粒子与震屏
{
  const g = new PVZ.Game({ onWin: noop, onLose: noop });
  g.explodeAt(3, 2, 1800, 1);
  check('particles spawned', g.particles.length > 0);
  check('shake triggered', g.shake > 0);
  for (let t = 0; t < 100; t++) g.update(DT);
  check('shake decays', g.shake === 0);
}

// 19. 拖拽种植
{
  const g = new PVZ.Game({ onWin: noop, onLose: noop });
  g.sun = 200;
  // 卡片栏起始 x=110，第一张卡片中心约 x=143
  g.onPointerDown(143, 50); // 点第一张卡片（向日葵）
  check('card selected by pointer', !!g.seedBar.selected && !!g.drag);
  // 草坪区域：lawnOffsetX=102, lawnOffsetY=100, cellHeight=100
  // row=1 需要 y ∈ [200,300)，col=2 需要 x ∈ [262,342)
  const targetX = 270, targetY = 250;
  g.onPointerMove(targetX, targetY);
  g.onPointerUp(targetX, targetY + 10);
  // 验证：应在 grid[1][2] 有植物（row=1 因为 y=250→floor(150/100)=1... 等等）
  // 实际：row = floor((260-100)/100) = floor(160/100) = 1 ... 不对
  // y=260: row=floor(160/100)=1, 正确！
  const c = PVZ.config;
  const actualCol = Math.floor((targetX - c.lawnOffsetX) / c.cellWidth);
  const actualRow = Math.floor((targetY + 10 - c.lawnOffsetY) / c.cellHeight);
  const planted = g.grid[actualRow] && g.grid[actualRow][actualCol] !== null;
  check('drag plant placed', planted);
  if (planted) check('sun deducted', g.sun === 200 - PVZ.config.PLANTS[g.seedBar.selected].cost);
  g.onPointerDown(500, 60); // 点空白顶栏
  g.onPointerUp(500, 60);   // 松开不在草坪 → 取消
  check('drag cancel clears selection', g.seedBar.selected === null);
}

console.log(assertions.join('\n'));
