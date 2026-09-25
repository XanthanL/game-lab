# 强渡宇宙 FORCING COSMOS — project notes

像素卡牌构筑 Roguelike（杀戮尖塔式玩法）。纯静态站点（无构建）：`index.html`、`style.css`、`src/{audio,sprites,cards,entities,story,ui,game}.js`、`assets/`（Fusion Pixel 12px 字体，OFL）。
**零外部美术/音频资源**：所有精灵是 `sprites.js` 里的调色板字符串，所有声音是 `audio.js` 里的振荡器合成。

⚠️ **`ROADMAP.md` 是与《杀戮尖塔 2》的差距清单 + 待办（P0/P1/P2/P3）。开工前先看它，做完一条回来打勾。**
当前内容量（`node .probe-inv.cjs` 打印）：3 幕 / 4 职业 / 36 卡 +3 诅咒 / 18 敌 / 8 遗物 / 10 事件 / 6 状态 / 6 药水。

## 架构

- 画布 **640×360**；`#wrap`（canvas + DOM 覆盖层）整体 CSS 缩放（`fit()`），所以 UI 一律按游戏像素写坐标。像素字体只有 **12px**（正文）与 **24/36/48px**（标题）可用，不要写其它字号。
  手机竖屏时 `fit()` 会整体 `rotate(90deg)` 铺满屏幕 —— 见「手机端适配」。
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
- ⚠️ **`.panel` 是 `overflow:hidden`**。牌组 30+ 张时，选项行会被直接裁掉 —— 看不到也点不到。所以 **`#modal-body` 自己滚**（`overflow-y:auto`），标题与 `#modal-actions` 留在外面不动。
- ⚠️ **`touch-action` 是沿祖先链取交集的，写 `none` 会连子孙一起锁死。**
  `html,body` 现在写 **`manipulation`**（禁双击缩放、保留滚动），只有 `#hand` 写 `none`（拖拽出牌必须独占指针，
  否则浏览器把它当滚动手势、`pointercancel` 一来拖拽就断）。
  曾经 `html,body{touch-action:none}` + `#modal-body{touch-action:pan-y}` —— 后者**完全无效**，
  30 张牌的牌组在手机上根本翻不动。顺带补了 `overscroll-behavior:none` 防下拉刷新。
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
- 无键盘设备才显示 `#touch` 暂停键。判定走 `isCoarse()`（`(pointer: coarse)` **或** `navigator.maxTouchPoints > 0` —— 后者是兜底，无头探针和部分安卓 WebView 的媒体查询不可靠），
  置在 `html.coarse` 上；再叠一个 `html.canpause`（由 `setScene()` 维护，只在 `battle`/`map` 为真），
  因为标题/选人/结局按了也没反应，不该给假按钮。
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

## 地图连通性（改 `genMap` 前必读）

**「只保证入边」是不够的，必须同时保证出边。** 这是作者实际卡住的 bug：*打完一场战斗，地图上再也没有可点的节点，只能重新开始。*

- `genMap()` 里两趟补边，**两趟都必要**：
  1. **入边**：下一行每个节点至少有一条入边（原本就有）。
  2. **出边**：本行每个节点至少有一条出边（2026-09-24 补的）。
- 漏掉第 2 趟为什么必炸：**末行 BOSS 固定只有 `c=1` 一个节点**，而倒数第二行是从 `{0,1,2,3}` 里挑 3 个 —— 有 3/4 的概率含 `c=3`。
  连边条件是 `|列差| ≤ 1`，`|3-1| = 2` 不成立 → **那个节点没有任何出边**。
  玩家踩上去后 `updateReach()` 算出的可达集合是**空集**，`showMap()` 于是不给任何节点挂 `onclick` ——
  整张图变成死的，连「回到底图选择界面」都是回了个寂寞。
  实测：600 张图里 453 个无出边节点，随机走图 30 次踩中死路。
- `updateReach()` 里还有一层**兜底修复**：可达集合为空且 BOSS 未打过时，从「走得最深的已访问节点」**补一条边**到下一行最近节点。
  补边而不是硬把节点设成 `reach` —— 这样地图数据被真正修好，之后不会再触发，画面上那条线也是真实存在的。
  这层是给**老存档**用的（`saveGame` 会把 `map.nodes` 的 `visited` 和 `edges` 一起存进 `localStorage`，
  已经卡死的玩家光靠修生成器救不回来）。
- **回归探针：`.probe-mapfuzz.cjs`**（模糊测试 + 结构体检 + 老存档救援）。动 `genMap` / `updateReach` 必跑。

## 手机端适配

- **竖屏自动转 90°**：`fit()` 在 `isCoarse() && h > w` 时把 `#wrap` 整体 `rotate(90deg)`。
  不转的话 640×360 塞进 390 宽只剩 **219 高**（0.61 倍）：12px 字变 7px、地图节点只剩 13px，根本没法玩。
  转完 390×844 的屏幕能出到 **1.083 倍**，比桌面默认还大。旋转纯用 CSS transform，**浏览器命中测试会跟着转，所有游戏坐标一行都不用改**。
- `translate(tx,ty) rotate(90deg) scale(s)` 的几何（`transform-origin:0 0`，变换从右往左生效）：
  本地 `(0,0)` 落在 `(tx,ty)`，转完占 `x∈[tx-360s, tx]`、`y∈[ty, ty+640s]` → 居中就是 `tx=(w+360s)/2`、`ty=(h-640s)/2`。
- **视口尺寸信 `visualViewport`**：手机上地址栏收起/展开时 `window.innerHeight` 经常不更新（iOS 尤其明显），
  只信它会让 `#wrap` 的「画在哪」和「能点到哪」错位 —— 症状正是「点了没反应」。取 `min(visualViewport, innerWidth/Height)`：
  宁可四周留点黑边，也不能让画面和命中区超出真正可见的范围。
- ⚠️⚠️ **`fit()` 不靠事件驱动，靠主循环每帧自愈**：`loop()` 里调 `fitIfChanged()`，尺寸字符串变了就重排。
  旋转时 `orientationchange` 会**先于** `innerWidth/Height` 更新触发，`resize` 也可能只来一次旧值 ——
  赌浏览器事件时序必然有漏网的时候。另外还挂了 `resize` / `orientationchange` / `visualViewport.resize` 各补两次（60ms / 260ms）。
- **安全区**：JS 读不到 `env()`，所以 CSS 里先存成 `--sat/--sar/--sab/--sal` 自定义属性，`safeInsets()` 再读回来做缩放留白。
  横屏时刘海会压住左上角的关卡信息。
- **触摸命中区放大**（`html.coarse` 下，视觉尺寸一点不改）：
  `.mnode::before { content:''; position:absolute; inset:-9px }` 把 22px 的节点撑到有效 66px。
  `::before` 是绝对定位，**不参与 `.mnode` 的 flex 布局**，所以那个字形不会位移。
  实测竖屏 390 宽下节点有效命中区从 13px → **66×66**。
- 标题页的两句提示（`#ctrl-hint` / `#enter-hint`）在 `updatePointerMode()` 里按输入方式换文案 —— 手机上没有空格键也没有 ENTER。
- **竖屏提示 `#rot` 必须放在 `#wrap` 外面**（里面的东西整体转了 90°，提示文字不能跟着转），且 `pointer-events:none`
  （`elementFromPoint` 会跳过它，不会挡命中测试）。只在「手机 + 竖屏」时露 6 秒自己淡出，**不做成挡住画面的遮罩**。

## 出牌演出（改 `playCard` / `applyCard` 前必读）

- **卡牌本体是 DOM，不是 canvas**。`#hand` 是 `inset:0` 覆盖层，所以卡牌的 `left/top` **就是游戏像素**，
  跟着 `#wrap` 的整体缩放一起走 —— 想让卡"飞向敌人"只是把 `left/top` 插值到 `(LAY.ex-48, LAY.eyBase-95)`，
  **不需要换算屏幕坐标**。
- 演出元素必须放进 **`#fxcards`**（`#wrap` 内，`z-index:15`），**不能留在 `#hand` 里**：
  `renderHand()` 开头是 `innerHTML=''`，留在里面会被立刻销毁 → 症状正是「卡还没飞到就没了」。
- ⚠️ **`playCard` 里的顺序不能反**：先 `node.remove()` 把这张卡的 DOM 从 `#hand` 摘下来，
  **再** `G.hand.splice` + `renderHand()`。反过来就白摘了。
- 演出时长由 `FLY_MS`(150) + `FLY_BURST`(130) 决定；`applyCard` **返回 `tail`**
  （多重打击逐击还要多久），`playCard` 用 `after(200 + tail)` 才放开 `G.busy`。
  不返回 tail 就会在最后一击落地前放行 → 连击打到一半被当成"打完了"。
- `applyCard` 的**所有**伤害出口必须走 `cardHitDamage()`：它是 `applyCard` 与 UI 预测共用的唯一入口。
  在 UI 里另写一份算式就是"预测 12、实际打 9"的来源。
- **虚弱在来源侧乘 0.75**（`cardHitDamage` 里）。以前只有敌人的攻击算了虚弱，玩家中了虚弱照样满伤 ——
  HUD 挂着「虚弱」却毫无效果，不抛异常、探针全绿。
- 飘字要显示 `r.total`（结算后、含易伤），不是传入的 `per`。
- `setScene` 里必须 `clearFlyCards()` + `hideDmgPreview()`：`#fxcards` 不归 `renderHand()` 管，
  不清的话上一场战斗最后一张卡会一直悬在屏幕上。
- 抽牌类卡会改 `G.hand`/`G.draw`，而 `updateHud()` 只在 `playCard` 开头调过 ——
  演出收尾的 `after()` 里要**补一次 `updateHud()`**，否则「手 N/10」「抽 N」停在出牌前的数。

## 手牌上限与牌堆查看

- `HAND_MAX = 10`。⚠️ 手牌满时抽到的牌要**真的从抽牌堆抽出来再丢进弃牌堆**，不能留在原地 ——
  留在原地的话下一张「抽牌」会反复抽到同一张，等于把抽牌卡变成永动机。
- 三个牌堆（抽/弃/耗）挂在 `#pileinfo` 的 `[data-pile]` 按钮上，走**独立于 `[data-act]`** 的委托分支。
- ⚠️ **抽牌堆必须用副本洗乱后展示**（`shuffleArray(G.draw.slice())`）：
  真实顺序就是"下一张抽什么"，原样列出来等于把抽牌堆变成明牌堆；
  也不能就地洗 `G.draw` —— 那会真的改变抽牌顺序。

## 局外进度（`src/meta.js`，改梯度/解锁前必读）

- 存 `localStorage['fc_meta_v1']`，**和局内存档 `forcing_cosmos_save` 是两个 key**。
  `gameOver()` 会 `removeItem` 局内存档 —— 局外进度要是塞在同一个 key 里会被一起清掉，
  玩家通了关才发现阶梯白爬了。
- `META_DEFAULT.v` 是**版本闸**：改结构就 +1，`loadMeta()` 会丢弃旧数据回默认。
  宁可让玩家丢一次进度，也不要让半新半旧的对象污染后面所有读点。
- **`ASC_STEPS` 只许往尾部追加**（老玩家的 `unlockedAsc` 是按序号存的），
  且**条目数必须 ≥ `ASC_MAX`** —— 否则最高一级是空的（已踩过：9 条修正配 `ASC_MAX=10`）。
- `ascMods(level)` = **累加前 N 条**，返回 9 键对象；`ascLines(level)` 给 UI 列文字。
- **梯度只由调用方显式传进 `entities.js`**（`makeEnemy(act, kind, row, asc)`）：
  entities.js 里不要直接读 `G` —— 顶层 `const` 有 TDZ，`typeof` 也救不了。
- 所有伤害出口统一走 `e.dmg(v)`（内部乘 `dmgMul`），保证「意图上显示的」和「实际打的」一致。
- **`metaPrevRun()` 必须在 `metaRecordRun()` 之前读**：后者会 `unshift` 本局到 `log[0]`。
- `gameOver()` → `recordRunAndShowUnlock()`：写日志 + 攒统计 + 推解锁 + 填 `#over-unlock`。
  通关 Lv.N 才解锁 Lv.N+1；阵亡只记日志不解锁。
- 清空口子在航行日志弹窗里（**点两次确认**，不用 `confirm()` —— 无头探针里它会被静默驳回）。

⚠️ **`CURSE_CARDS` 是对象不是数组。** `createCurseCard()` 曾写成 `CURSE_CARDS[(Math.random()*n)|0]`
（数字下标索引对象）→ 返回 `undefined` → 生成 `{uid}` 空壳卡：没有 `id`/`curse`/`unplayable`，
不占手牌位、不扣血、`r.curses` 恒为 0。连带后果：「烧毁一张诅咒」永远是死选项、
**虚空结局永远走不到**。**先 `Object.keys()` 再索引。**

## 探针（验证用，改完必跑）

```bash
python -m http.server 8126 --bind 127.0.0.1        # 必须常驻（先 curl 确认 docroot 就是 forcing-cosmos/）
bash .probe.sh                                     # 6 个场景截图 + 抓运行时错误 → .shots/
bash .probe-ui.sh                                  # 6 个弹窗截图 + 抓运行时错误 → .shots/
node .probe-exit.cjs                               # 交互出口审计（47 条）：改 UI 必跑
node .probe-mapfuzz.cjs                            # 地图连通性：模糊走图 + 出边体检 + 老存档救援：改 genMap/updateReach 必跑
node .probe-mobile.cjs                             # 手机端端到端：竖屏转 90°/命中区 ≥40px/真触摸走完一整幕
node .probe-play.cjs                               # 出牌演出 + 伤害预测 + 手牌上限 + 牌堆查看（64 条）
node .probe-meta.cjs                               # 局外进度（66 条）：梯度数值/解锁/日志/继续卡片/清空/诅咒卡回归
node .probe-shots-meta.cjs                         # 局外进度 UI 视觉确认截图 → .shots/meta-*.png
node .probe-shots-play.cjs                         # 出牌演出/伤害预测/牌堆 UI 截图 → .shots/play-*.png
node .probe-inv.cjs                                # 打印内容量（改卡/遗物/事件后更新 ROADMAP 用）
node .probe-shots-exit.cjs                         # 交互修复的视觉确认截图 → .shots/exit-*.png
```

⚠️ **`.probe-*.cjs` / `.probe-*.mjs` 需要 `playwright-core`**，它不在仓库里。装一次然后带上 `NODE_PATH`：

```bash
node <npm-cli> install playwright-core --prefix "C:/Users/<你>/.workbuddy-ai/binaries/node/workspace"
NODE_PATH="C:/Users/<你>/.workbuddy-ai/binaries/node/workspace/node_modules" node .probe-mobile.cjs
```

浏览器用 `ms-playwright/chromium-1228`（`executablePath` 已在脚本里写死）。
`.probe.sh` / `.probe-ui.sh` 用的是完整版 Chrome + `--virtual-time-budget`，**不需要** playwright。

自动通跑（真正驱动游戏逻辑，需要带调试端口的 Chrome）：

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --no-sandbox \
  --remote-debugging-port=9333 --user-data-dir="E:\Code\game-lab\forcing-cosmos\.chrome-prof" about:blank &
node .probe-run.mjs 170000 engineer     # 从地图开始自动打到结束
node .probe-boss.mjs 2 boss 60000 boost # 指定幕/BOSS；boost = 削弱敌人验证胜利与结局路径
```

- ⚠️ **CDP 探针（`.probe-run.mjs` / `.probe-boss.mjs` / `.probe-click.mjs`）必须用全新 `--user-data-dir` 启动 Chrome**，
  否则会命中上一轮的 HTTP 缓存：页面加载的是**旧的 `ui.js`**，症状是
  `ReferenceError: clearFlyCards is not defined` 这种"磁盘上明明有这个函数"的假崩溃。
  启动加 `--disable-http-cache`，或每次换一个 profile 目录。
- ⚠️ `.probe-click.mjs` 的每个用例都要**先把战场钉成确定状态**再动手（手牌内容 / 电量 / 敌人血量）。
  旧版是"跑一步 sleep 400ms 读结果"，靠 220ms 的旧出牌时序侥幸通过；演出把时序拉长后
  基线立刻被自动回合污染 —— 读到的是敌人回合清空手牌的结果，不是拖拽的结果。
- ⚠️ 合成的 `pointerdown` + `pointerup` **不会**派生出 `click`。要测 `onclick` 的路径
  （如不可打出的诅咒牌）必须直接 `dispatchEvent(new MouseEvent('click', ...))`。
- 探针用 **Chrome DevTools Protocol**：Node 22 自带全局 `WebSocket`，无需 puppeteer。
- **Chrome 必须用 `run_in_background` 启动**，否则命令结束后被回收，CDP 端口连不上（`ECONNREFUSED`）。
- 页面错误写在 `#errlog`（`window.onerror` 捕获），`--dump-dom` 可读；这是判断"有没有崩"的唯一可靠信号。
- `--virtual-time-budget` 下 **CSS 动画会停在起始帧**（`animation:...both` 的元素直接不可见）→ 截图一律带 `?noanim=1`（`#wrap.noanim * { animation:none }`）。canvas 的 rAF 不受影响。
- 截图输出路径必须是 **Windows 绝对路径**（`--screenshot="E:\\...\\x.png"`），相对路径 Chrome 解析不到。

## 调试参数

`?noanim=1` 冻结 CSS 动画 · `?auto=1` 直进战斗 · `&act=N` 指定幕 · `&boss=1`/`&elite=1` 指定节点 · `&row=N` 地图行 · `&char=xxx` 指定职业 · `&map=1` 直接看地图 ·
`?charsel=1` 直进选人页 · `?over=win` / `?over=lose` 直进结局面板（**用于测局外进度**）

⚠️ **开关型参数必须带值**（`?charsel=1` 不能写 `?charsel`）：`debugJump()` 用 `QS.get(k)` 做真值判断，
不带值时返回空字符串（falsy），整个调试入口会被跳过、静默回到标题页。

⚠️ **给 bot 开无敌要写 `G.player.baseMaxHp = 9999`，不是 `G.player.maxHp`。**
`Entity`/`Player` 的 `maxHp` 是**只有 getter 没有 setter** 的访问器（`get maxHp(){ return this.baseMaxHp + this.relicBonus('maxHp'); }`），
而脚本是非严格模式 —— `G.player.maxHp = 9999` **静默失败**，一点效果都没有，还很难发现
（症状：bot 照样在第三幕阵亡，`hp=2/90`，maxHp 还是角色基础值 80 + 星核 10）。敌人同理，用 `G.enemy.baseMaxHp`。

## 与前作的关系

玩法框架沿用 `../forcing-mars`（Phaser 3 版《强渡火星》），本次按 last-firewall 的**画风与代码框架**（纯 Canvas + palette-string 精灵 + WebAudio 合成）重写，舞台从「火星地下三层」扩展为「火星 → 小行星带 → 深空奇点」三幕。旧作里 declared-but-unimplemented 的 `retainBlock` / `endTurnDamage` / `damageAmplify` 这次都已实现。
