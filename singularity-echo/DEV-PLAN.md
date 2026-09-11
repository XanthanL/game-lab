# 奇点回响 · 开发规划与交接指南

> **这份文档是给下一个会话的执行手册。** 不依赖任何对话上下文，读完就能开工。
> 行号基于 2026-09-11 的 `index.html`（7845 行 / 425 KB）实测，**会漂**，以函数名为锚点。
> 详细背景见 `ROADMAP.md`（六阶段路线图）、`DESIGN-SYSTEM.md`（token 与方向）、
> `.impeccable.md`（设计上下文）。本文是它们的**进度与执行层**，不是替代品。

---

## 0. 当前状态速览（2026-09-11 核对）

| 阶段 | 状态 | 说明 |
|---|---|---|
| Phase 0 风格锚定 | ✅ 完成 | 含 A（等价 token 化）+ B（换方向）+ B.1（配色修订） |
| Phase 1 战斗反馈 | ✅ 完成 | 伤害飘字 / 命中音效 / 击杀出口 / 拾取反馈 |
| **Phase 2 引导与信息** | ✅ **完成** | 2.1 / 2.2 / 2.3 / 2.4 / 2.5 全部落地 |
| **Phase 3 构筑深度** | ✅ **完成** | **3.4 + 3.1 + 3.2 + 3.3 + 3.5 全部完成**（详见 §4） |
| **Phase 4 内容扩充** | 🔄 **进行中** | **4.1 新敌型 + 4.2 新 Boss + 4.3 新船体完成**（敌型 20→24 · 巨像 6→8 · 船体 6→7）；4.4–4.5 待做 |
| Phase 5 平台打磨 | ⬜ 未开始 | |

**当前代码健康度（已实测）**：JS 语法 OK · `audit-tokens.js` 全绿 · 无残留临时文件。
**下一步建议：Phase 4.4 新武器行为**（加进 `MODULES`，并检查 `rollChoices` 的 ability/stat
加权是否失衡，见 §5）。
`index.html` 现 **8737 行 / 478 KB**（含 4.1 四种新敌型 + 4.2 两尊新巨像 + 4.3 第七船体
「熔炉」的数据 + 行为 + 绘制 + HUD 槽）。

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
| `.workbuddy/shots/phase3-1-check.js` | **卡牌稀有度 10 项**（rarity 字段完整性、权重分布、保底计数确定性、卡面类目与标签、升阶标记、MAX 互斥、英文、竖屏、模块数/roll 大小回归、modStats 回归） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase3-2-check.js` | **协同扩展 10 项**（22 条计数、空 apply 归零、依赖合法、孤儿清零、无重复 / EN 缺漏、初始 P 上 22 条 apply 全部真实改字段≥1、协同表下标安全、样例效果、实机触发链路、模块/成就树回归） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase3-2-shots.js` | 留档截图：暂停面板 7/22 协同（桌面 / 竖屏）+ 卡面协同块 4 on | 人工 |
| `.workbuddy/shots/phase3-3-check.js` | **每日挑战 12 项**（RNG 默认 / 同种子同序列 / 不同种子不同序列 / clearSeed 还原、DAILY_RULES 池稳定、dailySeed 32-bit + 同日不变、rollChoices 尊重 G.noRepair、startDaily 链路、renderDaily 写入、commitDaily 写盘 + 徽章、菜单按钮 + 模块/协同/成就回归、移动端布局） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase3-3-shots.js` | 留档截图：菜单 btnDaily + menuDaily 面板 / 死亡面板含 daily 徽章 / 移动端 | 人工 |
| `.workbuddy/shots/phase3-5-check.js` | **局外解锁树 17 项**（树结构 / 默认档 / 产出公式 / 扣费 / req 守卫 / dust 守卫 / 重复守卫 / 7 节点开局加成 / 基线 / 存储往返 / 三态视觉 / 点击解锁链路 / 竖屏适配 / 数据规模回归 + **3.5c 坠毁面板星尘行 / 通关面板星尘行 / 切英文后重绘**） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase3-5-shots.js` | 留档截图：桌面·初始档（0 星尘，全锁）/ 桌面·中期档（208 星尘 + 7 节点解锁）/ 竖屏 390×844 适配 | 人工 |
| `.workbuddy/shots/phase4-1-check.js` | **新敌型 12 项**（六表同步 / 解锁波次 ≤30 / 定义完整性 / `SQUADS` 收录 / 四种可生成 / 播雷 6 颗 / 干扰场进出 / 干扰射速比 / 孵化双上限 / 裂解撕盾 / 图鉴 24 格 / 数据规模回归），**自带留档截图** | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase4-2-check.js` | **新巨像 14 项**（五表同步 / 剧本 Boss 优先于无尽随机 / 新字段初始化 / 干扰场开合节律 / 场内外 jam 读写 / 场灭易伤 ×1.5 / 狂暴窗口 2.6→1.8 / 引力拉扯 + 半径外归零 / 事件视界 26dps / 狂暴反转 / 图鉴 8 格 / 数据规模回归 / 4.1 jammer 未破 / 英文图鉴），**自带留档截图** | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase4-3-check.js` | **新船体 16 项**（四表同步 / 机库文案 / 解锁门禁与持久化 / 机库 7 卡锁定→解锁 / apply 属性 / **蓄热与射速解耦** / 满膛锁膛→排空归零 / 冷膛 0.85×↔满膛 1.45× 含背射 / 其余 6 船零溢出 / HUD 过热槽 / 击碎坍缩之核解锁链路 / `hullPath` 新形状 / 图鉴 7 格 + 成就 7 / 数据规模回归 / 英文机库 / 实机），**自带留档截图** | 无 pageerror、断言全过 |
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

### ✅ 3.1 卡牌稀有度 / 升阶（已完成）

**分档原则不是"越稀有越强"，而是「越稀有越特化」** —— 这样稀有卡才有"要不要赌一把"的决策重量，
而不是"反正更强必选"。

| 档 | 权重 | 数量 | 语义 | 卡 |
|---|---|---|---|---|
| **common 基础** | 1.00 | 11 | 纯数值成长 / 无依赖通用能力，构筑的地基 | hull thruster loader warhead crit magnet regen pierce ricochet twin frag |
| **rare 进阶** | 0.45 | 8 | 明确玩法倾向、需搭配才发挥，或强度明显高于同级 | guided ram backshot leech overdrive phase aegis drone |
| **epic 核心** | 0.18 | 7 | 能单独改变玩法形态的"构筑引擎"（多数连着 2~3 条协同） | tesla stasis nova lance blink deathtrail mine |

**数据跟着卡走**：`rarity` 是 `MODULES` 每项的字段（不是外部映射表），新增卡必须显式分档，
否则会落进 `rarityOf()` 的 `common` 兜底 —— 那样就失去了设计意图。

**加权与保底**（`rollChoices`）：
- 权重 = `RARITY_W[rarity]` × 能力型加权（`1 + 已投资能力数 × 0.22`），与原有权重**相乘**而非替换。
- **伪随机补偿**：`G.rarPity` 记录连续未出 rare+ 的升级次数 → dry ≥3 时 rare+ 权重 ×2.2，
  dry ≥5 时 ×4.0，dry 触及 `PITY_HARD=6` 时**强制把一张 common 换成 rare+**（换完归零）。
  ⚠️ 保底前必须判断"池里是否真有 rare+" —— 后期局 rare+ 全满级时 `candRare` 为空，
  此时静默跳过是**正确行为**（无卡可换），不是 bug。
- ⚠️ 保底计数在 `startGame` 清零、在**每次 offer 结算后**更新（含 rare+ → 归零，不含 → +1）。

**卡面视觉**（`renderCards`）：
- `r-rare` / `r-epic` 类 → 换边色 + 顶部渐变线 + 图标/英文行换色。
  common **不加类**，沿用默认钢蓝边 —— 与成就树三态同源（钢蓝 / 青 / 黄铜）。
  实测：epic 边 `rgba(201,162,39,.6)`、rare 边 `rgba(124,178,221,.55)`。
- `.tag.rar` 稀有度标签（基础 / 进阶 / 核心，英文 COMMON / RARE / EPIC），三档不同色。
- **升阶标记**：已持有且未满级 → 加 `up` 类（青色左缘）+ `.up-mark`「↑ 升阶 LVn」。
  满级卡走原有 `mx`（MAX 金边），**两者互斥**（`up` 只在非 max 时加）。

**测试钩子**：`NOVA.cards.{rarity,roll,pity,faces}`（`roll(n)` 重置 build+pity 采纯权重分布；
`faces()` 读卡面类名与标签）。
**断言脚本**：`.workbuddy/shots/phase3-1-check.js`（10 项，全绿）。
**回退点**：`.workbuddy/backups/singularity-echo_phase3-1-pre.html`
**截图**：`.workbuddy/shots/phase3/3-1-*.png`

### ✅ 3.2 协同扩展（已完成）

`SYN` **12 → 22 条**，并把原本 9 条「空 `apply()`」全部改成真实生效的一次性属性变更。

**这轮最大的发现不是"协同太少"，而是"协同是假的"**：旧表 12 条里只有 3 条
（`storm` / `bulwark_ram` / `swarm_arc`）真的改了属性，其余 9 条 `apply:()=>{}` 是空函数，
而**运行时根本没有任何地方读 `G.syn[id]`** —— 它们照样在面板上标亮为「已激活」，
玩家以为拿到了加成，实则零效果。这是比"内容少"严重得多的问题，所以本轮
优先级从"补数量"改成"先让已有的全真"。

**新增 10 条（优先补孤儿卡）**：旧表里 `twin` / `pierce` / `ricochet` / `frag` / `guided`
这 5 张卡**一条协同都没有**，拿了等于纯数值堆叠、没有构筑方向 —— 这是"每局手感雷同"的主因。

| 协同 | 组合 | 效果 |
|---|---|---|
| `volley_pierce` 齐射穿刺 | twin + pierce | `P.pierce+=2` |
| `salvo_blast` 散爆齐射 | twin + frag | 爆炸范围 ×1.25、溅射 ×1.25 |
| `spray_bounce` 流弹幕 | twin + ricochet | 反弹 +1、射速 ×1.08 |
| `pierce_bounce` 穿甲跳弹 | pierce + ricochet | `P.ricochet+=2` |
| `guided_pierce` 制导穿甲 | guided + pierce | 制导 +1 级、穿透 +1 |
| `guided_frag` 追踪榴弹 | guided + frag | 搜索范围 +120、爆炸范围 ×1.2 |
| `bounce_blast` 跳雷 | ricochet + frag | 反弹 +1、溅射 ×1.3 |
| `minefield_arc` 雷场电击 | mine + tesla | `P.tesla+=1` |
| `rear_pierce` 贯穿尾炮 | backshot + pierce | 尾炮火力 +15%、穿透 +1 |
| `stasis_mine` 停滞雷区 | stasis + mine | `P.stasisR+=60` |

**修复的 9 条空 apply**：`blink_ram`(+2 冲角) / `blink_arc`(链击+1、冷却-0.2) /
`nova_stasis`(减速+0.6) / `pulse_swarm`(机群火力+0.25、间隔-0.06) /
`judge_frost`(长枪冷却-0.5、静止场+40) / `rear_lance`(尾炮+1、长枪冷却-0.4) /
`molten_ram`(+2 冲角) / `vent_wake`(盾上限+15 并补满) / `ignite`(爆炸伤害+15)。

**`SYN_EN` 同步 22 条**，测试钩子 `NOVA.syn.{list,count,emptyApply,badDeps,orphans,dupes,enMissing,effect,audit}`。
10 项断言全过（含「22 条 apply 在初始 `P` 上必须至少改 1 个字段」、
**「`P.mine`/`P.nova`/`P.blink` 下标不动」的协同表安全检查**），`audit-tokens.js` 全绿，
`phase2-check` / `phase2-3-check` / `phase2-5-check` / `phase3-4-check` / `phase3-1-check` 无回归。
回退点 `.workbuddy/backups/index_*_phase3-2-pre.html`，截图 `.workbuddy/shots/phase3/3-2-*.png`。

### ✅ 3.3 每日挑战（已完成）

**关键设计**：「同一种子 = 完全相同的一局」是核心承诺 —— 玩家每日面对同一对规则、
同一模块分布、同样的开局优势 → 真正的「技术比拼 + 当日最优」而非纯运气。

**1. RNG 种子化（3.3.1）**：抽常量表 `RND={on,s}` + `mulberry32` + `setSeed/clearSeed`。
把 `rand/irand/pick/shuffle` 这 4 个顶层随机函数改成走 `srand01()`：
- 默认状态：`srand01()` 走 `Math.random()`，与旧行为**字节级一致**；
- 种子状态：`setSeed(s)` 后所有 `rand/irand/pick/shuffle` 走 `mulberry32`，
  VFX 与微观暴击判定仍走 `Math.random`（保证「同开局」承诺的同时不影响动画）。
**只改 4 个函数、29 处 `Math.random` 调用中无需改 1 行**，全部自动跟随。

**2. 规则池（3.3.2）**：4 条规则，pickDailyRules 用 `setSeed + shuffle` 选 2 条：
- `startLoader` 起步装载（送 loader LV1，射速 +12%）
- `startAegis` 护盾待命（送 aegis LV1 + 护盾立刻填满）
- `swiftStar` 临界之星（暴击率 +10%、暴击伤害 +50%）
- `noRepair` 不可修复（升级三选不放 repair）
`rollChoices` 在 `G.noRepair=true` 时剔除 `repair` 候选；
`startDaily` 顺序：`G.dailyMode=true` + `G.daily={...}` + `setSeed` + `startGame` + 逐条 `apply`，
**`startGame` 看到 `G.dailyMode=true` 不重置 `G.daily`**（否则本句之后 `for r of G.daily.rules` 崩）。

**3. 入口与结算（3.3.3）**：
- **菜单**：btnDaily（`DAILY ▸ 每日挑战`，与 btnLaunch 同级）+ menuDaily 面板
  （「日期 / 今日规则 / 今日最佳」三段），回菜单/首次进入自动 `renderDaily()` 刷新；
- **死亡面板**：`buildCause` 顶部加 `daily-badge`（日期 + 规则名，青边分隔线）；
- **存储键 `nova-daily`**：`commitDaily` 在 `commitDaily` 时按「更高分覆盖」
  写 `{date:{score,wave,kills,rules:[id,id]}}`；showOver 顺道 `commitDaily`。
- **每日种子**：`dailySeed()` = `YYYYMMDD` 走 FNV-1a 哈希成 32-bit 整数；同日同设备同种子 → 同规则。

**测试钩子** `NOVA.rng.{set,clear,sequence,raw,state}` / `NOVA.daily.{seed,rules,today,start,render,state,active}` / `NOVA.dailyStore.{load,save,commit,clear}` / `NOVA.counts`。

**12 项断言全过**：`audit-tokens.js` 全绿，`phase2-check`(10) / `phase2-3-check`(10) / `phase2-4-check`(10) / `phase2-5-check`(11) / `phase3-4-check`(12) / `phase3-1-check`(10) / `phase3-2-check`(10) **无回归**。

回退点 `.workbuddy/backups/singularity-echo_phase3-3-pre.html` + `index_*_phase3-3-post.html`；
截图 `.workbuddy/shots/phase3/3-3-*.png`（12 张断言 + 3 张留档）。

### ✅ 3.5 局外解锁树 · Stardust 星尘（已完成，3.5c 加结算可见化）

**核心目的**：让连败也有进展感 —— 玩家无论胜败每局都拿到 **Stardust（星尘）**，
永久解锁起始增益。货币可见、进度可见、消费可见，循环透明。

#### 1. 数据层

**13 个节点 · 4 条支线 + 1 根**（画布 672×642）：

| 支线 | 节点（id · 效果 · cost） | y |
|---|---|---|
| 根 | `mroot`（永远已解锁 · cost 0） | 302 |
| 生存 | `hp1`(maxHp+15, 10) → `hp2`(maxHp+25, 22) → `sh1`(shieldMax+20, 40) | 20 |
| 火力 | `dmg1`(dmg×1.08, 12) → `rate1`(fireRate×1.06, 24) → `crit1`(crit+0.05, 45) | 180 |
| 机动 | `spd1`(maxSpeed×1.06, 10) → `mag1`(magnet×1.3, 20) → `turn1`(turn×1.1, 38) | 420 |
| 战术 | `lv1`(level=2 开局, 18) → `xp1`(xpNext×0.9, 32) → `premod`(pierce LV1, 55) | 580 |

**存储键 `nova-meta = {dust:N, unlocked:[id,...]}`**（旧档无此键 → 默认 `{dust:0, unlocked:['mroot']}`，
**零新存储键破坏**兼容性，类比 3.4 统计 schema 扩展）。`unlocked` 至少包含 `mroot`。

**星尘产出公式**（在 `showOver` / `showVictory` 结算时一次性入账）：
```
earn = 1 + ⌊score / 1500⌋ + ⌊kills / 60⌋
```
例：0/0 → 1 · 1500/60 → 3 · 9000/300 → 12 · 45000/1200 → 51（断言 3-5-03 实测）。

#### 2. 守卫链（`metaUnlock` 返回 `{ok, reason}`）

| 失败原因 | 含义 | 触发 |
|---|---|---|
| `no-node` | id 不在 META 表里 | 内部异常 |
| `already` | 重复解锁 | `unlocked.indexOf(id) >= 0` |
| `req` | 前置节点未解锁 | `metaHas(id.req)` false |
| `dust` | 星尘不足 | `dust < cost` |

**成功路径**：`dust -= cost` 后 `push(id)` → 持久化 → 返回 `{ok:true, dust, cost}`。
`cost` 字段给 UI 显示「消耗 10 星尘 —— 剩余 40」。

#### 3. 三态视觉（沿用 3.4 `lbnode` 语汇）

- **locked**（暗轮廓）：未达成或前置未满
- **ready**（青边 + 青底 + cursor:pointer）：可点击
- **done**（金边 + 金底）：已解锁，悬停仍可读但不可点

`drawMeta()` 走与 `drawAch()` 同一渲染骨架：SVG 连线（成本色虚线） + 绝对定位节点 + dust 读数。
`fitMeta()` 自适应缩放（floor 0.34，对齐 `fitAch`），竖屏 390 视口下 scale ≈ 0.4375 不溢出。

#### 4. 开局加成链路（`applyMetaBonuses`）

`startGame` 在 `hull.apply()` 之后立刻调用 `applyMetaBonuses()` —— 把 `unlocked`
按顺序写入 `P`，**支持任意前缀组合**。实测：
```
解 hp1/hp2/sh1/dmg1/spd1/mag1/lv1  → P.maxHp=140 P.shieldMax=20 P.dmg=1.08
                                    P.maxSpeed=360 P.magnet=195 P.level=2
零解锁                            → P.maxHp=100 P.dmg=1 P.maxSpeed=340
                                    P.magnet=150 P.level=1（基线）
```
**`premod` 故意不注册进 `G.build`**（详见 §7 坑 38），让玩家可以开局就拥有 pierce 而不占用
模块位 / 触发 `G.noMod` 反成就。

#### 5. 3.5c · 结算面板星尘行（新增）

**问题**：3.5 结算时只算了 `G.lastDust=metaEarn()`，面板上没有任何展示 →
3.5 的核心循环对玩家 **完全不可见**。修复：
- 坠毁面板 / 通关面板各加一行 `<div class="statline dust">`，
  内容「星尘产出 +N · 可用 M · 于「解锁星图」消费」，琥珀色与「星尘」语义一致。
- `renderDust(node, earn)` 把本局产出 + 累计余额（`metaLoad().dust`，含本局）
  一次性拼出来；`applyI18n` 切语言时一并重绘，**杜绝中英混排**。
- 三断言：`3-5-15-over-dust`（9000 分 + 300 杀 → 「+12 · 12」）/ `3-5-16-victory-dust`
  （通关 20000 分 + 800 杀 + 8000 加成 → 「+32 · 32」）/ `3-5-17-dust-i18n`（切英文后无中文）。

#### 6. 测试钩子

`NOVA.meta.{tree,load,save,has,state,unlock,earn,earnFor,reset,grant,draw,fit}` 12 个。
`NOVA.counts().meta=13`。**17 项无头断言全过**（断言 1-14 数据 + UI + 回归，
15-17 3.5c 结算可见化），前 8 个 phase（2/2-3/2-4/2-5/3-4/3-1/3-2/3-3 共 90 项）**无回归**。
`audit-tokens.js` 全绿。回退点 `.workbuddy/backups/index_*_phase3-5-post.html`，截图 `.workbuddy/shots/phase3/3-5-*.png`。

---

## 5. Phase 4 · 内容体量扩充 🔄 进行中

#### ✅ 4.1 新敌型（已完成 2026-09-11）

**敌型 20 → 24 种**，补上原本的三个空位：**区域控制 / 玩家减益 / 召唤**
（原 20 种里区域控制只有静态的 `mine`，没有任何玩家减益，也没有召唤者）。

| 类型 | 中文 / EN | 解锁 | 定位 | 机制 |
|---|---|---|---|---|
| `sower` | 播雷者 SOWER | W15 | 区域控制 | 每 1.0–1.8s 布 1 颗雷（每只上限 6），自身不主动贴身 |
| `jammer` | 干扰者 JAMMER | W18 | 玩家减益 | 绕玩家 260–340 半径公转，`jamR=230` 场内给 `P.jamT` 续期 |
| `brood` | 孵育体 BROOD | W22 | 召唤 | 每 `max(2.2, 3.4-0.03·波次)`s 孵 1 只 reaver，**每巢 10 / 场上 70 双上限** |
| `sunder` | 裂解者 SUNDER | W25 | 反护盾 | 230 速突进；接触撕掉 `SUNDER_STRIP=22` 点护盾（**固定值，不随波次膨胀**） |

- **三个常量**：`JAM_FIRE=0.65`（干扰场内射速倍率）/ `JAM_SPD=0.8`（极速倍率）/ `SUNDER_STRIP=22`。
- **玩家新字段** `P.jamT`（`newPlayer` 初始化，每帧衰减）；**在场内每帧续期 0.4s，
  离开后 0.4s 自动解除** —— 不需要写"离开检测"。
- **干扰链路乘性叠加**：`P.fireCd = 1/(P.fireRate * (P.rateT>0?1.6:1) * (P.jamT>0?JAM_FIRE:1))`，
  极速同理乘 `JAM_SPD`。**与既有 `rateT`/`boostT` 增益相乘而非覆盖。**
- **反护盾** `sunderShield()`：扣盾 → `dmgText(...,'absorb')` + `FX.splash('cyan')` +
  `ring()` + `sfx.hit('block')` —— 全复用 Phase 1 的「被挡」反馈档，**零新增反馈语汇**。
- **六表同步**（顺序别乱）：`ENEMY_DEFS` → `EN_UNLOCK` → `EN_ZH`/`EN_EN`/`EN_TRAIT`
  → `EN_LIST` → `SQUADS`。⚠️ 新敌型定义**必须写进 `ENEMY_DEFS` 本体**（见 §7 内容扩充第 42 条）。
- **测试钩子** `NOVA.enemy.*`；**12 项无头断言全过**，前 9 个 phase
  （2 / 2-3 / 2-4 / 2-5 / 3-1 / 3-2 / 3-3 / 3-4 / 3-5，**共 101 项**）**无回归**。
  `audit-tokens.js` 全绿。回退点 `.workbuddy/backups/index_*_phase4-1-post.html`，
  截图 `.workbuddy/shots/phase4/4-1-*.png`。

#### ✅ 4.2 新 Boss（已完成 2026-09-11）

**巨像 6 → 8**，两场都是**无尽专属**（W35 / W40），补上原本缺的两种威胁形态：
**场地压制**与**位移操控**（原 6 尊都是"弹幕 + 召唤"的变体，没有一个操控玩家位移）。

| 波次 | 中文 / EN | 机制 |
|---|---|---|
| W35 | 静默方碑 MONOLITH | 干扰场**开合节律**：场开 4.2s（狂暴 5.0）压射速 ×0.55 / 极速 ×0.72；场灭 2.6s（狂暴 1.8）核心暴露、**受伤 ×1.5** |
| W40 | 坍缩之核 COLLAPSE | **引力井**：`GRAV_R=820` 内持续拉扯（峰值 430，终速 ≈205）；`r×0.62` 事件视界每秒灼烧 26；狂暴后每 8s 倒转 2s 为斥力 |

- **九个常量**：`MONO_FIRE=0.55` / `MONO_SPD=0.72` / `MONO_R=300` / `MONO_ON=4.2` /
  `MONO_OFF=2.6` / `GRAV_R=820` / `GRAV_PULL=430` / `HORIZON_R=0.62` / `HORIZON_DPS=26`。
- **干扰参数化**（4.1 的遗留问题）：`JAM_FIRE/JAM_SPD` 是常量，Boss 想要不同强度只能复制 →
  新增 `P.jamF` / `P.jamS`（`P.jamT` 只管时长），**施加者写入、消费点统一读**。
  4.1 的 `jammer` 数值与既有行为零改动。
- **五表同步**：`BOSS_AT` / `BOSS_NAME` / `BOSS_ZH` / `BOSS_MV` / `BOSS_STYLE`。
  图鉴巨像名录与 `NOVA.counts().bosses` **都从 `BOSS_AT` 派生** → 加 Boss 无需改 UI。
- **剧本优先**：`buildWave` 改成 `BOSS_AT[n]||(endless&&n%5===0?pick(Object.keys(BOSS_MV)):null)` ——
  原写法里 `n>WIN_WAVE` 走无尽分支，`BOSS_AT[35]` 永远读不到。
- `st_c(a)` 取巨像分量色串，绘制与 VFX 一律走它（R4 零新增字面量）。
- **测试钩子** `NOVA.boss.{at,kinds,waves,wave,spawn,info,jam,gravity,step,place,player,clear}`；
  **14 项无头断言全过**，前 10 个 phase（2 / 2-3 / 2-4 / 2-5 / 3-1 / 3-2 / 3-3 / 3-4 / 3-5 / 4-1
  共 113 项）**无回归**。`audit-tokens.js` 全绿。
  回退点 `.workbuddy/backups/index_*_phase4-2-post.html`，截图 `.workbuddy/shots/phase4/4-2-*.png`。
- ⚠️ 顺手修掉 4.1-08 的**静默失效**：参数化后该断言只写 `P.jamT` 不写 `jamF/jamS`，
  比值从 1.538 退化成 1 却仍打印 `ok`。已补三件套 + `ok` 硬断言（详见 §7 第 52 条）。

#### ✅ 4.3 新船体（已完成 2026-09-11）

**船体 6 → 7**：第七船体 **「熔炉 FORGE」❖**（熔铜配色 `#1a0e07` / `#f0a468` / `236,132,58`），
解锁挂 **肃清第 40 波 · 击碎坍缩之核** —— 与 4.2 新增的 W40 巨像呼应
（此前 raven↔W15、nemesis↔W30，**无尽 30 波之后一直没有里程碑奖励**）。

**机制 · 过热膛线**（首个带"持续状态"的船体 —— 其余 6 艘都是一次性属性改写）

| 状态 | 行为 |
|---|---|
| 持续开火 | 热量 **+30/s**（满膛 3.3s），伤害在 **冷膛 0.85× → 满膛 1.45×** 之间线性浮动 |
| 停火 | 热量 **−34/s**（满膛排空约 2.9s） |
| 热量见顶 | **锁死炮膛 1.7s**，期间强制散热、解锁瞬间归零（`HEAT_VENT` 排空） |

- **七个常量**：`HEAT_MAX=100` / `HEAT_UP=30` / `HEAT_COOL=34` / `HEAT_LOCK=1.7` /
  `HEAT_VENT=HEAT_MAX/HEAT_LOCK`（≈58.8，**必须与前两者对齐** —— 否则解锁瞬间残留热量、
  立刻二次过热产生抖动）/ `HEAT_COLD=0.85` / `HEAT_HOT=1.45`。
- **蓄热走"速率"而非"每发累加"**：`HEAT_UP*dt` 与射速解耦（断言验证射速 ×3 后 1s 蓄热仍是 30）。
  若按每发累加，高射速构筑会在 1 秒内烧穿，"节奏取舍"退化成"不许点射"，
  与堆射速的构筑意图相悖。
- **新玩家字段** `P.heat` / `P.heatMul` / `P.heatLock` / `P.heatOn`：
  `heatOn` 只有熔炉为 `true`，**其余 6 艘 `heat` 恒 0、`heatMul` 恒 1**（已逐船断言，零溢出）。
  `heatMul` 在 `updatePlayer` 每帧刷新、`fireGun` 直接乘进弹丸伤害（主弹与背射弹都吃）。
- **HUD 过热槽** `#heatrow`（`HEAT` 标签 + `.bar.heat`，黄铜→朱砂渐变，满膛转警示色），
  仅熔炉显示。⚠️ `HUDC` 缓存在换船体重开时**不自清** → 切显示状态即作废宽度缓存强制重写一次。
- **四处全同步 + `hullPath` 新分支**：`HULL_TINT` / `HULL_GEO` / `HULL_TAIL` / `TRAIL_RAMP`
  + 形状（宽厚砧形 + 双侧散热鳍 + 方形炉尾喷口）。
  `HULL_TAIL.forge=15` 必须等于 `-HULL_GEO.forge.t`（已断言），否则尾流从船身中段喷出。
- **联动四处**：机库数字键 `Digit[1-6]`→`[1-7]`、`HULL_EN` / `HULL_LOCK_EN`、
  成就「全舰制霸」`hull6.goal()` **6→7**（**id 保留** —— 存档按 id 记已达成，改 id 会丢档）、
  `NOVA.counts().hulls` 自动变 7。
- **16 项无头断言全过**，前 11 个 phase（2 / 2-3 / 2-4 / 2-5 / 3-1 / 3-2 / 3-3 / 3-4 / 3-5 /
  4-1 / 4-2，**共 129 项**）**无回归**。`audit-tokens.js` 全绿（51 hex + 30 rgb 全在白名单）。
  回退点 `.workbuddy/backups/index_*_phase4-3-pre.html`，
  截图 `.workbuddy/shots/phase4/4-3-*.png`。

**待做**

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
30. **断言阈值的单位要盯紧**：3.1 的占比断言里 `pct()` 返回的是 **63.0（百分制）**，
    却拿去和 `0.70` 比 → 恒 false，而打印出来的 `63.0%` 看着完全正常。
    **症状：数值对了但 `ok=false`。** 百分制阈值一律写 `70` 而不是 `0.70`。
31. **`#cards` 覆盖层里是 `.cards-in` 不是 `.panel`** —— 量升级面板尺寸时
    `querySelector('#cards .panel')` 恒为 null（`TypeError: reading 'getBoundingClientRect'`）。
    各覆盖层内部结构不统一：`#cards`/`#hulls` 用 `.cards-in`，`#victory`/`#pause`/`#over` 用 `.panel`。
32. **构造"确定性的稀有度场景"要借 `NOVA.debug`**：想让池里只剩某一档，
    就在游戏作用域里 `G.build={}` 后把目标档全部 `=6`（满级即出池）。
    比"随机跑很多次看统计"可靠得多 —— 后者永远测不到保底这类边界分支。

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
30. **实测稀有度占比 63/26/12，不是纯权重的 69/23/8 —— 这是设计预期，不是 bug。**
    `rollChoices` 强制每 offer **至少 2 张能力型**，而能力型 16 张里有 12 张是 rare+
    （common 仅 twin/pierce/ricochet/frag 4 张），所以 rare+ 被显著放大。
    别拿"全池纯权重"的理论值去校准断言，会误判成分布写错了。
31. **`rarity` 是 `MODULES` 每项的字段，不是外部映射表** —— 新增卡必须显式分档，
    否则落进 `rarityOf()` 的 `common` 兜底。**批量插字段的正则要用 `,max:` 作锚**，
    插完必须校验：无 `,,`、无 `'x'max:`（我第一版把它插成了 `,,rarity:'common'max:6`，
    语法没报错但数据全坏 —— 是 `node --check` 抓不到的那类错误）。
32. **`up`（升阶）与 `mx`（MAX）互斥**：`up` 只在"已持有且未满级"时加，
    满级走 `mx`。两者可以同时出现在 className 里（`card up mx`），
    但 `up-mark` 文案只在非 max 时渲染 —— 断言别只看类名，要连文案一起看。
33. **「空 apply」协同是沉默失效的真坑**（3.2）：旧 `SYN` 12 条里 9 条 `apply:()=>{}` 是空函数，
    且**运行时没有任何地方读 `G.syn[id]`** —— 它们照样在 UI 标亮为已激活。
    验证姿势不是看 `G.syn` 的键存在，而是**每个 apply 必须真实改 `P`**。
    断言 `effect()` 在初始 `P` 上跑一次后，比对前后 ~26 个标量字段，确保 `minChanged>=1`。
    这条和 29（`G.noMod`/`G.flawless` 的本局/累计混淆）是同一类「数据看着对、行为空转」。
34. **乘法协同遇零基字段 = 静默失效**（3.2）：`P.splashR`/`P.splashDmg` 初始为 0，
    只有 `frag.apply` 跑过才有值 —— 直接 `*=1.25` 永远乘零。
    写 `splashBoost(rMul,dMul)`：用 `FRAG_LV[0]` 一级值播种再乘。
    抽常量表 `FRAG_LV` 后 `frag.apply` 与协同共用，避免硬编码重复。
    新增任何「对可能为 0 的字段做乘法」的协同都要照此办理。
35. **`P.mine`/`P.nova`/`P.blink` 是 `MINE_LV[P.mine-1]` 之类表的下标**（3.2 警告固化）：
    协同 `apply` 里永远别动这三个字段（连续 += 会越界 → `undefined` → 直接崩）。
    只用纯标量：`pierce` / `ricochet` / `splashR` / `splashDmg` / `teslaCd` / `stasisR` /
    `dronePow` / `droneCd` / `ram` / `deathBonus` / `backshot` / `backPow` / `homeR` /
    `homing` / `shieldMax` / `shield` / `fireRate` / `dmg` / `maxSpeed` / `magnet`。
36. **`rollChoices` 是裸 `Math.random`**（3.3 已完成）：每日挑战的随机源抽成可注入种子。
    **最终方案：只改 `rand/irand/pick/shuffle` 4 个顶层函数走 `srand01()`，VFX 与微观判定仍走 `Math.random`** —— 29 处 `Math.random` 调用中无需改 1 行，「同种子 = 同开局」的承诺由这 4 个函数兜底。
    ⚠️ 「全部用种子化的 `Math.random`」也是可行方案但 diff 大且风险面广，**只换顶层函数**是性价比最高的路径。
37. **`startDaily` 的调用顺序坑**（3.3）：`G.daily={...}` + `setSeed` + `startGame` + `for r of G.daily.rules`
    看似自然，但 `startGame` 会重置 `G.daily=null` → 后面的 `r.apply` 拿到 null 崩。
    **修法：startGame 看到 `G.dailyMode=true` 时跳过 `G.daily` 重置**（但仍清掉 `G.dailyMode`）。
    startDaily 顺序因此改成：先设 `G.dailyMode=true` + 注入 `G.daily` + `setSeed`，
    再调 `startGame`，最后逐条 `apply`。
38. **测试脚本在 IIFE 里访问 `G`/`SYN`/`MODULES`/`ACH` 全部 `not defined`**（3.3 踩到）
    —— 一律走 `NOVA.*` 钩子（`NOVA.counts()` / `NOVA.syn.count()` / `NOVA.cards.*` / `NOVA.logbook.ach`）。
    之前 phase 的脚本可能碰巧能用直接访问是因为没有触发 IIFE 边界（顶层常量声明即可见）。
    **新加测试钩子时统一进 NOVA.*，避免日后别的脚本踩同样的坑。**

33. **「空 apply」协同是沉默失效的真坑**（3.2）：旧 `SYN` 12 条里 9 条 `apply:()=>{}` 是空函数，
    且**运行时没有任何地方读 `G.syn[id]`** —— 它们照样在 UI 标亮为已激活。
    验证姿势不是看 `G.syn` 的键存在，而是**每个 apply 必须真实改 `P`**。
    断言 `effect()` 在初始 `P` 上跑一次后，比对前后 ~26 个标量字段，确保 `minChanged>=1`。
    这条和 29（`G.noMod`/`G.flawless` 的本局/累计混淆）是同一类「数据看着对、行为空转」。
34. **乘法协同遇零基字段 = 静默失效**（3.2）：`P.splashR`/`P.splashDmg` 初始为 0，
    只有 `frag.apply` 跑过才有值 —— 直接 `*=1.25` 永远乘零。
    写 `splashBoost(rMul,dMul)`：用 `FRAG_LV[0]` 一级表值播种再乘。
    抽常量表 `FRAG_LV` 后 `frag.apply` 与协同共用，避免硬编码重复。
    新增任何「对可能为 0 的字段做乘法」的协同都要照此办理。
35. **`P.mine`/`P.nova`/`P.blink` 是 `MINE_LV[P.mine-1]` 之类表的下标**（3.2 警告固化）：
    协同 `apply` 里永远别动这三个字段（连续 += 会越界 → `undefined` → 直接崩）。
    只用纯标量：`pierce` / `ricochet` / `splashR` / `splashDmg` / `teslaCd` / `stasisR` /
    `dronePow` / `droneCd` / `ram` / `deathBonus` / `backshot` / `backPow` / `homeR` /
    `homing` / `shieldMax` / `shield` / `fireRate` / `dmg` / `maxSpeed` / `magnet`。
36. **`rollChoices` 是裸 `Math.random`**（3.3 待办前置）：每日挑战要先把随机源
    抽成可注入种子的函数（`rng()` / `seedRng(seed)`），再改 `rollChoices` /
    `buildWave` 的 `Math.random` 调用点。**先确认、再动手**，免得每改一处忘一处。
37. **`hidden` 容器里量不到尺寸**（3.5 复用 3.4 教训）：`fitMeta()` 依赖 `clientWidth`，
    但 `openLogbook()` 若先 draw 后 unhide → 宽高全 0、缩放退化成 1、最右一列被裁。
    `openLogbook()` 已内化为「`hidden=false` → `drawLogbook()` → 双 `rAF` 后再
    `fitAch(); fitMeta();`」三步走，**调任何 fit* 前必须先开日志**。
38. **`premod` 故意不注册进 `G.build`**（3.5 设计决定）：该节点给开局 `pierce=1`，
    若走 `apply()` 把 `pierce LV1` push 进 `G.build`，会同时：
    ① 占一个 `ABILITY_CAP=6` 模块位；
    ② 触发「零模块」玩法的 `G.noMod` 状态为 false → 反成就 `nomod` 永远拿不到。
    修法：`premod.apply` 直接 `P.pierce = 1`（不走模块系统），与开局加成同一套机制。
39. **`metaState.ready` 要先算 reqOk 再算 dust**（3.5 实现顺序坑）：状态机是
    `unlocked=已解锁` / `ready=可解锁` / `locked=未达成`，`ready = !unlocked && reqOk && dust>=cost`。
    `reqOk` 是先于 `dust` 的硬门槛 —— 即使有钱也要先把前置做满。错把 `dust` 算在前面，
    会让「前置未满但有钱」错误地显示成 ready，**视觉上诱导玩家以为能解锁**。
40. **强制点击真实点击要先 `scrollIntoView`**（3.5-12 静默失败教训）：
    `logbook` 面板滚动条很长，节点若不在视口内，`p.click(sel, {force:true})` 仍会把
    真实鼠标事件派发到节点屏幕坐标上 —— 但该坐标**可能被面板外其他元素覆盖**，
    表现为「dust 不变 / cls 仍是 ready」。修法：点击前先
    `document.querySelector('[data-node-id="lbsec7"]').scrollIntoView({block:'center'})`，
    再等 ≥400ms 让 fit 完成 + 滚动结束。
41. **零基础字段乘法协同静默失效**（3.2 旧坑 · 3.5 复核时再撞）：`P.splashR` / `P.splashDmg`
    默认 0，`*= 1.25` 永远得 0。3.5 写 `applyMetaBonuses` 时如果有人把 `dmg` 当成「加法 +
    ×系数」叠加在已归零字段上，要像 3.2 那样先**用常量表一级值播种**（例：`P.dmg = P.dmg *
    1.08`，而不要 `P.splashR *= 1.25` 这种从零起步的乘法）。开新字段时回头看 `FRAG_LV` 那种
    `if(!P)startGame(HULLS[0]); G.mode='play';` 之类自愈入口，别假设调用方已开局。

### 内容扩充（Phase 4 · 新增敌型 / Boss / 船体）

42. **R4 的动态色板白名单只认 `const ENEMY_DEFS={…\n};` 这一个正则**（4.1 第一版踩到）：
    我把四个新敌型放进独立的 `ENEMY_DEFS_41` 子表再 `Object.assign` 合并 ——
    **功能完全正常、断言也全过**，但 R4 的色板提取看不见子表，把 4 个机体色 + 4 个高光色
    判成「白名单外字面量」，**一次性报 8 条 R4 错**。
    **修法：新敌型一律直接写进 `ENEMY_DEFS` 花括号本体**（顺带让 `EN_LIST` 与图鉴自动拾取）。
    同规则适用于 `HULL_TINT` / `TRAIL_RAMP` / `BOSS_STYLE` 这几张被动态提取的表。
43. **高光色从敌型自己的 `c` 派生，别再写新字面量**：`rgba(${e.c},0.35)` 足矣 ——
    `ENEMY_DEFS.c` 是 `"190,170,90"` 这类**空格分隔分量串**（不是 hex），
    既天然落在 R4 白名单内，又保证机体色与高光永远同源（改一处两边一起变）。
44. **`ENEMY_DEFS` 是对象，`.length` 恒 `undefined`**（4.1 顺手修掉的真 bug）：
    `NOVA.counts().enemies` 原本写 `ENEMY_DEFS.length` → 一直是 `undefined`，
    因为此前没有任何断言读它的值，潜伏至今。
    正确写法 `EN_LIST.length`。**同理 `BOSS_AT` / `AFFIX` / `HULL_TINT` 全是对象，
    取数量一律 `Object.keys().length` 或对应的 `*_LIST`。**
45. **依赖 `P` 的测试钩子必须自愈**（4.1-07 崩溃）：`NOVA.enemy.jamProbe()` 若在
    `startGame` 之前调用 → `P` 为 `null` → `Cannot set properties of null (setting 'jamT')`。
    钩子开头加 `if(!P)startGame(HULLS[0]); G.mode='play';`，**别假设调用方已开局**。
46. **召唤型必须双上限，且场满时"暂停"而非"丢弃"**（4.1 `brood` 设计结论）：
    只有「每巢上限」→ 多巢叠加仍指数爆炸；只有「场上上限」→ 单个巢吃满后其他巢白孵。
    `brood` 用「每巢 10 + 场上 70」双闸门，场上已满时**不推进孵化计时**，
    避免出现"玩家躲着不打就永远不刷"的退化策略。
47. **反护盾数值取固定常量，不要随波次膨胀**（4.1 `sunder`）：
    `SUNDER_STRIP=22` 是常量 —— 若改按比例/按波次，后期 aegis 玩家会被一击剥空、
    前期又完全无感，两个极端都不好玩。
48. **无尽分支会吃掉剧本 Boss**（4.2）：`buildWave` 原写法
    `endless?(n%5===0?pick(...):null):(BOSS_AT[n]||null)` —— `n>WIN_WAVE` 一律走无尽分支，
    **`BOSS_AT[35]` 永远读不到**，新 Boss 加进去也不出场。
    改成 `BOSS_AT[n]||(endless&&n%5===0?pick(...):null)`：**剧本优先、随机兜底**。
    以后再给无尽加固定剧本，先查这一行。
49. **玩家减益要参数化：`jamT` 只管时长，倍率另存 `P.jamF`/`P.jamS`**（4.2）：
    4.1 把 `JAM_FIRE/JAM_SPD` 写成常量，Boss 想要不同强度就得复制一份乘数。
    改成施加者一次写入 `{jamT, jamF, jamS}`、消费点统一 `P.jamT>0?P.jamF:1`。
    ⚠️ **`P.jamT` 的衰减写在 `updatePlayer` 里** —— 测试里只循环 `updateEnemies`
    永远不会衰减（4-2-13 第一版因此恒 0.4，看着像"干扰没解除"）。
50. **引力必须在阻尼之前施力，且必须有作用半径**（4.2 `collapse`）：
    `P.vx+=…` 放在 `Math.exp(-2.1*dt)` 阻尼之前，终速 ≈ `g/2.1`；
    没有 `GRAV_R` 上限时全图都被拉、远了也甩不掉 —— 一定要
    `if(d>=GRAV_R)break;` 让边缘归零，**中心最强、边缘趋零**才有"冲出去"的操作空间。
51. **`NOVA.lang` 不在根上，在 `NOVA.death.lang`**（4.2 踩到）：
    `p.evaluate(()=>NOVA.lang('en'))` 报 `NOVA.lang is not a function`。
    钩子是分域挂的（`death` / `logbook` / `cards` / `boss` / `enemy` …），
    用之前先 `grep -n "  lang:"` 确认归属。
52. **参数化改造会让旧断言"静默假绿"**（4.2 复核 4.1 时抓到）：
    把 `JAM_FIRE` 从"消费点直接读常量"改成"读 `P.jamF`"之后，4.1-08 只写 `P.jamT=1`
    不再影响射速 —— **比值从 1.538 退化成 1，而脚本依然打印 `ok`**（它只做 JSON 输出、
    没有判定）。**任何"改消费点"的重构，都要回头检查读作旧路径的断言**；
    数值型断言一律带 `ok:Math.abs(实测-期望)<ε` 字段，别只打印。**
53. **新船体要改五处，漏哪处都不报错**（4.3）：`HULL_TINT` / `HULL_GEO` / `HULL_TAIL` /
    `TRAIL_RAMP` 四张表 + `hullPath()` 一个分支。
    **漏 `HULL_TINT`** → `HULL_TINT[id]||HULL_TINT.peregrine` 静默套用游隼配色（新船长成蓝色）；
    **漏 `hullPath` 分支** → 落进 `else`（peregrine 兜底），画成游隼形；
    **漏 `HULL_TAIL` / `TRAIL_RAMP`** → 尾流从船身中段喷出、配色借用游隼。
    `HULL_TAIL[id]` 必须等于 `-HULL_GEO[id].t`（尾部最负 x 坐标），已有断言锁死。
54. **`el.style.width` 会被浏览器归一化**：写入 `'50.0%'` 读回是 `'50%'` ——
    断言写 `w==='50.0%'` **永远为假**。一律 `parseFloat(w)===50`。
55. **背射弹的 `back` 标记是 falsy 陷阱**：源码写 `back:P.backMax||undefined`，
    `P.backMax=false` 时背射弹的 `back` 是 `undefined`，`!b.back` 把它也算成主弹 ——
    `filter(b=>!b.back).pop()` 拿到的是背射弹（4.3-08 据此算出 0.2559 的假偏差）。
    **测试里先把 `P.backMax=true` 再分辨主弹 / 背射弹。**
56. **船体数量是散落的硬编码**（加第 7 艘时四处要同步改）：机库数字键 `/^Digit[1-6]$/`、
    成就「全舰制霸」`goal:()=>6`、以及各断言脚本里的 `c.hulls===6`。
    ⚠️ **成就 id 一个字都别改**（`hull6` 保持原样，只改 `goal`/文案）——
    `nova-ach` 按 id 记已达成，改 id 会让老玩家丢档。
57. **"持续状态"型机制不要用"每发累加"**：蓄热若写成 `heat+=k`（每发），
    高射速构筑 1 秒烧穿，机制的"节奏取舍"就退化成"不许点射"，与堆射速的构筑意图相悖。
    改成 `heat+=HEAT_UP*dt`（**速率恒定、与射速解耦**）后，`updatePlayer` 每帧刷新倍率、
    `fireGun` 直接乘即可。**同类机制（充能 / 过热 / 连击衰减）都按速率写。**

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
| 2026-09-11 | **Phase 3.1 卡牌稀有度 / 升阶完成**。26 项 `MODULES` 加 `rarity` 字段（common 11 / rare 8 / epic 7，权重 1.00 / 0.45 / 0.18），分档原则是「越稀有越特化」而非「越稀有越强」。`rollChoices` 权重改为「稀有度 × 原能力型加权」相乘，新增伪随机补偿 `G.rarPity`（dry≥3 ×2.2 / dry≥5 ×4.0 / dry≥`PITY_HARD=6` 强制换一张 rare+）。卡面新增 `r-rare`（青边）/ `r-epic`（金边）+ `.tag.rar` 三档标签 + 升阶标记（`up` 类 + 「↑ 升阶 LVn」）。实测分布 63/26/12（能力型保底放大 rare+，属预期）。10 项断言全过，`audit-tokens.js` 全绿，`phase2-check.js` / `phase3-4-check.js` 无回归。回退点 `.workbuddy/backups/singularity-echo_phase3-1-pre.html`，截图 `.workbuddy/shots/phase3/3-1-*.png` |
| 2026-09-11 | **Phase 4.1 新敌型完成（Phase 4 首项）**。敌型 **20 → 24 种**，补上原设计的三个空位：**区域控制 / 玩家减益 / 召唤**。`sower` 播雷者（W15，每 1.0–1.8s 布雷、每只上限 6）/ `jammer` 干扰者（W18，绕玩家 260–340 公转，`jamR=230` 场内射速 ×0.65、极速 ×0.8）/ `brood` 孵育体（W22，孵 reaver，每巢 10 + 场上 70 双上限，场满暂停计时）/ `sunder` 裂解者（W25，接触撕掉固定 22 点护盾）。新增常量 `JAM_FIRE=0.65` / `JAM_SPD=0.8` / `SUNDER_STRIP=22` 与玩家字段 `P.jamT`（每帧续期 0.4s、离场自动解除），干扰与既有 `rateT`/`boostT` **乘性叠加**。`sunderShield()` 全复用 Phase 1 的「被挡」反馈档，零新增反馈语汇。**踩坑**：R4 动态白名单只扫 `ENEMY_DEFS` 本体 → 子表 + `Object.assign` 会报 8 条 R4 错（功能却是好的）；顺手修掉 `counts().enemies` 用 `ENEMY_DEFS.length`（对象 → 恒 `undefined`）的潜伏 bug。**12 项断言全过**，前 9 个 phase（共 101 项）**无回归**，`audit-tokens.js` 全绿。回退点 `.workbuddy/backups/index_*_phase4-1-post.html`，截图 `.workbuddy/shots/phase4/4-1-*.png` |
| 2026-09-11 | **Phase 4.2 新 Boss 完成**。巨像 **6 → 8 种**，两场均为无尽专属：**W35 静默方碑 MONOLITH**（干扰场开合节律：场开 4.2s 压射速 ×0.55 / 极速 ×0.72，场灭 2.6s 核心暴露受伤 ×1.5，狂暴后窗口缩到 1.8s）/ **W40 坍缩之核 COLLAPSE**（引力井：`GRAV_R=820` 内持续拉扯、终速 ≈205，`r×0.62` 事件视界 26dps 灼烧，狂暴后每 8s 倒转 2s 为斥力）。补上原 6 尊都没有的两种威胁形态 —— **场地压制**与**位移操控**。**干扰参数化**：4.1 的 `JAM_FIRE/JAM_SPD` 是常量，Boss 需要不同强度 → 新增 `P.jamF`/`P.jamS`（`P.jamT` 只管时长），施加者写入、消费点统一读，4.1 `jammer` 行为零改动。**剧本优先**：`buildWave` 改为 `BOSS_AT[n]\|\|(endless&&n%5===0?pick(...):null)`，否则无尽分支会把 W35/W40 覆盖掉。`st_c(a)` 取巨像分量色串，R4 零新增字面量。**踩坑**：① 无尽分支吃掉剧本 Boss；② `P.jamT` 衰减在 `updatePlayer` 里，只跑 `updateEnemies` 不会解除；③ 引力须在阻尼前施力且要有作用半径；④ `NOVA.lang` 在 `NOVA.death.lang` 下。**顺手修掉 4.1-08 静默失效**：参数化后该断言只写 `P.jamT`，比值 1.538→1 却仍打印 `ok`，已补三件套 + `ok` 硬断言。**14 项断言全过**，前 10 个 phase（共 113 项）**无回归**，`audit-tokens.js` 全绿。回退点 `.workbuddy/backups/index_*_phase4-2-post.html`，截图 `.workbuddy/shots/phase4/4-2-*.png` |
| 2026-09-11 | **Phase 4.3 新船体完成**。船体 **6 → 7**：第七船体 **「熔炉 FORGE」❖**（熔铜配色），解锁挂 **肃清第 40 波 · 击碎坍缩之核**，与 4.2 的 W40 巨像呼应（无尽 30 波后原先没有里程碑奖励）。**首个带"持续状态"的船体** —— 其余 6 艘都是一次性属性改写。**过热膛线**：持续开火热量 +30/s（满膛 3.3s），伤害在 **冷膛 0.85× ↔ 满膛 1.45×** 线性浮动，见顶**锁死炮膛 1.7s** 并强制散热归零；停火 −34/s。七个常量 `HEAT_MAX=100` / `HEAT_UP=30` / `HEAT_COOL=34` / `HEAT_LOCK=1.7` / `HEAT_VENT=HEAT_MAX/HEAT_LOCK` / `HEAT_COLD=0.85` / `HEAT_HOT=1.45`；**蓄热按速率而非每发累加**（与射速解耦，否则高射速构筑 1 秒烧穿、"节奏取舍"退化成"不许点射"）。新玩家字段 `P.heat`/`P.heatMul`/`P.heatLock`/`P.heatOn`，非熔炉船体 `heat` 恒 0、`heatMul` 恒 1（逐船断言零溢出）。HUD 新增过热槽 `#heatrow`（仅熔炉显示，满膛转朱砂警示色；`HUDC` 不自清 → 切状态即作废宽度缓存）。**四处全同步 + `hullPath` 新分支**（宽厚砧形 + 双侧散热鳍 + 方形炉尾喷口，`HULL_TAIL=15` 对齐 `-HULL_GEO.t`）。**联动四处**：机库数字键 `Digit[1-6]`→`[1-7]`、`HULL_EN`/`HULL_LOCK_EN`、成就「全舰制霸」`goal` 6→7（**id 保留以免丢档**）、`NOVA.counts().hulls` 自动 7。**16 项断言全过**，前 11 个 phase（共 129 项）**无回归**，`audit-tokens.js` 全绿。回退点 `.workbuddy/backups/index_*_phase4-3-pre.html`，截图 `.workbuddy/shots/phase4/4-3-*.png` |
| 2026-09-11 | **Phase 3.4 成就树完成（Phase 3 首项）**。
| 2026-09-11 | **Phase 3.2 协同扩展完成**。
| 2026-09-11 | **Phase 3.5 局外解锁树完成（Phase 3 收官）**。**Stardust 星尘**：每局结算按 `1+⌊score/1500⌋+⌊kills/60⌋` 入账，连败也有进展感。**13 节点 / 4 支线 + 根**（生存 hp→sh / 火力 dmg→crit / 机动 spd→turn / 战术 lv→premod），画布 672×642，**画布规格独立于 3.4 成就树**（1008×688）避免互相覆盖。**`nova-meta` 存储**：`{dust, unlocked}`；旧档无键走 `{0, ['mroot']}` 默认值兜底，**零新存储键破坏兼容性**。**四档守卫** `no-node` / `already` / `req` / `dust`，全部返回 `{ok,reason}` 不抛异常。**三态视觉**沿用 3.4 `lbnode` 语汇（暗轮廓 < 青边青底 ready < 金边金底 done）。`applyMetaBonuses` 在 `hull.apply()` 之后立刻生效（`startGame` 内），**支持任意前缀组合**；`premod` 故意不注册进 `G.build`（避开「零模块」反成就 + `ABILITY_CAP`）。**3.5c 结算可见化**：3.5 算了 `G.lastDust` 但面板零展示 → 核心循环对玩家隐形。新增 `renderDust(node,earn)` 给坠毁 / 通关面板各加琥珀色 `星尘产出 +N \| 可用 M \| 于「解锁星图」消费` 行；`applyI18n` 切语言时一并重绘杜绝中英混排。**测试钩子** `NOVA.meta.{tree,load,save,has,state,unlock,earn,earnFor,reset,grant,draw,fit}` 12 个。**17 项断言全过**（1-14 数据 + UI + 回归 / 15-17 3.5c 结算可见化），前 8 个 phase（2/2-3/2-4/2-5/3-4/3-1/3-2/3-3 共 90 项）**无回归**。`audit-tokens.js` 全绿。回退点 `.workbuddy/backups/index_*_phase3-5-post.html`，截图 `.workbuddy/shots/phase3/3-5-*.png` |
| 2026-09-11 | **Phase 3.3 每日挑战完成**。**RNG 种子化**：抽 `RND={on,s}` + `mulberry32` + `setSeed/clearSeed`，`rand/irand/pick/shuffle` 这 4 个顶层随机函数走 `srand01()`；默认行为与旧版完全一致，种子化后所有 VFX/微观判定仍走 `Math.random`（**29 处调用中无需改 1 行**，4 个函数兜底）。**规则池 4 条**：`startLoader` / `startAegis` / `swiftStar` / `noRepair`；`pickDailyRules` 用 `setSeed + shuffle` 选 2 条；`dailySeed` = `YYYYMMDD` FNV-1a 哈希成 32-bit。`rollChoices` 尊重 `G.noRepair`；`startDaily` 用 `G.dailyMode` 保护 `G.daily` 不被 `startGame` 重置（顺序坑）。**菜单 btnDaily + menuDaily 面板**（日期 / 今日规则 / 今日最佳）；**死亡面板 daily-badge**（日期 + 规则名）。**`nova-daily` 存储**：`commitDaily` 按「更高分覆盖」写 `{date:{score,wave,kills,rules}}`。12 项断言全过，`audit-tokens.js` 全绿，前 7 个 phase（2 / 2-3 / 2-4 / 2-5 / 3-4 / 3-1 / 3-2 共 73 项）**无回归**。回退点 `.workbuddy/backups/singularity-echo_phase3-3-pre.html` + `index_*_phase3-3-post.html`；截图 `.workbuddy/shots/phase3/3-3-*.png` |`SYN` 12 → **22 条**，并把原本 9 条「空 `apply()`」全部改成真实生效的一次性属性变更（旧表只在 UI 标亮、运行时零效果）。**新增 10 条优先补「孤儿卡」联动**：twin / pierce / ricochet / frag / guided 五张旧表一条协同都没有，现在两两配对都连得上（详见 §4 3.2 表格）。零基字段乘法协同静默失效这条坑一并修掉：抽常量表 `FRAG_LV`，新增 `splashBoost(rMul,dMul)` 用一级值播种再乘。**`P.mine`/`P.nova`/`P.blink` 是表下标不可动**这条警告固化为注释 + 断言 `audit()` 检查项。10 项断言全过（含「22 条 apply 在初始 `P` 上必须至少改 1 个字段」与下标安全），`audit-tokens.js` 全绿，`phase2-check` / `phase2-3-check` / `phase2-5-check` / `phase3-4-check` / `phase3-1-check` 无回归。回退点 `.workbuddy/backups/index_*_phase3-2-pre.html`，截图 `.workbuddy/shots/phase3/3-2-*.png` |占位 7 节点 → **18 节点 / 22 连线**（画布 1008×688，坐标手写）：四条支线（击坠 100→4000 / 波次 5→35 / 时长 10min→5h / 技巧「3 船·6 船·零模块·无伤」）+ 汇总节点 `dependsOn` 6 项聚合。**统计 schema 5 → 8 字段**（`hulls` 船体数组 / `nomod` / `flaw`，旧档默认值兜底，**零新存储键**）。三态视觉（暗轮廓 < 蓝边蓝底 < 金边金底）+ 2px 进度条 + 「前置 5/6」聚合读数。达成瞬间弹窗（`achCheck`/`achTick`，banner+音效+金环，2.2s 冷却，**旧档首开静默补记不刷屏**）。`fitAch` 缩放下限 0.34。12 项断言全过，`audit-tokens.js` 全绿，`phase2-check.js` / `phase2-3-check.js` 无回归。回退点 `.workbuddy/backups/singularity-echo_phase3-4-pre.html`，截图 `.workbuddy/shots/phase3/3-4-*.png` |

---

## 10. 杂项待办（非阻塞）

- `singularity-echo/` 下有 8 张 `bg-prototype` 时期的旧截图（`_bg*.png`，约 4.5MB），可清理
- `bg-prototype.html` 停在 v6 搁置；恢复顺序：**先降速**（现 62s → 目标 110–150s，做成可调参数），
  再调光质；**不要靠继续堆图层**
- `BOSS_STYLE.fill` 与敌方机体 `fill` 暗色仍待换（面积小、优先级低）；粒子 `cols`、字距（19 种）待归并
