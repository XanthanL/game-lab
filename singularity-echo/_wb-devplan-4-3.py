# -*- coding: utf-8 -*-
"""Phase 4.3 写回 DEV-PLAN.md：§0 状态 / §1 验证表 / §5 明细 / §7 坑位 / §9 日志。"""
import io, sys, re, os

P = 'DEV-PLAN.md'
s = io.open(P, encoding='utf-8').read()
N = sys.argv[1]  # 历史回归总项数
n = 0

def rep(old, new, tag):
    global s, n
    c = s.count(old)
    if c != 1:
        print('FAIL[%s] count=%d' % (tag, c)); sys.exit(1)
    s = s.replace(old, new, 1); n += 1
    print('  ok %s' % tag)

# ── §0 状态表 ────────────────────────────────────────────────
rep("| **Phase 4 内容扩充** | 🔄 **进行中** | **4.1 新敌型 + 4.2 新 Boss 完成**（敌型 20→24 · 巨像 6→8）；4.3–4.5 待做 |",
    "| **Phase 4 内容扩充** | 🔄 **进行中** | **4.1 新敌型 + 4.2 新 Boss + 4.3 新船体完成**（敌型 20→24 · 巨像 6→8 · 船体 6→7）；4.4–4.5 待做 |",
    's0-table')

rep("""**下一步建议：Phase 4.3 新船体**（`HULL_TINT` / `HULL_GEO` / `HULL_TAIL` / `TRAIL_RAMP` 四处全同步
+ `hullPath` 形状 + 机库文案 + 解锁条件，见 §5）。
`index.html` 现 **8666 行 / 473 KB**（含 4.1 四种新敌型 + 4.2 两尊新巨像的数据 + 行为 + 绘制 + 钩子）。""",
    """**下一步建议：Phase 4.4 新武器行为**（加进 `MODULES`，并检查 `rollChoices` 的 ability/stat
加权是否失衡，见 §5）。
`index.html` 现 **8737 行 / 478 KB**（含 4.1 四种新敌型 + 4.2 两尊新巨像 + 4.3 第七船体
「熔炉」的数据 + 行为 + 绘制 + HUD 槽）。""",
    's0-next')

# ── §1 验证脚本表 ────────────────────────────────────────────
rep("""| `.workbuddy/shots/phase1/` | 战斗反馈四档对照截图 | 人工 |""",
    """| `.workbuddy/shots/phase4-3-check.js` | **新船体 16 项**（四表同步 / 机库文案 / 解锁门禁与持久化 / 机库 7 卡锁定→解锁 / apply 属性 / **蓄热与射速解耦** / 满膛锁膛→排空归零 / 冷膛 0.85×↔满膛 1.45× 含背射 / 其余 6 船零溢出 / HUD 过热槽 / 击碎坍缩之核解锁链路 / `hullPath` 新形状 / 图鉴 7 格 + 成就 7 / 数据规模回归 / 英文机库 / 实机），**自带留档截图** | 无 pageerror、断言全过 |
| `.workbuddy/shots/phase1/` | 战斗反馈四档对照截图 | 人工 |""",
    's1-table')

# ── §5 明细 ─────────────────────────────────────────────────
rep("""- 4.3 新船体 → **四处全同步**（`HULL_TINT` / `HULL_GEO` / `HULL_TAIL` / `TRAIL_RAMP`）
  + `hullPath` 形状 + 机库文案 + 解锁条件
- 4.4 新武器行为 → 加进 `MODULES`，并检查 `rollChoices` 的 ability/stat 加权是否失衡
- 4.5 无尽模式专属机制（30 波后不重复随机 Boss，加轮换与强化层）""",
    """#### ✅ 4.3 新船体（已完成 2026-09-11）

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
  4-1 / 4-2，**共 %s 项**）**无回归**。`audit-tokens.js` 全绿（51 hex + 30 rgb 全在白名单）。
  回退点 `.workbuddy/backups/index_*_phase4-3-pre.html`，
  截图 `.workbuddy/shots/phase4/4-3-*.png`。

**待做**

- 4.4 新武器行为 → 加进 `MODULES`，并检查 `rollChoices` 的 ability/stat 加权是否失衡
- 4.5 无尽模式专属机制（30 波后不重复随机 Boss，加轮换与强化层）""" % N,
    's5-detail')

# ── §7 坑位 ─────────────────────────────────────────────────
rep("""    数值型断言一律带 `ok:Math.abs(实测-期望)<ε` 字段，别只打印。""",
    """    数值型断言一律带 `ok:Math.abs(实测-期望)<ε` 字段，别只打印。**
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
    `fireGun` 直接乘即可。**同类机制（充能 / 过热 / 连击衰减）都按速率写。**""",
    's7-pitfalls')

# ── §9 变更日志 ─────────────────────────────────────────────
rep("""| 2026-09-11 | **Phase 3.4 成就树完成（Phase 3 首项）**。""",
    """| 2026-09-11 | **Phase 4.3 新船体完成**。船体 **6 → 7**：第七船体 **「熔炉 FORGE」❖**（熔铜配色），解锁挂 **肃清第 40 波 · 击碎坍缩之核**，与 4.2 的 W40 巨像呼应（无尽 30 波后原先没有里程碑奖励）。**首个带"持续状态"的船体** —— 其余 6 艘都是一次性属性改写。**过热膛线**：持续开火热量 +30/s（满膛 3.3s），伤害在 **冷膛 0.85× ↔ 满膛 1.45×** 线性浮动，见顶**锁死炮膛 1.7s** 并强制散热归零；停火 −34/s。七个常量 `HEAT_MAX=100` / `HEAT_UP=30` / `HEAT_COOL=34` / `HEAT_LOCK=1.7` / `HEAT_VENT=HEAT_MAX/HEAT_LOCK` / `HEAT_COLD=0.85` / `HEAT_HOT=1.45`；**蓄热按速率而非每发累加**（与射速解耦，否则高射速构筑 1 秒烧穿、"节奏取舍"退化成"不许点射"）。新玩家字段 `P.heat`/`P.heatMul`/`P.heatLock`/`P.heatOn`，非熔炉船体 `heat` 恒 0、`heatMul` 恒 1（逐船断言零溢出）。HUD 新增过热槽 `#heatrow`（仅熔炉显示，满膛转朱砂警示色；`HUDC` 不自清 → 切状态即作废宽度缓存）。**四处全同步 + `hullPath` 新分支**（宽厚砧形 + 双侧散热鳍 + 方形炉尾喷口，`HULL_TAIL=15` 对齐 `-HULL_GEO.t`）。**联动四处**：机库数字键 `Digit[1-6]`→`[1-7]`、`HULL_EN`/`HULL_LOCK_EN`、成就「全舰制霸」`goal` 6→7（**id 保留以免丢档**）、`NOVA.counts().hulls` 自动 7。**16 项断言全过**，前 11 个 phase（共 %s 项）**无回归**，`audit-tokens.js` 全绿。回退点 `.workbuddy/backups/index_*_phase4-3-pre.html`，截图 `.workbuddy/shots/phase4/4-3-*.png` |
| 2026-09-11 | **Phase 3.4 成就树完成（Phase 3 首项）**。""" % N,
    's9-log')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('\\nDEV-PLAN.md: %d patches, %d chars' % (n, len(s)))
