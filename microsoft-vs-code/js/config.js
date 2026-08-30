/* 配置：布局、阵营数据、章节战役、npm 商店、副业花园 */
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

/* fx：图鉴里显示的功能参数 */
const PLANTS = {
  coffee:   { name: '咖啡机',        cost: 50,  hp: 300,  cd: 5,  fx: '产能 30/15s',            lore: '996 的能量来源，每 15s 冲一杯' },
  log:      { name: 'console.log',   cost: 100, hp: 300,  cd: 5,  fx: '直线 25伤/1.4s',         lore: '最朴素的火力：打一行 log 看看' },
  keyboard: { name: '机械键盘',      cost: 175, hp: 300,  cd: 6,  fx: '直线 20伤/0.7s',         lore: '青轴，双倍射速，吵到对面' },
  firewall: { name: '防火墙',        cost: 150, hp: 450,  cd: 8,  fx: '直线 20伤 + 减速50%',    lore: '过滤包，命中减速，公司内网味' },
  duck:     { name: '橡胶鸭',        cost: 50,  hp: 1100, cd: 18, fx: '肉墙 1100 血',           lore: 'debug 之鸭，被咬也会嘎一声' },
  bp:       { name: '断点',          cost: 25,  hp: 300,  cd: 16, fx: '8s 武装 · 爆 1200',      lore: '一踩即炸，便宜量大' },
  rmrf:     { name: 'rm -rf',        cost: 150, hp: 300,  cd: 28, fx: '3×3 爆 1800 · 一次性',   lore: '同归于尽的艺术' },
  pad:      { name: '分支莲叶',      cost: 25,  hp: 1,    cd: 4,  fx: '水道种植地基',           lore: '在 merge 冲突水道上开一条分支' },
  stack:    { name: 'Stack Overflow', cost: 125, hp: 300,  cd: 10, fx: '3×3 射手射速 +40%',      lore: '复制粘贴之力' },
  monitor:  { name: '4K 显示器',     cost: 250, hp: 300,  cd: 9,  fx: '全行 120伤/4s',          lore: '像素打击：超远程点名，无视高墙' },
  bug:      { name: 'BUG 报告',      cost: 125, hp: 300,  cd: 7,  fx: '抛物线 75伤 + 溅射',     lore: '抛物线甩锅：越过障碍砸下 bug 单' },
};
const ALL_CARDS = ['coffee', 'log', 'keyboard', 'firewall', 'duck', 'bp', 'rmrf', 'pad', 'stack', 'monitor', 'bug'];
/* 跨域高墙：直线请求全部被同源策略弹开（monitor 是光束、bug 是重定向，豁免） */
const NO_ROOF = ['log', 'keyboard', 'firewall'];

const ZOMBIES = {
  clippy:    { name: 'Clippy',           hp: 200,  speed: 20,  dps: 80,  star: [1, .35], fx: '基础 200血',                 lore: '它还记得你要写什么' },
  ie:        { name: 'IE 浏览器',        hp: 380,  speed: 10,  dps: 80,  star: [2, .5],  fx: '超慢 + 随机读条 380血',       lore: '慢，但终究会来' },
  edge:      { name: 'Edge 弹窗',        hp: 130,  speed: 46,  dps: 80,  star: [1, .3],  fx: '疾跑 130血',                  lore: '已自动设为默认僵尸' },
  update:    { name: 'Windows 更新',     hp: 550,  speed: 17,  dps: 80,  star: [4, .6],  fx: '周期强制重启你方单位',        lore: '在你行内挑一个单位重启 4s' },
  bsod:      { name: '蓝屏 BSOD',        hp: 850,  speed: 13,  dps: 80,  star: [8, .9],  fx: '死亡时蓝屏整行',              lore: '倒下瞬间瘫你整行 3s' },
  garg:      { name: '强制更新.exe',     hp: 2100, speed: 11,  dps: 600, star: [40, 1],  fx: 'Boss · 半血狂暴',             lore: '99% 之后才是真正的开始' },
  telemetry: { name: '遥测探针',         hp: 260,  speed: 26,  dps: 80,  star: [2, .45], fx: '远端半隐身 260血',            lore: '靠近前你看不见它' },
  teams:     { name: 'Teams 通知',       hp: 480,  speed: 15,  dps: 60,  star: [5, .6],  fx: '每 10s 召唤小红点',           lore: '"在吗？现在方便吗？"' },
  popup:     { name: '小红点',           hp: 90,   speed: 55,  dps: 40,  star: [1, .1],  fx: '高速杂兵 90血',               lore: '已读不回也没用' },
  balloon:   { name: 'Balloon 弹窗',     hp: 150,  speed: 30,  dps: 80,  star: [2, .4],  fx: '飞行 · 无视肉墙',             lore: '飘过头顶，打爆它' },
  dotnet:    { name: '.NET 框架 4.0',    hp: 1500, speed: 9,   dps: 120, star: [12, 1],  fx: '倒下会兼容模式复活一次',      lore: '不兼容，但永不退场' },
};

/* ---------- 章节：一章一个场景 ---------- */
const CHAPTERS = [
  { n: 1, name: '本地环境', file: 'localhost:3000', theme: 'day',
    scene: '白天编辑器 · 公网咖啡随便掉', cards: ['coffee', 'log', 'duck', 'keyboard'], slots: 4 },
  { n: 2, name: '离线机房', file: 'offline.mode', theme: 'offline', night: true,
    scene: '断网内网 · 天上不掉咖啡，全靠咖啡机', cards: ['coffee', 'log', 'keyboard', 'firewall', 'duck', 'bp'], slots: 5 },
  { n: 3, name: '冲突水道', file: 'merge --abort', theme: 'pool', pool: true,
    scene: '中间两行是 merge 冲突水道，先铺分支莲叶', cards: ['coffee', 'log', 'keyboard', 'firewall', 'duck', 'bp', 'rmrf', 'pad'], slots: 6 },
  { n: 4, name: '祖传迷雾', file: 'legacy.wasm', theme: 'fog', fog: true,
    scene: '写这段代码的人已经离职了，右半场看不见僵尸', cards: ['coffee', 'log', 'keyboard', 'firewall', 'duck', 'bp', 'rmrf', 'pad', 'stack'], slots: 7 },
  { n: 5, name: '跨域高墙', file: 'CORS:403', theme: 'roof', roof: true,
    scene: '左半深渊禁种，直线弹被 CORS 弹开，只能甩 BUG 报告', cards: [...ALL_CARDS], slots: 8 },
];

/* ---------- 关卡：每章 2 小关，章内同场景 ---------- */
const LEVELS = [
  {
    id: 1, ch: 1, label: '1-1', name: '开机自启', winT: 90,
    waves: [[16, 48, 'clippy', 4], [30, 55, 'ie', 2], [56, 62, 'edge', 2]],
    banners: [[2, 'localhost 启动', '它们来了', '#e8e8e8'], [54, '一小波 Clippy 正在接近！', '键盘手，顶住', '#dcdcaa']],
  },
  {
    id: 2, ch: 1, label: '1-2', name: '热重载', winT: 130,
    waves: [[18, 70, 'clippy', 6], [30, 75, 'ie', 3], [40, 78, 'edge', 4]],
    banners: [[2, '热重载', '第二波更吵', '#e8e8e8'], [70, '一大波弹窗正在接近！', 'HMR 也救不了你', '#dcdcaa']],
  },
  {
    id: 3, ch: 2, label: '2-1', name: '断网第一天', winT: 150,
    waves: [[20, 60, 'clippy', 4], [36, 66, 'ie', 2], [46, 70, 'edge', 3], [80, 112, 'update', 2]],
    banners: [[2, '网络已断开', '天上不掉咖啡了', '#dcdcaa'], [76, '第二波 · 后台更新', '系统自己动的手', '#e8e8e8']],
  },
  {
    id: 4, ch: 2, label: '2-2', name: '机房之夜', winT: 220,
    waves: [[18, 60, 'clippy', 4], [30, 66, 'update', 3], [44, 70, 'edge', 3], [90, 120, 'bsod', 2], [100, 140, 'ie', 2], [150, 182, 'teams', 2]],
    banners: [[2, '机房之夜', 'LED 只闪坏消息', '#dcdcaa'], [86, '第二波 · 蓝屏降临', '死机会电你整行', '#e8e8e8'], [146, '一大波 Teams 通知正在接近！', '"在吗？"', '#d1695c']],
  },
  {
    id: 5, ch: 3, label: '3-1', name: 'CONFLICT', winT: 150,
    waves: [[18, 60, 'clippy', 4], [30, 64, 'telemetry', 3], [44, 66, 'balloon', 2], [72, 110, 'ie', 2]],
    banners: [[2, 'CONFLICT', '中间两行需要分支', '#d1695c'], [68, '第二波 · 遥测上线', '它们在看你打字', '#e8e8e8']],
  },
  {
    id: 6, ch: 3, label: '3-2', name: 'git push -f', winT: 230,
    waves: [[18, 60, 'clippy', 5], [30, 66, 'telemetry', 4], [44, 70, 'balloon', 3], [90, 130, 'update', 3], [140, 180, 'bsod', 2], [150, 190, 'edge', 3]],
    banners: [[2, 'git push -f', '强推开始，全线告急', '#d1695c'], [86, '第二波 · 深夜加班', '白天掉的咖啡用完了', '#e8e8e8'], [136, '一大波合并冲突正在接近！', '先打气球，再修分支', '#dcdcaa']],
  },
  {
    id: 7, ch: 4, label: '4-1', name: '无文档区', winT: 150,
    waves: [[20, 60, 'clippy', 4], [34, 64, 'ie', 2], [46, 70, 'edge', 3], [80, 112, 'telemetry', 4]],
    banners: [[2, '祖传代码', '雾里那位老哥没写注释', '#dcdcaa'], [76, '第二波 · 依赖腐烂', 'npm install 别惊动它们', '#e8e8e8']],
  },
  {
    id: 8, ch: 4, label: '4-2', name: '祖传遗产', winT: 220,
    waves: [[18, 60, 'clippy', 4], [30, 66, 'update', 3], [44, 70, 'telemetry', 3], [90, 130, 'bsod', 2], [140, 172, 'dotnet', 2], [150, 182, 'teams', 2]],
    banners: [[2, '祖传遗产', '维护者：已离职 ×3', '#dcdcaa'], [86, '第二波 · 技术债到期', '连 .NET 4.0 都来了', '#e8e8e8'], [136, '一大波遗留系统正在接近！', '别读，守住就行', '#d1695c']],
  },
  {
    id: 9, ch: 5, label: '5-1', name: '403 Forbidden', winT: 180,
    waves: [[20, 60, 'clippy', 4], [34, 66, 'edge', 2], [50, 72, 'ie', 2], [88, 130, 'balloon', 3], [100, 140, 'telemetry', 3]],
    banners: [[2, 'Access-Control-Allow-Origin: 无', '直线弹被弹开，甩 BUG 报告！', '#dcdcaa'], [84, '第二波 · 响应式灾难', '气球会飘过墙头', '#e8e8e8']],
  },
  {
    id: 10, ch: 5, label: '5-2', name: '决战红盟', winT: 280,
    waves: [[20, 60, 'clippy', 5], [34, 66, 'update', 3], [50, 72, 'edge', 2], [90, 130, 'bsod', 3], [140, 170, 'dotnet', 2], [160, 182, 'teams', 2], [196, 206, 'garg', 2], [200, 252, 'clippy', 4]],
    banners: [[2, '最终之战', '他们带着安装包来了', '#d1695c'], [86, '第二波 · 全家桶预热', '重启倒计时开始', '#e8e8e8'], [190, '两个「强制更新.exe」正在接近！', '0%…99%…', '#d1695c']],
  },
];
/* 章节数据下沉到关卡：theme/night/pool/fog/roof/cards/slots/file/world */
for (const lv of LEVELS) {
  const ch = CHAPTERS.find(c => c.n === lv.ch);
  Object.assign(lv, {
    theme: ch.theme, night: !!ch.night, pool: !!ch.pool, fog: !!ch.fog, roof: !!ch.roof,
    cards: ch.cards, slots: ch.slots, file: ch.file, world: ch.name,
  });
}

/* ---------- npm 商店（永久升级，店主是那只橡胶鸭） ---------- */
const SHOP = [
  { id: 'bug',       pkg: 'bug-report@latest',   cost: 45,  desc: '解锁新卡「BUG 报告」投掷器（跨域高墙刚需）' },
  { id: 'undo2',     pkg: 'undo@2.0.0',          cost: 60,  desc: '每行第二枚 Ctrl+Z：撤销键帽 ×2' },
  { id: 'ram16',     pkg: 'ram@16gb',            cost: 50,  desc: '开局咖啡 +100（内存加上了）' },
  { id: 'ssd',       pkg: 'ssd@nvme',            cost: 80,  desc: '所有卡片冷却 -25%' },
  { id: 'coffeexl',  pkg: 'coffee-machine-xl',   cost: 70,  desc: '咖啡机产出 30 → 40' },
  { id: 'duckpaint', pkg: 'duck-debugger-pro',   cost: 40,  desc: '橡胶鸭血量 +60%' },
  { id: 'calib',     pkg: 'monitor-calibration', cost: 90,  desc: '4K 显示器伤害 120 → 180' },
  { id: 'vacuum',    pkg: 'star-vacuum-daemon',  cost: 55,  desc: 'star 自动飞进账户，不用点' },
  { id: 'slot',      pkg: 'extra-seed-slot',     cost: 100, desc: '每关可携带单位 +1' },
];

/* ---------- 副业花园 ---------- */
const GARDEN = {
  side: { name: 'side project', seed: 10, harvest: 30,  water: 3 },
  ossl: { name: '开源框架',     seed: 30, harvest: 100, water: 5 },
};
const WATER_CD = 20000; // 两次 git commit（浇水）间隔 20s，真实时间，关页面也长
