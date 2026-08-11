// 全局配置与数据表：数值平衡集中于此，修改即生效
// 横屏设计分辨率 1020x600、竖屏 720x1280（内部坐标），由 main.js 按视口缩放，
// 既保证 PC 端以原始比例清晰渲染，又能缩放适配手机横屏与竖屏。
window.PVZ = window.PVZ || {};

PVZ.randomRange = function (a, b) {
  return a + Math.random() * (b - a);
};

PVZ.config = {
  // 渲染模式：'landscape'（桌面 / 手机横屏）或 'portrait'（手机竖屏）。
  // 由 main.js 在 fitCanvas 时按设备朝向设置。所有布局字段均为按 _mode 分支的 getter，
  // 因此 game.js / draw.js / 实体类里的 c.xxx 引用无需改动即可自动适配两种布局。
  _mode: 'landscape',

  // 横向布局基准（桌面 / 手机横屏）
  landscape: {
    canvasWidth: 1020, canvasHeight: 600,
    topBarHeight: 100, seedPanelWidth: 260,
    houseWidth: 80, fenceWidth: 22,
    gridCols: 9, gridRows: 5,
    cellWidth: 80, cellHeight: 100, lawnOffsetY: 100
  },
  // 竖向布局基准（手机竖屏）：草坪占满纵向空间，房屋收窄以给草坪更多宽度
  portrait: {
    canvasWidth: 720, canvasHeight: 1280,
    topBarHeight: 64, seedPanelWidth: 0,
    houseWidth: 54, fenceWidth: 14,
    gridCols: 9, gridRows: 5,
    cellWidth: 72, cellHeight: 238, lawnOffsetY: 64
  },

  get canvasWidth() { return this[this._mode].canvasWidth; },
  get canvasHeight() { return this[this._mode].canvasHeight; },
  get topBarHeight() { return this[this._mode].topBarHeight; },
  get seedPanelWidth() { return this[this._mode].seedPanelWidth; },
  get houseWidth() { return this[this._mode].houseWidth; },
  get fenceWidth() { return this[this._mode].fenceWidth; },
  get cellWidth() { return this[this._mode].cellWidth; },
  get cellHeight() { return this[this._mode].cellHeight; },
  get lawnOffsetY() { return this[this._mode].lawnOffsetY; },
  // 列数 / 行数两种模式一致，作常量
  gridCols: 9,
  gridRows: 5,

  // ===== 布局重构：左侧房屋+割草机区域 =====
  // houseWidth: 房屋侧宽度（门/窗/墙壁），割草机停在里面
  // lawnOffsetX: 草坪起始 X（栅栏在 lawnOffsetX - fenceWidth 处）
  get lawnOffsetX() { return this.houseWidth + this.fenceWidth; },
  get lawnEndX() { return this.lawnOffsetX + this.gridCols * this.cellWidth; },

  colors: {
    canvasBg: '#1a2332',
    topBar: '#2c5e2c',
    seedPanel: '#3d2b1f',
    houseWall: '#5d4037',
    houseDoor: '#8d6e63',
    houseRoof: '#4e342e',
    windowGlass: '#90caf9',
    windowFrame: '#6d4c41',
    lawnA: '#58a93c',
    lawnB: '#63b844',
    lawnBorder: '#3e7d2b',
    poolA: '#42a5f5',
    poolB: '#64b5f6',
    poolBorder: '#1976d2',
    fenceRed: '#d43a2f',
    fenceWhite: '#f5f5f5',
    text: '#e8e8e8',
    sunGold: '#ffd54f'
  },

  // ===== 植物配置 =====
  // action.type:
  //   produce   -> 产出阳光（interval 间隔秒, value 阳光值）
  //   shoot     -> 发射豌豆（interval, volley 齐射数, ice 减速）
  //   explode   -> 延时范围爆炸（delay, damage, radius 格）
  //   armed     -> 武装后触碰爆炸（delay 武装秒, damage, range 格）
  //   squash    -> 砸落单体（damage, range px）
  //   spikes    -> 地刺，持续伤害经过的僵尸（dps）
  //   chomp     -> 大嘴花，吞噬范围内僵尸（recharge 冷却秒, damage）
  //   rowclear  -> 整行清除（delay, damage）
  //   bomb      -> 投弹（interval, damage, radius, splash 伤害半径格）
  //   shield    -> 南瓜头，给同格植物加护甲（bonusHp）
  //   magnet    -> 磁力菇，吸走护甲/道具（interval, range 格）
  //   coffee    -> 咖啡豆，唤醒相邻一行植物（一次性）
  //   umbrella  -> 叶子保护伞，保护 3x3 区域免受特殊攻击
  // 特殊标记： torch=true 火炬树桩（豌豆经过变为火球）
  PLANTS: {
    // ---- 第一世界：白天草地 ----
    sunflower: { name: '向日葵', cost: 50, cooldown: 7, hp: 300, action: { type: 'produce', interval: 9, value: 50 }, world: '白天草地' },
    peashooter: { name: '豌豆射手', cost: 100, cooldown: 7, hp: 300, action: { type: 'shoot', interval: 1.4 }, world: '白天草地' },
    snowpea: { name: '寒冰射手', cost: 175, cooldown: 7, hp: 300, action: { type: 'shoot', interval: 1.4, ice: true }, world: '白天草地' },
    repeater: { name: '双发射手', cost: 200, cooldown: 7, hp: 300, action: { type: 'shoot', interval: 1.4, volley: 2 }, world: '白天草地' },
    wallnut: { name: '坚果墙', cost: 50, cooldown: 30, hp: 4000, action: null, world: '白天草地' },
    tallnut: { name: '高坚果', cost: 125, cooldown: 30, hp: 8000, action: null, world: '白天草地' },
    cherrybomb: { name: '樱桃炸弹', cost: 150, cooldown: 50, hp: 1000, action: { type: 'explode', delay: 1, damage: 1800, radius: 1 }, world: '白天草地' },
    potatomine: { name: '土豆雷', cost: 25, cooldown: 30, hp: 300, action: { type: 'armed', delay: 15, damage: 1800, range: 1 }, world: '白天草地' },
    squash: { name: '窝瓜', cost: 50, cooldown: 30, hp: 500, action: { type: 'squash', damage: 1800, range: 70 }, world: '白天草地' },

    // ---- 第二世界：黑夜 ----
    sunshroom: { name: '阳光菇', cost: 25, cooldown: 7, hp: 300, night: true, action: { type: 'produce', interval: 14, value: 15 }, world: '黑夜' },
    puffshroom: { name: '小喷菇', cost: 0, cooldown: 7, hp: 300, night: true, action: { type: 'shoot', interval: 1.5, shortRange: true }, world: '黑夜' },
    fumeshroom: { name: '大喷菇', cost: 75, cooldown: 7, hp: 300, night: true, action: { type: 'shoot', interval: 1.5, pierce: true }, world: '黑夜' },
    dormium: { name: '催眠菇', cost: 75, cooldown: 30, hp: 300, night: true, action: { type: 'chomp', range: 52, recharge: 20, damage: 0, hypnotize: true }, world: '黑夜' },

    // ---- 第三世界：泳池 ----
    threepeater: { name: '三线射手', cost: 325, cooldown: 7, hp: 300, action: { type: 'shoot', interval: 1.4, volley: 1, rows: 3 }, world: '泳池' },
    jalapeno: { name: '火爆辣椒', cost: 125, cooldown: 45, hp: 1000, action: { type: 'rowclear', delay: 1, damage: 1800 }, world: '泳池' },
    spikeweed: { name: '地刺', cost: 100, cooldown: 30, hp: 300, action: { type: 'spikes', dps: 22 }, world: '泳池' },
    spikeRock: { name: '地刺王', cost: 125, cooldown: 30, hp: 4000, action: { type: 'spikes', dps: 45 }, world: '泳池' },
    torchwood: { name: '火炬树桩', cost: 175, cooldown: 30, hp: 300, torch: true, action: null, world: '泳池' },
    chomper: { name: '大嘴花', cost: 150, cooldown: 30, hp: 300, action: { type: 'chomp', range: 48, recharge: 16, damage: 9999 }, world: '泳池' },

    // ---- 第四世界：迷雾 ----
    plantern: { name: '灯笼草', cost: 25, cooldown: 30, hp: 300, action: { type: 'umbrella', revealRadius: 3 }, world: '迷雾' },
    magnetshroom: { name: '磁力菇', cost: 100, cooldown: 30, hp: 300, action: { type: 'magnet', interval: 8, range: 3 }, world: '迷雾' },
    pumpkin: { name: '南瓜头', cost: 125, cooldown: 30, hp: 4000, action: { type: 'shield', bonusHp: 3000 }, world: '迷雾' },

    // ---- 第五世界：屋顶 ----
    melonpult: { name: '西瓜投手', cost: 300, cooldown: 30, hp: 300, action: { type: 'bomb', interval: 2.5, damage: 120, radius: 1 }, world: '屋顶' },
    cobaltion: { name: '玉米加农炮', cost: 700, cooldown: 50, hp: 300, action: { type: 'rowclear', delay: 0.5, damage: 3600, manual: true }, world: '屋顶' },
    kernelpult: { name: '玉米投手', cost: 150, cooldown: 30, hp: 300, action: { type: 'bomb', interval: 2.5, damage: 20, radius: 0, butterStun: 2.5 }, world: '屋顶' },

    // ---- 终局 / 全世界 ----
    coffeebean: { name: '咖啡豆', cost: 75, cooldown: 10, hp: 300, action: { type: 'coffee' } }
  },

  // ===== 僵尸配置 =====
  // armor: { kind:'cone'|'bucket'|'screen'|'football'|'metal', hp }
  // boss: true -> 巨型单位（独立血条、砸碎植物）
  // rage: true -> 血量过半后狂暴加速
  // summon: true -> 周期召唤小僵尸
  // fly: true -> 气球僵尸，从空中飞过（需仙人掌/叶子/三线击落）
  // dive: true -> 潜水僵尸，水下免疫直射（需气泡菇/磁力菇拉出）
  // throw: true -> 小丑僵尸，反弹炸弹伤害
  ZOMBIES: {
    // ---- 基础 ----
    normal: { name: '普通僵尸', hp: 200, speed: 20, damage: 20, eatInterval: 0.5, world: '白天草地' },
    cone: { name: '路障僵尸', hp: 370, speed: 20, damage: 20, eatInterval: 0.5, armor: { kind: 'cone', hp: 170 }, world: '白天草地' },
    bucket: { name: '铁桶僵尸', hp: 650, speed: 20, damage: 20, eatInterval: 0.5, armor: { kind: 'bucket', hp: 450 }, world: '白天草地' },
    pole: { name: '撑杆跳僵尸', hp: 250, speed: 30, damage: 20, eatInterval: 0.5, world: '白天草地' },
    newspaper: { name: '读报僵尸', hp: 320, speed: 20, damage: 20, eatInterval: 0.5, rage: true, world: '黑夜' },
    screen: { name: '门板僵尸', hp: 200, speed: 20, damage: 20, eatInterval: 0.5, armor: { kind: 'screen', hp: 380 }, world: '黑夜' },
    football: { name: '橄榄球僵尸', hp: 280, speed: 22, damage: 25, eatInterval: 0.5, armor: { kind: 'football', hp: 520 }, world: '泳池' },
    dancing: { name: '舞王僵尸', hp: 350, speed: 18, damage: 20, eatInterval: 0.5, summonBackup: true, world: '黑夜' },
    balloon: { name: '气球僵尸', hp: 200, speed: 18, damage: 20, eatInterval: 0.5, fly: true, world: '泳池' },
    snorkel: { name: '潜水僵尸', hp: 280, speed: 16, damage: 20, eatInterval: 0.5, dive: true, world: '泳池' },
    jackbox: { name: '小丑僵尸', hp: 280, speed: 18, damage: 20, eatInterval: 0.5, throw: true, world: '迷雾' },
    catapult: { name: '投石车僵尸', hp: 800, speed: 10, damage: 20, eatInterval: 1, siege: true, world: '屋顶' },
    gargantuar: { name: '伽刚特尔', hp: 3000, speed: 13, damage: 9999, eatInterval: 0.5, boss: true, armor: { kind: 'bucket', hp: 700 }, world: '终局' },
    zombot: { name: '僵尸博士机甲', hp: 9000, speed: 7, damage: 9999, eatInterval: 0.5, boss: true, summon: true, world: '终局' },
    bungee: { name: '蹦极僵尸', hp: 250, speed: 0, damage: 0, eatInterval: 0, bungee: true, world: '迷雾' },
    digger: { name: '矿工僵尸', hp: 340, speed: 24, damage: 20, eatInterval: 0.5, digger: true, world: '迷雾' },
    yeti: { name: '雪人僵尸', hp: 1200, speed: 28, damage: 30, eatInterval: 0.3, rare: true, world: '终局' }
  },

  // ===== 阳光系统 =====
  SUN: {
    skyInterval: [7, 12],
    fallSpeed: 45,
    life: 10,
    value: 25,
    collectRadius: 30
  },

  // ===== 割草机配置 =====
  LAWNMOWER: {
    width: 60,
    height: 44,
    speed: 520,     // 激活后移动速度 px/s
    damage: 9999,    // 碾压伤害（即死）
    offsetX: 12,     // 相对 houseRight 的偏移
    color: '#e53935',
    wheelColor: '#37474f',
    handleColor: '#9e9e9e'
  },

  // ===== 关卡配置 =====
  LEVEL_LIST: [
    // ═════════ 第一世界：白天草地（5 关）════════
    {
      id: '1-1', name: '关卡 1-1', world: '白天草地', initialSun: 50, speedMul: 1,
      deck: ['sunflower', 'peashooter', 'wallnut'],
      waves: [
        { time: 20, spawns: [{ type: 'normal', count: 2 }] },
        { time: 55, spawns: [{ type: 'normal', count: 3 }] },
        { time: 95, spawns: [{ type: 'normal', count: 4 }] },
        { time: 135, spawns: [{ type: 'normal', count: 5 }] },
        { time: 175, spawns: [{ type: 'normal', count: 6 }] }
      ]
    },
    {
      id: '1-2', name: '关卡 1-2', world: '白天草地', initialSun: 75, speedMul: 1,
      deck: ['sunflower', 'peashooter', 'snowpea', 'wallnut'],
      waves: [
        { time: 20, spawns: [{ type: 'normal', count: 2 }] },
        { time: 55, spawns: [{ type: 'cone', count: 1 }, { type: 'normal', count: 2 }] },
        { time: 95, spawns: [{ type: 'cone', count: 2 }, { type: 'normal', count: 1 }] },
        { time: 135, spawns: [{ type: 'cone', count: 2 }, { type: 'normal', count: 3 }] },
        { time: 175, spawns: [{ type: 'cone', count: 3 }, { type: 'normal', count: 2 }] }
      ]
    },
    {
      id: '1-3', name: '关卡 1-3', world: '白天草地', initialSun: 100, speedMul: 1.1,
      deck: ['sunflower', 'peashooter', 'snowpea', 'repeater', 'wallnut', 'tallnut', 'cherrybomb', 'potatomine'],
      waves: [
        { time: 20, spawns: [{ type: 'normal', count: 3 }] },
        { time: 55, spawns: [{ type: 'bucket', count: 1 }, { type: 'normal', count: 2 }] },
        { time: 95, spawns: [{ type: 'cone', count: 2 }, { type: 'bucket', count: 1 }] },
        { time: 135, spawns: [{ type: 'bucket', count: 2 }, { type: 'cone', count: 2 }] },
        { time: 175, spawns: [{ type: 'bucket', count: 2 }, { type: 'cone', count: 2 }, { type: 'normal', count: 2 }] },
        { time: 215, spawns: [{ type: 'bucket', count: 3 }, { type: 'cone', count: 3 }] }
      ]
    },
    {
      id: '1-4', name: '关卡 1-4', world: '白天草地', initialSun: 100, speedMul: 1.25,
      deck: ['sunflower', 'peashooter', 'snowpea', 'repeater', 'wallnut', 'tallnut', 'cherrybomb', 'potatomine', 'squash'],
      waves: [
        { time: 15, spawns: [{ type: 'normal', count: 3 }] },
        { time: 45, spawns: [{ type: 'cone', count: 3 }, { type: 'normal', count: 2 }] },
        { time: 80, spawns: [{ type: 'bucket', count: 2 }, { type: 'cone', count: 3 }] },
        { time: 115, spawns: [{ type: 'bucket', count: 3 }, { type: 'cone', count: 3 }, { type: 'normal', count: 2 }] },
        { time: 150, spawns: [{ type: 'bucket', count: 4 }, { type: 'cone', count: 4 }] },
        { time: 185, spawns: [{ type: 'bucket', count: 4 }, { type: 'cone', count: 4 }, { type: 'normal', count: 4 }] }
      ]
    },
    {
      id: '1-5', name: '关卡 1-5', world: '白天草地', initialSun: 125, speedMul: 1.35,
      deck: ['sunflower', 'peashooter', 'snowpea', 'repeater', 'wallnut', 'tallnut', 'cherrybomb', 'potatomine', 'squash'],
      waves: [
        { time: 15, spawns: [{ type: 'normal', count: 3 }] },
        { time: 45, spawns: [{ type: 'cone', count: 3 }, { type: 'normal', count: 2 }] },
        { time: 80, spawns: [{ type: 'pole', count: 2 }, { type: 'bucket', count: 2 }] },
        { time: 115, spawns: [{ type: 'pole', count: 3 }, { type: 'cone', count: 3 }] },
        { time: 150, spawns: [{ type: 'bucket', count: 3 }, { type: 'pole', count: 3 }, { type: 'normal', count: 2 }] },
        { time: 185, spawns: [{ type: 'pole', count: 4 }, { type: 'bucket', count: 3 }, { type: 'cone', count: 3 }] }
      ]
    },

    // ═════════ 第二世界：黑夜（4 关）════════
    {
      id: '2-1', name: '关卡 2-1', world: '黑夜', initialSun: 50, speedMul: 1.2, night: true,
      deck: ['sunflower', 'sunshroom', 'puffshroom', 'peashooter', 'wallnut', 'potatomine'],
      waves: [
        { time: 20, spawns: [{ type: 'normal', count: 3 }] },
        { time: 55, spawns: [{ type: 'normal', count: 4 }, { type: 'newspaper', count: 1 }] },
        { time: 95, spawns: [{ type: 'cone', count: 2 }, { type: 'newspaper', count: 2 }] },
        { time: 135, spawns: [{ type: 'screen', count: 2 }, { type: 'normal', count: 3 }] },
        { time: 175, spawns: [{ type: 'screen', count: 3 }, { type: 'newspaper', count: 2 }] }
      ]
    },
    {
      id: '2-2', name: '关卡 2-2', world: '黑夜', initialSun: 75, speedMul: 1.3, night: true,
      deck: ['sunflower', 'sunshroom', 'puffshroom', 'fumeshroom', 'peashooter', 'wallnut', 'potatomine', 'cherrybomb'],
      waves: [
        { time: 18, spawns: [{ type: 'normal', count: 3 }] },
        { time: 50, spawns: [{ type: 'cone', count: 2 }, { type: 'screen', count: 2 }] },
        { time: 85, spawns: [{ type: 'newspaper', count: 3 }, { type: 'normal', count: 2 }] },
        { time: 120, spawns: [{ type: 'bucket', count: 2 }, { type: 'screen', count: 2 }] },
        { time: 155, spawns: [{ type: 'bucket', count: 2 }, { type: 'newspaper', count: 3 }, { type: 'cone', count: 2 }] }
      ]
    },
    {
      id: '2-3', name: '关卡 2-3', world: '黑夜', initialSun: 100, speedMul: 1.4, night: true,
      deck: ['sunflower', 'sunshroom', 'puffshroom', 'fumeshroom', 'dormium', 'peashooter', 'snowpea', 'repeater', 'wallnut', 'tallnut', 'cherrybomb'],
      waves: [
        { time: 15, spawns: [{ type: 'cone', count: 3 }, { type: 'newspaper', count: 2 }] },
        { time: 50, spawns: [{ type: 'screen', count: 3 }, { type: 'bucket', count: 2 }] },
        { time: 90, spawns: [{ type: 'newspaper', count: 4 }, { type: 'cone', count: 3 }] },
        { time: 130, spawns: [{ type: 'dancing', count: 1 }, { type: 'bucket', count: 3 }, { type: 'screen', count: 2 }] },
        { time: 170, spawns: [{ type: 'bucket', count: 4 }, { type: 'newspaper', count: 4 }, { type: 'screen', count: 2 }] }
      ]
    },
    {
      id: '2-4', name: '关卡 2-4 · 黑夜深处', world: '黑夜', initialSun: 100, speedMul: 1.5, night: true,
      deck: ['sunflower', 'sunshroom', 'puffshroom', 'fumeshroom', 'dormium', 'peashooter', 'repeater', 'wallnut', 'tallnut', 'cherrybomb', 'potatomine', 'squash'],
      waves: [
        { time: 12, spawns: [{ type: 'newspaper', count: 3 }, { type: 'cone', count: 2 }] },
        { time: 45, spawns: [{ type: 'screen', count: 3 }, { type: 'dancing', count: 1 }, { type: 'bucket', count: 2 }] },
        { time: 85, spawns: [{ type: 'newspaper', count: 4 }, { type: 'screen', count: 3 }, { type: 'pole', count: 2 }] },
        { time: 125, spawns: [{ type: 'bucket', count: 4 }, { type: 'dancing', count: 2 }, { type: 'newspaper', count: 3 }] },
        { time: 165, spawns: [{ type: 'bucket', count: 4 }, { type: 'screen', count: 4 }, { type: 'dancing', count: 1 }, { type: 'cone', count: 3 }] },
        { time: 200, spawns: [{ type: 'dancing', count: 2 }, { type: 'bucket', count: 3 }, { type: 'newspaper', count: 4 }] }
      ]
    },

    // ═════════ 第三世界：泳池（5 关）════════
    {
      id: '3-1', name: '关卡 3-1', world: '泳池', initialSun: 100, speedMul: 1.25, pool: [2, 3],
      deck: ['sunflower', 'peashooter', 'snowpea', 'threepeater', 'wallnut', 'spikeweed', 'jalapeno', 'cherrybomb'],
      waves: [
        { time: 15, spawns: [{ type: 'cone', count: 3 }, { type: 'normal', count: 2 }] },
        { time: 50, spawns: [{ type: 'football', count: 2 }, { type: 'bucket', count: 2 }] },
        { time: 90, spawns: [{ type: 'screen', count: 3 }, { type: 'football', count: 2 }] },
        { time: 130, spawns: [{ type: 'football', count: 3 }, { type: 'bucket', count: 3 }, { type: 'normal', count: 2 }] },
        { time: 170, spawns: [{ type: 'football', count: 4 }, { type: 'screen', count: 3 }, { type: 'cone', count: 2 }] }
      ]
    },
    {
      id: '3-2', name: '关卡 3-2', world: '泳池', initialSun: 125, speedMul: 1.35, pool: [2, 3],
      deck: ['sunflower', 'peashooter', 'snowpea', 'repeater', 'threepeater', 'torchwood', 'wallnut', 'tallnut', 'chomper', 'spikeweed', 'cherrybomb', 'jalapeno'],
      waves: [
        { time: 15, spawns: [{ type: 'cone', count: 2 }, { type: 'football', count: 2 }] },
        { time: 50, spawns: [{ type: 'bucket', count: 3 }, { type: 'screen', count: 3 }] },
        { time: 90, spawns: [{ type: 'football', count: 3 }, { type: 'newspaper', count: 3 }] },
        { time: 130, spawns: [{ type: 'balloon', count: 2 }, { type: 'football', count: 3 }, { type: 'bucket', count: 2 }] },
        { time: 170, spawns: [{ type: 'snorkel', count: 3 }, { type: 'screen', count: 4 }, { type: 'football', count: 3 }] }
      ]
    },
    {
      id: '3-3', name: '关卡 3-3', world: '泳池', initialSun: 125, speedMul: 1.4, pool: [2, 3],
      deck: ['sunflower', 'peashooter', 'threepeater', 'torchwood', 'chomper', 'spikeweed', 'spikeRock', 'wallnut', 'tallnut', 'cherrybomb', 'jalapeno', 'potatomine'],
      waves: [
        { time: 12, spawns: [{ type: 'football', count: 3 }, { type: 'cone', count: 2 }] },
        { time: 48, spawns: [{ type: 'balloon', count: 3 }, { type: 'screen', count: 2 }] },
        { time: 88, spawns: [{ type: 'snorkel', count: 4 }, { type: 'football', count: 3 }] },
        { time: 128, spawns: [{ type: 'football', count: 4 }, { type: 'balloon', count: 2 }, { type: 'bucket', count: 3 }] },
        { time: 168, spawns: [{ type: 'snorkel', count: 3 }, { type: 'jackbox', count: 2 }, { type: 'football', count: 4 }] },
        { time: 205, spawns: [{ type: 'gargantuar', count: 1 }, { type: 'football', count: 3 }, { type: 'balloon', count: 2 }] }
      ]
    },
    {
      id: '3-4', name: '关卡 3-4 · 泳池 Boss', world: '泳池', initialSun: 150, speedMul: 1.3, pool: [2, 3], boss: 'gargantuar',
      deck: ['sunflower', 'peashooter', 'repeater', 'threepeater', 'torchwood', 'wallnut', 'tallnut', 'spikeRock', 'chomper', 'cherrybomb', 'jalapeno', 'potatomine', 'squash'],
      waves: [
        { time: 12, spawns: [{ type: 'normal', count: 3 }, { type: 'cone', count: 2 }] },
        { time: 45, spawns: [{ type: 'football', count: 2 }, { type: 'bucket', count: 2 }] },
        { time: 85, spawns: [{ type: 'balloon', count: 3 }, { type: 'snorkel', count: 2 }] },
        { time: 125, spawns: [{ type: 'gargantuar', count: 1 }] },
        { time: 160, spawns: [{ type: 'football', count: 3 }, { type: 'screen', count: 3 }] },
        { time: 195, spawns: [{ type: 'gargantuar', count: 1 }, { type: 'balloon', count: 3 }, { type: 'snorkel', count: 3 }] }
      ]
    },
    {
      id: '3-5', name: '关卡 3-5 · 泳池之夜', world: '泳池', initialSun: 100, speedMul: 1.45, night: true, pool: [2, 3],
      deck: ['sunflower', 'sunshroom', 'puffshroom', 'peashooter', 'threepeater', 'wallnut', 'spikeweed', 'cherrybomb', 'potatomine', 'dormium'],
      waves: [
        { time: 14, spawns: [{ type: 'normal', count: 3 }, { type: 'snorkel', count: 2 }] },
        { time: 50, spawns: [{ type: 'cone', count: 3 }, { type: 'balloon', count: 2 }] },
        { time: 90, spawns: [{ type: 'newspaper', count: 3 }, { type: 'snorkel', count: 3 }] },
        { time: 130, spawns: [{ type: 'bucket', count: 3 }, { type: 'football', count: 2 }, { type: 'screen', count: 2 }] },
        { time: 170, spawns: [{ type: 'dancing', count: 1 }, { type: 'balloon', count: 3 }, { type: 'snorkel', count: 3 }] }
      ]
    },

    // ═════════ 第四世界：迷雾（4 关）════════
    {
      id: '4-1', name: '关卡 4-1', world: '迷雾', initialSun: 100, speedMul: 1.3, fog: true,
      deck: ['sunflower', 'peashooter', 'plantern', 'wallnut', 'potatomine', 'cherrybomb'],
      waves: [
        { time: 18, spawns: [{ type: 'normal', count: 3 }] },
        { time: 55, spawns: [{ type: 'cone', count: 2 }, { type: 'newspaper', count: 2 }] },
        { time: 95, spawns: [{ type: 'bucket', count: 2 }, { type: 'screen', count: 2 }] },
        { time: 140, spawns: [{ type: 'jackbox', count: 2 }, { type: 'bucket', count: 3 }, { type: 'cone', count: 2 }] }
      ]
    },
    {
      id: '4-2', name: '关卡 4-2', world: '迷雾', initialSun: 125, speedMul: 1.4, fog: true,
      deck: ['sunflower', 'peashooter', 'repeater', 'plantern', 'magnetshroom', 'pumpkin', 'wallnut', 'tallnut', 'cherrybomb', 'potatomine'],
      waves: [
        { time: 15, spawns: [{ type: 'cone', count: 3 }, { type: 'newspaper', count: 2 }] },
        { time: 50, spawns: [{ type: 'screen', count: 3 }, { type: 'football', count: 2 }] },
        { time: 90, spawns: [{ type: 'jackbox', count: 3 }, { type: 'bucket', count: 2 }] },
        { time: 130, spawns: [{ type: 'digger', count: 2 }, { type: 'bungee', count: 2 }, { type: 'screen', count: 3 }] },
        { time: 170, spawns: [{ type: 'football', count: 4 }, { type: 'jackbox', count: 2 }, { type: 'digger', count: 2 }] }
      ]
    },
    {
      id: '4-3', name: '关卡 4-3', world: '迷雾', initialSun: 150, speedMul: 1.45, fog: true,
      deck: ['sunflower', 'peashooter', 'repeater', 'plantern', 'magnetshroom', 'pumpkin', 'wallnut', 'tallnut', 'cherrybomb', 'jalapeno', 'squash', 'potatomine'],
      waves: [
        { time: 12, spawns: [{ type: 'digger', count: 3 }, { type: 'cone', count: 2 }] },
        { time: 48, spawns: [{ type: 'bungee', count: 3 }, { type: 'jackbox', count: 2 }] },
        { time: 88, spawns: [{ type: 'football', count: 3 }, { type: 'digger', count: 2 }] },
        { time: 128, spawns: [{ type: 'gargantuar', count: 1 }, { type: 'bungee', count: 3 }, { type: 'jackbox', count: 2 }] },
        { time: 168, spawns: [{ type: 'digger', count: 4 }, { type: 'football', count: 3 }, { type: 'screen', count: 3 }] },
        { time: 205, spawns: [{ type: 'yeti', count: 1 }, { type: 'digger', count: 3 }, { type: 'bungee', count: 2 }] }
      ]
    },
    {
      id: '4-4', name: '关卡 4-4 · 迷雾深渊', world: '迷雾', initialSun: 175, speedMul: 1.5, fog: true,
      deck: ['sunflower', 'peashooter', 'repeater', 'torchwood', 'plantern', 'magnetshroom', 'pumpkin', 'wallnut', 'tallnut', 'spikeRock', 'cherrybomb', 'jalapeno', 'chomper', 'squash'],
      waves: [
        { time: 10, spawns: [{ type: 'digger', count: 3 }, { type: 'bungee', count: 2 }] },
        { time: 42, spawns: [{ type: 'jackbox', count: 3 }, { type: 'football', count: 3 }] },
        { time: 82, spawns: [{ type: 'gargantuar', count: 1 }, { type: 'digger', count: 3 }, { type: 'bungee', count: 2 }] },
        { time: 122, spawns: [{ type: 'yeti', count: 1 }, { type: 'jackbox', count: 3 }, { type: 'football', count: 4 }] },
        { time: 162, spawns: [{ type: 'gargantuar', count: 1 }, { type: 'digger', count: 4 }, { type: 'bungee', count: 3 }] },
        { time: 200, spawns: [{ type: 'gargantuar', count: 1 }, { type: 'yeti', count: 1 }, { type: 'jackbox', count: 3 }] }
      ]
    },

    // ═════════ 第五世界：屋顶（4 关）════════
    {
      id: '5-1', name: '关卡 5-1', world: '屋顶', initialSun: 125, speedMul: 1.3, roof: true,
      deck: ['sunflower', 'peashooter', 'kernelpult', 'melonpult', 'wallnut', 'cherrybomb', 'potatomine'],
      waves: [
        { time: 16, spawns: [{ type: 'cone', count: 3 }, { type: 'normal', count: 2 }] },
        { time: 52, spawns: [{ type: 'bucket', count: 2 }, { type: 'football', count: 2 }] },
        { time: 92, spawns: [{ type: 'screen', count: 3 }, { type: 'newspaper', count: 2 }] },
        { time: 135, spawns: [{ type: 'catapult', count: 1 }, { type: 'bucket', count: 3 }, { type: 'cone', count: 2 }] },
        { time: 175, spawns: [{ type: 'football', count: 4 }, { type: 'screen', count: 3 }] }
      ]
    },
    {
      id: '5-2', name: '关卡 5-2', world: '屋顶', initialSun: 150, speedMul: 1.4, roof: true,
      deck: ['sunflower', 'peashooter', 'repeater', 'melonpult', 'cobaltion', 'kernelpult', 'wallnut', 'tallnut', 'chomper', 'cherrybomb', 'jalapeno'],
      waves: [
        { time: 14, spawns: [{ type: 'cone', count: 2 }, { type: 'football', count: 3 }] },
        { time: 48, spawns: [{ type: 'catapult', count: 1 }, { type: 'screen', count: 3 }] },
        { time: 88, spawns: [{ type: 'football', count: 4 }, { type: 'newspaper', count: 3 }] },
        { time: 128, spawns: [{ type: 'gargantuar', count: 1 }, { type: 'catapult', count: 1 }, { type: 'football', count: 3 }] },
        { time: 168, spawns: [{ type: 'gargantuar', count: 1 }, { type: 'football', count: 4 }, { type: 'bucket', count: 3 }] }
      ]
    },
    {
      id: '5-3', name: '关卡 5-3 · 屋顶决战', world: '屋顶', initialSun: 175, speedMul: 1.45, roof: true, boss: 'gargantuar',
      deck: ['sunflower', 'peashooter', 'repeater', 'melonpult', 'cobaltion', 'kernelpult', 'torchwood', 'wallnut', 'tallnut', 'spikeRock', 'chomper', 'cherrybomb', 'jalapeno', 'potatomine'],
      waves: [
        { time: 12, spawns: [{ type: 'football', count: 3 }, { type: 'cone', count: 2 }] },
        { time: 45, spawns: [{ type: 'catapult', count: 2 }, { type: 'screen', count: 3 }] },
        { time: 85, spawns: [{ type: 'gargantuar', count: 1 }, { type: 'football', count: 3 }] },
        { time: 125, spawns: [{ type: 'catapult', count: 1 }, { type: 'gargantuar', count: 1 }, { type: 'bucket', count: 4 }] },
        { time: 165, spawns: [{ type: 'gargantuar', count: 1 }, { type: 'football', count: 4 }, { type: 'catapult', count: 2 }] },
        { time: 200, spawns: [{ type: 'gargantuar', count: 2 }, { type: 'football', count: 3 }] }
      ]
    },
    {
      id: '5-4', name: '关卡 5-4 · 屋顶终焉', world: '屋顶', initialSun: 200, speedMul: 1.5, roof: true,
      deck: ['sunflower', 'peashooter', 'repeater', 'melonpult', 'cobaltion', 'kernelpult', 'torchwood', 'wallnut', 'tallnut', 'pumpkin', 'spikeRock', 'chomper', 'cherrybomb', 'jalapeno'],
      waves: [
        { time: 10, spawns: [{ type: 'catapult', count: 2 }, { type: 'football', count: 3 }] },
        { time: 42, spawns: [{ type: 'gargantuar', count: 1 }, { type: 'screen', count: 4 }] },
        { time: 82, spawns: [{ type: 'catapult', count: 2 }, { type: 'gargantuar', count: 1 }, { type: 'football', count: 4 }] },
        { time: 122, spawns: [{ type: 'zombot', count: 1 }] },
        { time: 162, spawns: [{ type: 'gargantuar', count: 2 }, { type: 'catapult', count: 2 }, { type: 'football', count: 4 }] }
      ]
    },

    // ═════════ 第六世界：终局（最终 Boss 关）════════
    {
      id: '6-1', name: '终局之战 · 僵尸博士', world: '终局', initialSun: 250, speedMul: 1, boss: 'zombot',
      deck: ['sunflower', 'sunshroom', 'peashooter', 'repeater', 'threepeater', 'snowpea', 'torchwood', 'melonpult', 'cobaltion', 'wallnut', 'tallnut', 'pumpkin', 'spikeRock', 'cherrybomb', 'jalapeno', 'chomper', 'potatomine', 'squash', 'magnetshroom', 'plantern'],
      waves: [
        { time: 10, spawns: [{ type: 'cone', count: 4 }, { type: 'normal', count: 4 }] },
        { time: 40, spawns: [{ type: 'football', count: 4 }, { type: 'bucket', count: 3 }] },
        { time: 75, spawns: [{ type: 'gargantuar', count: 1 }, { type: 'football', count: 3 }, { type: 'screen', count: 3 }] },
        { time: 110, spawns: [{ type: 'gargantuar', count: 1 }, { type: 'catapult', count: 2 }, { type: 'balloon', count: 3 }] },
        { time: 145, spawns: [{ type: 'zombot', count: 1 }] },
        { time: 185, spawns: [{ type: 'gargantuar', count: 2 }, { type: 'football', count: 4 }, { type: 'bucket', count: 4 }] },
        { time: 220, spawns: [{ type: 'zombot', count: 1 }, { type: 'gargantuar', count: 1 }, { type: 'yeti', count: 1 }] }
      ]
    }
  ],

  // 世界分组（用于关卡选择界面）
  WORLDS: ['白天草地', '黑夜', '泳池', '迷雾', '屋顶', '终局']
};
