# 强渡宇宙 FORCING COSMOS — project notes

像素卡牌构筑 Roguelike（杀戮尖塔式玩法）。纯静态站点（无构建）：`index.html`、`style.css`、`src/{audio,sprites,cards,entities,story,ui,game}.js`、`assets/`（Fusion Pixel 12px 字体，OFL）。
**零外部美术/音频资源**：所有精灵是 `sprites.js` 里的调色板字符串，所有声音是 `audio.js` 里的振荡器合成。

## 架构

- 画布 **640×360**；`#wrap`（canvas + DOM 覆盖层）整体 CSS 缩放（`fit()`），所以 UI 一律按游戏像素写坐标。像素字体只有 **12px**（正文）与 **24/36/48px**（标题）可用，不要写其它字号。
- **混合渲染**：canvas 只画战场（星空背景、实体、血条、意图、粒子、飘字）；**卡牌、按钮、弹窗、地图全部是 DOM**。DOM 用像素风 CSS（`style.css`），与 canvas 同一套 Sweetie 16 配色。
- `src/sprites.js`：`PAL` 调色板 + `spriteFrom`（palette-string → canvas）。**单帧简写 `['row','row']` 会被 `makeSet` 自动包一层**。敌人精灵按包围盒做**整数缩放**归一到统一体量（普通 68px、BOSS 102px）——不要改成非整数缩放，会糊。
- `src/cards.js`：卡牌数据（35 张 + 3 张诅咒）、升级表、药水、奖励池。**效果字段的结算逻辑在 `game.js` 的 `applyCard()` 里**，加新字段要同时改那里。
- `src/entities.js`：`ACTS`（三幕）/ `CHARACTERS`（4 职业）/ `ENEMIES`（18 种）/ `RELICS`（8 件）/ `STATUS_INFO`。`Entity`/`Player`/`Enemy` 类。
- `src/ui.js`：`LAY` 战场坐标表、`FX` 特效池、`drawBattle()`、`cardEl()`、`showModal()` / `pickCards()` / `pickFromDeck()`。
- `src/game.js`：`G` 全局状态、场景切换（`setScene`）、地图生成、战斗流程、事件/商店、存档。

## 必须遵守的约定

- **状态数据有两种写法**：`{type:'burn',stacks:2}`（卡牌）与 `{burn:2}`（敌人定义里的简写）。`applyStatus()` 两者都吃——**新增状态数据走这两种格式之一，不要自创**。
- **场景切换必须走 `setScene()`**：它负责隐藏所有覆盖层并切换 `#hud`/`#hand` 的显隐。打赢 BOSS 后要用 `setScene('actclear')` 把战斗 HUD 收掉，否则手牌会残留在幕终面板后面。
- **`#hand` 是全屏覆盖层（`inset:0`）**，卡牌的 `left/top` 直接用游戏坐标。曾因为给 `#hand` 设了 `bottom:0;height:132px` 导致卡牌整体被推出屏幕。
- **战场纵向节奏**（`LAY`）：标记 26 / 意图 38 / 名字 58 / 血条 74 / 状态行 88 / 电量 106 / 遗物 122。敌人底边 208、玩家底边 214。改尺寸时要一起调，否则 BOSS 立绘会压到状态图标。
- **精灵缓存**（`_gcache`/`_bcache`）的 key 只允许有界取值，**绝不把逐帧变化的 alpha/浮点半径放进 key**（会每帧新建 canvas 泄漏显存）。需要淡入淡出用 `drawGlow()` 走 globalAlpha。
- **音频必须在用户手势里 `Sound.init()`**（已挂在 `[data-act]` 点击与 Enter 上）。

## 交互出口约定（改 UI 前先读这条）

**每个「进得去」的面板都必须有「出得来」的口子。** 这是被作者实际卡住过的地方，不是理论洁癖。

- **弹窗分两类**：
  - **可关弹窗**（牌组、升级/移除/丢弃选卡器、商店）→ `showModal(title, build, actions, { onClose })` 里**必须给 `onClose`**。给了它，右上角的 `#modal-x` 才会显示，ESC 和点暗背景也才会生效。
  - **强制选择弹窗**（战后整理、休整营地、异象、幕终）→ **不给 `onClose`**，因为关掉会让玩家悬在半空。这类必须保证「选项本身可点」，且内容不能长到把选项挤出屏幕。
- ⚠️ **`.panel` 是 `overflow:hidden`**。牌组 30+ 张时，选项行会被直接裁掉 —— 看不到也点不到。所以 **`#modal-body` 自己滚**（`overflow-y:auto`），标题与 `#modal-actions` 留在外面不动。`#modal-body` 还要 `touch-action:pan-y`，否则 `html{touch-action:none}` 会让手机上滚不动。
- ⚠️ **子选择器的「取消」不能顺手把这一趟节点消费掉**。`pickFromDeck(..., { onCancel })` 的 `onCancel` 要退回上一层：
  休整 → `restSite` · 战后整理 → `rewardChoice` · 异象 → `showEvent(G.curEvent)`（**同一个**异象，不能重抽）。
- ⚠️ **先扣钱再弹选择器 = 取消就白扣**。商店的「移除一张卡」、熔炉的「花 15 金币升级」都用 `commit()` 回调模式：
  真正选定了才扣钱 / 加诅咒 / 删卡。
- ⚠️ **`showEvent(ev)` 会回写 `G.curEvent`**，让「当前异象」这个不变量自己成立 —— 别在别处再手动同步。
- ⚠️ **暂停必须真的暂停**。战斗里所有延时走 **`after(ms, fn)`**（`game.js` 顶部），它在 `G.paused` 期间每 120ms 自我重排。
  直接 `setTimeout` 的话，暂停只是个盖在上面的壳，敌人照样打你。
  `playCard` / `endTurn` / `usePotion` / 手牌 `pointerdown` 也都带 `G.paused` 守卫。
- ⚠️ **「点击屏幕」就必须整块屏幕能点**。剧情页的 `go` 监听挂在 `#story` 上（排除 `#story-skip`），
  不是挂在 `#story-text` 上 —— 后者比提示条矮，点在空白处毫无反应。
- ⚠️ **剧情打字机的 `setInterval` 必须在 `finish()` 里清掉**，并用 `done` 标志防重入。
  否则跳过之后定时器还在跑，往下一次打开的剧情框里继续灌旧文本。
- 无键盘设备（`(pointer: coarse)`）才显示 `#touch` 暂停键（CSS `html.coarse` + 媒体查询双路，见 `updatePointerMode()`）。
- ⚠️⚠️ **层叠上下文：带 z-index 的子元素会「逃逸」到最近的祖先层叠上下文里。**
  手牌卡在 `renderHand()` 里被赋 `d.style.zIndex = 10 + i`（悬停 60 / 拖拽 200），而 `#hand` 原本是 `z-index:auto`
  → **它不产生层叠上下文**，这些 10+ 的序号直接落到 `#wrap`（`transform` 让它成为层叠上下文）里，
  把 `z-index:auto`（≈0）的 `.ov` 弹窗整个盖住。
  症状极具欺骗性：开着牌组弹窗时**战斗手牌浮在弹窗上面**，连「关闭」按钮都被压住看不见 ——
  但 `getBoundingClientRect()` 和 `scrollHeight/clientHeight` 全部正常（它们量的是布局，不是绘制），
  所以**纯 DOM 断言抓不到这个 bug，必须用 `elementFromPoint` 做真实命中测试**。
  修法：`#hand { z-index: 5 }`（自己成为层叠上下文，内部序号不再外泄）+ `.ov { z-index: 20 }`（覆盖层统一压在手牌之上）。
  **规矩：任何「子元素会动态设 z-index」的容器，自己必须有一个 z-index。**
  排查手法：在页面上按 `getBoundingClientRect` 的坐标打一条 3px 标记线再截图，
  标记线落在 DOM 说的位置、而画面内容却在别处 → 就是绘制层的问题，不是布局。

## 探针（验证用，改完必跑）

```bash
python -m http.server 8126 --bind 127.0.0.1        # 必须常驻（先 curl 确认 docroot 就是 forcing-cosmos/）
bash .probe.sh                                     # 6 个场景截图 + 抓运行时错误 → .shots/
node .probe-exit.cjs                               # 交互出口审计（47 条）：改 UI 必跑
node .probe-shots-exit.cjs                         # 交互修复的视觉确认截图 → .shots/exit-*.png
```

自动通跑（真正驱动游戏逻辑，需要带调试端口的 Chrome）：

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --no-sandbox \
  --remote-debugging-port=9333 --user-data-dir="E:\Code\game-lab\forcing-cosmos\.chrome-prof" about:blank &
node .probe-run.mjs 170000 engineer     # 从地图开始自动打到结束
node .probe-boss.mjs 2 boss 60000 boost # 指定幕/BOSS；boost = 削弱敌人验证胜利与结局路径
```

- 探针用 **Chrome DevTools Protocol**：Node 22 自带全局 `WebSocket`，无需 puppeteer。
- **Chrome 必须用 `run_in_background` 启动**，否则命令结束后被回收，CDP 端口连不上（`ECONNREFUSED`）。
- 页面错误写在 `#errlog`（`window.onerror` 捕获），`--dump-dom` 可读；这是判断"有没有崩"的唯一可靠信号。
- `--virtual-time-budget` 下 **CSS 动画会停在起始帧**（`animation:...both` 的元素直接不可见）→ 截图一律带 `?noanim=1`（`#wrap.noanim * { animation:none }`）。canvas 的 rAF 不受影响。
- 截图输出路径必须是 **Windows 绝对路径**（`--screenshot="E:\\...\\x.png"`），相对路径 Chrome 解析不到。

## 调试参数

`?noanim=1` 冻结 CSS 动画 · `?auto=1` 直进战斗 · `&act=N` 指定幕 · `&boss=1`/`&elite=1` 指定节点 · `&row=N` 地图行 · `&char=xxx` 指定职业 · `&map=1` 直接看地图

⚠️ **给 bot 开无敌要写 `G.player.baseMaxHp = 9999`，不是 `G.player.maxHp`。**
`Entity`/`Player` 的 `maxHp` 是**只有 getter 没有 setter** 的访问器（`get maxHp(){ return this.baseMaxHp + this.relicBonus('maxHp'); }`），
而脚本是非严格模式 —— `G.player.maxHp = 9999` **静默失败**，一点效果都没有，还很难发现
（症状：bot 照样在第三幕阵亡，`hp=2/90`，maxHp 还是角色基础值 80 + 星核 10）。敌人同理，用 `G.enemy.baseMaxHp`。

## 与前作的关系

玩法框架沿用 `../forcing-mars`（Phaser 3 版《强渡火星》），本次按 last-firewall 的**画风与代码框架**（纯 Canvas + palette-string 精灵 + WebAudio 合成）重写，舞台从「火星地下三层」扩展为「火星 → 小行星带 → 深空奇点」三幕。旧作里 declared-but-unimplemented 的 `retainBlock` / `endTurnDamage` / `damageAmplify` 这次都已实现。
