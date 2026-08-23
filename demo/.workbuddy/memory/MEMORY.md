# 项目记忆 · 六边智将（Hexa Chess Sort 微信小游戏）

- **项目名**：《六边智将》（曾用工作名《六边小将》）。结合 Hexa Sort（六边形拖拽排序消除）与国际象棋元素的单机休闲解谜微信小游戏。
- **平台**：微信小游戏（Canvas2D + `game.js`），非标准小程序。类目「游戏/休闲益智」。
- **主体**：个人主体起步（个体工商户为备案受阻时的备选）。MVP 锁死免内购 → 免版号，纯广告 IAA 变现。
- **技术栈**：原生微信小游戏 + TypeScript + esbuild。平台抽象层 `src/platform/{types,wx,dom}.ts` 让同一套逻辑跑微信与浏览器（浏览器入口 `web.ts` 免 AppID 试玩）。
- **美术（M3-F 定稿）**：可爱风奶油马卡龙 + **有高的六边形像素饼（hex pie，高径比≈0.75，顶面+侧壁+像素硬边+投影）**，棋子国际象棋剪影绘于饼顶面；6 色绑定 6 棋子（兵红/马蓝/象绿/车黄/后紫/王青）。路线 A 代码矢量直绘（包体≈0）。
- **玩法内核（M3-K 定稿）**：空六边形棋盘（**无颜色预设**）→ 拖整组入空格 → **仅当相邻格"最上层"棋子同色才自动合并**（整摞迁移：埋藏色随行保序，逐片弧线飞叠）→ **单格内同色累计 10 消除** + 计分/粒子 → 满格失败；集齐 6 色各消除 1 次触发「将杀」。保留：连击、星级、存档、救援三件套、程序化音效。
- **当前进度（2026-08-20）**：M3-K 顶层规则+像素管线+旋转视角完成。逻辑单测 **80/0**，构建 game.js 61.5kb / web.js 65.7kb，预览 `http://localhost:8123/index.html`（python -m http.server 8123 常驻，可能需要重启）。
- **M3-K（2026-08-20 本轮）**：① 合并/消除改为 Hexa Sort 原版语义——`colorComponent` 只认**顶层色**，`startConsolidate` **整摞迁移**（含埋藏色、保持底→顶顺序），`pickClearIdx`/`clearCellColor` 单格同色 ≥10 即消；② **像素管线真正接通**（`game.ts` 原先 buffer 是死代码！）：1/2 缩放离屏缓冲 + NN 放大，实测颜色突变 100% 落偶数坐标；等宽字体栈（Courier New/Consolas/monospace）+ 方角像素按钮/托盘/Toast（亮暗双色斜面）；③ **立体棋盘**：`TILT=0.8` 俯角压缩 + 空白处拖动旋转（`viewAngle`，ROT_SENS=0.008 rad/px），渲染 `translate→scale(1,TILT)→rotate→translate` + 按屏幕 y 远近排序遮挡；`boardToScreen/screenToBoard` 严格互逆，落点命中在棋盘平面坐标判定（旋转不影响准确度）；④ 缝隙减半 `CELL_R_RATIO` 0.9→0.95；⑤ 代码优化：邻接表 `neighborIdx` 预计算、update 单遍、删除死代码（drawPiece/pieceByType/randomColor/rgba/pixelToAxial/hexRadiusFor/ContainerSpec/PALETTE/clearing/mergedAway 状态、HIT_SCALE 等）、web.ts 的 dpr/resize 与 game.ts 尺寸冲突修复、输入全转发（game.ts 不再用 dragId 门控 pointerMove/Up）。
- **M3-J 进阶机制（同日早轮）**：① `lockedCell` 锁格（第 8 关起 2→7 个，灰色+斜纹+锁图标，不可放置、不算可放格）；② `decoy` 诱饵子（第 14 关起 12%→18% 概率刷场外色，6 色全开自动关）；③ `timed` 限时（第 21 关起 90+goal×6s 封顶 200，HUD 左侧倒计时、末 10s 变红、末 5s tick 音、合并动画期间暂停、超时 failReason='timeout' 仅重开不罚分）；④ `movingObstacle` 移动障碍（第 31 关起 1 个/第 41 关起 2 个，暖灰"车"塔，驻留 4s→缩出→换格→缩入，遮挡格不可放置）。机制首现弹一次 Toast（存档 `tipShown` 去重）。
- **M3-J 关键 bug 修复**：`HexCell` 对象字面量轴向坐标 `r` 被像素半径 `r: size*0.9` 覆盖（esbuild duplicate-key 警告即此）——导致 `getNeighbors` 邻接判定失真（同 q 列邻居永不合并、远格误判相邻）+ `drawCellStack` 期望 `rad` 字段而实际 undefined（棋盘渲染 NaN 空白）。修复：半径改名 `rad`，轴向 `q/r` 保留。
- **待办（M4 前）**：开发项已清零。剩余：① M4 资质（备案/软著、流量主 UV≥500 后填广告 ID）；② 可选：关键关手工精修、云开发真实排行榜、真机手感回归（旋转灵敏度/俯角参数需真机调）。
- **关键文档**：`docs/game-design.md`（GDD，权威依据，M3-F 已对齐）、`hexachess-wechat-minigame-analysis.html`（可行性/版号/主体分析）。
- **已装 skill**：`i-have-adhd`（输出格式辅助，用户要求沿用）、`wechat-miniprogram`（标准小程序框架，仅部分通用）。
- **IP 边界铁律**：忠实复刻 Hexa Sort 玩法内核，但视觉与代码 100% 原创（自绘 hex pie），不搬运原作素材/源码，规避「换皮」下架与侵权。
