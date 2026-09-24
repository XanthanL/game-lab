# 奇点旅途 SINGULARITY VOYAGE — project notes

像素风太空弹幕射击。纯静态站点（无构建）：`index.html`、`style.css`、`src/{audio,sprites,game}.js`、`assets/`（Fusion Pixel 12px 字体，OFL）。

**血统**：画风与代码框架照搬 `last-firewall`（终焉防火墙），内容（船体 / 敌型 / 模块 / 波次）来自 `singularity-echo`（奇点回响）的重设计版。
本轮是**垂直切片**：5 船体 / 12 段航程 / 16 敌型 / 3 Boss / 16 模块卡（含 MAX 质变 + 8 组协同），完整可通关。

- 480x270 画布，`#wrap`（canvas + DOM 覆盖层）整体 CSS 缩放，UI 按游戏像素布局。像素字号必须是 12/24/36。
- `src/sprites.js`：调色板字符串精灵 + 烘焙；`src/audio.js`：WebAudio 合成 BGM/SFX；`src/game.js`：其余全部（船体在 `HULLS`，敌型在 `ETYPES`，编队在 `SQUADS`，Boss 在 `BOSSES`，模块在 `MODULES`，协同在 `SYNERGIES`，波次导演在 `startWave`/`updateWave`）。
- 操作：**WASD 惯性推进**（不是鼠标跟随），鼠标瞄准，**自动不开火**——按住左键或空格才射击。Space/左键开火，Shift/右键冲刺，E 超载。
- 关卡制：12 段，第 4/8/12 段是巨像；清空全部敌人后跃迁下一段。经验满 → 三选一模块。
- 存档：`localStorage['sv_save_v1']`（`SAVE`），存 best / 累计击坠 / 最远航段 / 通关次数 / 已解锁船体。
  老键 `sv_best` 在 `loadSave()` 里迁移，不要删。

## 三条硬纪律

1. **全局命名不能撞车。** 三个 js 都是普通 script（非 module），共享全局作用域。已经踩过两次：
   - `sprites.js` 的烘焙集合和 `game.js` 的船体数据表都叫 `HULLS` → `Identifier 'HULLS' has already been declared`，整页白屏。
     现在烘焙集合叫 `SHIPSET`。
   - **探针注入的脚本也算**。`.workbuddy/sv-balance.py` 里的 `var lastT` 撞上 `game.js` 的 `let lastT`
     → game.js 整份解析失败、`boot` 根本没定义、页面停在 loading。
     ⚠️ 而且**只在探针页复现**，直接开 index.html 完全正常 —— 极难定位。
     **注入脚本的全局名一律加前缀**（`balLog` / `balOut` / `balPost` / `balTicks`），别用 `out`/`t`/`st`/`lastT` 这种大众名。
   **新增全局常量前先 grep 三个文件 + 两个探针脚本。**
2. **精灵缓存的 key 必须是有界集合。** `_bcache`/`_gcache`/`tcache` 存 canvas，绝不把逐帧变化的量（alpha、浮点半径）写进 key，
   否则每帧泄漏一个 canvas、几分钟后 GPU 内存耗尽。要淡出就在 draw 时用 `drawGlow(ctx, color, R, alpha, x, y)` 改 `globalAlpha`
   （`glowSprite(color, R)` 本身不带 alpha 参数，key 只有 `color|R|1`，所以安全）。
3. **弹幕可读性**：友方 = 青白/金色细针（画在敌人**下**层），敌方 = 红/粉/紫描边圆弹（画在**最上**层）。新颜色只能在这两个色族里加。

## 敌型设计原则（第二批定下的）

新增敌型必须**改变玩家的决策**，不能只是换血量：

| 敌型 | AI | 机制 | 玩家的新决策 |
|---|---|---|---|
| 织网者 | `weave` | 往你前进方向前方铺减速蛛网（`G.webs`） | 走位要读图，不能直线冲 |
| 牧者 | `shepherd` | 半径 `aura` 内敌人持续回血 + 加速（`e.buffT`） | 必须优先点掉，否则这一波清不完 |
| 新星 | `chase` + `deathRing` | 死亡炸一圈弹幕（从 `r+6` 处生成，留一条缝） | 杀它的位置很重要 |
| 铁壁 | `guard` | 正面装甲吃掉 75% 伤害（`dx·facing < -0.35`） | 必须绕到侧后方 |

**已知副作用（有意保留）**：`damageEnemy` 的 `dx,dy` 传 `0,0` 时 `dot === 0`，不触发格挡
→ 电弧线圈（`updateAbilities`）无视铁壁装甲。当作「电击绕过装甲板」的设定，不是 bug。

## 输入 / 移动端（这一轮补的）

- ⚠️⚠️ **UI 按钮不要用 `click` 委托，用 `pointerdown`。** 触屏上手指按下去只要挪动一点点，
  `touchmove` 里的 `preventDefault()` 就会把浏览器随后**合成**的 `click` 掐掉 ——
  症状是「点『出击』完全没反应」（桌面端一切正常，只有手机复现，极难定位）。
  `pointerdown` 在任何手势判定之前触发，且不受后续 `preventDefault` 影响，鼠标/触屏/触控笔一套通吃。
  顺带把 `touchmove` 里那句 `preventDefault()` 删了 —— `html,body,#wrap` 上的 `touch-action:none`
  + `overscroll-behavior:none` 本来就够，它是多余的且有害的。
- ⚠️ **同一个交互不要同时挂 `el.onclick` 和 document 委托。** 委托里的 `renderHangar()` 会先把节点换掉，
  随后冒泡上来的 `onclick` 作用在一个已经脱离文档的节点上。选船现在统一走 `pickHull(i)`。
- ⚠️ **`banner()` / `toast()` 都往 `G` 上挂，但机库里 `G === null`**（`toTitle()` 会清掉）。
  机库点未解锁船体本来会走 `toast` → 直接抛 TypeError。两个函数现在都有 `if (!G) return`。
  没有画面反馈的失败 = 玩家以为按钮坏了，所以点锁定的船体会让 `#hull-detail` 抖一下（`.deny`）。
- **半屏判定要用游戏坐标**：`const [gx] = toGame(t.clientX, t.clientY); gx < W/2`。
  直接拿 `clientX - offX < innerWidth/2` 比，在居中的信箱式布局里会错位。
- **判断"玩家在用鼠标还是手指"要用 `pointerType`，不能用 `mousemove`。** 触屏点按之后浏览器会补一发
  兼容性的 `mousemove`，拿它判会让准星一闪一闪。现在 `pointerKind` 只由 `pointerdown`/`pointermove` 的
  `pointerType` 决定。
- **`isTouchDevice()` 只认 `matchMedia('(pointer: coarse)')`**。`'ontouchstart' in window`
  在带触摸屏的 Windows 上也为真，会把桌面端误判成手机（并在开局时弹全屏）。
- **安全区**：CSS 把 `env(safe-area-inset-*)` 读进 `--sat/--sab/--sal/--sar`，
  `fit()` 用 `getComputedStyle` 取出来，从视口尺寸里减掉再算缩放。`fit()` 同时改用 `visualViewport`
  （地址栏收放 / 转屏 / 进全屏都会改视口，只听 `window.resize` 会漏）。
- ⚠️ **竖屏提示 `#rotate` 走了两条路**：CSS `@media (orientation:portrait) and (pointer:coarse)`
  **加上** `<html>` 上的 JS class（`html.coarse.portrait #rotate`）。原因是纯媒体查询在无头桌面 Chrome 里
  永远为假、**测不了** —— 而这种全屏遮罩一旦在桌面端误触发，游戏直接不可玩。
  探针用 `__dbg.setLayout(coarse, portrait)` 四种组合都验一遍。
- **准星**（`drawCrosshair`）：桌面画在鼠标位置（`#wrap.playing { cursor:none }` 负责藏系统光标），
  触屏换成四角括线 + 摇杆底座。**全用 `fillRect` 画，不用 `ctx.arc`/`stroke`** ——
  1px 的圆弧会被抗锯齿糊成灰边，跟像素素材不是一套语言。坐标每帧都变，**绝不能进任何精灵缓存**。
  `pointerKind === 'touch'` 时画触屏版；`mouse.inside` 为假（鼠标移出窗口 / 切到别的标签）时不画。

## 其它已踩过的坑

- ⚠️⚠️ **敌人能被推到的最远处必须小于子弹的回收边界。** `updateBullets` 在 `|x|>20 或 |y|>20` 就回收弹丸，
  所以任何停在 ±40 的敌人**谁也打不到**，而 `updateWave` 的「场上清空才算过」永远不成立 → **整段航程卡死**。
  踩过两次：① 浮游雷 `spawnPos()` 生成在屏外 26px 且自己不动；② 牧者一路后退被硬夹在 ±40。
  现在统一 `const EDGE = 20`（生成边距 + 硬夹边都用它），并给所有带 `c.range` 的远程单位加**软性收容**（贴边往回走）。
  `updateWave` 里还留了一条 180 秒兜底（`alive <= 3` 就清场），防将来再出同类问题。
  **新增「不移动」或「会后退」的敌型时，先想清楚它能不能被子弹够到。**
- ⚠️ **`setTimeout` 是真实时间，`G.waveT` 是游戏时间。** 用 `setTimeout` 排巨像入场，`?fast=4` 时
  `waveT` 先跑到 2 秒 → 判「场上没 boss 也没敌人」→ 直接 `finishWave()`，第 4/8 段被整段跳过（3.7s 就过）。
  现在走 `G.bossPending` + `G.bossT -= dt`。**游戏内的一切计时都用 dt，只有 `gameOver` 的过场才用 setTimeout。**
- **卡片 glyph 用汉字，不要用 `▣ ➤ ↻ ◆ ✦` 这类符号。** 像素字体对符号覆盖不全，会渲染成缺字方块。
  现在用的是「甲 推 装 弹 暴 磁 修 相 炮 穿 爆 机 盾 电 冲 滞」。
- **`nearest(x, y, R)` 走空间网格，格子数是 (R/24)²，别传大半径。** 传 9999 会每帧扫 17 万个格子，直接卡死。
  `__dbg.nearest()` 与 `botStep()` 都用线性扫描。
- 船体精灵是**预烘焙 24 向**（`bakeRotation`），不要改成逐帧 `ctx.rotate`，否则糊掉像素边缘。
- **机库宽度是硬约束**：`#wrap` 只有 480px，5 台船体每台 86px + 8px 间距 = 462px。
  再加船体必须同步缩卡片（或改成两行 / 翻页），否则会被 `overflow:hidden` 切掉。
- **改完精灵表先验行宽**：`spriteFrom` 用 `Math.max(...rows.length)` 补宽，短一行不会报错，只会静默错位。
- **全局 keydown 里 `preventDefault` 会吃掉滑杆的方向键。** 先判 `e.target.tagName === 'INPUT'`，是输入控件就放行（Esc 仍交给游戏）。
- **`?bot=1` 会直接开局**（不再停在标题页），并且 bot 会自己把选卡面板点掉 —— 否则平衡跑测永远卡在升级界面。

## 命令

- 本地：`python -m http.server 8127` → http://127.0.0.1:8127/
- 冒烟探针：`python .workbuddy/sv-probe.py`（自带 HTTP 服务，无需另起；每次自动清空 Chrome profile）
  覆盖：标题 → 机库 → 开局 → 生成敌人 → 开火 → 击杀 → 升级三选一 → 选卡 → Boss → 跃迁
  → **4 种新敌型机制（铺网 / 治疗脉冲 / 正面减伤 / 死亡弹幕）→ 蛛网减速 → 命中凝滞 → 协同 → 存档解锁
  → 浮游雷夹边 → 巨像按游戏时间入场 → 航行日志 → 音量滑杆**，31 条断言。改完 `game.js` 就跑一次。
  ⚠️ 用例顺序有讲究：`die()` 之后 `state` 变 `over`，主循环不再 `step()`，所以**所有需要跑帧的用例
  （比如等巨像入场）必须排在 `die()` 之前**。
- 平衡跑测：`python .workbuddy/sv-balance.py [秒数] [倍速]` —— `?bot=1&god=1&fast=N` 自动游玩，
  每 ~5 秒回传快照（bot 无敌，永远不会「结束」，别只等 final），输出逐段用时 / 等级 / 模块 / 协同 /
  同屏峰值敌人 / 峰值蛛网 / **滞留敌人诊断**。改了 `ETYPES` / `SQUADS` / `ZONES` / `hpScale` 之后跑一次。
  ⚠️ **单次跑测的时长散得很开，别拿一把当基线。** 实测三把（`240 6`）：游戏内 271 / 373 / 426 s，
  等级 7—8、模块 5—6、协同 0—1。**1—7 段高度一致**（9.5±0.3 / 11±0.3 / 14±0.4 / 21.2 / 14.8 / 17±0.5 / 26.5±0.3），
  散的全在 8 段之后（第 8 段 33—49s、第 9 段 30—63s、第 10 段 52—59s、第 11 段 32—47s）——
  那是星区二的编队，**牧者刷在哪儿决定了这一波清多快**。要判断改动有没有影响，先比 1—7 段。
  三把都是 12 段通关、0 JS 错误、**无滞留**。
- 输入链路探针：`python .workbuddy/sv-input.py` —— 专治「桌面能跑、手机上按不动」这类问题。
  覆盖：`pointerdown` 能否真的出击 · 点未解锁船体不抛异常且不改变选中 · **准星画在鼠标位置 / 移动后旧位置
  清空 / `mouse.inside=false` 时收掉** · 触屏 `pointerType` 切换 · 左半屏摇杆满推杆 ·
  **竖屏提示四种组合只有「粗指针 + 竖屏」显示**。改了输入 / 布局 / 准星就跑一次。
  它用 `PointerEvent` + `TouchEvent` 构造器打真实事件序列（不是 `click`），
  ⚠️ 所以**不要再用 `click` 去测按钮** —— 委托已经不听 `click` 了。
- 截图探针：`python .workbuddy/sv-shot.py [宽x高]` —— 点出击 → 跑 90 帧 → 把 canvas 存成 PNG
  到 `.workbuddy/out/`。想看某一帧长什么样就用它（canvas 上只有战场，DOM 覆盖层拍不到）。
- 调试 URL 参数：`?bot=1`（自动游玩）、`&god=1`（无敌）、`&fast=N`（N 倍速）、`&loop=1`。
  `window.__dbg` 暴露 `G`、`state`、`spawnBoss`、`giveXp`、`nextWave`、`aim(x,y)`、`aimOff()`、`nearest()`、`die()`，
  探针用的 `spawn/clearEnemies/hit/setMods/clearMods/save/writeSave/hullUnlocked/checkUnlocks/lockAll/reload/webSlowAt/soundVol`，
  以及输入/布局用的 `pointerKind`、`touchMode`、`joyActive`、`joyVec`、`scale`、`off`、`pickHull`、`fit`、`updateLayoutMode`、`setLayout(coarse,portrait)`。

## 待办（下一轮）

- **故事框架未定**：用户说「会有新故事框架」，本轮玩法优先，标题页只有占位标语。
  接入点：`index.html` 的 `#title`（tagline）与 `game.js` 的 `startWave()`（每段一条 banner），
  想做开场 SYSTEM LOG 可以照搬 last-firewall 的 `#story` 覆盖层。
- 从垂直切片扩到全量：船体 5 → 8、模块 16 → 28、敌型 16 → 20、Boss 3 → 6、12 段 → 30 段 + 无尽漂移。
  加船体前先看「机库宽度是硬约束」那条。

