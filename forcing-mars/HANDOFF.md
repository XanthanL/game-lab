# 工作交接文档（HANDOFF）

> 面向承接本项目的下一个 agent。记录当前状态、关键架构决策、已知坑与待办。
> 最后更新：对应提交 `v21`（已 push 到 origin/main）。

---

## 1. 项目概况

- **名称**：Forcing Mars 强渡火星
- **类型**：Phaser 3 (v3.60.0, CDN 引入) 回合制卡牌肉鸽游戏（杀戮尖塔式地图推进）
- **形态**：**纯静态页面，无构建步骤**。直接用浏览器 + 本地 HTTP 服务器运行
- **仓库**：`https://github.com/XanthanL/forcing-mars.git`，分支 `main`
- **部署**：`.github/workflows/pages.yml` → push main 自动部署 GitHub Pages
- **本地运行**：`npm run dev`（映射到 `python -m http.server 8765`），或直接跑该命令。**不能用 file:// 直接打开**（资源加载会被浏览器拦截）

### 文件结构
```
index.html          入口，含 viewport/触屏锁定，按 ?v=NN 版本号引脚本
js/theme.js         【v21 新增】字体栈 + 高分屏文本渲染补丁，必须最先加载
js/audio.js         BGM 管理器（含移动端音频解锁）
js/entities.js      Player/Entity 类、CHARACTERS 四职业配置
js/cards.js         卡牌定义、DrawPile、升级/遗物/药水数据
js/story.js         开场剧情场景(StoryScene) + 共用加载进度条 createLoadingIndicator
js/main.js          ★核心 5900+ 行：BattleScene、UI、战斗状态机、地图、商店、存档
tools/process_art.ps1  美术处理管线（泛洪清底+渐晕+职业色调），可复跑
ART_ASSETS.md       美术资源现状清单
assets/             backgrounds/ enemies/ player/ ui/ bgms/
```

---

## 2. 关键架构决策（改动前务必理解）

### 2.1 缩放与布局（手机适配核心）
- 用 `Phaser.Scale.FIT` + `CENTER_BOTH`，**不是** RESIZE。设计分辨率是唯一坐标系，触点由 Phaser 自动映射
- **方向感知**：`computeLayout()` 依据 `window.innerHeight > window.innerWidth` 判断横竖屏，生成全局 `LAYOUT` 对象
  - 横屏 960×640：玩家左、敌人右
  - 竖屏 640×960：敌人上、玩家下
- **所有坐标必须走 `LAYOUT.xxx`**，不要硬编码像素（曾有 shakePlayerUI 硬编码 120/170 导致竖屏错位的 bug）
- 旋转屏幕时：`resize` 监听 → 若方向变了则 `setGameSize` + 重启场景。已实现**旋转静默续档**（旋转前 saveGame，重启后 create() 里 restoreAfterRotate 自动 loadGame，不弹存档询问框）

### 2.2 字体与文本清晰度（v21）
- **禁止再用 `"Courier New", monospace`**——它无中文字形，中文会回退成发糊的衬线体
- UI 一律用 `FONT_UI`（中文黑体栈），终端打字机用 `FONT_MONO`（都定义在 theme.js）
- theme.js 里 hook 了 `scene.add.text` 工厂，全局文本默认 2~3x 分辨率渲染（跟随 devicePixelRatio），FIT 拉伸后依旧锐利。**新增文本无需手动 setResolution**

### 2.3 美术方案（重要历史背景）
- **ImageGen 工具当时持续 40500 服务端故障**，无法生成新图。改用 B 计划：`tools/process_art.ps1` 对现有素材做程序化处理
- 原素材几乎全是**假透明**（棋盘格/白底被烤进 PNG，alpha 全 255）。方案是统一为「深色渐晕方形底(#140806) + 圆角矩形遮罩/底板」，规避透明通道依赖
- 4 职业立绘由宇航员原图裁胸像 + 不同色调乘数生成（蓝/绿/紫/红）
- **卡牌底图 ui_card_base.png 已废弃**，改为 `createCardGraphics()` 程序化绘制
- process_art.ps1 **必须用 `powershell.exe`（5.1）跑，不能用 pwsh**（.NET Core 缺 System.Drawing.Common）。原图可用 `git checkout` 恢复后重跑
- ⚠️ **若 ImageGen 服务恢复**：可把程序化色调变体升级为真正独立的原创立绘（4 职业 + 6 敌人），这是美术上的最优路径

---

## 3. 已知易踩的坑

1. **存档结构 version:2**：saveGame 现在存 `characterId` 和 `endingStats/endingFlags`。旧存档无 characterId 时 loadGame 回退宇航员。改存档字段时注意向后兼容
2. **续档总是回到地图选择**：loadGame 会把战斗中断的手牌/弃牌全部洗回牌库、清空瞬态战斗状态（enemy/turnPhase 等），不支持战斗中途精确恢复
3. **改脚本引用顺序**：theme.js 定义了 `FONT_UI/FONT_MONO` 全局常量，必须在其它 js 之前加载（index.html 已排好）
4. **版本号**：每次改 js 要把 index.html 里的 `?v=NN` 递增，否则浏览器缓存旧文件。当前 **v21**
5. **PowerShell + System.Drawing** 的环境/语法要求见项目记忆（Add-Type 用 powershell.exe、Marshal.Copy 参数顺序）

---

## 4. 本轮（v21 及之前）已完成

- [x] 死资源清理约 1.4MB（4 vfx、bg_transition 1MB、player_avatar、ui_bar_bg、ui_depth_segment、ui_card_base）
- [x] 手机适配：FIT + 方向感知 + index.html 触屏锁定/安全区/防缩放
- [x] 4 职业独立立绘接入（选人界面 + 战斗立绘），entities.js 各自独立 sprite key
- [x] 存档系统修复：职业/结局统计入档、旋转静默续档、新开局重置结局追踪
- [x] 首屏优化：分场景加载 BGM（剧情只载 story 曲）+ 终端风加载进度条
- [x] 移动端音频解锁延迟播放（sound.locked → once('unlocked')）
- [x] 存档弹窗「新游戏」正确进入选人界面（原来固定宇航员）
- [x] 字体全局黑体化 + 高分屏文本渲染 + 消灭 <11px 小字
- [x] 卡牌 UI 程序化重做（费用徽章/卡色标题栏/类型描边/辉光悬停）
- [x] 补 package.json 让 npm run dev 可用

---

## 5. 建议的后续优化方向（按价值，未做）

1. **main.js 拆分**：5900 行单文件（UI/战斗/地图/商店/事件/存档混在一起）。收益大但风险高，建议先有回归验证手段
2. **音效系统**：目前只有 BGM，出牌/受击/胜负无音效反馈
3. **战斗中旋转的完美恢复**：需序列化敌人状态和回合状态机（当前折中为放弃当前战斗回地图）
4. **美术升级**：ImageGen 恢复后生成真正原创的职业/敌人立绘（见 2.3）
5. **同方向 resize 的 UI 重排**：桌面拖窗口只 refresh 不重排，极窄横屏有黑边（不影响正确性）

---

## 6. 验证与惯例

- 改完 JS 用 `node --check js/xxx.js` 静态校验语法
- **用户已明确要求不用截图验证**，靠代码审查 + node --check
- commit 风格：`vNN: 简述`，正文用多个 `-m` 列要点（见 git log）
- 用户授权：无用文件可自主删除，敏感/不可逆操作需先确认
