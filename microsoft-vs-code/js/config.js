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
  cron:     { name: 'cron 定时任务',  cost: 25,  hp: 200,  cd: 10, fx: '产能 15→45 / 20s',      lore: '凌晨三点自己起来干活' },
  ssh:      { name: 'SSH 隧道',       cost: 175, hp: 300,  cd: 7,  fx: '三线 18伤/1.6s',        lore: '端口转发到上下两行，隧道不过墙' },
  rebase:   { name: 'rebase 地刺',    cost: 100, hp: 40,   cd: 12, fx: '不可啃咬 · 90dps',      lore: '踩上去的人都被要求重写历史' },
  sourcemap:{ name: '溯源图',         cost: 150, hp: 300,  cd: 9,  fx: '雾中显形 · 受伤 +25%',  lore: '压缩成一行的它也能还原' },
  cors:     { name: '万能头',         cost: 200, hp: 350,  cd: 12, fx: '本行直线豁免 CORS',     lore: 'Access-Control-Allow-Origin: *' },
};
const ALL_CARDS = ['coffee', 'log', 'keyboard', 'firewall', 'duck', 'bp', 'rmrf', 'pad', 'stack', 'monitor', 'bug', 'cron', 'ssh', 'rebase', 'sourcemap', 'cors'];
/* 跨域高墙：直线请求全部被同源策略弹开（monitor 是光束、bug 是重定向、ssh 走隧道，豁免） */
const NO_ROOF = ['log', 'keyboard', 'firewall'];
/* 溯源图：雾中显形 + 标记半径（px），美术里的虚线圈与战斗判定共用 */
const REVEAL_R = 165;

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
  defender:  { name: '实时防护',         hp: 240,  speed: 16,  dps: 80,  armor: 380, star: [4, .6], fx: '护盾 380 · 弹开直线',  lore: '你的 log 被判定为威胁' },
  copilot:   { name: 'AI 补全',          hp: 340,  speed: 30,  dps: 80,  star: [3, .5],  fx: 'Tab 越过第一个单位',          lore: '它猜到了你要种什么' },
  invite:    { name: '会议邀请',         hp: 260,  speed: 34,  dps: 90,  star: [3, .5],  fx: '地下潜行 · 出土换行',         lore: '已接受：30 分钟，无议程' },
  hotfix:    { name: '救火 U 盘',        hp: 900,  speed: 52,  dps: 110, star: [7, .75], noSlow: true, fx: '全速冲锋 · 免疫减速',         lore: '生产环境的英雄，只带一个 U 盘' },
  store:     { name: '微软商店',         hp: 420,  speed: 14,  dps: 70,  star: [5, .6],  fx: '每 9s 抛一只小红点',          lore: '「已为你安装」不需要你同意' },
};

/* 图鉴档案正文：lore 是一句话标语，story 是点进详情页看的背景故事 */
const STORIES = {
  you: {
    coffee: '它不写代码，也不打怪，只负责在你已经不想活的时候再提供 30 点咖啡因。运维手册上只写了两个字：别停。于是它从来没停过——所有战术、所有坚持，最后都要回到这台机器有没有电。',
    log: '项目第一天你写它，项目最后一天你还在写它。没有伤害加成，没有优雅语法，但只要它打印出来过一次，你就知道这段程序还活着。上线前删掉的那些 log，都会在事故现场以另一种形式回来找你。',
    keyboard: '青轴，全办公室都听得见你的输出。双倍射速来自一个未经证实的说法：键程越爽，思路越快。至于它真正的作用，是吵到对面——物理意义上的。',
    firewall: '它挡住的不只是网络包，还有产品经理直连生产的幻想。命中减速，是因为所有请求都得先走一遍审批流程。公司内网味，具体表现为：慢，但是稳。',
    duck: '《调试的艺术》里那只鸭子，被真正量产之后发现比工程师好用：不还嘴，不请假，被咬的时候还能嘎一声顶 1100 血。你只需要相信一件事——把问题讲给它听，问题就已经解决了一半。',
    bp: '便宜，量大，需要八秒冷静下来。它存在的意义，是让某个失控的流程在错误的位置停一停，顺便把周围炸平。生产环境的同事会劝你千万别用它，因为他们已经这么干过一次了。',
    rmrf: '一条命令，1800 点范围伤害，代价是你自己也一起没了。它教会每一个手滑的人同一件事：按回车之前，先看清当前目录。',
    pad: 'merge 冲突的水面上，只有先铺开一块地基，才谈得上种植。它没有血量也没有输出，但少了它，你连后悔的资格都没有。',
    stack: '复制粘贴之力。围着它三格以内的单位都会突然勤快 40%，因为你的问题早就有人问过，也早就有人答过。至于答案是否完全正确，那属于你个人需要承担的风险。',
    monitor: '250 咖啡的昂贵赌注：视野拉到整行，一巴掌 120 点。别人还在纠结色域，你已经用像素做了打击精度。它也是全办公室最容易被抱去开会的那台设备。',
    bug: '当所有直线请求都被同源策略弹开，只有抛物线能把锅甩过去。它砸得又高又远，落点周围一起遭殃——毕竟一份写清楚的 BUG 单，从来不止一个人看得懂。',
    cron: '你写它的时候是周五下午五点，本来只想让它替你跑一次数据。周一早上你发现它每天都在跑，而且没人敢删。它不聪明、不报错、不休息，是团队里绩效最好的那位——虽然从来没参加过晨会。',
    ssh: '本地端口 8080 转发到线上 22，注释里写着「临时用一下，周末就删」。三个月后它成了整条链路的地基：上下两行都能顾到，墙也拦不住它，因为隧道从一开始就不打算走正门。',
    rebase: '它不挡怪，它改历史。谁走过去，谁的提交记录就要重算一遍。老员工反复叮嘱：不要在共享分支上用它——可正因为如此，才总有人想试试。',
    sourcemap: '线上只有一行压缩代码，报错位置是 `index-8f3c1a.js:1:294187`。它把那张地图铺开，雾里的人就都站到了灯下：你不但看得见，打上去还多疼四分之一。写代码的人可以跑，注释可以丢，地图不能丢。',
    cors: '一行 `Access-Control-Allow-Origin: *`，安全评审当场通过——因为没人细看。它把整行的门禁都开了一道缝：直线请求终于可以名正言顺地撞过去。代价是，以后所有事故复盘都会引用这一行。',
  },
  foe: {
    clippy: '1997 年它问你要不要写一封信，2026 年它问你要不要重写一遍这个模块。它记得你所有没写完的东西，并且真心实意地想帮你把它们写完。这份执着，你只能理解成爱。',
    ie: '它慢，它不标准，它每走一步都在挑战你的耐心。但它从 1995 年一路走到今天，从未真正退场。所有关于它死亡的传闻，都只是下一个版本发布的预热。',
    edge: '它以迅雷不及掩耳之势成为默认浏览器——在你没有同意的前提下。弹窗是它表达礼貌的方式：先告诉你它来了，再告诉你它已经替你做好了选择。',
    update: '它从不在你空闲时出现，只在演示、上线和凌晨三点降临。它会挑一个你最重要的单位，说一句「需要重启一下」，然后消失四秒。进度条停在 99% 的样子，像极了对人生的态度。',
    bsod: '倒下不是结束，是拉着整行一起休息。它带来了详细的错误代码，和一点点的心理阴影——可惜从来没有人能看懂第二行到底写了什么。',
    garg: '2100 血，半血狂暴，走到哪里都要停下来安装一下。它不是恶意软件，它是「经你同意后」安装的官方组件。0% 到 99% 只是等待，99% 之后才是真正的开始。',
    telemetry: '它在远处是半透明的，等你靠近才看得见。它一直在收集「改进体验所需的必要数据」，其中包括你此刻的表情。可以关掉的选项一共有 12 个，全都藏在「更多设置」的下一层里。',
    teams: '「在吗？现在方便吗？」——每十秒一次，不带上下文，也不接语音。它的一句话会召唤出一群小红点，就像它自己也没想到会有这么多。',
    popup: '已读不回也没有用，它会自己增长。它全部的存在意义，就是让你相信右上角那个数字很重要。',
    balloon: '它飘过你所有的防御，因为策略文档里写明了「横幅提示不属于可拦截内容」。把它打爆之后，它会落地，然后以普通弹窗的身份继续往前走。',
    dotnet: '项目里那个谁都不愿意碰的依赖：不兼容，但永不退场。倒下之后它会以兼容模式复活一次，用当年的姿势再走一段路。所有人都盼它退休，所有电脑都还装着它。',
    defender: '它挡下来的第一条日志，恰好是你排查故障唯一依赖的那一条。它不关心你的系统跑得好不好，只关心有没有东西绕过它——包括你自己。护盾 380，专吃直线请求；至于抛物线甩过来的工单，一律判定为「用户主动提交」。',
    copilot: '你刚敲下两个字母，它已经把整行补完、回车、并且推到了主分支。它真心认为你们配合得天衣无缝，所以每次想拒绝它，你得连按三次 Esc。它越过第一个单位不是恶意，只是顺手帮你把路也补上了。',
    invite: '它从地板下面钻过来，不占你的火力线，也不接受拒绝——议程一栏至今空白。出土之后它会挑一个最舒服的位置坐下，共享屏幕，然后问大家能看到吗。三十分钟的事，通常只解决了一件事：下次再约。',
    hotfix: '它不带代码，只带一个 U 盘和一句「先恢复再说」。它从不在白天出现，只在凌晨三点的告警里全速冲刺，任何流程都追不上它——减速、审批、复盘，全部无效。事故报告上写着「已修复」，没有一个人知道它改了什么。',
    store: '它走路很慢，但它会往你家里扔东西。你只是想看一眼订单，回头任务栏已经多了六个图标。它抛出来的小红点不算安装失败，也不算安装成功——它们只是在那里，等着下一次提醒你去处理。',
  },
};

/* ---------- 章节：一章一个场景 ---------- */
/* mode：编辑器外观三档，对应 PvZ 的白天 / 黄昏 / 深夜（场景差异由 pool/fog/roof 负责） */
const CHAPTERS = [
  { n: 1, name: '本地环境', file: 'localhost:3000', mode: 'light',
    scene: '浅色模式 · 白天编辑器，公网咖啡随便掉', cards: ['coffee', 'log', 'duck', 'keyboard'], slots: 4 },
  { n: 2, name: '离线机房', file: 'offline.mode', mode: 'dark', night: true,
    scene: '深色模式 · 断网内网，天上不掉咖啡全靠咖啡机', cards: ['coffee', 'log', 'keyboard', 'firewall', 'duck', 'bp', 'cron'], slots: 5 },
  { n: 3, name: '冲突水道', file: 'merge --abort', mode: 'light', pool: true,
    scene: '浅色模式 · 中间两行是 merge 冲突水道，先铺分支莲叶', cards: ['coffee', 'log', 'keyboard', 'firewall', 'duck', 'bp', 'rmrf', 'pad', 'ssh'], slots: 6 },
  { n: 4, name: '祖传迷雾', file: 'legacy.wasm', mode: 'midnight', fog: true,
    scene: '午夜模式 · 写这段代码的人已经离职了，右半场看不见僵尸', cards: ['coffee', 'log', 'keyboard', 'firewall', 'duck', 'bp', 'rmrf', 'pad', 'stack', 'sourcemap', 'rebase'], slots: 7 },
  { n: 5, name: '跨域高墙', file: 'CORS:403', mode: 'dark', roof: true,
    scene: '深色模式 · 左半深渊禁种，直线弹被 CORS 弹开，只能甩 BUG 报告', cards: [...ALL_CARDS], slots: 8 },
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
    waves: [[18, 60, 'clippy', 4], [30, 66, 'update', 3], [44, 70, 'edge', 3], [90, 120, 'bsod', 2], [104, 144, 'defender', 2], [100, 140, 'ie', 2], [150, 182, 'teams', 2]],
    banners: [[2, '机房之夜', 'LED 只闪坏消息', '#dcdcaa'], [86, '第二波 · 蓝屏降临', '死机会电你整行', '#e8e8e8'], [100, '实时防护已开启', '直线请求会被判定为威胁', '#4ec9b0'], [146, '一大波 Teams 通知正在接近！', '"在吗？"', '#d1695c']],
  },
  {
    id: 5, ch: 3, label: '3-1', name: 'CONFLICT', winT: 150,
    waves: [[18, 60, 'clippy', 4], [30, 64, 'telemetry', 3], [44, 66, 'balloon', 2], [56, 82, 'copilot', 2], [72, 110, 'ie', 2]],
    banners: [[2, 'CONFLICT', '中间两行需要分支', '#d1695c'], [52, 'AI 补全已启用', '它会跳过你的第一个单位', '#8f94d8'], [68, '第二波 · 遥测上线', '它们在看你打字', '#e8e8e8']],
  },
  {
    id: 6, ch: 3, label: '3-2', name: 'git push -f', winT: 230,
    waves: [[18, 60, 'clippy', 5], [30, 66, 'telemetry', 4], [44, 70, 'balloon', 3], [90, 130, 'update', 3], [126, 166, 'copilot', 2], [140, 180, 'bsod', 2], [150, 190, 'edge', 3]],
    banners: [[2, 'git push -f', '强推开始，全线告急', '#d1695c'], [86, '第二波 · 深夜加班', '白天掉的咖啡用完了', '#e8e8e8'], [136, '一大波合并冲突正在接近！', '先打气球，再修分支', '#dcdcaa']],
  },
  {
    id: 7, ch: 4, label: '4-1', name: '无文档区', winT: 150,
    waves: [[20, 60, 'clippy', 4], [34, 64, 'ie', 2], [46, 70, 'edge', 3], [62, 100, 'invite', 2], [80, 112, 'telemetry', 4]],
    banners: [[2, '祖传代码', '雾里那位老哥没写注释', '#dcdcaa'], [58, '你收到一个会议邀请', '它从地板下面来', '#b48ee0'], [76, '第二波 · 依赖腐烂', 'npm install 别惊动它们', '#e8e8e8']],
  },
  {
    id: 8, ch: 4, label: '4-2', name: '祖传遗产', winT: 220,
    waves: [[18, 60, 'clippy', 4], [30, 66, 'update', 3], [44, 70, 'telemetry', 3], [64, 100, 'invite', 2], [90, 130, 'bsod', 2], [112, 150, 'defender', 2], [140, 172, 'dotnet', 2], [150, 182, 'teams', 2]],
    banners: [[2, '祖传遗产', '维护者：已离职 ×3', '#dcdcaa'], [86, '第二波 · 技术债到期', '连 .NET 4.0 都来了', '#e8e8e8'], [136, '一大波遗留系统正在接近！', '别读，守住就行', '#d1695c']],
  },
  {
    id: 9, ch: 5, label: '5-1', name: '403 Forbidden', winT: 180,
    waves: [[20, 60, 'clippy', 4], [34, 66, 'edge', 2], [50, 72, 'ie', 2], [88, 130, 'balloon', 3], [100, 140, 'telemetry', 3], [148, 172, 'hotfix', 2]],
    banners: [[2, 'Access-Control-Allow-Origin: 无', '直线弹被弹开，甩 BUG 报告！', '#dcdcaa'], [84, '第二波 · 响应式灾难', '气球会飘过墙头', '#e8e8e8'], [144, '救火 U 盘出发', '它不吃减速，全速冲脸', '#d1695c']],
  },
  {
    id: 10, ch: 5, label: '5-2', name: '决战红盟', winT: 280, mode: 'midnight',
    waves: [[20, 60, 'clippy', 5], [34, 66, 'update', 3], [50, 72, 'edge', 2], [90, 130, 'bsod', 3], [140, 170, 'dotnet', 2], [160, 182, 'teams', 2], [196, 206, 'garg', 2], [200, 250, 'store', 2]],
    banners: [[2, '最终之战', '他们带着安装包来了', '#d1695c'], [86, '第二波 · 全家桶预热', '重启倒计时开始', '#e8e8e8'], [190, '两个「强制更新.exe」正在接近！', '0%…99%…', '#d1695c'], [204, '微软商店正在推送', '「已为你安装」', '#b48ee0']],
  },
];
/* 章节数据下沉到关卡：mode/night/pool/fog/roof/cards/slots/file/world（关卡可覆盖 mode） */
for (const lv of LEVELS) {
  const ch = CHAPTERS.find(c => c.n === lv.ch);
  Object.assign(lv, {
    mode: lv.mode || ch.mode, night: !!ch.night, pool: !!ch.pool, fog: !!ch.fog, roof: !!ch.roof,
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
  { id: 'rebase',    pkg: 'rebase-spike@1.2.0',  cost: 55,  desc: '解锁新卡「rebase 地刺」：不可啃咬的地板伤害' },
  { id: 'cors',      pkg: 'cors-anywhere',       cost: 95,  desc: '解锁新卡「万能头」：本行直线弹豁免 CORS 高墙' },
];

/* ---------- 副业花园 ---------- */
const GARDEN = {
  side: { name: 'side project', seed: 10, harvest: 30,  water: 3 },
  ossl: { name: '开源框架',     seed: 30, harvest: 100, water: 5 },
};
const WATER_CD = 20000; // 两次 git commit（浇水）间隔 20s，真实时间，关页面也长
