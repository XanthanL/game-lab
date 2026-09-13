# 奇点回响 · 开发规划与交接指南

> **这份文档是给下一个会话的执行手册。** 不依赖任何对话上下文，读完就能开工。
> 行号基于 2026-09-12 的 `index.html`（**10641 行 / 603 KB**）实测，**会漂**，以函数名为锚点。
> 详细背景见 `ROADMAP.md`（六阶段路线图）、`DESIGN-SYSTEM.md`（token 与方向）、
> `.impeccable.md`（设计上下文）。本文是它们的**进度与执行层**，不是替代品。

---

## 0. 当前状态速览（2026-09-12 核对）

| 阶段 | 状态 | 说明 |
|---|---|---|
| Phase 0 风格锚定 | ✅ 完成 | 含 A（等价 token 化）+ B（换方向）+ B.1（配色修订） |
| Phase 1 战斗反馈 | ✅ 完成 | 伤害飘字 / 命中音效 / 击杀出口 / 拾取反馈 |
| **Phase 2 引导与信息** | ✅ **完成** | 2.1 / 2.2 / 2.3 / 2.4 / 2.5 全部落地 |
| **Phase 3 构筑深度** | ✅ **完成** | **3.4 + 3.1 + 3.2 + 3.3 + 3.5 全部完成**（详见 §4） |
| **Phase 4 内容扩充** | ✅ **完成** | **4.1 新敌型 + 4.2 新 Boss + 4.3 新船体 + 4.3b 星图改版 + 4.4 新武器行为 + 4.5 无尽机制**（敌型 20→24 · 巨像 6→8 · 船体 6→7 · 模块 26→29 · 协同 22→26 · 无尽加轮换袋与强化层） |
| Phase 5 平台打磨 | ✅ **完成** | **5.1 键位重绑定 + 5.2 手柄支持 + 5.3 设置面板补完 + 5.4 性能 + 5.5 移动端专项 + 5.6 分享卡片 / 排行榜 / 截图**（可改键；手柄全程可达；画质四档 / 四个特效开关 / 色盲两档 / 减弱动态；**特效预算随档位收缩，绘制调用 100%→85%→63%**；**虚拟摇杆改模拟量 + 死区 + 下拉刹车 + 拖远重锚**，安全区与横竖屏；**本机 Top10 排行榜 + 1200×630 成绩卡 + 局内截图**） |

**当前代码健康度（已实测）**：JS 语法 OK · `audit-tokens.js` 全绿 · 无残留临时文件。
| **Phase 6 长线留存与可分享性** | ✅ **完成（6.1–6.6 全部落地 · Phase 6 收官）** | 6.1 种子 + URL 直达；6.2 三档难度；6.3 五个 Modifier 最多叠 3；6.4 29 模块禁 8；6.5 每局 10Hz 录飞行轨迹、影子同时间轴并排跑、按指纹分组存最佳最多 6 组；**6.6 把种子 + 难度 + 挑战 + 卡池 + 前 90s 轨迹压成 ~1.8K 短码塞进 `#g=`，别人点开同地图 + 一只你的影子陪着飞（不需要后端、不依赖微信）** |

| **Phase 7 限时冲刺** | ✅ **完成（7.1 + 7.2）** | **7.1 冲刺赛 Time Attack**：3 分钟倒计时冲波次，固定 standard / 无 Modifier / 无禁用；倒计时只在 play·inter 衰减，归零即 `die()`；`taSettle()` 走独立结算（**不写 nova-best / 不 commitDaily / 不出星尘**），独立榜单 `nova-tattack` Top10。**7.2 闭环**：TA 开局自动落种子（`gcodeMine()` 首行判 `!G.seed`，菜单进 TA 不带种子 → **实测出不了码**，TA 的分享玩法整个是死的）+ 轨迹码按模式取值（普通局 5Hz×90s · **TA 4Hz×180s 覆盖整局**）+ `gcodeDec` 改读头部 hz（老码天然向后兼容）。**7.3 分享闭环**：码的头部加一个标志位（bit0 = 冲刺赛，`GCODE_VER` 升到 2、v1 老码照收），收端 `gcodeTake` 置 `G.taMode` —— 之前对方点开是**普通漂移**，「3 分钟跟我比」这个语境全丢（全新实例实测）。**7.4 模式边界**：`G.taMode` 补复位点（`toMenu` / `resumeRun`）—— 之前打完一局 TA 后它**永远为真，之后每一局普通漂移都被当成 3 分钟限时**（分数还不进 nova-best）；TA 局不再写续档存档（原先会冲掉玩家正在打的普通局存档）；机库如实标注「本局固定标准 / 无挑战 / 全卡池」且影子指纹按实际生效值取。让 6.5 影子 + 6.6 轨迹码从「锦上添花」变成核心机制 |

**下一步建议**：7.1–7.4 已落地。剩候选 **平台适配层 PAL（微信小游戏移植的前置）/ 难度档再扩一档 / TA 再开一档时长**。PAL 越早做越便宜（现在 60+ 处 localStorage，见 ROADMAP「移植硬约束」表）。
> ⚠️ **发行目标由作者定，不是我替他定。** 作者是**个人开发者、无商业预算**，
> 首选 **微信小游戏（个人主体 · 免版号）**，不是 Steam（$100 上架费）。
> 别再往文档里写任何付费商店的包装计划。
`index.html` 现 **11295 行 / 631 KB**（含 4.1 四种新敌型 + 4.2 两尊新巨像 + 4.3 第七船体
「熔炉」+ 4.3b 两张星图的纵向版式与缩放引擎 + 4.4 三个新武器行为模块 + 4.5 无尽轮换袋 / 强化层
+ 5.1 键位表与设置面板的改绑 UI + 5.2 手柄轮询 / 死区映射 / 面板导航
+ 5.3 画质档 / 特效开关 / 色盲重映射 / 减弱动态
+ 5.4 `QB` 三档特效预算表 / 降档即砍存量 / 后处理与星场分档 / 绘制调用计数探针
+ 5.5 虚拟摇杆 `JOY_*` 参数组 / `joyRead()` 死区重映射 / 下拉刹车 / 拖远重锚 / `--safe-*` 安全区 / 竖屏提示
+ 5.6 `nova-board` 本机 Top10 排行榜 / `shareCard()` 离屏成绩卡 / `grabShot()` 主画布截图
+ 6.1 种子面板 / `seedCode()` base36 / `seedAt()` 键控重播种 / `Math.random()` 仅战斗层
+ 6.2 `DIFFS` 系数表 / `diffNow()` / `addScore()` 单入口 / `?diff` 难度标 / 解锁门槛
+ 6.3 `RMODS` Modifier 表 / `modNow()` / `scoreMul()` / `applyRmods()` 船体上限倍率后置
+ 6.4 `POOL_KEY` / `poolLoad/Save` / `G.ban` 局内冻结 / `rollChoices` 池内过滤 / `#poolRow` 工坊条 29 个 chip
+ 6.5 `GHOST_KEY` / `GHOST_DT0=0.1` 10Hz 采样 / `ghostPush` 抽稀 dt 翻倍游标同步折半 / `ghostAt` 最短弧角度插值 / `drawGhostRun` 钢蓝虚线影子 + 220 段航迹 + 终点标记 / `renderGhostRow` 机库状态行 + 清除键 / `OPTS.ghost` 实时开关 / `GHOST_SLOTS=6` LRU 淘汰。
+ 6.6 `gcodeEnc/Dec` 差分 + zigzag varint（**3.01B/点已是该编码的最优下界**，由探针 probe66.js 实测） / `gcodeTake` 注入外来影子只在本局生效不写库 / `seedFromUrl` 扩展解析 `#g=` / 结算面板「LINK ▸ 轨迹链接」按钮 + 完整链接 textarea / `gcodeShare` 三层兜底（clipboard API → `execCommand` → **把链接摆出来让玩家手动复制**）。
+ 7.1 `TA_SEC=180` / `TA_KEY='nova-tattack'` / `TA_MAX=10` / `TA_BOARD` / `taBoardLoad|Save|Add|Clear` / `taTick` 倒计时（只在 play·inter 衰减）/ `taSettle` 独立结算（不写 nova-best · 不 commitDaily · 不出星尘）/ `taHudPaint` HUD 读数（≤10s 转朱砂）/ `boardRec` 增 `m:3` / `bdMode` 增「限时 TIME」/ 菜单 `TIME ▸ 限时冲刺` 按钮 / HUD `#tatime`。
+ 7.2 `GCODE_TA_HZ=4` / `GCODE_TA_SEC=180` / `GCODE_TA_MAX=720` / `GCODE_CAP` / `gcodeHz|Sec|Max()` 按模式取值 / `startGame` 加 TA 自动落种子分支 / `taSettle` 改 `setSeedLine(el.overSeed)` / `gcodeDec` 的 `dt` 改读头部 hz。
+ 7.3 `GCODE_VER=2`（头部第 2 字节为标志位，bit0 = 冲刺赛）/ `gcodeDec` 按 `b[0]` 分支兼容 v1 / `gcodeTake` 置 `G.taMode` / `seedFromUrl` 在 TA 码开局后补一条 `TIME ATTACK` 横幅 / 分享横幅区分 `SPRINT LINK` 与 `TRACK LINK`。
+ 7.4 `toMenu()` 与 `resumeRun()` 复位 `G.taMode` / `saveRun()` 加 `if(G.taMode)return;`（不写续档存档）/ `ghostFpMenu()` 在 TA 下返回 `standard|-|-` / 机库 `#taNotice` 说明行 + `.tafreeze` 三行变灰不可点。

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
| `.workbuddy/shots/phase4-3b-check.js` | **星图改版 17 项**（纵向：每个子节点都在父节点下方 / 响应式列数 4↔2 / 视窗内无重叠无出界 / **默认缩放桌面 ≥0.9、手机 ≥0.85** / 连线纵向走列中线 / 按钮缩放与上下限夹取 / 滚轮缩放 / 双指捏合 / 缩放锚点漂移 <1px / 平移夹取边界 / 解锁树同样可平移 / 缩放按钮不随内容缩放 / 点击解锁链路 / 中英提示都含「双指」/ 竖屏无横向溢出 / 数据规模回归） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase4-3b-shots.js` | 留档截图：桌面成就星图 / 放大 1.8× / 桌面解锁星图 / 竖屏成就 / 竖屏解锁 | 人工 |
| `.workbuddy/shots/phase4-4-check.js` | **新武器行为 16 项**（三卡数据完整性 / 协同非空且两端合法 / 散射弹数与张角 / 散射弹伤害系数 / **裂变弹片数 + 弹片不二次分裂** / 弹片伤害系数 / 口径三字段 + **与制导的绝对赋值顺序无关** / 零新卡时弹丸与旧版一致 / 26 张旧卡零污染 / 等级表对齐 / **offer 位置翻转** / **封顶时机模拟** / 新卡进池 / 数据规模回归 / 英文 / 满配实机弹幕有界） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase4-4-shots.js` | 留档截图：三张新卡卡面 / 散射实机扇面 / 裂变实机弹片环 / 竖屏卡面 | 人工 |
| `.workbuddy/shots/phase4-5-check.js` | **无尽机制 11 项**（分层常量与边界 / **Boss 轮换 4000 次抽取零连续重复 + 16 窗无饥饿** / 精英巨像轮换 / **存档往返续档不撞车** / 强化层真加在敌人身上 / 额外敌人上限 38→48 / **前 40 波倍率恒等零回归** / 真跑 41→100 / HUD 与横幅中英后缀 / 数据规模回归 / 手机端） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase4-5-shots.js` | 留档截图：HUD 强化层读数 / 巨像横幅后缀 / 英文 AMP / 竖屏 | 人工 |
| `.workbuddy/shots/phase5-1-check.js` | **键位重绑定 14 项**（默认表与旧硬编码逐一对齐 / 改绑后真跑 `updatePlayer` 旧键失效新键生效 / 开火双槽位 / **撞车自动清空旧绑定** / 写盘重载后仍在 / 恢复默认 / **坏存档兜底** / 12 行槽位与等待态 / **捕获期不派发游戏逻辑** / HUD 提示跟随 / 中英 / 数据规模回归 / 竖屏不溢出 / 引导文案跟随键位） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase5-1-shots.js` | 留档截图：桌面默认键位 / 等待按键（朱砂槽位）/ 英文 / 竖屏 | 人工 |
| `.workbuddy/shots/phase5-2-check.js` | **手柄 14 项**（死区重映射与径向归一化 / 模拟量转向量 / 摇杆推进与 LT·LB 减速 / A·RT·RB 开火 / 边沿只在按下帧 / START·Select·B 与键鼠语义对齐 / 选卡 `.padsel` / 机库选船 / 通用按钮导航 / 各面板返回 / **拔掉零残留** / 连接提示只弹一次 / 数据规模回归 / 竖屏） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase5-2-shots.js` | 留档截图：连接横幅 / 卡牌手柄选中 / 机库手柄选中 / 竖屏焦点 | 人工 |
| `.workbuddy/shots/phase5-3-check.js` | **设置面板 14 项**（默认值与表定义 / 持久化与坏档兜底 / 画质四档 / **手动画质锁死不自动降** / 四个特效开关 / 减弱动态 / 色盲 token 覆盖与逐条还原 / PAL 重读与中性色不动 / **CVD 模拟三对关键色分离度 ≥90（基础配色必须不过线）** / 敌方弹丸走 token / 中英 / 手柄可达 / 数据规模回归 / 竖屏不出界） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase5-4-check.js` | **性能 12 项**（预算表八项三档严格单调 / **降档同 tick 砍存量** / 粒子·残骸入口上限随档 / 残影·电弧·碎片·飘字 trim 后不超档 / **绘制调用数 100%→85%→63% 单调递减** / bloom 只在高档的 A/B 差值 / 看门狗降档预算同步 / DPR 与星场层数 / 低档照样打得死人 / 5.1·5.2·5.3 回归 / 竖屏） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase5-5-check.js` | **移动端 12 项**（**模拟量转向：推杆幅度→转角严格递增** / 死区内抖动不转船 / **下拉是刹车不是推进** / 手指拖远时底盘重锚且满舵不跳变 / 安全区变量链路与 FIRE 的 calc 避让 / 竖屏提示出现·点击永久忽略·横屏不出现 / 中英 / **真鼠标按下切回键鼠** / 键鼠·手柄转向无回归 / 竖横屏都不出界 / 触屏下能击杀 / 5.1·5.3·5.4 无回归） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase6-2-check.js` | **难度档 14 项**（三档系数表严格单调且标准档=1 / 敌人三围随档递增 / **同样 20 点伤害三档扣血不同** / 每波数量递增 / 得分系数 0.8·1·1.4 / **开局后改选择不改本局数值** / 解锁门槛 / 刷新后读回 / 机库三档可选且当前高亮 / **每日挑战固定标准档** / 记录·卡片·榜单带难度 / 中英 / 6.1 与 5.x 无回归 / 竖屏） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase6-3-check.js` | **自定义挑战 19 项**（5 个 Modifier 数据表与上限 3 / 蜂群 数量×1.45 单体血×0.8 / 铁壁 血×1.7 速×0.85 / 疾风 速×1.35 伤×1.15 / 荒芜 补给间隔最小采样 ×2.2 / 脆命 船体上限 ×0.5 / **组合相乘而非覆盖** / **得分加成累加不连乘** 与难度档相乘 / 最多选 3 / **开局后冻结本局** / 历史最佳波次解锁门槛 / localStorage 持久化 / **每日挑战强制清空** / 记录·榜单·卡片带标记 / 像素差证明卡片真的画了 / 机库 UI 选中与倍率文案 / 中英 / 6.1·6.2 无回归 / 竖屏不出界） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase6-4-check.js` | **卡池工坊 14 项**（29 个模块 · 最多禁用 8 · **禁用后 50 次采样 0 次出现** / 禁 8 个仍能凑齐 3 张不塌成 REPAIR / 选 10 个只留前 8 / **开局后冻结本局** / localStorage 持久化 / **每日挑战强制清空** / 记录·榜单·卡片带「工坊 xN」标记 / 像素差证明卡片真画了 / 机库 UI 选中 + 上限变色 + 顺序按 MODULES 定义序 / 中英 / 6.1·6.2·6.3 + 难度/挑战/工坊三套并存 无回归 / 竖屏不出界） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase6-5-check.js` | **幽灵回放 18 项**（含 6.2/6.3/6.4 续档还原 fix） |
| `.workbuddy/shots/phase6-6-check.js` | **轨迹码 14 项**（5Hz × 90s = 450 点 · 位置量化 4px · 朝向 256 级 / 差分+varint 编码极限 3.01B/点 / 全字段往返 + 精度误差 ≤2px 与 ≤1/256 圈 / 上限 450 点 / 无种子不产码 / `#g=` URL 直达带影子开局 / 坏码与截断码一律 null 不炸 / 结算面板 UI 给出完整链接 / 随机局不出轨迹链接按钮 / 中英文「来自链接」/ 6.1·6.5·5.6 钩子不破 / 390px 不撑破） |（常量表 CAP 3600 · SLOTS 6 · MIN 40 · DT0 0.1 / 空开局机库 1 元素 / `runT 0→1.0` 录 11 点 · 首点精度正确 / 3700 点抽稀 dt 翻倍 gn≈1900 len=gn×3 / 插值中点=50 越末点 null / 角度走最短弧不穿 0 / 归档首存·低分不覆盖·高分覆盖 / 指纹分组互不覆盖 / 写满 7 组仍 6 组 LRU 淘汰最旧 / 开关实时 / 老存档无键仍默认开 / 刷新读回 / 机库 2 元素点清除→1 元素 / 中英文案 / 跑一段无 pageerror · 含越过终点分支 / 6.1·6.2·6.3·6.4 钩子不破 / 390px 不溢出） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase7-check.js` | **冲刺赛 13 项**（常量 180s / Top10 / **开局冻结 standard·无 Modifier·无禁用** / 倒计时 play 减·levelup·dying 不动 / 归零自动 `die()` / **不写 nova-best** / 不 commitDaily / 榜单 wave 降序平局按剩余秒升序 / HUD 读数 ≤10s 变红 / 结算面板 TA 分支 / `boardRec.m=3` + `bdMode` TIME / 中英 / 6.x·5.x 钩子不破 / 390px 不撑破） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase7-2-check.js` | **冲刺赛闭环 12 项**（常量两档 / **TA 自动落种子** / 三连开种子互不相同 / 手填种子不被覆盖 / TA 码 720 点且比普通局长 / 解码 `dt` 跟随头部 / **老码头里 hz=20 仍按 5Hz 解（向后兼容）** / 结算显示种子 / 轨迹链接按钮已显示 / 解出轨迹跨满 180s / 随机局仍不出码 / 390px 不撑破） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase7-3-check.js` | **冲刺赛分享闭环 11 项**（`GCODE_VER=2` / TA 码带 ta 标志而普通码不带 / **乙方全新实例点开 → 真进 3 分钟冲刺**（倒计时 180 · 同地图 · 影子 720 点 dt=0.25 · HUD 显示 · standard 无挑战无禁用）/ 普通链接不会把人拽进 TA / **v1 老码照解且 ta=false** / ver 0·3·9 一律 null / 横幅区分 SPRINT·TRACK / 乙方开局 TIME ATTACK 交代 / 标志位只 +1 字节 / 6.6 往返与 6.5·6.1 钩子不破 / 390px 不撑破） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase7-4-check.js` | **冲刺赛模式边界 10 项**（回主菜单复位 / **打完 TA 后普通漂移不再是限时赛** / 普通局分数回到 nova-best / 续档一律普通 / **TA 局不写续档存档而普通局照写** / 机库三行冻结 + 说明行 / **机库影子指纹 == 开局实际指纹** / 中英 / TA 本身未被复位搞坏 / 390px 不撑破） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase6-1-check.js` | **种子 14 项**（短码往返含大小写·空格·非法码 / **编队确定性且不受战斗推流影响** / 选卡干净流·脏流都确定 / 精英·词缀·掉落确定 / 菜单→面板→机库→开局全流程 / 暂停与结算显示种子 / 随机局不显示 / 每日显示日期而非码 / **URL `?seed=` 直达** / 成绩卡有无种子两张图不同（像素级证明真画上去了） / 榜单记录与行文本带码 / 中英 / 5.1–5.6 无回归 / 竖屏不出界） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase5-6-check.js` | **分享 / 榜 / 截图 13 项**（排序与 Top10 截断 / 名次返回值含「挤不进返 0」/ **刷新后读回存档** / 清空 / 面板渲染与本局高亮 / 从菜单开·关不串面板 / **坠毁与通关各自进榜** / 卡片 1200×630 且**颜色跟随色盲 token** / 主画布截图有实际内容 / 中英 / 5.1·5.4·5.5 无回归 / 竖屏不出界） | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase5-3-shots.js` | 留档截图：设置面板两节 / 对局色盲红绿档 / 对局色盲蓝黄档 / 竖屏 | 人工 |
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

#### ✅ 4.3b 星图改版 · 纵向版式 + 真缩放（已完成 2026-09-12）

**起因（用户原话）**：「那些星图，我希望是从上往下的，然后也不要太小，现在这些地方太小了，
手机电脑都是根本无法放大查看的。」—— 三个诉求：**纵向排布** / **别太小** / **能放大看**。

**量化定位（先测再改，不猜）**

| | 改版前 | 改版后 |
|---|---|---|
| 桌面默认缩放 | **0.447×**（内容 1008×688 塞进 490×298 的框） | **1.0×**（内容 654×572，4 列） |
| 手机默认缩放 | **0.34×**（撞 `ZOOM_MIN` 地板） | **0.9245×**（内容 318×988，2 列） |
| 版式 | 左→右（根在左，支线横排） | **上→下**（根居中置顶，支线成列向下，汇总居中置底） |
| 缩放 | **只有拖拽平移**，提示却写着「滚轮缩放」（从未实现） | 滚轮 / 双指 / −+⤢ 按钮，0.4–2.5，锚定指针 |

**数据层：坐标不再手写**

18 个 `ACH` 节点 + 13 个 `META` 节点全部从 `x:…,y:…` 改成语义槽位
**`br`（第几支）+ `dp`（第几层）**，根节点 `anchor:'top'`、汇总节点 `anchor:'bottom'`。
版式仍然是设计出来的（支线分组与层级顺序由 `br`/`dp` 定死），
但「横向塞不下就把整棵树压扁」这件事交给了列数与缩放，**不再压字**。

> ⚠️ **字段名叫 `br`/`dp` 而不是 `b`/`d`**：每个节点本来就有一个 `d` 字段存中文描述
> （`de` 才是英文），先用了 `d` 当层号 → 被 `d:'累计击坠 100'` 覆盖成字符串 → `y` 变 `NaN`
> → 12 个节点全叠在一处。

**引擎层：两树共用一套**

| 函数 | 职责 |
|---|---|
| `treeLayout(list,cols,branch,depth,layout)` | 按列数算 x/y 与画布尺寸；`cols = min(branch, 传入列数)` |
| `layoutAch(cols)` / `layoutMeta(cols)` | 各自包装，回写 `ACH_W/H`、`META_W/H` 与 `ACH_LC`/`META_LC` |
| `achCols()` / `metaCols()` | 响应式列数：`clientWidth>=560 ? 4 : 2` |
| `tfOf` / `applyTf` | 变换状态存在 wrap 的 `dataset`（tx/ty/sc），不解析 transform 字符串 |
| `clampPan(w)` | 内容比视窗大 → 夹在「恰好贴边」；比视窗小 → 居中（不夹会一拖就再也拉不回来） |
| `zoomAt(w,next,cx,cy)` | **三条缩放入口唯一通道**：把指针下那一点钉在原位（实测漂移 0.36px） |
| `fitTree(w,cw,ch)` | 默认视点**只按宽度铺满**（`clamp(bw/cw, 0.4, 1)`），纵向放不下就滚 —— 不再为了塞进小框压字 |

常量：`ZOOM_MIN=0.4` / `ZOOM_MAX=2.5` / `ZOOM_STEP=1.18`；
`ACH_COL=168` / `ACH_ROW=104`（节点 150×52 → 横留 18、纵留 52）。

**容器与文案**

- `#logbook .panel` 宽 `min(94vw,720px)`（原来只有 `max-width`，flex 把它压到 552px）
- `.lb-tree` 高 `min(46vh,300px)` → **`min(64vh,580px)`**，`min-height` 210 → 260
- 画布尺寸从 CSS 挪到 JS 写（列数会变，写死 1008×688 必然错位）
- 新增 `.lb-zoom` 按钮条（`−` / `+` / `⤢`），**挂在 `.lb-tree-wrap` 外面** —— 放里面会跟着
  一起缩放平移（已断言：缩放前后按钮屏幕坐标与宽度不变）
- 提示文案改「拖拽浏览 · 滚轮 / 双指缩放」/「点击节点解锁 · 拖拽 / 双指缩放」，
  新增 `lb_tree_hint2` 词条（英文 `Tap a node to unlock · drag / pinch to zoom`）
- 连线改纵向走列中线：`x1=x2=cx(n)`，`y1=p.y+ACH_NODE_H → y2=a.y`（断言：22 条线非向下 = 0）

**顺手修掉两个真实 bug**

1. **切语言时星图不重绘**：`setLang` 会重画菜单 / 卡牌 / 模块条，偏偏漏了日志里的两张树 ——
   节点文案是绘制时写死的，语言切了树还停在旧语言（现在 `setLang` 补 `drawLogbook()+fitAch()+fitMeta()`）。
2. **`hull6` 汇总永远差一个**：4.3 把「全舰制霸」目标改成 7 之后，3.4 的满达成断言仍喂 6 船
   → 汇总节点停在「前置 5/6」。已把断言数据补到 7 船（现在 18/18 全达成）。

**验证**：17 项新断言（`phase4-3b-check.js`）**全过**；
13 套历史脚本（2 / 2-3 / 2-4 / 2-5 / 3-1 / 3-2 / 3-3 / 3-4 / 3-5 / 4-1 / 4-2 / 4-3 / 4-3b）
**共 163 项无 ERR / 无 FAIL**；`audit-tokens.js` 全绿（51 hex + 30 rgb）。
回退点 `.workbuddy/backups/index_*_phase4-3b-post.html`，
截图 `.workbuddy/shots/phase4/4-3b-s1…s5-*.png`。

---

#### ✅ 4.4 新武器行为（已完成 2026-09-12）

原计划两条：① 加进 `MODULES`；② 检查 `rollChoices` 的 ability/stat 加权是否失衡。
**两条都先量后改** —— 加权那条量出来的偏差比预想大。

**① 加权失衡（300 局 × 40 级模拟实测）**

| 指标 | 修正前 | 修正后 |
|---|---|---|
| 能力型摸到 6 种上限 | 第 **12.2** 次升级 | 11.4 |
| 数值型摸到 6 种上限 | 第 **24.2** 次升级 | **18.4** |
| 40 级内摸满数值上限 | **274/300** 局 | **200/200** 局 |
| 两类都封顶后，能力型占 offer | **66.3%** | **33.3%** |
| `abilityBoost` 峰值 | **8.26×** | ≤ **1.9×** |

两个问题：

- **三张牌的位置恒为「2 能力 + 1 数值」**。能力型 16 种、数值型 10 种，2:1 让能力型早一倍封顶；
  而两类都封顶后池里只剩「给已有模块升等级」，2:1 已经没有任何依据，纯属惯性。
  → 改为 **能力型封顶后翻转成「1 能力 + 2 数值」**（`abSlots=capped?1:2`）。
- **`abilityBoost=1+能力型总等级×0.22`** 随等级线性发散到 8.26×。而它对能力池内部是
  **统一乘数**，根本改变不了池内排序，唯一作用是把「数值池空了、用能力补第三张」的概率推到 1
  —— 一个没有设计含义的隐藏偏向。→ 改成按**已持有的能力型种类数**，天然夹在 1.9 以内。

**② 三张新卡（26 → 29）**

选卡标准是「真正改变**弹丸本身**的行为，而不是再加一条数值」；并且刻意做了
**2 张能力型 + 1 张数值型** —— 新武器行为天然是能力型，会让 16:10 的能力偏向更严重，
所以补一张纯数值的武器卡（此前武器维度里一张数值卡都没有）。

| 卡 | 档位 | 类型 | 行为 |
|---|---|---|---|
| **散射喷嘴 SPRAY** ⋔ | rare | ability | 每次齐射额外喷出扇形弹（2→6 发），单发伤害 62%→100%，**扇形张角随等级收束**（0.34→0.24） |
| **裂变弹芯 SPLIT** ⁂ | epic | ability | 子弹**首次命中**炸成一圈弹片（2→8 枚，45%→85%）；弹片 `sp=0` 不再二次分裂 |
| **口径校准 CALIBER** ◎ | rare | **stat** | 弹丸半径 +1.0/级、弹速 +8%、射程 +10%（纯数值，武器维度唯一的数值卡） |

关键实现决策：

- **两张等级表抽成常量** `SPRAY_LV` / `SPLIT_LV`（与既有 `FRAG_LV` 同构）—— 续档是按
  `k=1..n` 逐级重放的，写成增量累加会随重放次数发散。
- **裂变只裂一次、且只裂在首次命中**：`b.sp` 用完置 0。高穿透构筑因此是「一路穿过去，
  沿途各炸一次」，而不是越打越多。**弹片绝不做二次分裂** —— 8 枚各再裂 8 枚在高射速下
  会把弹幕数炸到数百（满配实测峰值 33，可控）。
- **射程走独立的 `P.rangeMul`，不直接乘 `P.rangeLife`**：制导弹药 `guided` 的 apply 是
  **绝对值赋值**（`P.rangeLife=1.15*1.2`…），谁后跑谁覆盖 —— 乘在 `rangeLife` 上会静默失效。
  已断言两种装配顺序下同为 1.518。
- **新协同 4 条**（`fan_guided` / `fan_barrel` / `shard_pierce` / `shard_blast`），
  三张新卡立刻各配两条，不留孤儿卡。
  ⚠️ **数值型不能挂协同** —— 原本给 `caliber` 配了两条，被 `NOVA.syn.badDeps` 判坏
  （规则：协同只在能力型 × 能力型之间）。口径作为纯数值卡，与其余 10 张数值卡一致不参与联动。

**验证**：`phase4-4-check.js` **16 项全过**；
14 套脚本（2 / 2-3 / 2-4 / 2-5 / 3-1 / 3-2 / 3-3 / 3-4 / 3-5 / 4-1 / 4-2 / 4-3 / 4-3b / 4-4）
**共 179 项无 ERR / 无 FAIL**；`audit-tokens.js` 全绿。
回退点 `.workbuddy/backups/index_*_phase4-4-pre.html`，
截图 `.workbuddy/shots/phase4/4-4-s1…s4-*.png`。

**验收**：新增内容不破坏 Phase 1 的反馈出口与 Phase 0 的视觉 token。

---

#### ✅ 4.5 无尽模式专属机制（已完成 2026-09-12）

Phase 4 收官项。原计划两条：① 30 波后 Boss 不重复随机；② 加专属强化层。
**两条都先量后改** —— 量出来的问题比预想严重。

**① Boss 轮换（200 局 × 41–100 波实测）**

| 指标 | 修前 | 修后 |
|---|---|---|
| 连续撞同一只巨像 | **11.58%** | **0%**（4000 次抽取） |
| 至少撞一次的局 | **148/200** | 0 / 200 |
| 同款巨像最小间隔 | **5 波** | ≥ 2 波，最大 15 波 |
| 16 波窗口内缺某一种巨像 | — | 0（无饥饿） |

根因：`buildWave` 用 `pick(Object.keys(BOSS_MV))` —— **无记忆随机**。
改成**洗牌袋 `bagPick(kind)`**：一轮洗一次牌、走完再重洗；Boss 与精英巨像**各用一个袋子**
（`G.bossBag`/`G.champBag`），否则两者会互相消耗同一份记忆。三个衔接漏洞逐个补：

- **重洗瞬间**首项可能撞上上一只 → 洗完若 `bag[0]===last` 就与第二位交换。
- **剧本 Boss（W35 / W40）不写回记忆** → 40 波坍缩核到 45 波首抽仍可能撞同一只。
  现在 `buildWave` 里只要定下 `bossKind` / `Wv.champ` 就一并写 `G.bossLast` / `G.champLast`。
- 袋子必须**存档往返**（`saveRun` 写 `bb/cb/bl/cl`，`resumeRun` 还原）—— 不还原的话续档时
  袋子是空的，重新洗牌又会连续重复。

**② 强化层（AMP）**

修前 30 波之后强度是**纯线性**的：`hpMul` 3.61@30 → 9.91@100，中间没有任何加压层，
而无尽模式的唯一意义就是"还能更难"。从**第 41 波起每 5 波进一层**：

| | 常量 | 12 层（W100）时 |
|---|---|---|
| 层数 | `ETIER_FROM=41` / `ETIER_EVERY=5` | T12 |
| 血量 | `ETIER_HP=1.14^n` | × 4.82 |
| 伤害 | `ETIER_DMG=1.08^n` | × 2.52 |
| 速度 | `ETIER_SPD=1.03^n`，`ETIER_SPD_CAP=1.5` | × 1.43（封顶 1.5） |
| 额外敌人 | `+ETIER_EXTRA` / 层，`ETIER_EXTRA_CAP=10` | +10（总数 38 → 48） |

血量 / 伤害是**乘在既有线性成长之上**的（`spawnEnemy` 里 `m=(1+0.09*(n-1))*eTierHp()`），
所以 W100 相对 W40 是 **×10.59 血 / ×2.52 伤**，而纯线性基线只有 ×2.20。
速度**必须设上限** —— 再快就不是难度，是没法走位了。小行星血量同样走 `eTierHp()`。

- **0 层时所有倍率恒为 1、额外为 0** —— 前 40 波逐波断言零回归（倍率恒等 +
  剧本 Boss 不错位 + 敌人不超 38 只）。
- 读数由 `tierTxt(t)` 统一生成，**0 层返回空串**，不污染前 40 波文案；HUD 与三条 banner 都挂这个后缀。
  ⚠️ HUD 的波次读数是 `HUDC` 缓存写入的 —— `setLang` 里清了 `HUDC.wv`/`HUDC.el`，否则换语言后是旧文案。
- `banner()` 是**替换式、不排队** —— 各分支自己补一条后缀会互相覆盖，所以把巨像名与副标题
  先收进 `bt` / `bs` 变量，最后**只 `banner()` 一次**。

**验证**：`phase4-5-check.js` **11 项全过**；
15 套脚本（2-3 / 2-4 / 2-5 / 3-1 / 3-2 / 3-3 / 3-4 / 3-5 / 4-1 / 4-2 / 4-3 / 4-3b / 4-4 / 4-5）
**无 ERR / 无 FAIL**；`audit-tokens.js` 全绿。
回退点 `.workbuddy/backups/index_*_phase4-5-pre.html`，
截图 `.workbuddy/shots/phase4/4-5-s1…s4-*.png`。

**验收**：新增内容不破坏 Phase 1 的反馈出口与 Phase 0 的视觉 token。

---

## 6. Phase 5 · 平台与打磨 ✅ 完成 ＋ Phase 6 长线留存 🔄 进行中

- ✅ **5.1 键位重绑定**（2026-09-12 完成）
- ✅ **5.2 手柄支持**（2026-09-12 完成）
- ✅ **5.3 设置面板补完**（2026-09-12 完成）
- ✅ **5.4 性能**（2026-09-12 完成）：`qTier` 降级路径覆盖新增特效（尤其后处理与屏幕叠层）
- ✅ **5.5 移动端专项**（2026-09-12 完成）：虚拟摇杆手感、安全区、横竖屏
- ✅ **5.6 分享卡片 / 本地排行榜 / 局内截图**（2026-09-12 完成，Phase 5 收官）

**验收**：低端机稳 60fps，触屏与手柄都能完整通关。**Phase 5 已于 2026-09-12 全项完成。**

#### ✅ 5.1 键位重绑定（已完成 2026-09-12）

改前 `keydown` 里散着 20 多处 `e.code==='KeyX'` 字面量，玩法侧另有四处
`keys.KeyW||keys.ArrowUp` 式的直读 —— 玩家想改键只能改源码。

**数据层**：`KEY_DEFS`（12 个动作 × 主键 / 副键两槽位）+ `KEYMAP`（运行时表）+ `nova-keys` 持久化。
两槽位是刻意的：WASD 与方向键并存是既有默认，砍掉任一组都会招骂。

| 动作 | 默认 | 动作 | 默认 |
|---|---|---|---|
| 左转 / 右转 | `KeyA`/`←` · `KeyD`/`→` | 设置 | `KeyO` |
| 推进 / 减速 | `KeyW`/`↑` · `KeyS`/`↓` | 静音 | `KeyM` |
| 开火 | `Space` | 换牌 / 重开 | `KeyR`（分处 levelup / over·pause） |
| 暂停 | `KeyP` · `Escape` | 进入无尽 / 退出主菜单 | `KeyE` / `KeyQ` |

**改绑策略：撞车自动清空，不弹报错**。玩家点第二个槽位时「先撞后清」比「弹窗拒绝」顺手得多；
被清空的动作会在列表里变成「未设置」，并弹一条 `KEYMAP` 横幅说明是哪个动作丢了键。

**三个必须守住的边界**

- **捕获态不派发**：改绑等待期间 `keydown` 必须**在 `keys[]=true` 与所有游戏分支之前**吃掉按键 ——
  否则按下的瞬间会同时触发动作（比如抓 `P` 当暂停键，游戏当场暂停）。
- **存档逐槽位校验**：`loadKeys()` 对每个动作每个槽位单独判定，坏值（非字符串 / 非数组 / 缺动作）
  只让**那一个动作**回退默认，不会整张表失效、更不抛异常。
- **`syncKeyHints()` 必须排在 `applyI18n()` 之后**：HUD 的 ♪ / Ⅱ 两个按钮的 `title` 是
  `data-i18n-t` 托管的，先同步会被那轮覆盖回「音效 M」。改绑后提示要跟着指向新键。

**顺手做的**：引导文案的 `WASD` / `空格` 改成 `{MOVE}` / `{FIRE}` 占位符，渲染时取当前绑定 ——
**默认绑定下仍渲染成 `WASD`**（玩家认了三年的说法，换成「A / W / D」是自作聪明），改绑过才降级成逐个键名。

**未纳入键位表**（有意保留硬编码）：`Escape` 在日志 / 机库 / 设置里各有语义，塞进同一张表会把
上下文判断挤没；机库 `Digit1-7`、选卡 `Digit1-3`、菜单 `C`/`L` 同理，属于 contextual 快捷键。

**验证**：`phase5-1-check.js` **14 项全过**；
16 套脚本（`phase2-check` + 2-3 / 2-4 / 2-5 / 3-1 / 3-2 / 3-3 / 3-4 / 3-5 / 4-1 / 4-2 / 4-3 / 4-3b / 4-4 / 4-5 / 5-1）
**无 ERR / 无 FAIL**；`audit-tokens.js` 全绿。
回退点 `.workbuddy/backups/index_*_phase5-1-pre.html`，
截图 `.workbuddy/shots/phase5/5-1-s1…s4-*.png`。

#### ✅ 5.2 手柄支持（已完成 2026-09-12）

改前游戏是纯「键盘 + 鼠标」的：菜单要点、选卡要点、机库要点。手柄插上去除了一部分
`KeyboardEvent` 能蹭到的按键之外完全不可用 —— 沙发上玩不了。

**数据层**：`PAD` 单例 + 五个常量。

| 常量 | 值 | 含义 |
|---|---|---|
| `PAD_DZ` | 0.22 | 摇杆死区（内圈直接归零，外圈按 `(a-dz)/(1-dz)` 重映射，不丢手感） |
| `PAD_TRIG` | 0.45 | 扳机按下阈值（LT/LB 减速） |
| `PAD_EDGE` | 0.55 | 菜单里"拨一下"的摇杆阈值 |
| `PAD_REP1` / `PAD_REP2` | 0.42 / 0.16 | 长按连发：首次即响，之后加速 |

**映射**：左摇杆 X → 转向（**模拟量**，与键盘的 ±1 叠加后 `clamp(-1,1)`）、Y 上 → 推进 /
Y 下 → 减速；A / RT / RB 开火；LT / LB 减速；十字键 → 菜单与选卡移动；A 确认、B 返回、
X 换牌；START 暂停 / 继续；Select 开设置。

**四个必须守住的边界**

- **转向量不能退化成开关**。`PAD.ax` 是浮点，直接 `+PAD.ax` 让键盘的和手柄的叠加；
  若图省事写成 `keyDown('right')||PAD.ax>0?1:0`，摇杆就只剩"推到底"一档，
  微操和键盘没区别 —— 实测满推 0.07333 与按 D 键完全一致（这时才该一样）。
- **摇杆必须径向归一化**。死区重映射后斜推模长会超过 1（角上 1.414），
  不除以模长的话斜着飞比直着飞快 41%。实测 `(1,1)` 归一化后模长恰为 **1.0000**。
- **`B` 键的判定必须排在"空列表守卫"之前**。通用导航分支原本是
  `const list=padTargets(); if(!list.length)return;` 才到 B —— 于是**没有按钮的面板里
  B 键被静默吞掉**，玩家被困在日志页出不去。这是本次抓到的真 bug（顺带发现
  `padTargets()` 漏了 `el.logbook`，日志页本来一个可聚焦按钮都没有）。
- **拔掉手柄要零残留**。`padScan()` 在没有 gamepad 时必须走 `padClear()`，
  把 `ax/ay/fire/brake` 全部归零 —— 否则拔掉的瞬间飞船会保持最后一个朝向一直转。

**连接提示只弹一次**：`PAD.seen` 标志位，重连 / 换接口不重复刷横幅（断言里连插两次，
第二次必须返回空串）。横幅文案中英双行：
`CONTROLLER / 手柄已连接 —— 左摇杆转向与推进 · A / RT 开火 · START 暂停`。

**未纳入手柄**（有意）：右摇杆瞄准 —— 游戏是鼠标瞄准 + 船体朝向射击，
加右摇杆等于重做一套瞄准系统；手柄玩家用左摇杆转向已经够用（`aimMode='key'` 兜底）。

**测试**：无头环境没有真手柄，全部通过 `PAD_TEST` 注入假 gamepad
（`NOVA.pad.hold(ax,ay,mask)` 保持 / `tap()` 按下即松 / `clear()` 拔掉）。
新钩子 `NOVA.pad.{const,state,hold,tap,scan,ui,step,fireStep,sel,targets,clear}`。

**验证**：`phase5-2-check.js` **14 项全过**；
17 套脚本（`phase2-check` + 2-3 / 2-4 / 2-5 / 3-1 / 3-2 / 3-3 / 3-4 / 3-5 / 4-1 / 4-2 / 4-3 / 4-3b / 4-4 / 4-5 / 5-1 / 5-2）
**无 ERR / 无 FAIL**；`audit-tokens.js` 全绿。
回退点 `.workbuddy/backups/index_*_phase5-2-pre.html`，
截图 `.workbuddy/shots/phase5/5-2-s1…s4-*.png`。

#### ✅ 5.3 设置面板补完（已完成 2026-09-12）

改前设置面板只有两条音量条 + 5.1 加的键位表。画质只能靠 `qTier` 自动降、
色盲模式完全没有、前庭敏感的人没法关震屏 —— 这不是打磨问题，是**有人进不来**。

**数据层**：`OPTS` 单例（7 项）+ `nova-opts` 单键持久化。逐项校验、坏值只回退那一项
（沿用 5.1 键位表的兜底策略）。首次进入跟随系统的 `prefers-reduced-motion`，
玩家一旦改过（键已存在）就不再覆盖。

| 分区 | 项 | 值 |
|---|---|---|
| 显示与性能 | 画质 | 自动 / 高 / 中 / 低（对应 `qTier` 0/1/2，手动档**锁死不再自动降**） |
| 显示与性能 | 四个开关 | 屏幕震动 · 星云背景 · 辉光 / 故障 · 粒子 |
| 无障碍 | 色盲 | 关 / 红绿（protan·deutan）/ 蓝黄（tritan） |
| 无障碍 | 减弱动态 | 开 / 关（震屏 + 镜头冲击 + 循环动画一起停） |

**色盲模式是这次唯一需要"先量后改"的**。改前敌方弹丸是写死的 `#ffb08a`、
危险色朱砂 `#c0402b`、奖励色黄铜 `#c9a227` —— 三者在红绿色盲眼里都落到黄褐色区间。
用 Viénot CVD 矩阵把候选色模拟一遍后要求「危险 vs 奖励」「敌弹 vs 我弹」
「血条 vs 盾条」三对在模拟后的 sRGB 里欧氏距离 **≥ 90**：

| 关键对 | 基础配色 | 红绿档 |  | 基础配色 | 蓝黄档 |
|---|---|---|---|---|---|
| 危险 vs 奖励 | 61 | **125** | | 61 | **232** |
| 敌弹 vs 我弹 | 100 | **153** | | 134 | **245** |
| 血条 vs 盾条 | **36**（不过线） | **109** | | **38**（不过线） | **137** |

**基础配色两条轴都有不过线的对** —— 这条断言因此真的在测东西（若基础配色也过线，
说明阈值定得太松、模式做了等于没做）。

三条选色原则：
- **只换承载信息的色**（`danger` / `amber` / `foe` / `cyan` / `hp-*` / `shield-*`），
  中性色（`steel` / `ink` / `white` / `line` / `void`）**一个都不动** ——
  换了只是换皮，不解决辨色，还会把「结构 vs 内容」的层次一起塌掉。
- **红绿档走蓝↔黄安全轴**（Okabe-Ito）：危险压成朱橙、奖励提到纯黄，靠明度差分开。
- **蓝黄档走红↔绿安全轴 + 明度**：危险提亮成鲜红、奖励改青绿，我方走高亮度 ——
  蓝黄轴丢信息时**亮度是唯一剩下的把手**。

**实现要点**：色板表 `CB_PAL` 放在 JS（CSS 段写字面色值会被 R1 判违规，
故按 `HULL_TINT` / `TRAIL_RAMP` 的先例加进 audit 的动态放行表）；
`PAL` 从「启动快照」改成可重读的 `readPal()`，换色后必须重读一次。

**验证**：`phase5-3-check.js` **14 项全过**；
18 套脚本（`phase2-check` + 2-3 / 2-4 / 2-5 / 3-1 / 3-2 / 3-3 / 3-4 / 3-5 / 4-1 / 4-2 / 4-3 /
4-3b / 4-4 / 4-5 / 5-1 / 5-2 / 5-3）**无 ERR / 无 FAIL**；`audit-tokens.js` 全绿。
回退点 `.workbuddy/backups/index_*_phase5-3-pre.html`，
截图 `.workbuddy/shots/phase5/5-3-s1…s4-*.png`。

---

#### ✅ 5.4 性能（已完成 2026-09-12）

**症状：降了档，负载没下。** 改前 `qTier` 一共只有 7 处用法，砍的是 DPR、推进器层数、
流线条数、六边形层数和辐条数 —— 而**占大头的粒子 / 残骸 / 残影 / 电弧全是常量上限**：
`PART_MAX=560` / `DEBRIS_MAX=120` / 残影硬编码 8 / 电弧**根本没有上限**。
于是看门狗一路降到 2 档，屏幕上的东西一点没少，帧率也没救回来。

**一、`QB` 三档预算表**（`canvas` 段，紧贴 `qTier`）

| | parts | debris | ghosts | bolts | texts | fmax | shards | stars |
|---|---|---|---|---|---|---|---|---|
| 0 high | 560 | 120 | 8 | 24 | 26 | 48 | 16 | `1111` |
| 1 mid | 320 | 64 | 5 | 14 | 18 | 30 | 11 | `1101` |
| 2 low | 150 | 32 | 3 | 8 | 12 | 18 | 7 | `1001` |

- **高档值一律沿用旧常量**（560 / 120 / 8 / 26），保证默认画质观感零变化。
- `texts` = 伤害飘字（原 `DMG_MAX`），`fmax` = 通用飘字（**原先无上限**，一波拾取能顶几十条）。
- `stars` 是星场四层 `[尘0.06, 0.2, 0.45, 近0.9]` 的开关掩码。
  **抽的是中间两层而不是从近端砍** —— 最近层是视差纵深的来源，砍掉整个画面就"贴"了；
  最远的尘层撑住"深空不空"，砍掉背景会露底。
- 缓存成标量 `QPM/QDM/QGM/QBM/QTM/QFM/QSM/QST`：`pushStreak` 这类在最热路径上，
  多一次属性链查找不值当。

**二、降档必须立刻砍存量（`trimFx()`）**
粒子寿命不到 1 秒，等它自然消亡等于**降档后还要扛一秒旧负载，而这一秒正是玩家在骂的那一秒**。
挂点只有两处：`applyQuality()`（手动切档）与 `qualityWatch()`（自动降档）。
⚠️ `qualityWatch` 在 1 档时只 `FX.dropFluid()` **不 resize**，所以 `qbSync()` 得单独调，不能塞进 `resize()`。

**三、后处理分级**
`bloom` 是纯装饰的全屏放大自叠（最贵的一笔），**1 档就掐掉**；
`glitch` 是受击可读性的核心（撞一下知道疼），留到 2 档才关。

**四、度量：改用「绘制调用次数」而不是墙钟**
headless 是软件渲染，单帧耗时被放大十几倍且抖 ±20% —— 消融法实测同一项两次能差 40ms，
正负号都不可信（曾测出「省 −4146%」这种数）。
`NOVA.bench.ops(n)` 临时包裹 `CanvasRenderingContext2D.prototype` 计数，用完还原：
同一场景两次跑**完全一致**，于是「降档少干了多少活」可以硬断言。

**实测**（1440×900 / dpr2 / 钉死场景：29 敌 + 粒子顶格）：

| 档 | 绘制调用 / 帧 | 比值 |
|---|---|---|
| high | 5137 | 100% |
| mid | 4352 | 85% |
| low | 3239 | **63%** |

**验证**：`phase5-4-check.js` **12 项全过**；
19 套脚本（+ `phase5-4-check`）**无 ERR / 无 FAIL**；`audit-tokens.js` 全绿。
回退点 `.workbuddy/backups/index_*_phase5-4-pre.html`，
截图 `.workbuddy/shots/phase5/5-4-s1…s5-*.png`。

---

#### ✅ 5.5 移动端专项（已完成 2026-09-12）

**一、虚拟摇杆：从「方向开关」改回「模拟量」**

改前实测：**推 3px 和推 46px，0.5s 内都转满 90°**，且推 1px 就开始转 ——
因为旧代码是 `P.angle += clamp(angDiff(P.angle,want), ±10*dt)`，一条**恒定**的 10 rad/s 斜率，
杆只决定"朝哪"，不决定"多快"。5.2 明确要求手柄「模拟量不退化成开关」，
移动端却漏了同一条。参数组 `JOY_*`：

| 常量 | 值 | 说明 |
|---|---|---|
| `JOY_R` | 46 | 杆最大位移 px（与 `#joyknob` 直径对齐，别只改一边） |
| `JOY_DZ` | 0.18 | 死区（占 `JOY_R`），与 5.2 `PAD_DZ` 同思想 |
| `JOY_TURN_MIN` / `MAX` | 0.45 / 2.2 | 转向倍率（相对 `P.turn`）：满舵 4.4×2.2 ≈ 旧手感 10 rad/s |
| `JOY_BRK` | 0.62 | 下拉超过即刹车，对齐 5.2 手柄 `ay>0.5` |
| `JOY_THR` | 0.12 | 推进阈值：刚出死区就点火太敏感 |
| `JOY_FOLLOW` | 2.2 | 手指超出 2.2R 才重锚底盘 |

`joyRead()` 做「死区 → 重映射 → 归一化」，与 5.2 `padScan()` 同一套 ——
**两种模拟量输入的语义必须一致，否则玩家换个设备手要重新学**。

**改后实测**（8 帧 = 0.133s，目标角 90°）：

| 推杆 | 3px | 10px | 20px | 33px | 46px |
|---|---|---|---|---|---|
| 转角 | **0°** | 17.81° | 33.40° | 53.68° | 73.95° |

⚠️ **必须取 8 帧而不是 0.5s**：0.5s 内连最小幅度都够转到目标角，
被 `clamp(angDiff)` 夹成常数 —— 那测出来「推多少都一样快」，是测试自己造成的假象。

**二、下拉 = 刹车**：改前 up / down 都 `thrust=1`，手机上**根本没有减速手段**。
实测初速 300 → 上推 254 · 不动 105 · **下拉 28.6**。

**三、手指拖远时重锚底盘**：超出 2.2R 时把底盘挪到「手指 − R」处再钳一次，
杆**仍停在满舵边缘、朝向连续**。不能"底盘瞬移到手指下"——那会让 `dx/dy` 归零、船突然停转。

**四、安全区**：`viewport-fit=cover` 已开，但 `env()` 一个都没用。
在 `:root` 收敛成 `--safe-t/r/b/l` 四个变量，其余一律 `calc(原值 + var(--safe-*))`
——每个用点各写一遍 `env()` 的结果必然是「改一处漏三处」。

**五、横竖屏**：新增竖屏轻提示（触屏 + 竖屏 + 对局中才露），**点一下永久忽略**（存 `nova-orient`）。
故意不做「几秒后自动消失」——那要引入一个说不清的时长常量，而玩家自己点掉既没有时长问题，
也保证他真的看见了。

**六、混用设备**：`isTouch` 改前一旦触屏就永久为 true，触屏笔记本插鼠标也回不去。
现在用 `pointerType==='mouse'` 判断 —— **触屏会产生合成的 mouse 事件，只靠 `mousedown` 会反复横跳**。

**验证**：`phase5-5-check.js` **12 项全过**；
20 套脚本（+ `phase5-5-check`）**无 ERR / 无 FAIL**；`audit-tokens.js` 全绿。
回退点 `.workbuddy/backups/index_*_phase5-5-pre.html`，
截图 `.workbuddy/shots/phase5/5-5-s1…s5-*.png`。

---

#### ✅ 5.6 分享卡片 / 本地排行榜 / 局内截图（已完成 2026-09-12 · Phase 5 收官）

**一、本地排行榜 `nova-board`（Top 10）**

| 字段 | 含义 |
|---|---|
| `s` / `w` / `k` / `l` / `t` | 分数 / 波次 / 击坠 / 等级 / 存活秒 |
| `h` / `d` | 船体 id / 日期 `M/D` |
| `m` | 0 标准 · 1 无尽 · 2 每日 |
| `v` | 是否通关（1 = 肃清） |

- **键名压到一两个字母**：localStorage 只有 ~5MB，一局一条、玩家能打到几百局，
  长键名是纯浪费。实测一条记录 **81 字节**。
- `boardAdd(r)` 返回 **1-based 名次；挤不进 Top10 返回 0** —— 调用方（`showOver` /
  `showVictory`）据此决定显示「本局排名 #N」还是「未进前 10」。
- ⚠️ `BOARD.indexOf(r)` 依赖「r 与入栈的是同一个引用」，别在调用前 `JSON.parse(JSON.stringify(r))`。
- **坠毁也要进榜**：只有通关才记的话，绝大多数玩家的榜会长期空着 —— 分数就是分数。
- 面板不占 `G.mode`（避免 mode 语义被稀释），`padBack` 按 `!el.board.hidden` 关。

**二、分享卡片 `shareCard()`：1200×630 离屏 canvas**

**颜色一律走 `PAL`** —— 5.3 的色盲模式换了 token，卡片自动跟着换。
卡片是拿给别人看的，辨色要求比游戏内更高。实测切到红绿档后
`shC('amber')` 由 `rgba(201,162,39)` → `rgba(240,228,66)`。
版式沿用「星图测绘」：深墨底 + 60px 钢蓝网格 + 青色内框 + 铅白读数 + 琥珀强调。

**三、局内截图 `grabShot()`**

主画布是 2D context，`toDataURL` 不受 `preserveDrawingBuffer` 影响，随时可截。
⚠️ 流体星云层是独立的 **WebGL** canvas，**不在**主画布上，截图里不会出现 —— 这是预期行为，
不是 bug（想要带星云的图得先合成两个 canvas）。

入口：暂停面板「SNAP ▸ 截图」、结算面板「CARD ▸ 分享卡片」、主菜单「BOARD ▸ 排行榜」。

**验证**：`phase5-6-check.js` **13 项全过**；
21 套脚本（+ `phase5-6-check`）**无 ERR / 无 FAIL**；`audit-tokens.js` 全绿。
回退点 `.workbuddy/backups/index_*_phase5-6-pre.html`，
截图 `.workbuddy/shots/phase5/5-6-s1…s5-*.png`。

#### ✅ 6.1 自定义种子与对局复现（已完成 2026-09-12）

**动机**：5.6 的成绩卡是**惰性**的 —— 它只有分数，别人拿到也复跑不了。
3.3 已经有 `setSeed`/`mulberry32`，但玩家既看不到也输入不了种子。6.1 补上这一层，
让「分享成绩」变成「分享一局」。

**一、先量后改 —— 量出来的结论比预想严重**

跑「同种子两遍」的对照探针，结果：

| 决策 | 改前 |
|---|---|
| 波次编队 / Boss 选取 | ✓ 已确定（`pick`/`shuffle` 走 `srand01`） |
| **选卡（`wsample`）** | ✗ **完全没走种子** —— 三张牌全靠 `Math.random()*sum` |
| 精英（`spawnAst` 8%） | ✗ `Math.random()` |
| 词缀（`applyAffix` 两次） | ✗ `Math.random()` |
| 掉落（`spawnPickup`） | ✗ `Math.random()` |

**二、为什么光「接入种子」不够 —— 键控重播种**

战斗里每帧都在消耗 `rand()`（弹道散布 `rand(-0.07,0.07)`、AI 节拍、生成抖动），
**战斗打多久，流的位置就不同** → 下一波编队和下一次选卡全跟着漂。
所以布局与奖励不能「顺着流走」，必须在每个**决策点**把流拉回确定位置：

```js
function seedAt(k,i){        // k = 上下文键，i = 波次 / 等级
  if(!RND.on)return;
  const x=(RND.s0^Math.imul(k,0x9E3779B1)^Math.imul((i|0)+1,0x85EBCA6B))|0;
  RND.s=x||1;
}
```
- `buildWave(n)` 入口：`seedAt(0x5EED,n)` → **编队 = f(种子, 波次)**
- `rollChoices()` 入口：`seedAt(0xCAFD,P.level)` → **选卡 = f(种子, 等级)**

**三、战斗层故意不进种子流**（弹道散布 / AI 出手 / 走位翻转 / 暴击 / 粒子）
—— 它们的调用次数取决于玩家怎么打，一旦进流，后续编队与选卡又会被推歪。
这条写进了 RNG 块的注释，加随机的先读那段。

**四、玩家侧**
- 6 位 base36 短码（`SEED_MAX=36^6-1`，好念好抄）；`normSeed()` 统一折叠，
  **三处（显示 / 解析 / 落种）必须同一个折法**。
- 菜单「SEED ▸ 自定义种子」→ 填码 → 进机库选船 → 出击；留空 = 每局随机。
- `?seed=XXXXXX` 直达开局（分享链接）。
- 暂停 / 坠毁 / 通关三处都显示 `SEED · XXXXXX`；随机局不显示；每日显示日期。
- 成绩卡在「模式」同一行右对齐印 `SEED · XXXXXX`；榜单每行 sub 行带码。

**验证**：`phase6-1-check.js` **14 项全过**；`audit-tokens.js` 全绿。
回退点 `.workbuddy/backups/index_*_phase6-1-pre.html`，
截图 `.workbuddy/shots/phase6/6-1-s1…s5-*.png`。

#### ✅ 6.2 难度档（已完成 2026-09-12）

**一、数值只住在一张表里**

```js
const DIFFS=[
 {id:'cruise',  hp:0.75,dmg:0.7, spd:0.9, cnt:0.85,sc:0.8,req:0},
 {id:'standard',hp:1,   dmg:1,   spd:1,   cnt:1,   sc:1,  req:0},
 {id:'abyss',   hp:1.35,dmg:1.3, spd:1.12,cnt:1.2, sc:1.4,req:15},
];
```
三档只改「敌人多强 / 多密 / 打你多痛」与「得分系数」，**不碰玩家输出**。
`sc` 是必须的：深渊更难，榜上就得值更多分，否则没人会选。

**二、六个应用点（改难度只需动这张表）**
`spawnEnemy`（hp/dmg/spd）· `spawnAst`（hp）· `hurtPlayer`（承伤，唯一入口）
· `drainPlayer`（承伤）· `buildWave` 的 `total`（密度）· `addScore()`（得分）。
加分点原本散在 5 处 `G.score+=`，统一收进 `addScore(v)` —— 系数一次算清，别各乘各的。

**三、局内锁定**：`diffNow()` 在局内读 `G.diff` 而不是 `G_DIFF`，
开局后即便选择被改写（测试 / 设置），当前这局的数值也不许变。

**四、解锁与公平**：深渊需历史最佳波次 ≥15；**每日挑战固定标准档**，
否则同日成绩没有可比性（踩到过：`G.dailyMode` 在判定前就被清零了，见 §7 #144）。

**验证**：`phase6-2-check.js` **14 项全过**；`audit-tokens.js` 全绿。
回退点 `.workbuddy/backups/index_*_phase6-2-pre.html`，
截图 `.workbuddy/shots/phase6/6-2-s1…s5-*.png`。

#### ✅ 6.3 自定义挑战（Modifier 组合）（已完成 2026-09-12）
**定位**：6.2 难度档改的是「整体压力有多大」，
6.3 Modifier 改的是「压力长什么样」——
同一个深渊档，挂蜂群和挂铁壁是两种完全不同的局，这是难度档给不了的。
**故意只留 5 个、最多叠 3 个**：组合数 C(5,1)+C(5,2)+C(5,3)=25，
够玩又不至于让每一局都无从比较。

| id | 中文 | 简述 | hp | dmg | spd | cnt | pk | php | sc | 解锁 |
|---|---|---|---|---|---|---|---|---|---|---|
| swarm   | 蜂群 | 敌人数量 ×1.45，单体更脆     | 0.8 | 1.00 | 1.00 | 1.45 | 1.0 | 1.0 | +0.30 | 0  |
| bulwark | 铁壁 | 敌人血量 ×1.7，但更慢          | 1.7 | 1.00 | 0.85 | 1.00 | 1.0 | 1.0 | +0.35 | 0  |
| gale    | 疾风 | 敌人更快更痛                    | 1.0 | 1.15 | 1.35 | 1.00 | 1.0 | 1.0 | +0.35 | 8  |
| barren  | 荒芜 | 补给刷新间隔 ×2.2              | 1.0 | 1.00 | 1.00 | 1.00 | 2.2 | 1.0 | +0.40 | 8  |
| brittle | 脆命 | 船体上限 ×0.5                  | 1.0 | 1.00 | 1.00 | 1.00 | 1.0 | 0.5 | +0.60 | 15 |

**六个应用点**（每帧只问一次 `modNow()` 快照）：
1. `spawnEnemy`：`hp/dmg/spd` 各乘 M.*（与 D.* 相乘，绝不覆盖）
2. `spawnAst`：`hpMul` 链尾追加 `*rmodMul('hp')`
3. `buildWave`：`total` 链尾追加 `*rmodMul('cnt')`
4. `hurtPlayer/drainPlayer`：`dmg` 链尾追加 `*rmodMul('dmg')`
5. `updatePickups`：`pickT` 链尾追加 `*rmodMul('pk')`
6. `applyRmods()`：开局时按 `php` 缩船体上限（必须排在 hull.apply + 局外加成之后）

**得分系数链**：`scoreMul() = diffNow().sc × (1 + Σ sc)`（**累加不连乘**——
三个 0.35 是 ×2.05 而不是 ×2.46，避免叠满爆表）。
`addScore()` 改成 `G.score += v × scoreMul()`，5 个加分点不再各乘各的。

**局内冻结**：`G.rmods = G.daily ? [] : (G_RMODS||[]).slice(0,3)` 在 startGame 拷贝，
之后改菜单选项不影响本局（与 G.diff 同一条规矩）。
判据是 `Array.isArray(G.rmods)` 而不是长度：G.rmods=[] 也是有效状态。

**每日挑战一律不带 Modifier**：保证同日可比。

**UI**：`#rmodRow` 在 `#diffRow` 下方，5 个按钮（上限 3，多选即挤掉最旧），
中点实时显示「自定义挑战 · 2/3 · 得分 ×1.65」。
记录 / 榜单 / 卡片在原有「难度 ·」之后追加「蜂群+脆命」。

**关键补丁点**：`renderRmods()` · `modNow()` · `scoreMul()` · `applyRmods()`
· 6 个应用点 · `G.rmods` 冻结 · `NOVA.rmod` 钩子（12 项）。

**验证**：`phase6-3-check.js` **19 项全过**；`audit-tokens.js` 全绿。
回退点 `.workbuddy/backups/index_*_phase6-3-post.html`（pre 已不可恢复，
post 与 git HEAD-1 等价），截图 `.workbuddy/shots/phase6/6-3-s1…s5-*.png`。

#### ✅ 6.4 工坊式卡池（已完成 2026-09-12）
**定位**：难度档改压力大小，挑战改压力形状 —— **卡池改的是「你这一局能不能拿到想要的卡」**。
29 个模块里总有几个是「拿就完事」，也有几个是「绝不点」。把后者禁掉，三选卡里垃圾位就少一截，
**构筑成功率明显上去** —— 这是给老玩家的真正福利。

**故意只让禁 8 / 29** —— 禁太多就把多样性砍没了（上限 `POOL_MAX=8`）。
**故意不给得分加成** —— 禁掉"垃圾"是纯收益，禁掉"强卡"会自然更难；
不引入「禁得越多分数越高」的 gaming 漏洞。

**与 G.diff / G.rmods 同条规矩**：
- 局内冻结为 `G.ban`，开局后改 `G_BAN` 不影响本局
- 每日挑战强制清空 —— 「同日必须可比」
- 持久化 `localStorage` 键 `nova-pool`，刷新读回

**单点过滤**：在 `rollChoices()` 里只动一行 —— `pool.filter(m=>G.ban.indexOf(m.id)<0)`，
**必须排在 rarity / cap 过滤之前**（禁一个未拿过的模块直接改变 offer 构成；禁一个已 maxed 的
本来就该消失，剔除前后等价 —— 写在前面不亏）。

**UI**：`#poolRow` 紧贴 `#rmodRow` 下，29 个 chip 多选（上限 8 满时其他变灰），
中点实时显示「卡池工坊 5/8」/「卡池工坊 未启用 - 最多 8 个」。
chip 顺序按 `MODULES` 定义序（不是点击序）—— 玩家改了之后可以一眼看出顺序。

**记录 / 榜单 / 卡片**：原「难度 · 挑战」之后追加「工坊 xN」，卡片对应多一段话。

**验证**：`phase6-4-check.js` **14 项全过**；`audit-tokens.js` 全绿。
回退点 `.workbuddy/backups/index_*_phase6-4-{pre,post}.html`（这次 pre 真的有了），
截图 `.workbuddy/shots/phase6/6-4-s1…s5-*.png`。

#### ✅ 6.5 幽灵回放（已完成 2026-09-12）
**定位**：6.1 分享种子让两个人跑同一局、5.6 分享成绩卡让一个人吹自己 —— **6.5 让这局的飞行轨迹变成别人也能看见的影子**。
下一局开打时，影子按同一条时间轴并排跑，你看到的不是文字描述、不是分数对比，而是一只画在同坐标系里、和你并驾齐驱的「过去的自己」。

**故意不让「过分享轨迹」存在** —— 别人没法直接套用你的轨迹作弊；影子按 *本机* 选定的难度/挑战/卡池自动筛选，没有「跨配置的影子」污染。
**故意按"最佳成绩"而非"最近一局"覆盖** —— 打得差的那局不该顶掉巅峰的那条影子。

**三条设计约束（每条都是踩过坑才定的）**：
- **按 `G.runT` 采样而非按帧** —— 暂停/三选一界面 `runT` 不涨，天然不录；掉帧时按 `runT` 补点，采样密度恒定，影子不会忽快忽慢；
- **扁平 `[x,y,ang,...]` 存轨迹，满了就地 2:1 抽稀并把 dt 翻倍** —— 时长无上限、点数有上限，不必预分配也不必砍掉尾巴（砍尾巴等于删掉最精彩的一段）；**`G.gn` 必须跟着折半**，否则下一帧的 `want` 瞬间落后几千点，整条轨迹压缩成一条直线；
- **按「难度 + 挑战 + 卡池」指纹分组，每组只留最高分那一局** —— 换配置时不会拿一条不可比的影子来赛跑；每日挑战另起一组（`daily:YYYY-MM-DD`），同日同种子，最公平。

**核心代码**（6.5 模块约 200 行）：
- `ghostRec()` —— 按 `runT` 补点，`guard<20` 防止极端掉帧把一帧补成几百点；
- `ghostPush()` —— 满 `GHOST_CAP=3600` 点即抽稀（偶数下标、dt 翻倍、`gn` 折半）；
- `ghostAt()` —— 线性插值，**角度走最短弧**避免 `±π` 跳变处整船瞬间翻面；
- `ghostSave()` —— 同组配置下「旧分覆盖新分」时 `return false`（没破纪录保留旧影子）；
- `drawGhostRun()` —— 钢蓝虚线轮廓 + 220 段航迹（lighter 加法、随影子同步生长）+ 越界的距离读数 `ΔN`（仅在 `>90px` 显示，贴身缠斗时不挡视线）+ 越过终点后 2.4 秒淡出 `×` 标记；
- `renderGhostRow()` —— 机库状态行 + `CLEAR` 按钮（按当前 `ghostFpMenu()` 找对应那一条）；
- `OPTS.ghost` 实时开关 + `OPT_BOOL` 列表新增项；
- **loadOpts 必须 `if(k in s)`**：老存档根本没有 `ghost` 这个键，无条件写 0 等于把新功能对老玩家默认关掉；
- **存档校验下界 6 而非 9**：两条点的短轨迹合法，按 9 判会被静默丢掉，表现为"存了却读不回来"，同时 `g.n=Math.min(...)` 钳制越界；
- **续档「照播不录」**：`resumeRun()` 里影子按指纹取回继续播（`runT` 连续，位置自动对上），
  但 `G.gpts` 保持 `null` —— 前面没录到的那一段补不回来，硬补会在下一局变成一段瞬移，
  而且 `ghostSave()` 对 `!G.gpts` 直接 `return false`，半截轨迹不会顶掉完整那条。

**顺手修掉的既有缺陷（6.2/6.3/6.4 的续档 bug）**：`saveRun()` 只存了 `b:G.build`，
**没存 `G.diff / G.rmods / G.ban`**，`resumeRun()` 也不还原 —— 刷新续档后
深渊档悄悄变标准档（`G.diff` 缺失 → `diffNow()` 回落到菜单当前选择，**局内改菜单就能改本局数值，
「开局冻结」被绕过**）、Modifier 全失效（`modNow()` 全 1）、禁用池失效。
修法：`saveRun` 补 `df/rm/bn` 三字段，`resumeRun` 补三行还原（旧档无这三键走默认兜底）。

**验证**：`phase6-5-check.js` **18 项全过**（第 18 项即上面那条续档还原），`audit-tokens.js` 全绿。回退点 `.workbuddy/backups/index_*_phase6-5-pre.html` · post `.workbuddy/backups/index_*_phase6-5-post.html`，截图 `.workbuddy/shots/phase6/6-5-s1…s4-*.png`。


#### ✅ 6.6 轨迹码（Ghost Code）（已完成 2026-09-13）
**定位**：6.1 让两个人跑同一张地图（种子里带了敌人编队与掉落），
6.5 让一局留下自己的形状（影子录下你的飞行轨迹），
**6.6 把两件事合成一个链接**：把「种子 + 难度 + 挑战 + 卡池 + 前 90 秒飞行轨迹」
压成一段 ~1.8K 字符的短码，塞进分享链接的 hash。
别人点开就是同一张地图 + 一只你的影子陪着飞，**不需要后端、不依赖微信**，
只在 hash 里走一遍 —— 浏览器原生转发、邮件转发、QR 码转发都行。

**长度是先量出来的，不是拍的**（探针 `probe66.js`）：差分 + zigzag varint
后**恒为 3.01 字节/点**（与采样率无关），已经贴着该编码的最优下界 —— 再压只能减点数或减维度。
所以定 **5Hz × 90s = 450 点 ≈ 1.35KB → base64url ≈ 1.8K 字符**，
走 **URL hash**（`#g=...`，hash 不发给服务器、长度上限宽得多，
且 6.1 的 `seedFromUrl` 本来就同时解析 search 与 hash）。

**只在「有种子」的局生成轨迹码** —— 随机局地图不同，影子没有可比性（与 6.1「随机局不显示种子」同一条语义）。

**格式**（base64url）：头定长 11B（ver / dtcs / diff / rmods bitmask / ban bitmask 4B / seed 4B / hull idx）+ varint（score / wave / n）+ 轨迹（每点 3 个 zigzag varint：dx, dy, dang，位置量化 4px，朝向 256 级/圈）。

**模块**（6.6 约 200 行）：
- `gcodeResample()` —— 把本机的 10Hz 轨迹按时间重采样到 5Hz，
  复用 6.5 抽出的通用插值函数 `gpAt()`（不是再写一遍），与源步长无关；
- `gcodeEnc()` / `gcodeDec()` —— 编码解码 + base64url，量化到 4px 后最大位置误差 ≤2px、
  角度 ≤1/256 圈（实测），坏码 / 截断码 / 空串一律 `null` 不抛；
- `gcodeMine()` —— 当前局能不能出码：无种子 / 点数不足 → 空串；
- `gcodeUrl()` —— 拼 `#seed=XXXXXX&g=<码>` 完整链接；
- `gcodeShare()` —— 优先剪贴板 API（**注意 `writeText` 返回 promise 拒收时
  `try/catch` 抓不到、直接冒 pageerror，必须挂 `.then(成功, 失败)` 兜住**，
  详见 §7 #167）→ 失败则 `execCommand` → 还失败就**把完整链接显示出来让玩家手动复制**，
  这条兜底是核心：URL 摆出来玩家看得见自己分享的是什么；
- `gcodeTake()` —— 收端注入 `G.pendingGhost` + `G.pendingSeed`，开局时优先于本机影子；
- `seedFromUrl()` 扩展 `#g=` 解析 —— 有码就**直接开局**（与 `?seed=` 同一条流程）。

**优先级**：链接里的影子 > 本机最佳影子。用完即清回落到本机最佳。
**机库行**：外来影子带「来自链接」琥珀色标记，**不显示清除键** —— 清除动的是本机影子库，外来影子只在本局生效。

**验证**：`phase6-6-check.js` **14 项全过**，全量回归 27 套零 FAIL 零 ERR，`audit-tokens.js` 全绿。回退点 `.workbuddy/backups/index_*_phase6-6-{pre,post}.html`，截图 `.workbuddy/shots/phase6/6-6-s1…s4-*.png`。

#### ✅ 7.1 冲刺赛（Time Attack）（已完成 2026-09-13）
**定位**：6.5 影子 + 6.6 轨迹码现在是"锦上添花" —— 有了限时赛，它们变成**核心机制**：
分享一条链接就是「3 分钟里跟你的影子比谁冲得更远」。TA 是一条**独立于长期进度**的赛道，
输了不心疼，赢了也只是 TA 榜单上的一个名字。

**设计约束**（每条都是先定后写的）：
- **固定 `diff=standard` · `rmods=[]` · `ban=[]`** —— TA 的本质是「3 分钟冲波次」，
  带深渊档 / Modifier / 禁用池会让节奏失真，也让榜单失去可比性；
- **不更新 nova-best / 不 commitDaily / 不出星尘** —— 三个面板与长期进度解耦；
- **倒计时只在 `play` / `inter` 衰减**，pause / levelup / dying 都不动（与 `G.runT` 同语义）；
- 死亡或时间到都走 `taSettle()`，**不**走 `showOver()` 那条流（避免 `G.best` 误写）。

**模块**（约 90 行）：`TA_SEC=180` / `TA_KEY='nova-tattack'` / `TA_MAX=10` / `TA_BOARD`；
`taBoardLoad|Save|Add|Clear`（排序 `(y.w-x.w)||((x.rt|0)-(y.rt|0))`：wave 降序、平局剩得越少越快到）；
`taTick(dt)`；`taSettle()`；`taHudPaint()`（≤10s 加 `.warn` 转朱砂）。
接入点：菜单 `TIME ▸ 限时冲刺`（`G.taMode=true;G.dailyMode=false`）· `startGame` 三行冻结 +
`G.taT=TA_SEC` · `updateWorld` 里 `taTick(dt)` · `showOver` 首行分流 · `updateHUD` 末尾 `taHudPaint()`
· 开机 `taBoardLoad()` · `boardRec` 增 `m:3` · `bdMode` 增「限时 / TIME」。

**验证**：`phase7-check.js` **13 项全过**，全量回归 28 套零 FAIL 零 ERR、零 pageerror，`audit-tokens.js` 全绿。
回退点 `.workbuddy/backups/index_*_phase7-{pre,post}.html`。

#### ✅ 7.2 冲刺赛闭环（已完成 2026-09-13）
**起因**：7.1 落地后我按「先量后改」跑了一遍探针 `probe72.js`，发现 TA 的核心玩法**是死的** ——
`gcodeMine()` 首行就是 `if(!G.seed)return ''`，而菜单进 TA 不带种子，
实测 `gcodeMine()` 返回空串。「分享一条链接跟你的影子比」这条 TA 一半的意义，根本出不来。

**修法一 · TA 自动落种子**：`startGame()` 的 else 分支加一条 `else if(G.taMode)`，
没手填种子就现起一个（`irand(1,SEED_MAX)`）。玩家仍可自己填种子跑同一张图 —— 只补默认值，不改已有行为。
顺带把 `taSettle()` 里的 `el.overSeed.hidden=true` 换成 `setSeedLine(el.overSeed)`：
TA 现在必有种子，按 6.1「有种子就显示」的规矩该露出来。

**修法二 · 轨迹码按模式覆盖整局**（这才是真正要量的地方）：TA 整局 180s，
而默认档只录前 90s —— 影子半路消失，等于后半程没有参照。探针实测（10Hz 真值对照，同一条三频规避航线）：

| 方案 | 点数 | 链接长度 | 位置 p95 | 角度 p95 | 覆盖 |
|---|---|---|---|---|---|
| 5Hz×90s（原） | 450 | 1866 字 | 8.00 px | 12.9° | 90 s |
| 2.5Hz×180s | 450 | 1972 字（+5.7%） | 15.57 px | 38.8° | 180 s |
| 3.33Hz×180s | 600 | 2534 字（+36%） | 11.77 px | 26.2° | 180 s |
| **4Hz×180s** | **720** | **2990 字（+60%）** | **8.94 px** | **21.5°** | **180 s** |
| 5Hz×180s | 900 | 3706 字（+99%） | 8.32 px | 13.2° | 180 s |

4Hz 之后精度几乎不再涨、长度却线性翻倍 —— **取 4Hz×180s**。
2.5Hz 虽然只贵 5.7%，但角度 p95 38.8° 会让影子在急转时船头明显偏，不值。
**只有 TA 走这一档**：普通漂移一局 5~15 分钟，前 90 秒陪跑足够，没必要让每一条分享链接都变长 60%。

**修法三 · 解码读头部 hz**（顺手修掉一个 latent bug）：`gcodeDec` 原来写死 `dt:1/GCODE_HZ`，
编码参数一旦「按模式取值」，TA 码（4Hz）就会被按 5Hz 播、速度快 25%。
改成 `dt:1/hz`（头部本来就带这个字段）—— **老码头里存的是 100/5=20，照它解仍是 5Hz，
向后兼容天然成立，连 `GCODE_VER` 都不用升**。

**验证**：`phase7-2-check.js` **12 项全过**（第 7 项专门验老码兼容），全量回归 29 套零 FAIL 零 ERR、零 pageerror，`audit-tokens.js` 全绿。
回退点 `.workbuddy/backups/index_*_phase7-2-{pre,post}.html`。

#### ✅ 7.3 冲刺赛分享闭环（已完成 2026-09-13）
**起因**：7.2 让 TA 终于能出轨迹码了，但我顺手问了一句「对方点开是什么」——
探针 `probe73.js` 用**全新实例**一测：`G.taMode=false` / `G.taT=0`，
**开的是普通漂移**。种子和影子都到位了，唯独「3 分钟跟我比」这个语境在收端整个丢了。
和 §7 #171 是同一类：**新链路接进老功能时，忘了老功能还有别的入口语义**。

**修法**：码的头部加一个标志字节（bit0 = 冲刺赛），`GCODE_VER` 从 1 升到 2。
解码端按 `b[0]` 分支 —— v2 读标志字节，v1 没有这一字节、按普通局处理：

```
if(b.length<13||b[0]<1||b[0]>GCODE_VER)return null;   /* v1 老码照收 */
let i=1;
const flags=b[0]>=2?(b[i++]||0):0;   /* v2 起第 2 字节是标志位 */
const ta=!!(flags&1);
```

**一个字节的代价**：链接长度 +1.4 字符（2975 → 2977），换回整个分享语义。
**没有为了省这个字节去猜长度或复用 rmask 的空闲位** —— 版本号就是留给这种事的（§7 #175）。

**收端链条**：`gcodeTake()` 里 `G.taMode=!!g.ta` → `startGame()` 里已有的
`if(G.taMode)G.taT=TA_SEC;` 自动就位（7.1 那行不用改）→
`seedFromUrl()` 补一条 `TIME ATTACK` 横幅，让点开链接的人知道自己要跑什么。
分享横幅也区分开：`SPRINT LINK` / `TRACK LINK`。

**验证**：`phase7-3-check.js` **11 项全过**，全量回归 30 套零 FAIL 零 ERR、零 pageerror，`audit-tokens.js` 全绿。
回退点 `.workbuddy/backups/index_*_phase7-3-{pre,post}.html`。

#### ✅ 7.4 冲刺赛模式边界（已完成 2026-09-13）
**起因**：7.3 把分享链路打通之后，我回头查了一遍 `G.taMode` 的生命周期 ——
`grep 'G\.taMode='` 只有**置真**（菜单按钮、7.3 收端、测试钩子），**没有任何复位点**。
探针 `probe74.js` 一量，三个问题：

**A · `G.taMode` 永不复位（严重）** —— 打完一局 TA 回主菜单后它仍是 `true`，
之后**每一局普通漂移都被当成 3 分钟限时赛**：倒计时在跑、分数还不进 nova-best，玩家完全不知情。
修法：复位点放在 **`toMenu()`**（回标题 = 退出冲刺，唯一符合直觉的时机）与 **`resumeRun()`**（续档一律普通漂移）。

**B · TA 局冲掉普通局的续档存档** —— 实测一局普通局（WAVE 11）的存档会被下一局 TA 的自动存档整个冲掉（→ WAVE 2）。
修法：`saveRun()` 里 `flushStats()` 之后加 `if(G.taMode)return;` ——
**统计照常提交**（生涯数据不丢），只是不写续档。TA 是「3 分钟一局」的独立赛道，中途关页就没了，符合"输了不心疼"。

**C · 机库界面说一套做一套** —— 界面照旧显示玩家存下的 `abyss · [swarm+brittle] · 禁[crit+magnet]`，
实际生效的是 `standard · [] · []`；更隐蔽的是**影子指纹对不上**（机库取 `abyss|swarm+brittle|crit+magnet`，
TA 局实际用 `standard|-|-`），机库显示的那只影子根本不是这局会遇到的。
修法：`ghostFpMenu()` 在 TA 下返回 `standard|-|-`；机库三行加 `.tafreeze`（变灰 + `pointer-events:none`），
并加一行说明「限时冲刺 · 3 分钟 —— 本局固定：标准难度 / 无挑战 / 全卡池」。

**注意**：这三处**都不改 TA 本身的行为** —— TA 依旧 180s、standard、独立榜单（第 9 项断言专门守着这条）。

**验证**：`phase7-4-check.js` **10 项全过**，全量回归 31 套回归零 FAIL 零 ERR、零 pageerror，`audit-tokens.js` 全绿。
回退点 `.workbuddy/backups/index_*_phase7-4-{pre,post}.html`。

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
33. **`#boot` 启动遮罩只有加上 `.out` 才 `pointer-events:none`** —— 没淡出时它会吃掉所有点击，
    表现为「点击断言**随机**失败」（4.3b-13 一度命中到一个无 class 的 DIV，`dust` 纹丝不动）。
    点击类断言前先 `waitForFunction(()=>document.getElementById('boot').classList.contains('out'))`。
    截图同理：headless 里 `#boot` 常常不淡出，留档脚本要手动 `hidden=true`。
34. **点面板深处的节点要先滚到位**：节点落在 `#logbook` 滚动区之外时，`p.click(force:true)`
    会静默打空（不报错、状态不变）。先 `scrollIntoView({block:'center'})` 再到
    `p.mouse.click(x,y)` —— 顺便用 `elementFromPoint` 把命中链打进日志，失败一眼能看出谁挡着。
35. **`NOVA.counts` 是属性不是方法**：`NOVA.debug('counts()')` 报 `not a function`，
    要 `p.evaluate(()=>NOVA.counts())`。同理 `NOVA.lang` 实际挂在 `NOVA.death.lang` 下。
36. **`NOVA.logbook.counts()` 数的是 DOM 子节点** —— 不开日志面板时 enemies/bosses/hulls/
    affix/nodes/links **全是 0**，看着像大规模回归，其实只是面板没渲染。回归断言前先
    `NOVA.logbook.open()` + 等 500ms。
37. **历史断言里写死的模块 / 协同数量是一颗地雷**：加卡后 `mods===26 && syn===22` 会在
    4-2 / 4-3 / 4-3b / 3-2 **四处**同时变红（4.4 加三张卡时踩到）。改 `MODULES` / `SYN`
    之后先 grep 一遍 `mods === ` / `syn === ` / `modules=`，连同 4.3 那条
    「各断言脚本里的 `c.hulls===6`」一起改。

### 星图 / 版式（4.3b 星图改版踩到的）

58. **别为了"塞进框里"压缩放 —— 那是文字不可读的根因**。旧版 `fitAch` 按
    `min(bw/cw, bh/ch)` 取小值，桌面 490×298 的框装 1008×688 的内容 → **0.447×**，
    手机直接撞 0.34 地板。改成**只按宽度铺满**（`clamp(bw/cw, 0.4, 1)`），
    纵向放不下就滚动，桌面立刻回到 **1.0×**、手机 **0.9245×**。
    "整棵树一眼看全"是个伪需求；"字看得清 + 能放大"才是。
59. **版式常量要能算出来，不能写死在数据里**。坐标手写（`x:…,y:…`）一旦列数要响应式变化，
    画布尺寸必然错位。改成 `br`/`dp` 槽位后，4 列 / 2 列只是 `treeLayout` 的一个入参。
60. **`d` 不能当字段名** —— 每个节点已有 `d` 存中文描述（`de` 才是英文）。
    用 `d` 当层号会被描述字符串覆盖 → `y` 变 `NaN` → 十几个节点全叠在一处。
    最终取名 `br`（branch）/ `dp`（depth）。**改数据前先 grep 一遍对象已有字段。**
61. **TDZ：`const META=[...]` 声明在引擎之后**。首帧兜底只能调 `layoutAch(4)`，
    `layoutMeta(4)` 必须挪到 `META` 数组字面量结束之后 —— 撞 TDZ 会让整个 IIFE 抛错、
    `window.NOVA` 都挂不上，**症状是整页白屏 + 所有探针报 `NOVA is not defined`**。
62. **缩放按钮必须挂在 `.lb-tree-wrap` 外面**：放里面会跟着 `transform` 一起缩放平移
    （放大 2.5 倍后按钮飞出屏幕）。已断言缩放前后屏幕坐标与宽度不变。
63. **`clampPan` 必须区分"内容比视窗大/小"**：大了夹在贴边区间内，小了居中。
    只夹不居中的话，纵向内容矮的时候树会贴在顶上；只居中不夹的话，一拖就再也拉不回来。
64. **三条缩放入口（滚轮 / 双指 / 按钮）必须都走 `zoomAt`**：各自直接改 scale
    会让内容往左上角跑，表现为"一放大就找不到刚才看的节点"。`zoomAt` 负责把指针下那一点钉住。
65. **SVG 连线用画布坐标系（`viewBox=0 0 ACH_W ACH_H`）**，不要用视窗尺寸 ——
    视窗只是画布的一个可平移窗口，用视窗尺寸会让节点与连线错位。
66. **`setLang` 不会重绘已打开的日志树**：节点文案是绘制时写死的。补上
    `if(!el.logbook.hidden){drawLogbook();fitAch();fitMeta();}`，否则语言热切换在星图上失效。
67. **调试钩子的 `cols` 要取"最近一次布局实际用的列数"**，不要实时量 `clientWidth` ——
    面板未打开时量到 0 → 报 2 列，和已算好的 4 列画布对不上，看着像 bug
    （`ACH_LC` / `META_LC` 就是为这个加的；`live` 字段留给确实要实时量的场合）。

### 新武器行为 / rollChoices（4.4 踩到的）

68. **数值型（`type:'stat'`）不能挂协同** —— 既有规则是「协同只在能力型 × 能力型之间」，
    `NOVA.syn.badDeps` 会把 a/b 里出现数值型的条目直接判坏（4.4 给口径卡配的两条就是这么
    被抓出来的）。**数值卡 = 纯数值成长，不参与联动**，与 hull / thruster / warhead 一致。
69. **`NOVA.syn.effect` 只比对一份写死的字段白名单 `K`** —— 新协同若只改表外字段，
    `audit()` 会报 `changed=0`，看着像「空 apply」（与 3.2 修掉的 9 条假协同同一种症状，
    但成因相反：这次是真生效、白名单没跟上）。**给武器系统加字段要同步补这张表。**
70. **射程别直接乘 `P.rangeLife`** —— 制导弹药 `guided` 的 apply 是**绝对值赋值**
    （`P.rangeLife=1.15*1.2` …），装配顺序不同会互相覆盖，乘在上面的加成**静默失效**。
    新增射程类加成一律走独立的 `P.rangeMul`，在 `fireGun` 里 `life:P.rangeLife*P.rangeMul`。
71. **裂变弹片必须 `sp=0`（不二次分裂）** —— 8 枚各再裂 8 枚，高射速下弹幕数会炸到数百。
    母弹也只在**首次命中**裂一次（`b.sp` 用完置 0），否则高穿透构筑越打越多。
72. **断言弹片数要看「逐帧峰值」而不是推进完的瞬时值** —— 弹片从命中点向四周炸开，
    朝后飞的那几枚会立刻再命中**同一个敌人**而消失（`pierce=0`/`sp=0`）。
    4-4-05 第一版就因此只数到 2 枚（期望 3）。
73. **弹丸是在 `updateBullets` 倒序遍历中 push 的** —— 新弹片落在数组末尾（下标 ≥ 初始长度），
    本帧不会被再遍历一次，安全；但**任何改成正序遍历的改动都会立刻引发无限分裂**。
74. **新武器数值要抽成等级表常量**（`SPRAY_LV` / `SPLIT_LV`，与 `FRAG_LV` 同构）——
    续档是按 `k=1..n` **逐级重放**的，写成 `P.x+=k` 会随重放次数发散。
75. **`rollChoices` 的三张牌位置不要写死 2 能力 + 1 数值**：能力型 16 种 / 数值型 10 种，
    固定 2:1 让能力型早一倍封顶；两类都封顶后池里只剩升等级，比例更没有依据。
    → 能力型封顶后翻转成 1:2（实测数值型封顶 24.2 → 18.4 次升级，达成率 274/300 → 200/200）。
76. **`abilityBoost` 别按「能力型总等级」累加** —— 一局后期发散到 8.26×，而它对能力池内部是
    **统一乘数**，根本改变不了池内排序，只是把「用能力补第三个空位」的概率推到 1。
    改成按**已持有的种类数**（`1+min(size,ABILITY_CAP)*0.15`），天然夹在 1.9 以内。

### 无尽模式 / 轮换与加压（4.5 踩到的）

77. **"每波随机抽一个"就是会重复的** —— 8 选 1 的**无记忆随机**，连续两次同款概率 1/8，
    200 局 × 41–100 波实测**连续重复率 11.58%、148/200 局至少撞一次、同款最小间隔 5 波**。
    这类"随机但不希望连着来"的需求一律上**洗牌袋**；且**每类实体各一个袋子**
    （Boss 与精英巨像共用一份记忆会互相消耗）。
78. **洗牌袋的破口只有三处，逐个堵**：① **重洗瞬间**首项撞上上一只（洗完若 `bag[0]===last`
    就与第二位交换）；② **剧本 Boss 不写回记忆**（W35/W40 走 `BOSS_AT`，45 波首抽仍可能撞它
    → `buildWave` 里定下 `bossKind`/`champ` 就一并写 `G.bossLast`/`G.champLast`）；
    ③ **续档时袋子是空的**（`saveRun` 写 `bb/cb/bl/cl`、`resumeRun` 还原，缺一即前功尽弃）。
    袋子内部不可能残留 `last`（它是刚被 `shift` 走的），别在抽之前加多余的通用去重。
79. **无尽加压不能只加速度** —— 速度是唯一一个"超过阈值就从难度变成不可玩"的维度：
    血量 / 伤害可以指数涨，速度必须封顶（`ETIER_SPD_CAP=1.5`），否则不是变难是不能走位。
    同理，额外敌人数也要封顶（`ETIER_EXTRA_CAP=10`，总数 38 → 48），否则后期"永远清不完"。
80. **加压层要乘在既有成长之上，0 层时必须恒等** —— `spawnEnemy` 里
    `m=(1+0.09*(n-1))*eTierHp()`，`eTierXxx(0)` 全返回 1 / 0，前 40 波因此**逐波断言零回归**。
    新增任何全局倍率前先问一句："它在 0 层时等于 1 吗？" 不等于就是回归。
81. **`banner()` 是替换式、不排队** —— 连调两次只有最后一条生效。要给所有分支统一加后缀，
    就把文案先收进 `bt`/`bs` 变量，**最后只 `banner()` 一次**（逐条补后缀必然漏）。
82. **HUD 的 `HUDC` 缓存不认语言**：波次读数是缓存写入的（`if(HUDC.wv!==s)`），
    `setLang` 里必须清 `HUDC.wv`/`HUDC.el`，否则切语言后 HUD 仍是旧文案
    （与 4.3 过热槽 `HUDC` 不自清同一类坑）。
83. **断言"无饥饿"要看窗口，不能只看均值 / 相邻**：相邻不重复仍可能让某一种巨像几十波不出场。
    用「**任意 16 次连续抽取必须 8 种齐全**」（袋子长 8 → 任意 16 窗必含一整个完整袋子）
    +「同款最大间隔 ≤ 15」。⚠️ 算最大间隔时 `last` 初值必须是 `null` 不是 `-99` ——
    用哨兵值会把"首次出现"算成上百波的间隔（第一版因此报 106 波）。
84. **面板入场动画期间取 `boundingBox()` 是假值**（4.5 全量回归时抓到 4-3b-12 的陈年 flake）：
    `.overlay` 的 `panelIn` 是 0.33s，动画中间帧能差 **8px 位移 / 3px 宽**。
    `openLogbook()` 之后**必须等 500–600ms 再量**，否则「缩放按钮不随内容缩放」
    这类前后比对断言会随机 FAIL（同一份代码，跑两次结果不同）。

### 键位 / 输入（5.1 踩到的）

85. **改绑的捕获分支必须排在 `keys[e.code]=true` 与所有游戏分支之前 `return`** ——
    否则抓键的瞬间会同时触发动作（抓 `P` 当暂停键，游戏当场暂停）。
    同理，捕获期间也不要写 `keys[]`，避免残留一个"永远按下"的键。
86. **撞车用「先撞后清」而不是「弹窗拒绝」**：玩家点第二个槽位时，把旧动作上那一位
    直接清空并弹一条横幅说明，比拒绝绑定顺手得多。清空后必须**整表重绘** ——
    被清空的动作可能在列表任意一行。
87. **键位存档逐动作逐槽位校验，坏值只回退那一个动作**：`Array.isArray` +
    `typeof a[0]==='string'` 两道闸，非字符串一律当空位。整张表失效或抛一次异常，
    玩家就再也进不去设置了。断言里塞 `{"left":"x","thrust":[1,2]}` 这种脏数据验一遍。
88. **`syncKeyHints()` 必须排在 `applyI18n()` 之后** —— HUD 的 ♪ / Ⅱ 两个按钮的 `title`
    是 `data-i18n-t` 托管的（`dataset.zhTitle` 缓存 + 按语言回写），先同步会被那轮覆盖回
    「音效 M」。凡是覆写 i18n 托管属性的逻辑，都要跟在 `applyI18n()` 后面。
89. **别把「关闭面板」这类全局键塞进键位表** —— `Escape` 在日志 / 机库 / 设置里各有语义，
    硬塞进同一张表会把上下文判断挤没。表里只放有明确游戏语义的动作；
    机库 `Digit1-7`、选卡 `Digit1-3`、菜单 `C`/`L` 同理，属于 contextual 快捷键。
90. **引导文案里的按键名要跟着绑定走，但默认渲染必须一字不变** ——
    `{MOVE}` 在未改绑时仍渲染成 `WASD`（玩家认了三年的说法，换成「A / W / D」是自作聪明），
    改绑后才降级成逐个键名。这类"动态化"改造默认要先保住原样。
91. **新增 CSS 别写动画时长字面量** —— R5 会把 `.9s` / `cubic-bezier(...)` 判成违规。
    设置面板的"等待按键"态因此用**静态朱砂描边**而不是闪烁动画，
    顺带不打扰 2-5-11 的 keyframes 清单（那条断言数的是"已定义且被引用"）。

### 手柄 / 摇杆（5.2 踩到的）

92. **摇杆必须「死区归零 + 区间重映射 + 径向归一化」三连** —— 只做死区会让死区边缘
    突然跳到 0.22（手感断层）；只做重映射不做归一化，斜推模长 1.414，
    斜着飞比直着飞快 41%。顺序不能换：先判死区、再重映射、最后按模长归一。
93. **手柄转向要保留模拟量，不能退化成开关** —— `PAD.ax` 是浮点，
    与键盘的 ±1 叠加后统一 `clamp(-1,1)`。写成 `ax>0?1:0` 摇杆就只剩"推到底"。
    判据：满推的转向量应与按 D 键**完全相等**，半推约为其一半。
94. **边沿（press）只在按下的那一帧为真** —— `padScan()` 用 `now & ~prev` 算，
    所以同一帧里调两次 `padScan()` 第二次必为 0。断言里想连续跑两个 UI 动作，
    要么自己塞 press（`NOVA.pad.ui(dt, press)`），要么分帧 hold。
95. **`B` 键分支必须排在"可聚焦列表为空就 return"之前** —— 否则没有按钮的面板里
    B 被静默吞掉，玩家困在页面里出不去（5.2 实测：日志页）。
    同理 `padTargets()` 漏掉任何一个面板 = 那个面板手柄完全不能操作。
96. **`padBack()` 要逐条对齐 `Escape` 的语义**，不能只写"关当前面板" ——
    设置 / 日志 / 机库 / 暂停各有归宿（机库 B 回菜单而不是回主界面上一层）。
97. **拔掉手柄必须零残留** —— `padScan()` 取不到 gamepad 时走 `padClear()`，
    把 `ax/ay/fire/brake/now/prev/press` 全部归零。只清 `on` 的话，
    飞船会保持拔掉瞬间的朝向一直转。
98. **`Select` 开设置要照抄 `KeyO` 的守卫** —— 在 `play` 中同样被拒（对局中开设置
    会打断游戏）。这不是 bug，写断言时别把它当 bug 修。
99. **无头测试没有真手柄**：走 `PAD_TEST` 注入（16 个按钮 `{pressed,value}` + 2 轴）。
    ⚠️ 所有 UI 断言要以 `NOVA.pad.hold(0,0,0)` **插入一支手柄**开头，而不是
    `NOVA.pad.clear()` —— `padUI()` 要求 `PAD.on`，拔着线跑 UI 当然是零响应。

### 设置项 / 画质 / 色盲（5.3 踩到的）

100. **色盲色板不能写进 CSS** —— R1 会把它当「字面色值」判违规。放 JS 表 `CB_PAL`，
     并把表名加进 `audit-tokens.js` 的动态放行列表（与 `HULL_TINT` / `TRAIL_RAMP` / `BOSS_STYLE`
     同类，属色板数据）。**`:root` 是 R1 / R5 的豁免区**，只有那里能写字面色值。
101. **`PAL` 原来是启动时的快照** —— 换掉 CSS token 后画布颜色纹丝不动。
     必须改成 `let PAL=readPal()`，并在 `applyCb()` 末尾重读一次，否则「改了个寂寞」。
     新增 PAL 键要同时加进 `NAMES`，否则 `PAL.foe` 是 `undefined`、`RGBA()` 返回品红。
102. **只重映射承载信息的色，中性色一个都不动** —— 换 steel / ink / white / line 只是换皮，
     不解决辨色，还会把「结构 vs 内容」的层次一起塌掉。断言要**同时**验
     「中性色没被动」和「信息色都动了」两条。
103. **色盲选色要量，不要凭感觉** —— 用 Viénot 矩阵把候选色模拟一遍，
     要求关键对在模拟后的 sRGB 距离 ≥ 90；**并断言基础配色不过线**（实测 61 / 36 与 61 / 38）。
     基础配色若也过线，说明阈值太松、这条断言根本没在测东西。
104. **敌方弹丸的色必须走 token** —— 原本写死 `#ffb08a`，色盲模式改不到它，
     而「敌我弹」正是辨色的第一现场。新增 `--c-foe` / `--c-foe-rgb` 并加进 `NAMES`。
105. **`FX.dropFluid()` 是单向的**（`fOk=false` 之后无法恢复）—— 设置项要能来回切，
     必须补 `setFluid(on)` + 原始能力位 `fCap`；WebGL 上下文丢失时 `fCap` 也要一起置 false，
     否则「能力已永久丢失」仍会被当成「只是关掉了」。
106. **手动画质档要真的锁死** —— `qualityWatch` 加 `if(!Q_AUTO)return`，
     否则玩家选了「高」照样被自动降级，这个选项等于没用。
     断言：手动档喂 200 帧 20fps 不许降；自动档同样输入必须降。
107. **`applyQuality()` 里改完 `qTier` 必须再 `resize()`** —— DPR 取
     `min(devicePixelRatio, qTier>=2?1:2)`，先 resize 后改等于没改。
108. **设置面板的控件会随语言整片重绘** —— 监听要用**事件委托**挂在面板上，
     逐个绑必漏；并且控件一定要用 `<button>`（`#optRm` 一开始写成 `div`，
     鼠标点得动，但 `padTargets()` 只收 `button`，手柄够不着）。
109. **R5 会在 cssRest 里抓时长字面量** —— 减弱动态不能写 `animation-duration:0s`，
     要先在 `:root` 定义 `--ambient-rm:0s`，再 `html[data-rm]{--ambient-1:var(--ambient-rm)}`。

110. **断言里「生成一只敌人测数值」是天生 flaky 的** —— `applyAffix()` 有
     `min(0.05+0.011*Wv.n, 0.20)` 的概率给精英词缀，词缀会乘血量 / 伤害。
     4-5-05 就因此偶发 FAIL（W40 抽到词缀 → 13.53 变 28.41 → 比值 6.55 不过线）。
     修法：循环生成直到抽中一只 `!e.affix` 的，量到的才是纯波次成长。
     **凡是拿单只敌人当基线的断言都要先排除词缀。**
111. **新增设置分节会顶掉「面板里第一个 `.sec-head`」** —— 5-1-11 写的是
     `document.querySelector('#settings .sec-head')`，5.3 把「显示与性能」插到
     「键位」之前，它就读到新的那一节。断言要按 `data-i18n` 取自己那一节，别取第一个。

### 性能 / 降级（5.4 踩到的）
112. **「降档」和「少干活」是两件事** —— 改前 `qTier` 只管 DPR 和几处几何细节，
     粒子 / 残骸 / 残影上限全是常量，看门狗降到 2 档屏幕上东西一个没少。
     **每加一种新特效，都要问一句「它随档位收缩吗」**，否则降级路径就是摆设。
113. **headless 里量墙钟 = 量噪声** —— 软件渲染把单帧放大到 40–60ms 且抖 ±20%，
     消融法实测同一项两次差 40ms，还能量出「省 −4146%」。
     要断言「少干了活」就用**绘制调用次数**（`NOVA.bench.ops`），确定性、可复现。
     （真要在 headless 里测耗时，也必须先 `NOVA.bench.hold(true)` 冻住 rAF ——
     否则主循环一边抢 CPU，一边把残影 / 电弧 / 飘字持续抽干，场景根本钉不住。）
114. **包裹 `CanvasRenderingContext2D.prototype` 计数必须还原** —— 原型被污染后
     每一帧都在计数，退出去就再也测不准了；而且它会连流体层 / 粒子层一起计，
     所以只能在 `BENCH_HOLD` 下用（主循环冻住，只有手动调的 `draw()` 在跑）。
115. **压力场景里同批创建 = 同时过期** —— 稳态会在「满」和「空」之间跳，
     测到的数取决于抽样落在哪一帧。生成时要把 `t` 用 `rand()` 错开年龄。
     同理 `bench.fill()` 是**故意绕过入口钳制**去钉死场景的，
     所以验上限要用 `bench.trim()` 而不是看 `fill()` 之后的数量。
116. **`qbSync()` 不能塞进 `resize()`** —— `resize()` 在脚本求值时就跑了一次，
     那时 `G` 还在 TDZ，直接 ReferenceError。挂点只能是 `applyQuality()` /
     `qualityWatch()`；`trimFx()` 里另留一行 `typeof G==='undefined'` 兜底。
117. **`updateAim()` 不在 `updateWorld()` 里** —— 真实 `frame()` 中它是单独一步。
     只跑 `updateWorld` 的话船头朝哪全凭初始角度，子弹全打空，
     测出来「0 击杀」是假的（5-4-10 一开始就栽在这）。
118. **`buildWave(n)` 只登记波次、不落敌** —— 想测「打得死人」得自己
     `spawnEnemy(EN_LIST[0], …)` 围一圈；基础 `P.dmg=1` 打 10 秒也就能蹭死一个，
     断言阈值要有意义就得先把 dmg 提上去。
119. **`spawnEnemy` 的第一个参数必须是 `EN_LIST` 里的真名** ——
     写 `'drone'` 这种想当然的名字不会报错，只会生出一只打不死的怪。
     `EN_LIST = Object.keys(EN_UNLOCK)`，共 24 个。
120. **`#settings` 里 `.optrow` 只有 3 个**（画质 / 色盲 / …），不是 7 个 ——
     特效开关在 `.toggrid` 里。**断言要按 id 取**（`#optQuality .segb` = 4、
     `#optCb .segb` = 3、`#optFx .tog` = 4），别按 `.optrow` 数。

### 触屏 / 移动端（5.5 踩到的）
121. **测「模拟量」不能给足时间** —— 摇杆是「角度跟随」（`clamp(angDiff)` 夹到目标角），
     给 0.5s 连最小幅度都够转满，测出来「推 3px 和推 46px 一样快」是这个夹取造成的假象。
     **取 8 帧（0.133s）**，这段时间内满舵也到不了目标角，转角才与幅度成正比。
122. **`env(safe-area-inset-*)` 只在 `:root` 里读一次**，收敛成 `--safe-t/r/b/l`，
     其余一律 `calc(原值 + var(--safe-*))`。散着写的下场是「改一处漏三处」。
     前提：`<meta viewport>` 必须有 `viewport-fit=cover`，否则 `env()` 恒为 0。
123. **`orientHint()` 不能从 `resize()` 里调** —— `resize()` 在脚本求值时就跑了一次，
     那时 `G` 还在 TDZ，**连 `typeof G` 都会抛 ReferenceError**。
     单独挂 `resize` / `orientationchange` 监听。
124. **`setTouch()` 里也要重算依赖 `isTouch` 的东西** —— 只调了 `guideRefresh()` 不够，
     竖屏提示同样依赖它；漏了就只有「先触屏再开局」这一种顺序才显示。
125. **触屏会合成 mouse 事件** —— 判断真鼠标必须用 `pointerType==='mouse'`，
     只听 `mousedown` 会让触屏笔记本在两种模式间反复横跳。
126. **重锚要保持连续，不能归零** —— 手指拖远时把底盘挪到「手指 − R」处，
     杆仍停在满舵边缘；若把底盘瞬移到手指下，`dx/dy` 归零会让船突然停转。
127. **`hidden` 元素的 `getBoundingClientRect()` 全是 0** ——
     `#firebtn` 在菜单态是 hidden，量出来「距右 390px」其实是视口宽度。
     测贴边 UI 前必须先进入对局让控件显示。
128. **测「打得死人」别让船一路满舵推到底** —— 10 秒能跑 3000px，
     既撞上世界边界（速度被钳 0），也飞出了敌人圈；那时 0 击杀是测试自己造成的。
129. **测 touchmove 逻辑要派发合成 `TouchEvent`** —— `NOVA.touch.set()` 直接写 `joy.dx/dy`，
     绕过了 `touchmove` 里的重锚与 `#joybase` 显隐，截图上什么都不会出现。
130. **A/B 测量时场景只能钉一次** —— 5-4-07 原本「两次测量各跑一遍 `bench.stress()`」，
     而 stress 会重随一次 Boss（无尽波 60 必出巨像），**不同巨像的 drawImage 基线不同**，
     差值里混的是「换了尊 Boss」而不是被测的 bloom，实测因而出过高 −3（应为 +1）。
     **凡是「同一场景开/关某特性比差值的」断言，中间不能重建场景。**
131. **Playwright 的 `p.click()` 是真鼠标** —— 在 5.5 之后它会触发
     `pointerType==='mouse'` 分支把 `isTouch` 置 false，依赖触屏态的控件当场消失，
     于是「点一下」永远点不到。触屏断言一律用 `p.tap()`（真机手指是 `pointerType==='touch'`）。

### 排行榜 / 分享 / 截图（5.6 踩到的）
132. **`applyI18n` 用 `querySelector` 只取第一个匹配** ——
     同一个 `data-i18n` 出现两次时，**第二个永远不翻译**。
     两个面板都要「分享卡片」按钮就得用两个键（`o_share` / `v_share`）。
     写完新按钮务必确认键名全局唯一（`grep -c 'data-i18n="键名"'` 应为 1）。
133. **localStorage 键名要压短** —— 只有 ~5MB，排行榜这类「一局一条」的数据
     用长键名是纯浪费。记录内部字段名同理（`{s,w,k,l,t,h,d,m,v,at}`）。
134. **`boardAdd` 的 `indexOf(r)` 依赖对象引用** —— 传进去的若是副本（或 JSON 往返过），
     永远返回 −1，名次就成了 0。断言要连「进榜 / 挤不进」两种返回值一起测。
135. **画布类断言别取文字像素** —— 描边文字的实心像素很稀疏，指定坐标极易落空。
     要验「卡片颜色跟随色盲 token」，直接读 `shC('amber')` 换档前后的返回值，稳且直观。
136. **`grabShot()` 拍不到流体星云层** —— 那是独立的 WebGL canvas，不在主画布上。
     这是预期：想要合成图得先把两个 canvas 叠一次。
137. **新增浮层要同步三处**：`el` 缓存 · `padTargets()` 的 root 列表 · `padBack()` 的关闭分支。
     漏 `padTargets` = 手柄 / 十字键够不着；漏 `padBack` = 按 B 关不掉。
     同理 `toMenu()` 里要一并 `hidden=true`，否则回主菜单时浮层还挂着。

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

### 种子与确定性（6.1 踩到的）
138. **加权取样 `wsample` 用的是 `Math.random()`，不在种子流里** —— 三张卡全靠它，
    所以「同种子」改前连选卡都复现不了。加随机源前先确认它走的是哪个 `rand`。
139. **光把随机点接进种子流不够，必须键控重播种** —— 战斗每帧消耗 `rand()`，
    战斗时长一变，后续编队与选卡就漂。`buildWave`/`rollChoices` 入口用 `seedAt(k,i)`
    把流拉回 `f(原始种子, 上下文, 序号)`。
140. **战斗层（弹道 / AI 出手 / 走位 / 暴击 / 粒子）故意留在 `Math.random()`** ——
    它们的调用次数由玩家决定，进流反而会毁掉布局的确定性。
141. **6 位短码装不下 32 位整数** —— 上界取 `36^6-1`，超出的必须折叠，
    且**显示 / 解析 / 落种三处同一个折法**。用 `Math.min` 夹会让所有超限种子
    显示成同一个 `ZZZZZZ`（每日挑战的种子就是超限的，踩到了）。
    每日改成显示日期而不是码 —— 它的种子由日期算出，本来就不该给码。
142. **Python 补丁吃掉换行 = 静默注释掉下一行** —— 插入 `seedAt(...);   // 注释`
    忘了补 `\n`，结果 `Wv.qA.length=0;Wv.qE.length=0` 变成注释内容，队列只增不清。
    **每个插入都以 `\n` 结尾，插完立刻读回来验。**
143. **测「boot 后状态」不能只等 `G.mode==='menu'`** —— boot 是分帧异步的，
    启动过程中 `G.mode` 本来就短暂等于 `'menu'`，等待会**在 boot 中途就返回**，
    URL 直达那条永远测不到。要等的是「boot 完成后预期的值」（如 `'play'`）。

144. **`startGame` 里 `G.dailyMode` 在判定前就被清零了** —— 想「每日挑战固定标准难度」，
     写 `G.diff=G.dailyMode?'standard':G_DIFF` 永远走到玩家自选那一档：
     上面那行 `G.dailyMode=false` 已经把它清了。**判据要用 `G.daily`**（非 daily 局会被置 null）。
145. **量「每波敌人数量」必须固定种子** —— 编队主题 `sq` 是随机的，`sq.s` 一变总数就变，
     不固定会量出「巡航 24 > 标准 21」这种假象。固定后 18 / 21 / 25 正常递增。
146. **加分系数要收进一个函数** —— 原本 5 处 `G.score+=`，难度系数若在其中一处漏乘，
     榜上分数就静默错档。统一成 `addScore(v)` 后只可能全对或全错，不会错一半。
147. **难度只改「打你多痛」，不要改玩家输出** —— 否则玩家会把「深渊打不动」
     误读成「这把构筑不行」。玩家侧手感必须跨档一致。
148. **`hurtPlayer` 里 `dmg` 后面还要被 `P.ram` 再乘** —— 加难度系数时用 `let` 声明新变量
     （写成 `const dmg=...` 会在 `dmg*=` 处直接 TypeError）。

### 无头断言（跨阶段）
149. **前置条件的阈值不能贴着"填充上限"** —— `5-4-02-trim` 原写 `a.parts > 400`，
    而 `bench.fill` 最多 40 轮 × `burst(10)` ≈ 400（实测 384 / 389 / 404 都出现过），
    阈值正好卡在天花板上 → 偶发假失败。**改成随预算表自适应**（`a.parts > bd.parts*2`），
    既安全又仍有意义。修断言前先确认它是阈值问题而不是真回归（6.2 那次就是这样误报的）。

### 无头断言（跨阶段）
149. **前置条件的阈值不能贴着"填充上限"** —— `5-4-02-trim` 原写 `a.parts > 400`，
    而 `bench.fill` 最多 40 轮 × `burst(10)` ≈ 400（实测 384 / 389 / 404 都出现过），
    阈值正好卡在天花板上 → 偶发假失败。**改成随预算表自适应**（`a.parts > bd.parts*2`），
    既安全又仍有意义。修断言前先确认它是阈值问题而不是真回归（6.2 那次就是这样误报的）。

### 自定义挑战（6.3 踩到的）
150. **六个应用点每帧只能 `modNow()` 一次** —— 别在 `spawnEnemy` / `spawnAst` /
    `buildWave` / `hurtPlayer` 各调一遍 `rmodMul('hp')`，各自飘就难定位。统一快照。
151. **得分系数用累加，不用连乘** —— 三个 0.35 连乘是 ×2.46，玩家感觉「加了这么多怎么只多
    50% 分」会以为 bug。改成 `1 + Σ sc`（×2.05）体感更线性，也避免叠满爆表。
152. **船体上限倍率必须排在 hull.apply + 局外加成之后** —— 否则脆命的 ×0.5
    会被 hull 的 +20/+60 / 局外节点的 +15 盖掉，等于没生效。在 `applyMetaBonuses()`
    后面调 `applyRmods()`。
153. **`G.rmods=[]` 也是有效状态，判据用 `Array.isArray` 不要用长度** ——
    长度判会回落到菜单里那一份，等于局内偷偷生效（与 G.diff 同一条规矩）。
154. **每日挑战必须强制清空 Modifier** —— 与 6.2 同理：「同日必须可比」，
    在 `startGame` 里 `G.daily ? [] : G_RMODS.slice(...)`。
155. **量补给间隔用「30 次采样的最小值」** —— `rand(7,12)` 单次采样 ±40%，
    直接断言「×2.2」会假失败。多次采样取最小区间，稳定。
156. **EN_LIST[3] 等若干敌种没有 `spd` 字段** —— 量 spd 加成必须先 `ENEMY_DEFS[id].spd !== undefined`
    否则 e.spd 是 undefined，`a.spd/b.spd` 出 NaN。改成 EN_LIST[7] bastion 之类有 spd 的种。
157. **断言里 `{...}.x` 是块语句不是对象** —— `JSON.stringify({d:...}).d` 在
    `(()=>{...})()` 里会被解析成 `{...}` 代码块后 `d` 未定义。
    改成先 `var A=arguments0; A.d;` 再用。

### 卡池工坊（6.4 踩到的）
158. **测试模块 id 必须先列一遍真名** —— 我随手写的 `shield/rapid/cluster/tor/nano/ice`
    一个都不是 `MODULES` 里有的，filter 全部返回空、`G_BAN=[]`，
    「禁用后 0 次出现」与「禁用前后无差异」是**同时成立**的伪命题。
    第一次跑 9 通过 / 5 失败全是这个原因。**先 probe 一次模块清单再写断言**。
159. **NOVA.debug 不包 JSON.stringify** —— `NOVA.debug = code=>eval(code)`，返回的是
    eval 原始结果。断言脚本里的 helper `ev(p, code)` 又对它 `JSON.parse` —— 返回值必须是
    已 stringify 的字符串，否则 `Unexpected token` 报错。
    写完一段返回原始值的代码想 `await ev()`，必须自己包一层 `JSON.stringify(...)`。
160. **断言里 chip 顺序按 `MODULES` 定义序，不是点击序** —— pierce(5) < crit(9) < magnet(10)
    即使按 crit→pierce→magnet 顺序点击，`on` 数组仍是 `['pierce','crit','magnet']`。
    直接 `JSON.stringify(on)===JSON.stringify(['crit','pierce','magnet'])` 是假阴性。
    写 `['pierce','crit','magnet']` 或者**只比长度不比对顺序**。
161. **禁用过滤必须排在 rarity/cap 之前** —— 禁一个未拿过的模块会改变 offer 构成，
    禁一个已 maxed 的本来就不该出现，剔除前后等价。**写在前面不亏**：两边都对，
    写在后面就漏掉第一类场景。
162. **pre-backup 必须是脚本第一步**（不是口头约定）—— 6.3 那次口头"已创建"但实际没写、
    会话边界重新说一遍也以为有了，结果只拿到 git HEAD-1 兜底。**从 6.4 起第一件事**就是
    `cp index.html .workbuddy/backups/index_*_phaseX-N-pre.html`。

163. **`G.gn` 必须跟着抽稀折半**（6.5）—— 否则下一帧的 `want=floor(runT/gdt)+1`
    会瞬间落后几千点，`guard<20` 一旦用尽，影子时间戳与实际采样率对不上，
    整条轨迹压缩成一条直线。**抽稀 = 三个量一起动**：扁平数组下标步长 2、`dt*2`、
    `gn=Math.floor(gn/2)`，缺一个就翻车。
164. **`loadOpts` 必须判 `k in s`**（6.5）—— 老存档里根本没有新增开关的键（`ghost`），
    无条件 `OPTS[k]=s[k]?1:0` 会把新功能对老玩家默认关掉，等于白做。
    改法：`if(k in s)OPTS[k]=s[k]?1:0;`（已有键行为不变，新增键在缺失时保持默认）。
167. **`navigator.clipboard.writeText` 必须挂 `.then(成功, 失败)`**（6.6）—— 它返回的 promise 在 file:// 与无用户手势场景必拒，`try/catch` 抓不到、直接冒成 pageerror。挂 `.then(()=>setHint(true), ()=>setHint(false))` 吃掉 —— **两参形式才是「成功和失败都跑」**。绝对不要把 `done=true` 设在 `navigator.clipboard.writeText(url)` 之后：它的同步执行成功 ≠ 异步的写入成功。
166. **存档漏字段 = 续档静默降级**（6.5 修掉的 6.2/6.3/6.4 既有缺陷）—— `saveRun()`
    只写了 `b:G.build`，没写 `G.diff / G.rmods / G.ban`。后果不是"少个功能"而是**悄悄换规则**：
    `G.diff` 缺失 → `diffNow()` 回落到菜单当前选择 → **局内改菜单就能改本局数值**，
    「开局后冻结」这条规矩被绕过；`G.rmods` 空 → `modNow()` 全 1；`G.ban` 空 → 禁用池失效。
    **加任何"开局冻结"的局内配置时，saveRun / resumeRun 必须成对改**，只改 startGame 等于只做了一半。
176. **「有置真就一定要有复位」**（7.4）—— `G.taMode` 只有三处置真（菜单按钮 / 收端 / 测试钩子），
     **没有任何复位点**，于是打完一局 TA 之后它永远为真，之后每一局普通漂移都被当成限时赛。
     这类"模式开关"写的时候想的是"怎么打开"，**"什么时候关"必须同时想清楚**，
     并且用 `grep 'X='` 把所有赋值点列一遍确认成对。
     复位时机要选符合玩家心智的那个：这里是「回主菜单 = 退出冲刺」+「续档 = 普通漂移」。
177. **探针测错了对象，会得出反向结论**（7.4）—— 我第一版 probe74 用 `NOVA.ta.start()` 进 TA
     再去验"TA 会不会覆盖普通局存档"，结果 `startGame()` 本身就 `archiveSave + clearSave`，
     测出来的是 startGame 的行为；改成"开完局再单独置 `G.taMode=true`"才量到真东西。
     **用高层钩子搭场景时，先确认这个钩子自己有没有副作用。**

174. **探针自己也会踩「没复现真实路径」的坑**（7.3）—— 第一版 `probe73.js` 在同一个页面里
     `NOVA.ta.start()` 之后再测"对方点开链接"，而 `G.taMode` 是**内存态**，
     上一步留下的 `true` 让探针得出「模式位能传」的错误结论。
     **验证"另一个人会怎样"必须用全新浏览器实例**（`file://` 下 localStorage 还跨 context 共享，
     要连 context 一起换）。与上一条 #169 同源：**探针与测试钩子一样，必须复现真实路径**。
175. **版本号该升就升**（7.3）—— 给已有二进制格式加字段时，我第一反应是复用 `rmask` 的空闲位
     或者按总长度猜—— 都是在给自己埋雷（`RMODS` 涨到 8 个就当场炸）。
     加一个字节 + `GCODE_VER` 1→2 + 解码端按版本分支，成本是一个字节，
     换来的是「老链接永远能开」这件确定的事。**格式里专门留了版本字段，就是干这个用的。**

171. **「分享不出来」的根因常常在入口，不在编码**（7.2）—— `gcodeMine()` 首行就是
     `if(!G.seed)return ''`，而新加的 TA 入口不带种子，于是功能**静默失效**：
     不报错、不崩溃、结算面板只是少一个按钮，肉眼根本看不出来。
     **新增任何"可分享 / 可复现"的入口时，回头检查它是否满足既有功能的前置判据**
     （种子 / 点数 / 模式位……），最好写成断言而不是靠眼睛看。
172. **解码端不能写死编码端的常量**（7.2）—— `gcodeDec` 里 `dt:1/GCODE_HZ` 写死了，
     而头部**本来就已经带了 hz 字段**。只要编码参数从"唯一常量"变成"按模式取值"，
     写死就立刻错位（TA 的 4Hz 码被按 5Hz 播，速度快 25%）。
     教训：**格式里已经有的字段，解码端必须读它** —— 向后兼容天然成立，连版本号都不用升。
173. **覆盖率与精度要分开量**（7.2）—— 我一开始拿 5Hz×90s 的 p95 8.00px 和 4Hz×180s 的
     8.94px 直接比，得出"4Hz 几乎没变差"—— 其实后者覆盖了 180s（含更多机动段），
     比的是**不同区间**。**不同覆盖秒数的误差不可直接比**；
     要同时摆出 覆盖秒数 / 位置误差 / 角度误差 / 链接长度 四维再下结论。

168. **大段插入必须确认落点的作用域**（7.1）—— 我用"插在某函数之前"的方式加了整个 TA 模块，
    锚点行选中了 `resumeRun()` 内部的一行，结果 `TA_SEC` / `taTick` 全成了 `resumeRun` 的局部变量，
    外面一调就是 `ReferenceError`，症状是**一串测试同时报 not defined**。
    **搬移要用行号 + 内容双断言**（先 `find` 起止行、再 `assert` 块内含 `const TA_SEC=180;` 等 5 个签名），
    不要靠"我记得它插在那儿"。
169. **测试钩子必须复现真实按钮路径**（7.1）—— `NOVA.ta.start()` 一开始只调 `startGame()`，
    没先把 `G.taMode=true` 置上（菜单按钮是 `G.taMode=true;G.dailyMode=false;openHulls()`），
    于是 12 项测试里 9 项拿到的都是"普通局"的数据，报错全是 `taT=0` / `mode=play` 这种
    **看起来像游戏 bug、其实是钩子偷懒**的假阴性。钩子要复现玩家路径，不能只调一半。
170. **「不写 nova-best」不是加个分流就完事**（7.1）—— `taSettle()` 绕开 `showOver()` 只是堵住了一条路，
    `flushStats()` 里还有一行"最高分随进度实时刷新"（**与结算面板无关，局中每 2 秒就写一次**），
    `showVictory()` 里还有一条。**三处都要按 `G.taMode` 隔离**；
    HUD 的 `BEST max(best,score)` 读数同理，TA 局只报真实历史最高，别让冲刺分冒充历史纪录。

165. **读档校验下界是 6 而非 9**（6.5）—— 6 是「两个采样点」的最小长度（`[x,y,ang,x,y,ang]`），
    测试里两条点的短轨迹是合法数据，按 9 判会被静默丢掉，表现为"存了却读不回来"。
    同时 `g.n=Math.min(g.n|0,Math.floor(g.pts.length/3))` 钳制越界 —— 手改 / 半截写入的脏数据
    在这里一次性挡掉，不必每次去算 `n*3===pts.length`。

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
| | 2026-09-13 | **Phase 7.4 冲刺赛模式边界完成**。查 `G.taMode` 生命周期时发现**只有置真、没有复位** —— 打完一局 TA 后它永远为真，之后每一局普通漂移都被当成 3 分钟限时赛（倒计时在跑、分数还不进 nova-best，玩家完全不知情）。顺带量出另外两个：TA 局的自动存档会冲掉玩家正在打的普通局存档（WAVE 11→2）；机库照旧显示 `abyss+蜂群+脆命` 而实际生效 `standard/无/无`，**影子指纹也对不上**（机库取 `abyss|swarm+brittle|crit+magnet`，实际 `standard|-|-`）。三处修法：① `toMenu()` 与 `resumeRun()` 复位（回标题 = 退出冲刺）；② `saveRun()` 在 `flushStats()` 之后 `if(G.taMode)return;`（统计照交，不写续档）；③ `ghostFpMenu()` 在 TA 下返回 `standard|-|-` + 机库三行 `.tafreeze` 变灰不可点 + `#taNotice` 说明行。**都不改 TA 本身的行为**（180s / standard / 独立榜单，第 9 项断言专门守着）。10 项断言全过，31 套回归零 FAIL 零 ERR、零 pageerror，`audit-tokens.js` 全绿。回退点 `index_*_phase7-4-{pre,post}.html`。**踩坑**：模式开关要成对想"怎么开 / 什么时候关"（§7 #176）· 探针用高层钩子搭场景前先确认钩子自身有无副作用（§7 #177） |
| | 2026-09-13 | **Phase 7.3 冲刺赛分享闭环完成 → Phase 7 收官**。7.2 让 TA 能出码之后顺手问了一句「对方点开是什么」，探针（全新实例）实测 `G.taMode=false / G.taT=0` —— **开的是普通漂移**，种子和影子都到位、唯独「3 分钟跟我比」这个语境在收端整个丢了（与 §7 #171 同类：新链路接进老功能时忘了老入口的语义）。修法：头部加一个标志字节（bit0 = 冲刺赛），`GCODE_VER` 1→2，解码端按 `b[0]` 分支、**v1 老码照收且按普通局处理**；`gcodeTake` 置 `G.taMode`，7.1 那行 `if(G.taMode)G.taT=TA_SEC` 自动就位；`seedFromUrl` 补 `TIME ATTACK` 横幅交代，分享横幅区分 `SPRINT LINK` / `TRACK LINK`。**成本只有一个字节**（链接 2975→2977 字符）。11 项断言全过（含 v1 老码兼容与 ver 0·3·9 一律 null），30 套回归零 FAIL 零 ERR、零 pageerror，`audit-tokens.js` 全绿。回退点 `index_*_phase7-3-{pre,post}.html`。**踩坑**：探针自己在同页面里测收端被内存态污染，得出过错误结论（§7 #174）· 加字段就升版本号，别复用空闲位或猜长度（§7 #175） |
| | 2026-09-13 | **Phase 7.2 冲刺赛闭环完成**。探针先量出一个**静默失效**：`gcodeMine()` 首行判 `!G.seed`，而菜单进 TA 不带种子 → 实测返回空串，TA「分享一条链接跟你的影子比」这条核心玩法根本出不来。三处修法：① `startGame` 加 `else if(G.taMode)` 自动落种子（手填仍优先），并把 `taSettle` 的种子行从「藏」改成 `setSeedLine` 显示；② 轨迹码按模式取值 —— 普通局 5Hz×90s 不变，**TA 4Hz×180s 覆盖整局**（探针实测拐点：2.5Hz 虽只贵 5.7% 但角度 p95 38.8° 太粗，5Hz 贵 99% 精度却几乎不涨）；③ `gcodeDec` 的 `dt` 改读头部 hz（原来写死 `1/GCODE_HZ`），顺手修掉 latent bug 且**老码头里存 20=5Hz，向后兼容天然成立、不用升 GCODE_VER**。12 项断言全过（含老码兼容专项），@@REG@@，`audit-tokens.js` 全绿。回退点 `index_*_phase7-2-{pre,post}.html`。**踩坑**：新入口要回头查既有功能的前置判据（§7 #171）· 解码端不能写死编码端常量（§7 #172）· 不同覆盖区间的误差不可直接比（§7 #173） |
| | 2026-09-13 | **Phase 7.1 冲刺赛（Time Attack）完成**。3 分钟倒计时冲波次：菜单 `TIME ▸ 限时冲刺` → 开局冻结 `diff=standard`/`rmods=[]`/`ban=[]` 并 `G.taT=180`；`taTick(dt)` 只在 `play`/`inter` 衰减，归零即 `die()`（死亡或时间到都走 `taSettle()`，**不**走 `showOver`）。`taSettle()` 走独立榜单 `nova-tattack` Top10（wave 降序、平局按剩余秒升序），**不写 nova-best / 不 commitDaily / 不出星尘** —— 为此把 `flushStats()`、`showVictory()`、HUD `BEST` 读数三处 `G.best` 写入/显示都用 `G.taMode` 隔离掉（只有一处是"结算面板"，另外两处在局中每 2 秒就写一次，见 §7 #170）。`boardRec` 增 `m:3`、`bdMode` 增「限时 / TIME」。HUD `#tatime` ≤10s 转朱砂。13 项断言全过，%s，`audit-tokens.js` 全绿。回退点 `index_*_phase7-{pre,post}.html`。**踩坑**：大段插入落进了 `resumeRun()` 内部（§7 #168）· 测试钩子没复现按钮路径（§7 #169） |
| | 2026-09-13 | **Phase 6.6 轨迹码完成 → Phase 6 收官**。把「种子 + 难度 + 挑战 + 卡池 + 前 90s 飞行轨迹」压成 base64url 短码（**3.01B/点已是差分+varint 的最优下界**，由探针 probe66.js 实测）塞进 `#g=`，别人点开同地图 + 一只你的影子陪着飞。**先量后改**：不是拍的，是跑探针拿到的下界。**只在有种子局生成** —— 随机局地图不同，影子没有可比性（与 6.1 同条规矩）。`gpAt()` 通用插值函数从 6.5 抽出复用，重采样与源步长无关。**优先级**：链接里的影子 > 本机最佳影子，用完即清回落到本机最佳。机库行「来自链接」琥珀标记，**不显示清除键**（外来影子只本局生效）。`gcodeShare()` 三层兜底：clipboard API → `execCommand` → **把完整链接摆出来让玩家手动复制** —— URL 摆出来玩家看得见自己分享的是什么，这条兜底是核心。`seedFromUrl()` 扩展 `#g=` 解析。14 项断言全过，27 套回归零 FAIL 零 ERR，`audit-tokens.js` 全绿。回退点 `index_*_phase6-6-{pre,post}.html`，截图 `phase6/6-6-s1…s4-*.png`。**踩坑**：`navigator.clipboard.writeText` 返回的 promise 拒收时 `try/catch` 抓不到、直接冒 pageerror（详见 §7 #167）|
| 2026-09-12 | **Phase 6.5 幽灵回放完成**。按 10Hz 采样（`GHOST_DT0=0.1`）+ 扁平数组存轨迹，满了就地 2:1 抽稀 `dt` 翻倍 `G.gn` 折半（三个量同步动，少一个翻车），时长无上限；按「难度 + 挑战 + 卡池」指纹分组存本机最佳（最多 6 组 LRU），每日挑战另起一组。`ghostSave()` 同组配置下低分不覆盖高分；`ghostAt()` 线性插值 + 角度走最短弧避免 `±π` 跳变时整船翻面；`drawGhostRun()` 钢蓝虚线影子 + 220 段同步生长的航迹 + `ΔN` 距离读数（>90px 才显示）+ 越过终点 2.4s 淡出 `×` 标记；`renderGhostRow()` 机库状态行 + 清除键；`OPTS.ghost` 实时开关；**`loadOpts` 加 `if(k in s)` 判据**避免新开关对老玩家默认关；**读档校验下界 6 而非 9**避免两条点的合法短轨迹被拒。18 项断言全过（含 6.1·6.2·6.3·6.4 钩子回归 + 续档还原），`audit-tokens.js` 全绿。**顺手修掉 6.2/6.3/6.4 的续档缺陷**：`saveRun` 漏存 `G.diff/G.rmods/G.ban`，刷新续档后深渊档变标准档、Modifier 与禁用池全失效（详见 §7 #166）。回退点 `.workbuddy/backups/index_*_phase6-5-pre.html` · post `index_*_phase6-5-post.html`，截图 `.workbuddy/shots/phase6/6-5-s1…s4-*.png` |
| 2026-09-12 | **Phase 6.2 难度档完成**。新增 `DIFFS` 三档（巡航 0.75/0.7/0.85/×0.8 · 标准 1 · 深渊 1.35/1.3/1.2/×1.4，深渊需历史最佳波次 ≥15），只改敌人三围·密度·承伤与得分系数，**不碰玩家输出**；六个应用点（spawnEnemy / spawnAst / hurtPlayer / drainPlayer / buildWave 的 total / 新增 addScore），加分点从 5 处 `G.score+=` 收敛到 `addScore()`；局内以 `G.diff` 锁定不受后续选择影响；每日挑战固定标准档；难度进记录·成绩卡·榜单。14 项断言全过，`audit-tokens.js` 全绿。回退点 `.workbuddy/backups/index_*_phase6-2-pre.html`，截图 `.workbuddy/shots/phase6/6-2-s1…s5-*.png` |
| 2026-09-12 | **Phase 6.3 自定义挑战完成**。5 个 Modifier `RMODS`（蜂群 数量×1.45/血×0.8 · 铁壁 血×1.7/速×0.85 · 疾风 速×1.35/伤×1.15 · 荒芜 补给×2.2 · 脆命 船体×0.5），最多叠 3 个，**得分加成累加不连乘**（三个 0.35 是 ×2.05 而不是 ×2.46）并与难度档相乘；六个应用点每帧只问一次 `modNow()` 快照；`applyRmods()` 在 hull.apply + 局外加成之后生效；局内 `G.rmods` 冻结不受改选影响；每日挑战强制清空。机库 `#rmodRow` 多选 + 实时倍率文案；记录·榜单·卡片追加「蜂群+脆命」式标记。19 项断言全过，`audit-tokens.js` 全绿。post-backup `.workbuddy/backups/index_20260912-221500_phase6-3-post.html`，截图 `.workbuddy/shots/phase6/6-3-s1…s5-*.png` |
| 2026-09-12 | **Phase 6.4 工坊式卡池完成**。`POOL_KEY='nova-pool'` + `POOL_MAX=8` 最多禁 29 个模块中的 8 个；`G.ban` 局内冻结（与 G.diff / G.rmods 同条规矩）；每日挑战强制清空；`rollChoices()` 在 rarity/cap 过滤**之前**加一行 `pool.filter(m=>G.ban.indexOf(m.id)<0)`。机库 `#poolRow` 29 个 chip 多选（满 8 时其他变灰），chip 顺序按 `MODULES` 定义序；记录·榜单·卡片追加「工坊 xN」。**故意不给得分加成** —— 禁"垃圾"是纯收益、禁"强卡"自然更难，不引入"禁得越多分数越高"的 gaming 漏洞。14 项断言全过（含三套并存：深渊+挑战+工坊 船体仍 50），`audit-tokens.js` 全绿。pre `index_20260912-225300_phase6-4-pre.html` · post `index_20260912-230600_phase6-4-post.html`，截图 `phase6/6-4-s1…s5-*.png`。**本次踩坑最大教训**：6.3 那次口头"已创建 pre"实际没写，**pre 备份必须用脚本第一步固化**，已写进 §7 #162 |
| 2026-09-12 | **Phase 6.1 自定义种子与对局复现完成**。先量后改发现 `wsample`（选卡核心取样器）压根没走种子流；引入 `seedAt()` 键控重播种（`buildWave` 按波次 / `rollChoices` 按等级），并把精英·词缀·掉落接进 `srand01()`，战斗层（弹道·AI 出手·走位·暴击·粒子）**故意留在 `Math.random()`** 以免污染布局流。玩家侧：6 位 base36 短码 + 菜单「SEED ▸ 自定义种子」+ `?seed=` 直达 + 暂停/坠毁/通关三处显示 + 成绩卡与榜单带码。14 项断言全过，`audit-tokens.js` 全绿。回退点 `.workbuddy/backups/index_*_phase6-1-pre.html`，截图 `.workbuddy/shots/phase6/6-1-s1…s5-*.png` |
| 2026-09-12 | **Phase 5 收官（5.6 分享卡片 / 本地排行榜 / 局内截图）**：`nova-board` 本机 Top10（81B/条，名次被挤出返回 0）、1200×630 离屏成绩卡（颜色全走 `PAL`，跟着色盲方案走）、暂停面板一键截图。13 项断言全过，21 套无回归。 |
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
| 2026-09-12 | **Phase 5.6 分享卡片 / 本地排行榜 / 局内截图完成 → Phase 5 收官**。**本地排行榜 `nova-board`**：本机 Top 10，记录字段压成 `{s,w,k,l,t,h,d,m,v,at}`（单条 81 字节，localStorage 只有 ~5MB，长键名是纯浪费），`boardAdd()` 返回 1-based 名次、**挤不进返回 0**；**坠毁也要进榜**（只有通关才记的话榜会长期空着）；面板不占 `G.mode`，`padBack` 按可见性关。**分享卡片 `shareCard()`**：1200×630 离屏 canvas，版式沿用「星图测绘」（深墨底 + 60px 钢蓝网格 + 青色内框 + 铅白读数 + 琥珀强调），**颜色一律走 `PAL`** —— 5.3 色盲模式换 token 后卡片自动跟随（实测 amber 201,162,39 → 240,228,66）；卡片是给别人看的，辨色要求比局内更高。**局内截图 `grabShot()`**：主画布 2D context 的 `toDataURL`，入口在暂停面板（SNAP）/ 结算面板（CARD）/ 主菜单（BOARD）。**13 项断言全过**，21 套脚本**无回归**，`audit-tokens.js` 全绿。回退点 `.workbuddy/backups/index_*_phase5-6-pre.html`，截图 `.workbuddy/shots/phase5/5-6-s1…s5-*.png` |
| 2026-09-12 | **Phase 5.5 移动端专项完成**。虚拟摇杆从「方向开关」改回**模拟量**：新增 `JOY_*` 参数组（R=46 / DZ=0.18 / TURN 0.45–2.2 / BRK=0.62 / THR=0.12 / FOLLOW=2.2）与 `joyRead()` 死区重映射，与 5.2 `padScan()` 同语义。改前实测推 3px 与推 46px 在 0.5s 内都转满 90°（旧代码是恒定 10 rad/s 斜率），改后 8 帧转角 0° / 17.81° / 33.40° / 53.68° / 73.95° 严格递增，满舵 ≈ 旧手感。**下拉改为刹车**（改前 up/down 都在推进，手机上没有减速手段；实测初速 300 → 上推 254 / 不动 105 / 下拉 28.6）。手指拖出 2.2R 时底盘重锚到「手指 − R」，保持满舵连续不跳变。安全区：`env(safe-area-inset-*)` 在 `:root` 收敛为 `--safe-t/r/b/l`，HUD 三块与 FIRE 按钮改 `calc()` 避让。横竖屏：新增竖屏轻提示（触屏 + 竖屏 + 对局中），点击永久忽略存 `nova-orient`。`isTouch` 改用 `pointerType==='mouse'` 判断，触屏笔记本插鼠标可切回键鼠。**12 项断言全过**，20 套脚本**无回归**，`audit-tokens.js` 全绿。回退点 `.workbuddy/backups/index_*_phase5-5-pre.html`，截图 `.workbuddy/shots/phase5/5-5-s1…s5-*.png` |
| 2026-09-12 | **Phase 5.4 性能完成**。新增 `QB` 三档特效预算表（parts / debris / ghosts / bolts / texts / fmax / shards / stars 八项**三档严格单调递减**，高档沿用旧常量 560/120/8/26 保证默认观感不变），替换硬编码 `PART_MAX` / `DEBRIS_MAX`，给原先无上限的电弧、通用飘字、经验碎片补上档位钳制；新增 `trimFx()`，**降档同 tick 砍存量**（粒子寿命 <1s，等自然消亡等于白扛一秒旧负载），挂点 `applyQuality()` + `qualityWatch()`；后处理分级（bloom 1 档掐掉、glitch 留到 2 档，受击可读性优先）；星场四层改开关掩码，低档抽中间两层。度量改用**绘制调用次数**（`NOVA.bench.ops` 包裹并还原 `CanvasRenderingContext2D.prototype`）—— headless 软件渲染下墙钟抖 ±20%，实测能出「省 −4146%」这种数，不可用。实测同一钉死场景：高 5137 → 中 4352 → 低 3239 次/帧（100% / 85% / **63%**）。**12 项断言全过**，19 套脚本**无回归**，`audit-tokens.js` 全绿。回退点 `.workbuddy/backups/index_*_phase5-4-pre.html`，截图 `.workbuddy/shots/phase5/5-4-s1…s5-*.png` |
| 2026-09-11 | **Phase 3.4 成就树完成（Phase 3 首项）**。
| 2026-09-11 | **Phase 3.2 协同扩展完成**。
| 2026-09-11 | **Phase 3.5 局外解锁树完成（Phase 3 收官）**。**Stardust 星尘**：每局结算按 `1+⌊score/1500⌋+⌊kills/60⌋` 入账，连败也有进展感。**13 节点 / 4 支线 + 根**（生存 hp→sh / 火力 dmg→crit / 机动 spd→turn / 战术 lv→premod），画布 672×642，**画布规格独立于 3.4 成就树**（1008×688）避免互相覆盖。**`nova-meta` 存储**：`{dust, unlocked}`；旧档无键走 `{0, ['mroot']}` 默认值兜底，**零新存储键破坏兼容性**。**四档守卫** `no-node` / `already` / `req` / `dust`，全部返回 `{ok,reason}` 不抛异常。**三态视觉**沿用 3.4 `lbnode` 语汇（暗轮廓 < 青边青底 ready < 金边金底 done）。`applyMetaBonuses` 在 `hull.apply()` 之后立刻生效（`startGame` 内），**支持任意前缀组合**；`premod` 故意不注册进 `G.build`（避开「零模块」反成就 + `ABILITY_CAP`）。**3.5c 结算可见化**：3.5 算了 `G.lastDust` 但面板零展示 → 核心循环对玩家隐形。新增 `renderDust(node,earn)` 给坠毁 / 通关面板各加琥珀色 `星尘产出 +N \| 可用 M \| 于「解锁星图」消费` 行；`applyI18n` 切语言时一并重绘杜绝中英混排。**测试钩子** `NOVA.meta.{tree,load,save,has,state,unlock,earn,earnFor,reset,grant,draw,fit}` 12 个。**17 项断言全过**（1-14 数据 + UI + 回归 / 15-17 3.5c 结算可见化），前 8 个 phase（2/2-3/2-4/2-5/3-4/3-1/3-2/3-3 共 90 项）**无回归**。`audit-tokens.js` 全绿。回退点 `.workbuddy/backups/index_*_phase3-5-post.html`，截图 `.workbuddy/shots/phase3/3-5-*.png` |
| 2026-09-11 | **Phase 3.3 每日挑战完成**。**RNG 种子化**：抽 `RND={on,s}` + `mulberry32` + `setSeed/clearSeed`，`rand/irand/pick/shuffle` 这 4 个顶层随机函数走 `srand01()`；默认行为与旧版完全一致，种子化后所有 VFX/微观判定仍走 `Math.random`（**29 处调用中无需改 1 行**，4 个函数兜底）。**规则池 4 条**：`startLoader` / `startAegis` / `swiftStar` / `noRepair`；`pickDailyRules` 用 `setSeed + shuffle` 选 2 条；`dailySeed` = `YYYYMMDD` FNV-1a 哈希成 32-bit。`rollChoices` 尊重 `G.noRepair`；`startDaily` 用 `G.dailyMode` 保护 `G.daily` 不被 `startGame` 重置（顺序坑）。**菜单 btnDaily + menuDaily 面板**（日期 / 今日规则 / 今日最佳）；**死亡面板 daily-badge**（日期 + 规则名）。**`nova-daily` 存储**：`commitDaily` 按「更高分覆盖」写 `{date:{score,wave,kills,rules}}`。12 项断言全过，`audit-tokens.js` 全绿，前 7 个 phase（2 / 2-3 / 2-4 / 2-5 / 3-4 / 3-1 / 3-2 共 73 项）**无回归**。回退点 `.workbuddy/backups/singularity-echo_phase3-3-pre.html` + `index_*_phase3-3-post.html`；截图 `.workbuddy/shots/phase3/3-3-*.png` |`SYN` 12 → **22 条**，并把原本 9 条「空 `apply()`」全部改成真实生效的一次性属性变更（旧表只在 UI 标亮、运行时零效果）。**新增 10 条优先补「孤儿卡」联动**：twin / pierce / ricochet / frag / guided 五张旧表一条协同都没有，现在两两配对都连得上（详见 §4 3.2 表格）。零基字段乘法协同静默失效这条坑一并修掉：抽常量表 `FRAG_LV`，新增 `splashBoost(rMul,dMul)` 用一级值播种再乘。**`P.mine`/`P.nova`/`P.blink` 是表下标不可动**这条警告固化为注释 + 断言 `audit()` 检查项。10 项断言全过（含「22 条 apply 在初始 `P` 上必须至少改 1 个字段」与下标安全），`audit-tokens.js` 全绿，`phase2-check` / `phase2-3-check` / `phase2-5-check` / `phase3-4-check` / `phase3-1-check` 无回归。回退点 `.workbuddy/backups/index_*_phase3-2-pre.html`，截图 `.workbuddy/shots/phase3/3-2-*.png` |占位 7 节点 → **18 节点 / 22 连线**（画布 1008×688，坐标手写）：四条支线（击坠 100→4000 / 波次 5→35 / 时长 10min→5h / 技巧「3 船·6 船·零模块·无伤」）+ 汇总节点 `dependsOn` 6 项聚合。**统计 schema 5 → 8 字段**（`hulls` 船体数组 / `nomod` / `flaw`，旧档默认值兜底，**零新存储键**）。三态视觉（暗轮廓 < 蓝边蓝底 < 金边金底）+ 2px 进度条 + 「前置 5/6」聚合读数。达成瞬间弹窗（`achCheck`/`achTick`，banner+音效+金环，2.2s 冷却，**旧档首开静默补记不刷屏**）。`fitAch` 缩放下限 0.34。12 项断言全过，`audit-tokens.js` 全绿，`phase2-check.js` / `phase2-3-check.js` 无回归。回退点 `.workbuddy/backups/singularity-echo_phase3-4-pre.html`，截图 `.workbuddy/shots/phase3/3-4-*.png` |
| 2026-09-12 | **4.3b 星图改版完成（用户插单：『从上往下 + 别太小 + 手机电脑都要能放大』）**。**版式左→右改上→下**：18 个 `ACH` + 13 个 `META` 节点从手写 `x/y` 改成语义槽位 `br`(支) / `dp`(层)，根 `anchor:'top'` 居中置顶、汇总 `anchor:'bottom'` 居中置底；连线改纵向走列中线。**默认缩放 0.447× → 1.0×（桌面）/ 0.34× → 0.9245×（手机）** —— 根因是旧 `fitAch` 按 `min(bw/cw,bh/ch)` 取小值，把 1008×688 的内容压进 490×298 的框；改成**只按宽度铺满** `clamp(bw/cw,0.4,1)`，纵向放不下就滚。**响应式列数** `clientWidth>=560?4:2`。**真缩放**：滚轮 / 双指 / `−`+`⤢` 按钮，0.4–2.5 夹取，`zoomAt` 统一锚定指针（漂移 0.36px）—— 旧版提示写着「滚轮缩放」但**从未实现**，只有拖拽平移。**容器**：面板 `min(94vw,720px)`、树框 `min(46vh,300px)`→`min(64vh,580px)`、画布尺寸改由 JS 写、`.lb-zoom` 挂在 wrap 外（否则跟着一起缩放）。**解锁树**此前完全不能平移缩放，现在与成就树共用一套`tfOf/applyTf/clampPan/zoomAt/fitTree`。**顺手修两个真实 bug**：① `setLang` 漏了日志树 → 切语言两张星图不重绘；② 3.4 满达成断言仍喂 6 船 → 4.3 把「全舰制霸」改成 7 之后汇总节点永远停在「前置 5/6」（已补到 7 船，现 18/18）。**踩坑**：`d` 不能当层号（节点已有 `d` 存中文描述 → `y` 变 NaN → 12 节点重叠）；`layoutMeta(4)` 必须放在 `META` 数组之后否则 TDZ 白屏；`#boot` 未 `.out` 时 `pointer-events` 仍为 auto 会吃掉点击（点击断言随机失败）。**17 项新断言全过**，13 套历史脚本**共 163 项无 ERR / 无 FAIL**，`audit-tokens.js` 全绿。回退点 `.workbuddy/backups/index_*_phase4-3b-post.html`，截图 `.workbuddy/shots/phase4/4-3b-s1…s5-*.png` |
| 2026-09-12 | **Phase 4.4 新武器行为完成**。模块 **26 → 29**、协同 **22 → 26**。
**先量后改 —— rollChoices 加权实测失衡**（300 局 × 40 级模拟）：三张牌恒为「2 能力 + 1 数值」，
能力型 16 种 / 数值型 10 种 → 能力型第 **12.2** 次升级就封顶、数值型要 **24.2** 次，
且两类都封顶后池里只剩升等级，66.3% 仍给能力型（2:1 已无依据）。改为**能力型封顶后翻转成「1 能力 + 2 数值」**
（`abSlots=capped?1:2`），数值型封顶 **24.2 → 18.4** 次、40 级内达成率 **274/300 → 200/200**、
后期能力占比 **0.663 → 0.333**。`abilityBoost` 从「能力型**总等级**×0.22」（发散到 **8.26×**，
而对池内是统一乘数、改变不了排序）改为「已持有**种类数**×0.15」，天然夹在 1.9 以内。
**三张新卡**（2 能力 + 1 数值，刻意补一张数值卡以对冲 16:10 的能力偏向）：
**散射喷嘴 SPRAY**（rare/ability，额外扇形弹 2→6 发、单发伤害 62%→100%、**张角随等级收束** 0.34→0.24）·
**裂变弹芯 SPLIT**（epic/ability，首次命中炸出 2→8 枚弹片、45%→85%）·
**口径校准 CALIBER**（rare/**stat**，弹丸半径 +1.0/级、弹速 +8%、射程 +10% —— 武器维度唯一的数值卡）。
新玩家字段 `P.spray/sprayArc/sprayMul/split/splitMul/bulletR/rangeMul`；等级表抽常量 `SPRAY_LV`/`SPLIT_LV`（同 `FRAG_LV`）。
**关键决策**：裂变只裂一次且只在首次命中（`b.sp` 用完置 0），**弹片 `sp=0` 绝不二次分裂**（否则高射速下弹幕数炸到数百，
满配实测峰值 33）；**射程走独立的 `P.rangeMul` 而非直接乘 `P.rangeLife`** —— `guided` 的 apply 是绝对值赋值，
乘在 rangeLife 上会因装配顺序静默失效（已断言两种顺序同为 1.518）。新协同 4 条（`fan_guided`/`fan_barrel`/`shard_pierce`/`shard_blast`）。
**踩坑**：① 数值型不能挂协同（`NOVA.syn.badDeps` 判坏，给 caliber 配的两条已撤）；
② `NOVA.syn.effect` 的字段白名单没列新字段 → 真生效的协同被判 `changed=0`（已补表）；
③ 断言弹片数要看逐帧峰值（朝后飞的弹片会立刻再命中同一个敌人）；
④ 历史断言里写死的 `mods===26 && syn===22` 在 4-2 / 4-3 / 4-3b / 3-2 四处同时变红。
**16 项断言全过**，14 套脚本**共 179 项无 ERR / 无 FAIL**，`audit-tokens.js` 全绿。
回退点 `.workbuddy/backups/index_*_phase4-4-pre.html`，截图 `.workbuddy/shots/phase4/4-4-s1…s4-*.png` |
| 2026-09-12 | **Phase 4.5 无尽模式专属机制完成 → Phase 4 收官**。两条都先量后改。**① Boss 轮换**：实测（200 局 × 41–100 波）`pick(Object.keys(BOSS_MV))` **无记忆随机**导致连续撞同一只巨像 **11.58%**、**148/200 局**至少撞一次、同款最小间隔仅 5 波。改成**洗牌袋 `bagPick(kind)`**（一轮洗一次、走完再重洗，Boss 与精英巨像各一袋 `G.bossBag`/`G.champBag`），并堵住三处破口：重洗瞬间首项撞车（洗完 `bag[0]===last` 则与第二位交换）、**剧本 Boss W35/W40 不写回记忆**（现在 `buildWave` 定下 `bossKind`/`champ` 即写 `G.bossLast`/`G.champLast`）、**续档时袋子是空的**（`saveRun` 写 `bb/cb/bl/cl`、`resumeRun` 还原）。修后 4000 次抽取**连续重复 0**、任意 16 窗 8 种齐全（无饥饿）、同款最大间隔 15 波。**② 强化层 AMP**：修前 30 波后是纯线性（`hpMul` 3.61@30 → 9.91@100，毫无加压层）。从 **W41 起每 5 波进一层**，常量 `ETIER_FROM=41`/`ETIER_EVERY=5`/`ETIER_HP=1.14`/`ETIER_DMG=1.08`/`ETIER_SPD=1.03`/`ETIER_SPD_CAP=1.5`/`ETIER_EXTRA=1`/`ETIER_EXTRA_CAP=10`，函数 `eTier/eTierHp/eTierDmg/eTierSpd/eTierExtra/tierTxt`；**乘在既有线性成长之上**，W100 相对 W40 **×10.59 血 / ×2.52 伤**（纯线性基线仅 ×2.20），额外敌人 38→48。**0 层恒等**：前 40 波逐波断言倍率恒为 1、剧本 Boss 不错位、敌人不超 38。读数由 `tierTxt(t)` 统一生成、0 层返回空串；HUD 与三条 banner 都挂后缀（`banner()` 是替换式，故先收进 `bt`/`bs` 最后只调一次），`setLang` 补清 `HUDC.wv`/`HUDC.el`。新钩子 `NOVA.endless.{tier,consts,bags,resetBags,seq,muls,build}`。**踩坑**：洗牌袋三处破口；HUD `HUDC` 缓存不认语言；断言无饥饿要用 16 窗而非均值（且 `last` 初值不能用 `-99` 哨兵）；面板入场动画期间取 bbox 是假值（顺手修掉 4-3b-12 的陈年 flake：加 600ms 落定等待）。**11 项断言全过**，15 套脚本**无 ERR / 无 FAIL**，`audit-tokens.js` 全绿。回退点 `.workbuddy/backups/index_*_phase4-5-pre.html`，截图 `.workbuddy/shots/phase4/4-5-s1…s4-*.png` |
| 2026-09-12 | **Phase 5.3 设置面板补完完成**。改前设置面板只有两条音量条 + 5.1 的键位表：画质只能靠 `qTier` 自动降、色盲模式完全没有、前庭敏感的人没法关震屏。**数据层** `OPTS`（7 项）+ `nova-opts` 单键持久化，逐项校验、坏值只回退那一项，首次进入跟随 `prefers-reduced-motion`（玩家改过就不再覆盖）。**画质四档**自动 / 高 / 中 / 低 —— 手动档**锁死**不再自动降级（`qualityWatch` 加 `if(!Q_AUTO)return`），中低档强制关星云、低档降 DPR；`applyQuality` 里改完 `qTier` 必须重 `resize()`（DPR 是 `min(dpr,qTier>=2?1:2)`）。**四个特效开关**震屏 / 星云 / 辉光·故障 / 粒子；`FX.dropFluid()` 是单向的，补了可逆的 `setFluid(on)` + 原始能力位 `fCap`。**减弱动态**：`html[data-rm]` 关掉震屏、镜头冲击与循环动画（时长在 `:root` 定义 `--ambient-rm:0s` 再引用，绕开 R5）。**色盲两档**（红绿 / 蓝黄）—— 这次唯一需要「先量后改」的：用 Viénot CVD 矩阵模拟后要求「危险 vs 奖励」「敌弹 vs 我弹」「血条 vs 盾条」三对 sRGB 距离 **≥90**，**基础配色两条轴都有不过线的对**（61/36 与 61/38），红绿档 125/153/109、蓝黄档 232/245/137。三条选色原则：只换承载信息的色（中性色一个不动）；红绿档走蓝↔黄安全轴（Okabe-Ito，靠明度差分开）；蓝黄档走红↔绿轴 + 亮度（蓝黄轴丢信息时亮度是唯一剩下的把手）。色板表 `CB_PAL` 放 JS（CSS 写字面色值会被 R1 判违规，按 `HULL_TINT` 先例加进 audit 动态放行表），`PAL` 从启动快照改成可重读的 `readPal()`。**顺手修**：敌方弹丸的 `#ffb08a` 改成 `--c-foe` token（否则色盲模式改不到敌我辨色的第一现场）；`#optRm` 从 `div` 改成 `button`（`padTargets()` 只收 button，写成 div 手柄够不着）。新钩子 `NOVA.opts.{defs,get,set,apply,reset,cssVar,cssRgb,palette,cbKeys,cbTable,sim,tier,auto,dpr,fluid,fluidCap,rm,ui,click,store}`。**14 项断言全过**，18 套脚本无 ERR / 无 FAIL，`audit-tokens.js` 全绿。回退点 `.workbuddy/backups/index_*_phase5-3-pre.html`，截图 `.workbuddy/shots/phase5/5-3-s1…s4-*.png` |
| 2026-09-12 | **Phase 5.2 手柄支持完成**。改前是纯键鼠：菜单/选卡/机库全靠点，手柄插上等于没有。**数据层** `PAD` 单例 + 常量 `PAD_DZ=0.22`（死区）/ `PAD_TRIG=0.45`（扳机）/ `PAD_EDGE=0.55`（菜单拨杆）/ `PAD_REP1=0.42`·`PAD_REP2=0.16`（长按连发）。**映射**：左摇杆 X→转向（**模拟量**，与键盘 ±1 叠加后 clamp）、Y 上→推进 / 下→减速；A/RT/RB 开火；LT/LB 减速；十字键→菜单与选卡移动；A 确认 · B 返回 · X 换牌；START 暂停/继续；Select 开设置。玩法四个读取点全部改成「键盘 OR 手柄」：`kd=clamp(key+kAx,-1,1)` / `keyDown('thrust')\|\|PAD.ay<-0.35` / `keyDown('brake')\|\|PAD.brake\|\|PAD.ay>0.5` / `mouse.down\|\|keyDown('fire')\|\|fireOn\|\|PAD.fire`。**UI 导航**：`padTargets()` 收集当前可见面板的可聚焦按钮，十字键/摇杆移动焦点、A 点击，`.card.padsel` 给选卡与机库画琥珀选中框（沿用 hover 的「抬起+描边」语汇）；选卡与机库各自维护 `padSel`，`renderCards()` / `openHulls()` 末尾归零重绘。**连接提示只弹一次**（`PAD.seen`），文案中英双行。**四个边界**：模拟量不能退化成开关；摇杆三连（死区→重映射→径向归一化，斜推模长恰为 1.0000）；**B 键判定必须排在空列表守卫之前**；拔掉要零残留。**抓到两个真 bug**：① `padTargets()` 漏了 `el.logbook` → 日志页零可聚焦按钮；② 通用导航的 `if(!list.length)return;` 排在 B 键之前 → 无按钮面板里 B 被静默吞掉，玩家出不去。测试靠 `PAD_TEST` 注入假 gamepad（无头环境没有真手柄），新钩子 `NOVA.pad.{const,state,hold,tap,scan,ui,step,fireStep,sel,targets,clear}`。**有意未做**：右摇杆瞄准（会牵动整套瞄准系统）。**14 项断言全过**，17 套脚本无 ERR / 无 FAIL，`audit-tokens.js` 全绿。回退点 `.workbuddy/backups/index_*_phase5-2-pre.html`，截图 `.workbuddy/shots/phase5/5-2-s1…s4-*.png` |\n| 2026-09-12 | **Phase 5.1 键位重绑定完成（Phase 5 首项）**。改前 `keydown` 里散着 20 多处 `e.code==='KeyX'` 字面量，玩法侧另有四处 `keys.KeyW\|\|keys.ArrowUp` 式直读。**数据层**：`KEY_DEFS`（12 动作 × 主键/副键两槽位）+ `KEYMAP` + `nova-keys` 持久化；两槽位是刻意的（WASD 与方向键并存是既有默认）。四个读取点（转向 / 推进 / 减速 / 开火）与全部游戏分支改走 `keyDown(act)` / `isAct(act,code)`。**设置面板**新增「键位」分节（复用 2.5 的 `.sec-head` 语汇）：12 行槽位可点，点一下进入等待态、下一次 keydown 被捕获分支吃掉，再点一次取消，另有「恢复默认」。**改绑策略：撞车自动清空旧绑定并弹横幅说明**，不弹窗拒绝。**三个边界**：捕获分支必须在 `keys[]=true` 与所有游戏分支之前 return（否则抓 P 当暂停键当场暂停）；`loadKeys()` 逐槽位校验、坏值只回退那一个动作（断言塞 `{"left":"x","thrust":[1,2]}` 验过）；`syncKeyHints()` 必须排在 `applyI18n()` 之后（HUD ♪/Ⅱ 的 title 是 `data-i18n-t` 托管的）。**顺手做**：引导文案的 `WASD`/`空格` 改成 `{MOVE}`/`{FIRE}` 占位符，默认绑定下仍渲染成 `WASD`、改绑后才降级成键名。**有意保留硬编码**：`Escape` 的关闭语义、机库 `Digit1-7`、选卡 `Digit1-3`、菜单 `C`/`L`。新钩子 `NOVA.keys.{defs,map,label,set,reset,press,down,wait,ui,click,slotText,hints,store}`。**14 项断言全过**，16 套脚本无 ERR / 无 FAIL，`audit-tokens.js` 全绿。回退点 `.workbuddy/backups/index_*_phase5-1-pre.html`，截图 `.workbuddy/shots/phase5/5-1-s1…s4-*.png` |

---

## 10. 杂项待办（非阻塞）

- `singularity-echo/` 下有 8 张 `bg-prototype` 时期的旧截图（`_bg*.png`，约 4.5MB），可清理
- `bg-prototype.html` 停在 v6 搁置；恢复顺序：**先降速**（现 62s → 目标 110–150s，做成可调参数），
  再调光质；**不要靠继续堆图层**
- `BOSS_STYLE.fill` 与敌方机体 `fill` 暗色仍待换（面积小、优先级低）；粒子 `cols`、字距（19 种）待归并
