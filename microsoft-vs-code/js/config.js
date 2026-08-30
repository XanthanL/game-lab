/* 配置：布局、阵营数据、关卡表 */
'use strict';

const W = 1280, H = 720;
const TITLE_H = 40, HUD_Y = 40, HUD_H = 62;
const LAWN_X = 110, CELL_W = 118, CELL_H = 118, LAWN_Y = 106, ROWS = 5, COLS = 9;
const LAWN_R = LAWN_X + COLS * CELL_W;
const LOSE_X = 96;
const CARD_X0 = 170, CARD_Y = 41, CARD_W = 54, CARD_H = 60, CARD_GAP = 7;
const OUT = '#141414';

const cellX = col => LAWN_X + col * CELL_W + CELL_W / 2;
const cellY = row => LAWN_Y + row * CELL_H + CELL_H / 2;

const PLANTS = {
  coffee:   { name: '咖啡机',        cost: 50,  hp: 300,  cd: 5,  lore: '996 的能量来源，每 18s 冲一杯（30）' },
  log:      { name: 'console.log',   cost: 100, hp: 300,  cd: 5,  lore: '最朴素的火力：打一行 log 看看' },
  keyboard: { name: '机械键盘',      cost: 175, hp: 300,  cd: 6,  lore: '青轴，双倍射速，吵到对面' },
  firewall: { name: '防火墙',        cost: 150, hp: 450,  cd: 8,  lore: '过滤包，命中减速，公司内网味' },
  duck:     { name: '橡胶鸭',        cost: 50,  hp: 1100, cd: 18, lore: 'debug 之鸭，被咬也会嘎一声' },
  bp:       { name: '断点',          cost: 25,  hp: 300,  cd: 16, lore: '8s 后武装，一踩即炸' },
  rmrf:     { name: 'rm -rf',        cost: 150, hp: 300,  cd: 28, lore: '同归于尽的艺术，3×3 清空' },
  pad:      { name: '分支莲叶',      cost: 25,  hp: 1,    cd: 4,  lore: '在 merge 冲突水道上开一条分支' },
  stack:    { name: 'Stack Overflow', cost: 125, hp: 300,  cd: 10, lore: '复制粘贴之力：邻近射手射速 +40%' },
  monitor:  { name: '4K 显示器',     cost: 250, hp: 300,  cd: 9,  lore: '像素打击：全行超远程高伤，装填慢' },
};
const ALL_CARDS = ['coffee', 'log', 'keyboard', 'firewall', 'duck', 'bp', 'rmrf', 'pad', 'stack', 'monitor'];

const ZOMBIES = {
  clippy:    { name: 'Clippy',           hp: 200,  speed: 20,  dps: 80,  lore: '它还记得你要写什么' },
  ie:        { name: 'IE 浏览器',        hp: 380,  speed: 10,  dps: 80,  lore: '慢，但终究会来' },
  edge:      { name: 'Edge 弹窗',        hp: 130,  speed: 46,  dps: 80,  lore: '已自动设为默认僵尸' },
  update:    { name: 'Windows 更新',     hp: 550,  speed: 17,  dps: 80,  lore: '周期强制重启你的单位' },
  bsod:      { name: '蓝屏 BSOD',        hp: 850,  speed: 13,  dps: 80,  lore: '死时整行蓝屏瘫痪' },
  garg:      { name: '强制更新.exe',     hp: 2100, speed: 11,  dps: 600, lore: '99% 之后才是真正的开始' },
  telemetry: { name: '遥测探针',         hp: 260,  speed: 26,  dps: 80,  lore: '靠近前你看不见它' },
  teams:     { name: 'Teams 通知',       hp: 480,  speed: 15,  dps: 60,  lore: '每 10s 弹一条"方便吗？"' },
  popup:     { name: '小红点',           hp: 90,   speed: 55,  dps: 40,  lore: '已读不回也没用' },
  balloon:   { name: 'Balloon 弹窗',     hp: 150,  speed: 30,  dps: 80,  lore: '飘过头顶，打爆它' },
  dotnet:    { name: '.NET 框架 4.0',    hp: 1500, speed: 9,   dps: 120, lore: '不兼容，但永不退场（复活一次）' },
};

/* 关卡表 ------------------------------------------------------------------
   night:  开局即加班（天空不掉咖啡）
   pool:   第 2、3 行是 merge 冲突水道（须先放分支莲叶）
   theme:  背景主题
   cards:  本关卡池（顺序即 HUD 卡槽顺序，数字键 1-N）
   waves:  [ [t0,t1,type,n] ... ]，rows 随机
   banners:[ [t,text,sub,color] ... ]
--------------------------------------------------------------------------- */
const LEVELS = [
  {
    id: 1, name: '白天防守', file: 'main.js',
    brief: '第一天上班。它们来了，先学会用咖啡和 log。',
    theme: 'day', night: false, pool: false, winT: 110,
    cards: ['coffee', 'log', 'duck', 'keyboard'],
    waves: [
      [16, 48, 'clippy', 4], [30, 55, 'ie', 2],
      [62, 66, 'clippy', 3], [62, 66, 'edge', 2], [64, 68, 'ie', 1],
    ],
    banners: [
      [2, '上班第一天', '它们来了', '#e8e8e8'],
      [60, '一小波 Clippy 正在接近！', '键盘手，顶住', '#dcdcaa'],
    ],
  },
  {
    id: 2, name: '通宵冲刺', file: 'night-mode.ts',
    brief: '全夜无天空咖啡，经济全靠咖啡机。学会为省咖啡而防守。',
    theme: 'night', night: true, pool: false, winT: 200,
    cards: ['coffee', 'log', 'keyboard', 'firewall', 'duck', 'bp'],
    waves: [
      [18, 60, 'clippy', 5], [34, 66, 'edge', 3], [44, 70, 'ie', 2],
      [86, 90, 'update', 3], [80, 128, 'clippy', 5], [88, 128, 'edge', 3], [96, 130, 'ie', 2],
      [150, 155, 'bsod', 2], [148, 178, 'clippy', 4], [152, 180, 'update', 2], [156, 182, 'edge', 3],
    ],
    banners: [
      [2, '通宵模式', '天空不再掉咖啡', '#dcdcaa'],
      [78, '第二波 · 深夜推送', '更新在路上了', '#e8e8e8'],
      [144, '一大波全家桶正在接近！', '守住发际线', '#d1695c'],
    ],
  },
  {
    id: 3, name: '冲突水道', file: 'merge --abort',
    brief: '中间两行是 merge 冲突水道，先铺「分支莲叶」才能种植。小心看不见的遥测与会飞的通知。',
    theme: 'pool', night: false, pool: true, winT: 240,
    cards: ['coffee', 'log', 'keyboard', 'firewall', 'duck', 'bp', 'rmrf', 'pad'],
    waves: [
      [18, 60, 'clippy', 4], [30, 64, 'ie', 2], [44, 66, 'balloon', 2], [52, 70, 'telemetry', 2],
      [84, 132, 'clippy', 5], [90, 134, 'telemetry', 4], [100, 138, 'balloon', 3], [108, 140, 'edge', 3], [118, 142, 'ie', 2],
      [168, 175, 'update', 3], [164, 208, 'clippy', 5], [170, 210, 'balloon', 3], [176, 212, 'telemetry', 4], [184, 214, 'bsod', 2],
    ],
    banners: [
      [2, 'CONFLICT', '中间两行需要分支', '#d1695c'],
      [78, '第二波 · 遥测上线', '它们在看你打字', '#e8e8e8'],
      [160, '一大波合并冲突正在接近！', '先打气球，再修分支', '#dcdcaa'],
    ],
  },
  {
    id: 4, name: '机房防守', file: 'prod.config.json',
    brief: '生产环境。Teams 通知会不断弹出小红点；.NET 框架 4.0 倒了还会再起。解锁「复制粘贴」与「4K 显示器」。',
    theme: 'server', night: true, pool: false, winT: 270,
    cards: ['coffee', 'log', 'keyboard', 'firewall', 'duck', 'bp', 'rmrf', 'stack', 'monitor'],
    waves: [
      [18, 62, 'clippy', 5], [30, 66, 'ie', 2], [40, 70, 'telemetry', 3], [55, 72, 'edge', 2],
      [92, 140, 'clippy', 5], [100, 145, 'update', 3], [110, 148, 'telemetry', 3], [115, 150, 'edge', 2], [130, 152, 'bsod', 2],
      [196, 204, 'teams', 3], [200, 240, 'clippy', 4], [206, 244, 'update', 3], [212, 246, 'bsod', 2], [220, 248, 'dotnet', 2],
    ],
    banners: [
      [2, '生产环境', '出事是真的出事', '#d1695c'],
      [88, '第二波 · 灰度发布', '遥测全开', '#e8e8e8'],
      [190, '一大波 Teams 通知正在接近！', '"现在方便吗？"', '#dcdcaa'],
    ],
  },
  {
    id: 5, name: '决战红盟', file: 'REDMOND.key',
    brief: '最终之战：两个强制更新.exe 扛着 setup 来了。全卡池解锁，守住你的编辑器。',
    theme: 'boss', night: true, pool: true, winT: 300,
    cards: [...ALL_CARDS],
    waves: [
      [18, 66, 'clippy', 6], [32, 70, 'edge', 3], [46, 74, 'telemetry', 2], [58, 78, 'ie', 2],
      [104, 156, 'clippy', 6], [110, 158, 'update', 4], [118, 160, 'edge', 3], [126, 164, 'balloon', 3], [134, 168, 'ie', 3], [150, 170, 'telemetry', 3],
      [208, 218, 'garg', 2], [204, 268, 'clippy', 5], [210, 270, 'bsod', 3], [216, 272, 'update', 3], [222, 274, 'dotnet', 2], [230, 276, 'teams', 2], [240, 278, 'edge', 2],
    ],
    banners: [
      [2, '最终之战', '他们带着安装包来了', '#d1695c'],
      [100, '第二波 · 全家桶预热', '重启倒计时开始', '#e8e8e8'],
      [200, '两个「强制更新.exe」正在接近！', '0%…99%…', '#d1695c'],
    ],
  },
];
