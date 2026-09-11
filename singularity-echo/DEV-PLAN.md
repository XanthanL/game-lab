# 奇点回响 · 开发规划与交接指南

> **这份文档是给下一个会话的执行手册。** 不依赖任何对话上下文，读完就能开工。
> 行号基于 2026-09-11 的 `index.html`（7740 行 / 418 KB）实测，**会漂**，以函数名为锚点。
> 详细背景见 `ROADMAP.md`（六阶段路线图）、`DESIGN-SYSTEM.md`（token 与方向）、
> `.impeccable.md`（设计上下文）。本文是它们的**进度与执行层**，不是替代品。

---

## 0. 当前状态速览（2026-09-11 核对）

| 阶段 | 状态 | 说明 |
|---|---|---|
| Phase 0 风格锚定 | ✅ 完成 | 含 A（等价 token 化）+ B（换方向）+ B.1（配色修订） |
| Phase 1 战斗反馈 | ✅ 完成 | 伤害飘字 / 命中音效 / 击杀出口 / 拾取反馈 |
| **Phase 2 引导与信息** | ✅ **完成** | 2.1 / 2.2 / 2.3 / 2.4 / 2.5 全部落地 |
| **Phase 3 构筑深度** | 🔄 **进行中** | **3.4 成就树已完成**（18 节点 / 22 连线）；**3.1 / 3.2 / 3.3 / 3.5 待做** |
| Phase 4 内容扩充 | ⬜ 未开始 | |
| Phase 5 平台打磨 | ⬜ 未开始 | |

**当前代码健康度（已实测）**：JS 语法 OK · `audit-tokens.js` 全绿 · 无残留临时文件。
**下一步建议：Phase 3.1 卡牌稀有度 / 升阶**（`MODULES` 加 rarity 字段 + 出现权重，
是 Phase 3 里唯一能立刻改变"每局构筑手感"的一项；3.2 协同扩展可与它并行）。
`index.html` 现 7740 行 / 418 KB。

---

## 1. 环境速查（路径写死，别用裸命令）

```bash
NODE="C:/Users/www27/.workbuddy/binaries/node/versions/22.22.2-3/node.exe"
export NODE_PATH="C:/Users/www27/.workbuddy/binaries/node/workspace/node_modules"   # playwright-core
CHROME="C:/Users/www27/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe"
```

⚠️ **node 版本目录是 `22.22.2-3`**（曾为 `-2`，小版本升级后旧路径会 `No such file or directory`）。
`NODE_PATH` 不设 → `require('playwright-core')` 报模块找不到。
临时产物一律 `_*.png` / `_*.js` 命名，收尾清掉。

### 三条必跑命令

```bash
cd E:/Code/game-lab/singularity-echo

# ① JS 语法自检（改完任何 JS 都跑）
"$NODE" -e "const fs=require('fs');const s=fs.readFileSync('index.html','utf8');\
const re=/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;let m,o=[];\
while((m=re.exec(s)))o.push(m[1]);fs.writeFileSync('_extract.js',o.join('\n'))" \
&& "$NODE" --check _extract.js && rm -f _extract.js && echo "SYNTAX OK"

# ② token 自查（改颜色 / 加 UI 必跑，退出码即结论）
"$NODE" audit-tokens.js

# ③ 实机回归（Phase 2 断言全量，含 26 模块穷举）
"$NODE" ../.workbuddy/shots/phase2-check.js
```

### 验证脚本

| 脚本 | 用途 | 判据 |
|---|---|---|
| `audit-tokens.js` | R1–R5 五条规则（CSS 无字面色值 / 引用无悬空 / PAL 有 `-rgb` 伴生 / JS 语义色白名单 / 无字号时长字面量） | 全绿 |
| `.workbuddy/shots/phase2-check.js` | 引导五步推进 + 卡牌读数 + 协同标亮 + **26 模块 ×（未持有/已持有）穷举** | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase2-3-check.js` | **航行日志 10 项**（空/满/中段存档、图鉴计数、巨像解锁、成就进度、星图结构、拖拽、竖屏、英文、卡牌回归） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase2-4-check.js` | **死亡结算 10 项**（环境/敌型/巨像死因、词缀标签、关键统计、三块同屏、英文、竖屏、语言热切换、死因固化） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase2-5-check.js` | **UI 转场统一 11 项**（覆盖层曲线唯一性、裸缓动计数、`.sec-head` 跨面板同规格、死亡面板回归、竖屏两面板、英文、连读 3 次稳定、数据无回归、keyframes 完整性） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase3-4-check.js` | **成就树 12 项**（树结构/依赖闭包/坐标唯一、全锁档、全达成档、中段三态、进度百分比算术、船体支、汇总聚合、弹窗文案、弹窗去重、英文、竖屏、图鉴回归） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase1/` | 战斗反馈四档对照截图 | 人工 |
| `.workbuddy/shots/zero-diff.js` | **零视觉变化**验证（冻结时钟 + 定种子 + 帧冻结 + 禁 CSS 动画后逐像素） | `diff=0` |

> ⚠️ **截图比对不算"零视觉变化"的证明**：星空漂移、`backdrop-filter`、HUD 无限动画都会造成假差异。
> ⚠️ `zero-diff.js` 每个文件必须用**全新浏览器实例** —— `file://` 下 localStorage 跨 context 共享，
> `nova-*` 存档会污染下一个页面（实测 11106 px 假差异，症状：差异落在左上角致命错误框位置）。

---

## 2. 已完成阶段（成果存档）

### Phase 0 · 风格锚定与方向重定 ✅

- **token 架构**：单一事实源 = `index.html` 的 `:root`（90 个 token，每色**成对**定义
  `--c-x`（hex，给 CSS）+ `--c-x-rgb`（空格分量，给 JS 拼 alpha））。
  JS 侧启动时读一次缓存成 `PAL`，用 `RGBA(k,α)` 取色。
- **两阶段策略已走完**：阶段 A 等价替换（computed style 13189 条断言 0 差异 +
  像素 1,024,000 px 0 差异）→ 阶段 B **只改 `:root` 的值**换方向，token 名未动、引用方零改动。
- **方向定稿「星图测绘」**：深墨底 + 钢蓝结构线 + 中性铅白读数 + 朱砂/黄铜内容色。
  三层色相分工：**钢蓝 = 结构（只出现在线性元素：边框/线/网格/HUD，从不做大面积底色）·
  中性铅白 = 读数 · 朱砂黄铜 = 内容**。
- 阶段 B 顺带归并：字号 30→10 档 / 时长 26→6 档 + 2 环境档 / 缓动 5→2 条 / z-index 归 7 档
  （**档内保留相对序号**，一刀切压平会让层叠退回 DOM 顺序）。
- 六船体 `HULL_TINT` 换矿物颜料；`BOSS_STYLE` / `ENEMY_DEFS` 整表收敛到矿物暖色族。

**回退点**：`.workbuddy/backups/singularity-echo_pre-tokens-{A,B}.html`、
`singularity-echo_phaseB1-pre.html`

### Phase 1 · 战斗反馈补完 ✅

| 项 | 实现 | 锚点 |
|---|---|---|
| 伤害飘字四档 | 普通 / 暴击 / 弱点 / 被挡；**同目标合并累加 + 同屏上限 26 条** | `dmgText(x,y,val,kind,key)`，埋点 `hurtEn`/`hurtAst`/`hurtPlayer` |
| 命中音效三档 | 普通 / 暴击 / 被挡；**暴击走独立 90ms 节流窗口** | `sfx.hit(kind)` |
| 击杀统一出口 | 顿帧 / 镜头 kick / 泛光 / 色差按三级收在一处 | `killImpact(e)` |
| 拾取反馈 | 磁吸拖尾粒子 + 白环 | `updatePickups` |

**参数表**：`DESIGN-SYSTEM.md` 表 3b。**三条硬规则**（实测结论，改参数前先读）：
① 同目标必须合并累加（否则连射刷屏，实测 48 次命中 → 16 条）；
② 暴击必须**横纵同时拉开**（x+12 / y−30，只纵向差 14px 仍会咬成一团）；
③ 伤害数字要**描一圈底色**再填，否则压在 Boss 红核上读不出来；
④ 得分飘字必须离开本体（−28/−32px），否则与伤害数字对冲成色块。

**回退点**：`.workbuddy/backups/singularity-echo_phase1-pre.html`

---

## 3. Phase 2 · 引导与信息传达 ✅ 完成（2.1–2.5）

**目标**：新手从"进游戏就懵"到"知道自己在干嘛"，同时给老玩家更多决策信息。
**验收**：完全没玩过的人第一局能自己打完前 3 波，不需要外部说明。

### ✅ 2.1 首局分步引导（已完成）

- 非模态提示条 `#guide`（`position:fixed`，**必须给 `width`，只写 `max-width` 会 shrink-to-fit
  缩到 ~195px 把文案挤成多行**）+ `GUIDE_STEPS` 五步表：
  **移动 → 开火 → 拾取升级 → 三选一 → 清波推进**。
  （原计划的"护盾/冲刺"不成立：游戏无冲刺、护盾只有 aegis 船有，已按真实机制重排。）
- **状态驱动**：每帧只读游戏状态判定，不在开火/拾取/升级十几处埋点。唯一例外是
  `openLevelUp` 里一行 `G.guideLvUp` —— "看过三选一"没有别的可观测状态。
- **由 `loop()` 每帧调 `guideTick()`**（不是 `updateWorld`），菜单/暂停/结算帧自动收起，
  不必在四处模式切换点各写一行。
- **全局去重**：达成的步骤写 localStorage `nova-guide`，重开不重播，全达成后 `guideStop` 彻底沉默。
- **允许跳跃**：某步条件先达成即记完成，不卡流程。
- 桌面 / 触屏两套文案，`setTouch` 里调 `guideRefresh` 即时换字。
- ⚠️ `guideShow` 必须**回写 `G.guideIdx`**，否则 tick 每帧判定"步骤变了"、入场过渡反复重播（文字一直闪）。
- **测试钩子**：`NOVA.guide.{steps,seen,current,text,reset,show}`

### ✅ 2.2 卡牌信息重构（已完成）

- **当前读数行**：`modStats(id)` —— 从 `moduleDetail` 的 switch 抽出，详情条与升级卡片共用。
  （升级描述只写「+9%」这类增量，看不见当前值就没法判断该不该选。）
- **分状态协同清单**：`synPlan(id)` —— 另一半已装配的当场标亮 ✓「选中即激活」，
  未装配的留作构筑方向；最多 2 条、ready 优先、超出折叠为「还有 N 条」。
- 三卡读数行用 `#cardrow .card .rd{margin-top:auto}` 对齐到同一水平线。
- ⚠️ **最大的坑**：`modStats` 现在会被**尚未持有的卡**调用，凡读数索引等级表的条目
  （`NOVA_LV[P.nova-1]` 这类），未持有时下标 **-1**，读 `undefined[1]` / `undefined.dmg`
  直接抛错、**升级面板白屏**（实测白屏两次）。已修 nova / blink / mine / deathtrail 四处 + 整体 try 兜底。
  **改任何读数表后必须跑 `phase2-check.js` 的「26 模块 × 两态」穷举断言。**

### ✅ 2.3 航行日志重构（已完成）

**结构**：`#logbook` 上半 = 图鉴（累计记录 / 敌型图鉴 / 巨像名录 / 词缀 / 船体图鉴），
下半 = 成就星图容器。函数锚点：`openLogbook()`、`drawLogbook()`、`drawAch(s)`、
`fitAch()`、`achTf()` / `applyAchTf()` / `resetAchPan()`。

**图鉴（全部复用现有数据，零新增存储键）**：

- 名称 / 描述表：`EN_ZH`（20 型中文名）、`EN_EN`（20 型英文名）、`EN_TRAIT`（一行特性文案）、
  `AFFIX_DESC`（3 词缀：疾 / 坚 / 爆）。
- 解锁判定：**敌型**读累计统计里的最远波次（`loadStats().w`）反查 `EN_UNLOCK`；
  **巨像**用 `Object.keys(BOSS_AT).sort((a,b)=>a-b).map(w=>{const k=BOSS_AT[w]…})` ——
  ⚠️ 必须 **iterate values 而不是 keys**：`BOSS_AT` 的 key 是波次字符串，
  `BOSS_STYLE["5"]` 恒为 `undefined`、`reached >= 'rock'` 恒为 false，
  症状是**打完 30 波巨像仍全锁**（此坑实测踩过）。
- 未解锁态：`.lbcell.locked` —— 降饱和 + 只留 2px 状态色带轮廓，配文显示需求波次（`第 15 波解锁`）。
- 版式：`#logbook .lbgrid` 为 `auto-fill minmax(132px,1fr)` 方格阵；巨像 / 词缀各用
  `.lbgrid-boss` / `.lbgrid-affix` 变体；面板放宽到 `max-width:min(94vw,680px)`。
  移动端媒体查询降到 **2 列**，巨像 / 词缀单列。

**成就星图（容器版式定稿，3.4 只填数据）**：

- 画布坐标写死：`ACH_W=560` / `ACH_H=340` / 节点 `ACH_NODE_W=150` / `ACH_NODE_H=52`；
  `ACH` 数组里每个节点**手写 x/y**，**不做自动布局**（对应 3.4 的实现要点）。
- 两类边：`req`（前置，虚线 → 解锁后实线通电）与 `dependsOn`（聚合节点，恒虚线）。
  连线画在 `#lbTreeLinks` 这个 SVG 里，**`viewBox="0 0 560 340"` 与节点像素坐标 1:1**
  （用 viewport 尺寸会整体错位）。
- 进度缓存键 `nova-ach`（`ACH_KEY`）；`achProgress(a,s)`：`goal<=0` 判定为聚合节点、
  走 `dependsOn` 汇总，否则 `v>=goal`。节点显示 `当前值 / 目标值 · 百分比`。
- 交互：`#lbTree` 是裁剪视口（`overflow:hidden`，`touch-action:none`），
  `#lbTreeWrap` 承载 `translate + scale`，两者**分开存**在 `dataset.tx/ty/sc`（拖拽不改 scale）。
  `fitAch()` 打开时自动缩放到装下整棵树（桌面实测 `scale≈0.829`）；
  `resetAchPan()` = 归零位移后重新 fit。
- ⚠️ **`openLogbook()` 里必须先 `el.logbook.hidden=false` 再 `drawLogbook()`** ——
  否则 `clientWidth` 为 0，`fitAch()` 算不出缩放（树左侧正常、第 3 列被裁掉）。
  fit 本身再延后两帧 `requestAnimationFrame` 等布局稳定。
- **测试钩子**：`NOVA.logbook.{open,counts,ach,locked,preview,fit,tf}`
- **断言脚本**：`.workbuddy/shots/phase2-3-check.js`（10 项，全绿）。

**回退点**：`.workbuddy/backups/singularity-echo_phase2-3-pre.html`
**截图**：`.workbuddy/shots/phase3/2-3-01…10`（空态 / 满态 / 中段 / 成就进度 / 星图 /
拖拽后 / 竖屏 / 英文 / 卡牌回归 / 计数）

### ✅ 2.4 死亡结算升级（已完成）

**三块内容**（顺序：先知道怎么死的 → 再看打得如何 → 最后回看拿了什么）：

1. **死因块**（`#overCause` / `#overCauseBody`，`buildCause()`）：
   「谁终结了这次漂移」+ 一句话特性 + 标签组。
   两种语言三档粒度：**巨像**（`BOSS_ZH`/`BOSS_NAME`，附 `星区巨像 · 波次首领` 或
   `精英巨像`）/ **普通敌型**（`EN_ZH`/`EN_EN` + `EN_TRAIT` 那句）/ **环境兜底**
   （「星尘与残骸 —— 撞击累积，没有哪个敌人补上最后一刀」）。
   标签：`词缀`（复用 `AFFIX` 表的单字名）、`精英/强化`、`致命累积 N`
   （朱砂色 —— 唯一高饱和，用在"致命"这个语义上）。
2. **关键统计行**（`#overExtra`，`buildOverExtra()`）：总输出 / 承伤 / 峰值威胁 / 换伤比，
   四个本局可比的硬数。⚠️ 每项必须 `white-space:nowrap` —— 英文 `TRADE RATIO`
   会在内部折成两行、看起来像两个独立统计项（实测踩过）。
3. **构筑回顾**：沿用原有 `buildChips()`（26 模块两态穷举已被 `phase2-check.js` 覆盖）。

**数据层（三条新状态，零新存储键）**：

- `G.lastHit`（最近一次"真正扣到血"的来源）+ `G.cause`（`snapshotCause()` 在 `die()` 里固化）。
  `noteHit(src,dmg)` 是唯一写入口，`cum` 累计同一来源的总伤害
  （吸附虫这种 6 点一跳的持续伤害靠它才有分量）。
- `G.dmgOut` / `G.dmgIn` / `G.peakThreat`：输出在两个伤害出口累加
  （`hurtEn` 一处、`hurtAst` 函数开头一处 —— 环 / 本体 / 普通三个分支都从那里出账）；
  承伤在 `hurtPlayer`/`drainPlayer` 实扣处累加；峰值威胁在 `updateWorld` 里只在
  `mode==='play'` 采样 `enemies+asteroids`。
- ⚠️ **`hurtPlayer` / `drainPlayer` 新增第 4 / 第 2 个参数 `src`**：
  不传就是环境伤害。所有敌人伤害调用点都补了来源（自爆 / 溅射 / 冲撞 / 持续吸血）。
  **敌方子弹不断持有者**（18 个生成点，逐个打标太重）→ 命中瞬间用 `nearestFoe(x,y)`
  找最近的敌人、其次巨像，找不到归环境。这条取舍是为了不污染 18 处生成代码。

**⚠️ `die()` 里必须先 `snapshotCause()` 再干别的**，且 `hurtPlayer` 只许在
`play`/`inter` 模式生效 —— 这两条合起来保证"死后不再改写死因"（测试 2-4-10 断言了这点）。

**测试钩子**：`NOVA.death.{kill,finish,over,cause,stats,line,lang}`
（`kill('wraith'|'boss:hydra'|'env', dmg)` / `finish()` 跳过 1.5s 坠毁动画直接进结算）。
**断言脚本**：`.workbuddy/shots/phase2-4-check.js`（10 项，全绿）。
**回退点**：`.workbuddy/backups/singularity-echo_phase2-4-pre.html`
**截图**：`.workbuddy/shots/phase4/2-4-01…10`

### ✅ 2.5 UI 转场统一（已完成）

**目标**：把 2.x 新增的面板与既有覆盖层收进**同一套动效语言**，消除裸写缓动关键字。

**结论先行**：**9 个覆盖层本来就共用同一条入场动画** ——实测
`animNames=["panelIn"] durs=["0.33s"] eases=["cubic-bezier(0.32, 0.72, 0, 1)"]`
（menu / over / pause / cards / hulls / victory / logbook / saves / settings 全部一致）。
缺的不是"统一动画"，而是**"统一来源"**：缓动值散落成裸关键字，改一处不会同步。

**做了三件事**：

1. **缓动 token 化（裸关键字 18 → 1）**：15 行 CSS 的裸 `ease` / `ease-out` / `linear`
   换成 `var(--ease-ui)` / `var(--ease-out)`。
   涉及 `.bar i`、`#shieldbar i`、`.ab .cd`、`#guide`、`#flash`、`#danger`、`#slowfx`、
   `#boot`、`.btn`、`.btn::after`、`.card`、`.card.fade`、`.cardDrawnTouch`。
   唯一保留的 1 处是 `.boot-bar::after` 的 `linear` —— 那是有意为之的匀速环境动画，
   `audit-tokens.js` 的裸缓动计数会把它算进去，属**已知白名单**。
   ⚠️ 时长早在 2.x 就已 100% token 化（`--dur-1…6`），**只有缓动有债**。
2. **面板入场曲线改用 `--ease-drawer`**：`.overlay` 的 `panelIn` 从 `--ease-out`
   换成 `cubic-bezier(0.32,0.72,0,1)`（抽屉曲线：起步快、收尾黏），
   位移距离从 8px 提到 `translateY(14px) scale(.982)` —— 有"面板推出来"的重量感，
   而不是淡入。**曲线清单是闭集**：`--ease-out` / `--ease-in-out` / `--ease-ui` /
   `--ease-drawer` / `--ease-pop`，UI 里禁止 `ease-in`，禁止 `transition:all`。
3. **`.sec-head` 提升为跨面板共享组件**：原 `.lb-sec`（航行日志专属）改名，
   14 处引用同步（含 HTML）。现在 `#over` 与 `#logbook` 的区块小标题是**同一个类**，
   实测 `specMatch=true`（`fs:10px` / `ls:3.4px` / `color:rgb(141,153,168)`）。
   `#logbook` 的视觉零变化（改名不改样式），好处是**以后改一处两面板同时生效**。
   同时给 `#over .statline` 补了 `b{color:var(--c-stat-hi);font-weight:500}` 与
   `margin-top:14px`，让统计行的数字有主次。

**🐞 顺手修掉一个真实潜伏 bug**：`@keyframesbootSweep`（`@keyframes` 后**少了空格**）——
整条 keyframe 规则被浏览器判为无效 CSS、**启动条扫光动画一直是死的**，且无人报错。
修法：补空格。为防复发新增了 **keyframes 完整性检查**
（重新扫描全表：`defined=8 / missing=0 / invalid=0`），并把断言 `2-5-11` 写进测试脚本锁死。

**测试钩子**：沿用 `NOVA.logbook.open()`（2.5 无新钩子，全部走 computed style 比对）。
**断言脚本**：`.workbuddy/shots/phase2-5-check.js`（11 项，全绿）。
**回退点**：`.workbuddy/backups/singularity-echo_phase2-4-pre.html`（2.5 起点 = 2.4 终点）
**截图**：`.workbuddy/shots/phase2/2-5-01…11`

---

## 4. Phase 3 · 构筑深度与长线留存 🔄 进行中

### ✅ 3.4 成就树 · MC 式节点树（已完成）

**18 个节点 / 22 条连线 / 画布 1008×688**（节点 150×52，列间距 168，行间距 74，坐标全部手写）。

**四条支线 + 一个汇总节点**（用「数量级拉开」避免成就全挤在一条数值轴上）：

| 支线 | 节点（目标） | y |
|---|---|---|
| 击坠 | 破百 100 → 猎手 500 → 蜂群之主 1500 → 星域清道夫 4000 | 12 |
| 波次 | 离开港湾 5 → 穿越中子星云 15 → 肃清星域 30 → 星域之外 35 | 160 |
| 时长 | 十分钟 600s → 万秒漂移 1h → 双时之航 2h → 恒星长眠 5h | 456 |
| 技巧 | 三舰齐发 3 船 → 全舰制霸 6 船 / 裸装穿越 波3 / 毫发无伤 波10 | 604 |
| 汇总 | 奇点观测者（`dependsOn` 6 项聚合） | 308 |

**技巧支是"跨玩法"节点**（不靠堆数值）：船体数组 / 零模块 / 无伤三种玩法各一个成就 ——
这也是"连续 10 局不拿到相同构筑"之外，给长线留的第二条成就感来源。

**统计 schema 从 5 字段扩到 8**（`loadStats`，旧档缺字段走默认值，**不新增存储键**）：

| 新字段 | 含义 | 写入点 |
|---|---|---|
| `hulls` | 已完成过出击的船体 id 数组 | `flushStats`（本局走过 ≥1 波才记） |
| `nomod` | 「零模块」状态下到达过的最远波次 | `flushStats`（`G.noMod` 由 `resolveCard` 一旦装配即置 false） |
| `flaw` | 「未受伤」状态下到达过的最远波次 | `flushStats`（`G.flawless` 由 `hurtPlayer`/`drainPlayer` 实扣处置 false） |

**三态视觉**（一眼可辨）：暗轮廓（未开始）< **蓝边 + 蓝底（进行中）** < 金边 + 金底（已达成）。
每个节点底部一条 2px 进度条（`.lbnode u`）：done 满格黄铜 / part 钢蓝。
读数行 `i` 显示 `700 / 1,500 · 47%`；**汇总节点未达成时显示「前置 5/6」**（否则看起来像没目标的空节点）。

**达成瞬间弹窗**（`achCheck` + `achTick`）：
- `achCheck(s)` 在 `flushStats` 写盘**之后**调用（此时 `loadStats()` 已是最新）；新达成项 `achMark` 写盘并入队。
- `achTick()` 在 `frame()` 里每帧驱动，队列串行播报（banner + `sfx.max()` + 船体金环），**冷却 2.2s**。
- **两条去重规则**：① 已在 `nova-ach` 的 id 不再提示；② **旧档首开若一次性满足多条 → 只写盘不弹**
  （`G.achPrimed` 置位后恢复正常）—— 否则老玩家一进游戏会被十几条弹窗连炸。

**`fitAch()` 缩放下限 0.34**：视窗（桌面约 425×300）远小于画布（1008×688），
不设下限会把整棵树缩到文字不可读。超出部分交给拖拽浏览（实测桌面 `scale≈0.42`，竖屏 0.34）。

**测试钩子**：`NOVA.logbook.{ach,achNodes,achDeps,achPreview,achToast,achFeed,achSeen,achReset,achQueue}`
（`achPreview` 用合成统计渲染不写盘；`achFeed` 走真实 `achCheck` 路径验去重）。
**断言脚本**：`.workbuddy/shots/phase3-4-check.js`（12 项，全绿）。
**回退点**：`.workbuddy/backups/singularity-echo_phase3-4-pre.html`
**截图**：`.workbuddy/shots/phase3/3-4-*.png`

### ⬜ 3.1 卡牌稀有度 / 升阶 —— **下一个做这个**

`MODULES`（~2143）加 rarity 字段 + 出现权重；重复获得可升阶。
**这是 Phase 3 里唯一能立刻改变"每局构筑手感"的一项。**

### ⬜ 3.2 协同扩展

`SYN`（~2300）12 条 → 20+ 条，优先补冷门卡联动。可与 3.1 并行。

### ⬜ 3.3 每日挑战

种子化 run（固定种子 + 固定卡池 + 特殊规则）。需要先确认 `rollChoices` 的随机源
是否可注入种子（当前是 `Math.random` 系）。

### ⬜ 3.5 局外解锁树

消耗累计数据解锁起始增益，让连败也有进展感。**可复用 3.4 的树渲染**
（`achProgress` / `drawAch` 的结构是通用的，换一份数据 + 换一个存储键即可）。

**验收**：连续 10 局不会拿到相同构筑；连败 3 局后仍有可感知的进度。

---

## 5. Phase 4 · 内容体量扩充 ⬜

- 4.1 新敌型 → 挂 `EN_UNLOCK`（~2100，同步解锁波次与 `AFFIX` 兼容性）
- 4.2 新 Boss → 挂 `BOSS_AT` + `BOSS_MV`（第 35/40 波或无尽专属）
- 4.3 新船体 → **四处全同步**（`HULL_TINT` / `HULL_GEO` / `HULL_TAIL` / `TRAIL_RAMP`）
  + `hullPath` 形状 + 机库文案 + 解锁条件
- 4.4 新武器行为 → 加进 `MODULES`，并检查 `rollChoices` 的 ability/stat 加权是否失衡
- 4.5 无尽模式专属机制（30 波后不重复随机 Boss，加轮换与强化层）

**验收**：新增内容不破坏 Phase 1 的反馈出口与 Phase 0 的视觉 token。

---

## 6. Phase 5 · 平台与打磨 ⬜

- 5.1 键位重绑定：抽 `KEYMAP` 替代硬编码，设置面板加 UI
- 5.2 手柄支持：`navigator.getGamepads()` + 摇杆死区
- 5.3 设置面板补完：画质档、特效开关、色盲模式、减弱动态（现在只有两个音量条）
- 5.4 性能：`qTier` 降级路径覆盖新增特效（尤其后处理与屏幕叠层）
- 5.5 移动端专项：虚拟摇杆手感、安全区、横竖屏
- 5.6 分享卡片 / 本地排行榜 / 局内截图

**验收**：低端机稳 60fps，触屏与手柄都能完整通关。

---

## 7. 已知坑清单（跨阶段，血泪）

### token / 颜色
1. **改 token 名必须全文件扫 `var(--旧名)`** —— HTML 内联样式里也有引用
   （`#vicBonus` 的 `style="color:var(--amber)"` 曾静默失效，只有 computed style 比对才抓得到）。
2. **凡给 JS 用的颜色必须在 `:root` 成对定义 `-rgb`** —— 缺则 `PAL` 取不到值，
   `RGBA()` 回退**品红 `rgba(255,0,255)`**。看到品红就是这个问题。
3. **批量替换 `'rgba(...)'` 要把外层引号一起吃进匹配** —— 否则留下 `'RGBA('cyan',0.4)'` 语法错误。
4. **换颜色前先 `grep -c` 每个旧值** —— `255,215,94`（拟态体色）恰好等于旧 `--c-amber`，
   全局替换一次波及 **37 处金色 VFX**。出现次数远超预期就是撞车。
5. `z-index` 不能一刀切压平（`--z-local-*` 是组件内层叠上下文，与 `--z-fx` 归并同值后
   层叠改由 DOM 顺序决定）。
6. 亮色主题下 `box-shadow: inset ..., none` 整条声明作废，要写 `0 0 0 rgba(0,0,0,0)`。
7. 暗底边框色**按对比度定，不凭色值感觉**（`--c-line` 首版在深底上蓝感完全看不出），改完必须截图。
8. **给 SVG / canvas 用的线性色也要成对定义 `-rgb`**：2.3 画成就树连线时用 `RGBA('line',α)`，
   但 `line` 当时既不在 `PAL` 的 NAMES 里、`--c-line` 也没有 `-rgb` 伴生 →
   连线静默变成**品红 `rgba(255,0,255,0.4)`**。修法：`:root` 加 `--c-line-rgb:53 89 125;`
   并把 `'line'` 加进 `PAL` 的 NAMES 列表。**新增任何"JS 里要拼 alpha"的颜色都照此办理。**
9. **绝对定位的中间层必须显式给尺寸**：`#lbTreeWrap` 里面全是 `position:absolute` 子元素，
   自身若只有 `position:relative` 会**塌成 0 高**，节点全部不可见 / 不可拖。
   修法：wrap 改 `position:absolute;left:0;top:0;width:100%;height:100%`，
   节点层 / 连线层各给固定 `560px × 340px`。
10. **`hidden` 容器里量不到尺寸**：`fitAch()` 依赖 `clientWidth`，而 `openLogbook()` 原先
   先 draw 后 unhide → 宽度 0、缩放算不出、树被裁。顺序必须是
   ① `hidden=false` → ② `drawLogbook()` → ③ 双 `rAF` 后再 `fitAch()`。
11. **无头测试里给元素加断言前先 `scrollIntoView`**：成就树在长面板底部（y≈1563），
    900px 视口外 → 取到 0 尺寸 / 拖拽坐标全落空，断言会假失败。
12. **断言里别匹配"颜色名"**：线缆实际 stroke 是 `rgba(201,162,39,…)` 而非字面 `amber`，
    按 `/amber/` 匹配恒得 0。要匹配 **RGB 分量**：`/201,162,39/`。
13. **测试用的伤害值必须真能致死**：玩家 100 HP，2.4 测死因时若随手写 `dmg:46`
    只是打掉一半血、`die()` 不触发 → 断言全变 `cause=null`，
    症状看着像"功能没写对"，其实是测试数据不够狠。**要 ≥100，且别用 1e9**
    （那个数字会直接印在截图上，看起来很假）。
14. **`@keyframes` 后少一个空格，整条规则静默作废**：2.5 发现写成了
    `@keyframesbootSweep`（标识符被当成名字的一部分），浏览器丢弃整条 keyframe，
    **动画永远是死的、零报错、零控制台输出**。肉眼审查完全看不出来。
    修法：永远写 `@keyframes 名字 {`；**改完动效跑一次 keyframes 完整性检查**
    （扫全表 `@keyframes[\w\s-]+` 定义集 vs `animation-name` 引用集，两边都要 0 缺口）。
15. **裸缓动关键字是隐性债**：`ease` / `ease-out` / `linear` 写死在 transition 里不报错、
    视觉也正常，但**改不动**——要统一动效语言时得逐条 grep。
    规则：缓动只许吃 `var(--ease-*)`。唯一的白名单是**匀速环境动画**
    （如 `.boot-bar::after` 的扫光），此时用 `linear` 并留注释说明理由。
16. **`audit-tokens.js` 的"时长/裸缓动"类检查会把注释也算进去**：
    在 CSS 注释里写 `40ms` 会触发"时长字面量"误报。写注释时避开裸数字+单位
    （改成"一个 `--stagger` 的交错"）。
17. **改 CSS 类名要三处同步**：CSS 规则、HTML 内联 class、JS 里 `classList` / 字符串拼接。
    2.5 把 `.lb-sec` → `.sec-head` 时是 14 处，漏一处就是**样式静默失效**
    （元素照常显示、只是没样式），只有 computed style 比对能抓到。
18. **内联 `style.width` 会被浏览器规范化**：JS 写 `style="width:100.0%"`，
    读回来是 `'100%'`（尾零被吃掉）。断言进度条满格要同时接受 `'100%'` 与 `'100.0%'`，
    否则"全达成档"断言恒得 0（看着像功能坏了）。
19. **`loadStats()` 加字段必须给默认值**：3.4 把 schema 从 5 扩到 8 字段，
    旧档 JSON 里没有 `hulls`/`nomod`/`flaw` → 若直接 `s.hulls.length` 会抛错。
    而 `flushStats` 的调用点在外层 `try` 里 → 异常被吞、**表现为统计永远停在 0**。
    一律写 `Array.isArray(s.hulls)?…:[]` / `s.nomod||0`。
20. **函数内不能直接喊 IIFE 里的变量名**（测试脚本侧）：`p.evaluate(()=>{ G&&null; })`
    报 `G is not defined`。页面全局只能看到 `NOVA`，游戏内部状态一律走钩子读。

### 无头测试
18. **`p.evaluate(() => NOVA.debug(\`…\`))` 的模板字符串在页面侧求值**，Node 侧闭包变量传不进
   （报 `ReferenceError`）。先在 Node 侧拼好字符串再当参数传：`p.evaluate(c => NOVA.debug(c), CODE)`。
19. **`debug` 的 eval 不接受顶层 `return`** —— 包成 IIFE。
20. **游戏逻辑全在一个 IIFE 里**，`p.evaluate(() => MODULES)` 拿不到
    （`MODULES` / `modStats` / `GUIDE_STEPS` 都不在页面全局）。必须借 `NOVA.debug("…")`，
    在页面侧 `JSON.stringify` 再 `JSON.parse` 回 Node。
21. `spawnEnemy` **无返回值**（用 `G.enemies[G.enemies.length-1]` 取）；`spawnAst` 返回实体。
22. 测试敌人会被玩家火力打死 → 循环里 `G.enemies[i]` 因 swapDel 错位。
    先 `const L=G.enemies.slice()` 快照 + `e.hp=e.maxHp=1e6` 锁血。
23. 持续伤害会连锁触发升级弹窗盖住画面 → 测试前 `P.xp=0;P.xpNext=1e9;`，
    截图前 `el.cards.hidden=true;G.mode='play'`。
24. Boss hp ≤ 50% 会弹阶段横幅盖住上半屏 → `b.hp=b.maxHp=1e6`。
25. 小字号元素（飘字）用 `deviceScaleFactor:2` + `clip` 局部放大截图，整屏缩略图看不清。
26. **无头里 `file://` 的 localStorage 跨 context 共享** → 测不同存档状态必须
    **每个状态一个全新浏览器实例**（沿用上一实例的 context 会读到上一条 `nova-*` 存档）。
27. **函数在 IIFE 里 → 测试里直接喊名字必 `ReferenceError`**：`openLogbook` / `setLang`
    都不在全局。一律走 `NOVA.*` 钩子（2.5 用的是 `NOVA.logbook.open()`）。
28. **截图救不了 CSS 动效验证**：动效统一只能靠 computed style 比对
    （`getComputedStyle(el).animationTimingFunction`），截图看不出"缓动是 token 还是裸写"。
29. **测试里读 CSS 属性要等面板渲染完成**：`openLogbook()` 后立刻读 `animationName`
    可能还是上一轮残留；断言前加一次 `requestAnimationFrame` × 2 或直接读
    `getComputedStyle` 的最终值（2.5 连读 3 次确认 `stable=true`）。

### 玩法事实（别想当然）
25. 游戏**没有冲刺**；**护盾只有 aegis 船有** —— 任何引导/文案/UI 别假设它们通用。
26. `MODULES` 26 项 + `REPAIR`，3 选 1，`max===Infinity` 的 repair 不参与读数。
27. **`BOSS_AT` 的 key 是波次、value 才是 Boss 种类** —— 要遍历 Boss 种类必须 `.map(w=>BOSS_AT[w])`，
   直接迭代 `keys` 会拿到 `"5"` / `"10"` 这种字符串（2.3 巨像全锁的根因）。
28. **`STAT_KEY` 一个键装 8 个字段**（3.4 后）：`k/g/t/w/sc/hulls/nomod/flaw`。
    加字段**不要新建存储键** —— 旧档靠 `loadStats` 的默认值兜底就是完整的向后兼容。
29. **`G.noMod` / `G.flawless` 是"本局标记"不是累计值**：`startGame` 置 true，
    一旦装配模块 / 受任何伤害即置 false。累计水位（`s.nomod` / `s.flaw`）只在
    `flushStats` 里、且**标记仍为 true 时**才抬升 —— 两者混淆会让成就瞬间全开。

---

## 8. 执行约定

1. **一步一验收**：一个小任务做完就验，不攒批量
2. **语法先过**：改完先抽内联脚本跑 `node --check`
3. **改颜色 / 加 UI** → 跑 `audit-tokens.js`；**动效改动** → 用 `animate` 定参数，不凭手感写数字
4. **视觉改动收口** → 过一遍 `impeccable`（`extract` 提炼 / `normalize` 规范化）
5. **动效优先级原则**：transform / opacity 优先，遵守 `prefers-reduced-motion`；
   本项目是手写 Canvas rAF + CSS，**不引入 React / GSAP**
6. **行号会漂** —— 以函数名为锚点
7. **不要靠"加更多元素"提升质感**（连续六版背景叠图层换来"不符合质感要求"的教训）

### ⚠️ 本文件的更新规程（必须遵守）

**每完成一个子项，立刻回来更新本文件**，三处：

1. 第 0 节「当前状态速览」—— 改状态标记与「下一步唯一任务」
2. 对应阶段的复选框 `- [ ]` → `- [x]`，并补上实际落地的函数名 / 数据结构名
3. 第 9 节「变更日志」追加一行：`日期 · 完成了什么 · 回退点/截图在哪`

如果过程中踩到新坑，**同步追加到第 7 节**，并同步更新
`~/.workbuddy/skills/singularity-echo-dev/SKILL.md`（那份 skill 是这套管线的完整版）。

---

## 9. 变更日志

| 日期 | 内容 |
|---|---|
| 2026-09-10 | Phase 0 完成（A 等价 token 化 + B 换「星图测绘」方向 + B.1 配色修订） |
| 2026-09-10 | Phase 1 完成（伤害飘字四档 / 音效三档 / `killImpact` 统一出口 / 拾取反馈） |
| 2026-09-10 | Phase 2 · 2.1 首局分步引导 + 2.2 卡牌信息重构完成（穷举 26 模块两态零错误） |
| 2026-09-11 | 建立本文件作为跨会话交接指南；核对代码健康度（语法 OK / audit 全绿 / 无残留） |
| 2026-09-11 | Phase 2.3 航行日志重构完成：图鉴（20 敌型 + 6 巨像 + 3 词缀，全复用现有数据）+ 成就星图容器（`ACH` 手写坐标 / SVG 双类边 / `fitAch` 自适应缩放 / 拖拽平移 / `nova-ach` 缓存）。`audit-tokens.js` 全绿，10 项无头断言全过。回退点 `.workbuddy/backups/singularity-echo_phase2-3-pre.html`，截图 `.workbuddy/shots/phase3/` |
| 2026-09-11 | Phase 2.4 死亡结算升级完成：死因块（巨像 / 敌型 / 环境三档 + 词缀与致命累积标签）+ 关键统计行（输出 / 承伤 / 峰值威胁 / 换伤比）+ 构筑回顾。数据层新增 `G.lastHit`/`G.cause`/`dmgOut`/`dmgIn`/`peakThreat`，`hurtPlayer`/`drainPlayer` 加 `src` 参数，敌方子弹用 `nearestFoe` 就近归因。10 项无头断言全过，`phase2-check.js` / `phase2-3-check.js` 无回归。回退点 `.workbuddy/backups/singularity-echo_phase2-4-pre.html`，截图 `.workbuddy/shots/phase4/` |
| 2026-09-11 | **Phase 2.5 UI 转场统一完成 → Phase 2 收官**。裸缓动关键字 18 → 1（唯一保留 `.boot-bar::after` 匀速扫光）；`.overlay` 入场改用 `--ease-drawer` 抽屉曲线 + 距离提到 14px；`.lb-sec` → `.sec-head` 提升为 `#over`/`#logbook` 共享区块标题（14 处同步，`specMatch=true`）；顺手修掉真实潜伏 bug `@keyframesbootSweep`（少空格 → 启动条扫光一直是死代码），并新增 keyframes 完整性检查锁死。11 项断言全过，`audit-tokens.js` 全绿，`phase2-check.js` / `phase2-3-check.js` / `phase2-4-check.js` 无回归。回退点 `.workbuddy/backups/singularity-echo_phase2-4-pre.html`，截图 `.workbuddy/shots/phase2/2-5-01…11` |
| 2026-09-11 | **Phase 3.4 成就树完成（Phase 3 首项）**。占位 7 节点 → **18 节点 / 22 连线**（画布 1008×688，坐标手写）：四条支线（击坠 100→4000 / 波次 5→35 / 时长 10min→5h / 技巧「3 船·6 船·零模块·无伤」）+ 汇总节点 `dependsOn` 6 项聚合。**统计 schema 5 → 8 字段**（`hulls` 船体数组 / `nomod` / `flaw`，旧档默认值兜底，**零新存储键**）。三态视觉（暗轮廓 < 蓝边蓝底 < 金边金底）+ 2px 进度条 + 「前置 5/6」聚合读数。达成瞬间弹窗（`achCheck`/`achTick`，banner+音效+金环，2.2s 冷却，**旧档首开静默补记不刷屏**）。`fitAch` 缩放下限 0.34。12 项断言全过，`audit-tokens.js` 全绿，`phase2-check.js` / `phase2-3-check.js` 无回归。回退点 `.workbuddy/backups/singularity-echo_phase3-4-pre.html`，截图 `.workbuddy/shots/phase3/3-4-*.png` |

---

## 10. 杂项待办（非阻塞）

- `singularity-echo/` 下有 8 张 `bg-prototype` 时期的旧截图（`_bg*.png`，约 4.5MB），可清理
- `bg-prototype.html` 停在 v6 搁置；恢复顺序：**先降速**（现 62s → 目标 110–150s，做成可调参数），
  再调光质；**不要靠继续堆图层**
- `BOSS_STYLE.fill` 与敌方机体 `fill` 暗色仍待换（面积小、优先级低）；粒子 `cols`、字距（19 种）待归并
