// 全局配置与数据表：数值平衡集中于此，修改即生效
window.PVZ = window.PVZ || {};

PVZ.randomRange = function (a, b) {
  return a + Math.random() * (b - a);
};

PVZ.config = {
  canvasWidth: 1020,
  canvasHeight: 600,

  topBarHeight: 100,
  seedPanelWidth: 300,

  gridCols: 9,
  gridRows: 5,
  cellWidth: 80,
  cellHeight: 100,

  lawnOffsetX: 300,
  lawnOffsetY: 100,

  colors: {
    canvasBg: '#14181c',
    topBar: '#2c5e2c',
    seedPanel: '#3d2b1f',
    lawnA: '#58a93c',
    lawnB: '#63b844',
    lawnBorder: '#3e7d2b',
    fenceRed: '#d43a2f',
    fenceWhite: '#f5f5f5',
    text: '#e8e8e8',
    sunGold: '#ffd54f'
  },

  // ===== 植物配置 =====
  PLANTS: {
    sunflower: { name: '向日葵', cost: 50, cooldown: 7, hp: 300, action: { type: 'produce', interval: 9 } },
    peashooter: { name: '豌豆射手', cost: 100, cooldown: 7, hp: 300, action: { type: 'shoot', interval: 1.4 } },
    snowpea: { name: '寒冰射手', cost: 175, cooldown: 7, hp: 300, action: { type: 'shoot', interval: 1.4, ice: true } },
    repeater: { name: '双发射手', cost: 200, cooldown: 7, hp: 300, action: { type: 'shoot', interval: 1.4, volley: 2 } },
    wallnut: { name: '坚果墙', cost: 50, cooldown: 30, hp: 4000, action: null },
    tallnut: { name: '高坚果', cost: 125, cooldown: 30, hp: 8000, action: null },
    cherrybomb: { name: '樱桃炸弹', cost: 150, cooldown: 50, hp: 1000, action: { type: 'explode', delay: 1, damage: 1800, radius: 1 } },
    potatomine: { name: '土豆雷', cost: 25, cooldown: 30, hp: 300, action: { type: 'armed', delay: 15, damage: 1800, range: 1 } },
    squash: { name: '窝瓜', cost: 50, cooldown: 30, hp: 500, action: { type: 'squash', damage: 1800, range: 70 } }
  },

  // ===== 僵尸配置 =====
  ZOMBIES: {
    normal: { name: '普通僵尸', hp: 200, speed: 20, damage: 20, eatInterval: 0.5 },
    cone: { name: '路障僵尸', hp: 400, speed: 20, damage: 20, eatInterval: 0.5 },
    bucket: { name: '铁桶僵尸', hp: 700, speed: 20, damage: 20, eatInterval: 0.5 },
    pole: { name: '撑杆跳僵尸', hp: 250, speed: 30, damage: 20, eatInterval: 0.5 }
  },

  // ===== 阳光系统 =====
  SUN: {
    skyInterval: [7, 12], // 天空掉阳光间隔(秒)
    fallSpeed: 45,        // 下落速度 px/s
    life: 10,             // 落地后存活秒数
    value: 25,            // 天空阳光价值
    collectRadius: 26     // 点击收集半径
  },

  // ===== 关卡配置（数组下标 = 关卡索引，与存档联动） =====
  LEVEL_LIST: [
    {
      id: '1-1', name: '关卡 1-1', initialSun: 50, speedMul: 1,
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
      id: '1-2', name: '关卡 1-2', initialSun: 75, speedMul: 1,
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
      id: '1-3', name: '关卡 1-3', initialSun: 100, speedMul: 1.1,
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
      id: '1-4', name: '关卡 1-4', initialSun: 100, speedMul: 1.25,
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
      id: '1-5', name: '关卡 1-5', initialSun: 125, speedMul: 1.35,
      deck: ['sunflower', 'peashooter', 'snowpea', 'repeater', 'wallnut', 'tallnut', 'cherrybomb', 'potatomine', 'squash'],
      waves: [
        { time: 15, spawns: [{ type: 'normal', count: 3 }] },
        { time: 45, spawns: [{ type: 'cone', count: 3 }, { type: 'normal', count: 2 }] },
        { time: 80, spawns: [{ type: 'pole', count: 2 }, { type: 'bucket', count: 2 }] },
        { time: 115, spawns: [{ type: 'pole', count: 3 }, { type: 'cone', count: 3 }] },
        { time: 150, spawns: [{ type: 'bucket', count: 3 }, { type: 'pole', count: 3 }, { type: 'normal', count: 2 }] },
        { time: 185, spawns: [{ type: 'pole', count: 4 }, { type: 'bucket', count: 3 }, { type: 'cone', count: 3 }] }
      ]
    }
  ]
};
