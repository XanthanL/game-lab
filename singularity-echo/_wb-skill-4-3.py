# -*- coding: utf-8 -*-
"""Phase 4.3 写回 SKILL.md：新增 ⚠️ 小节 + §四脚本表 + §五进度锚点。"""
import io, sys

P = r'C:/Users/www27/.workbuddy/skills/singularity-echo-dev/SKILL.md'
s = io.open(P, encoding='utf-8').read()
n = 0

def rep(old, new, tag):
    global s, n
    c = s.count(old)
    if c != 1:
        print('FAIL[%s] count=%d' % (tag, c)); sys.exit(1)
    s = s.replace(old, new, 1); n += 1
    print('  ok %s' % tag)

# ── 新增 ⚠️ 小节（插在 4.2 小节之后、§四之前） ───────────────
rep("""    断言脚本 `../.workbuddy/shots/phase4-2-check.js`（14 项全绿，自带留档截图）。

## 四、改完必跑自查""",
"""    断言脚本 `../.workbuddy/shots/phase4-2-check.js`（14 项全绿，自带留档截图）。

### ⚠️ 新增船体的四表同步与机制挂载（4.3 踩到的）

1. **五处同改，漏哪处都不报错**：`HULL_TINT`（`fill`/`line`/`glow` 分量串）/
   `HULL_GEO`（`n` 机首 x / `t` 机尾 x / `cy` / `gx` / `ribs` 半宽采样）/
   `HULL_TAIL`（尾部到中点的像素距离）/ `TRAIL_RAMP`（尾流三段色阶）+
   **`hullPath()` 里一个 `else if` 分支**。
   - 漏 `HULL_TINT` → `HULL_TINT[id]||HULL_TINT.peregrine` **静默套用游隼配色**（新船长成蓝色）；
   - 漏 `hullPath` 分支 → 落进 `else`（peregrine 兜底），**画成游隼形**；
   - 漏 `HULL_TAIL` / `TRAIL_RAMP` → 尾流从船身中段喷出、配色借用游隼。
   - `HULL_TAIL[id]` 必须等于 `-HULL_GEO[id].t`（尾部最负 x），已写进断言。
2. **颜色写进 `HULL_TINT` / `TRAIL_RAMP` 本体**：R4 的动态白名单只扫
   `HULL_TINT` / `TRAIL_RAMP` / `BOSS_STYLE` / `HULL_GEO` / `ENEMY_DEFS` 五张表的**花括号本体**
   （正则 `const NAME={...\\n};`），**别开子表再 `Object.assign`**（同 4.1 第 42 条）。
3. **`HULLS[]` 条目 + 三处联动**：`{id,zh,en,g,desc,apply,lockNote?}` 之后还要改 ——
   `HULL_EN` / `HULL_LOCK_EN`（机库英文，`lockNote` 可以是字符串**或函数**）、
   `hullUnlocked(id)` 门禁、机库数字键 `/^Digit[1-6]$/`（**加船记得扩到 1-7**）。
4. **成就「全舰制霸」的 `goal` 要跟着船体数改（6→7），但 id 一个字都别动**：
   `nova-ach` 按 `id` 记已达成，改 id 会让老玩家丢档。
   同理各断言脚本里的 `c.hulls===6` 也要一起改（4.3 改了 `phase4-2-check.js`）。
5. **"持续状态"型船体机制按速率写，不要按每发累加**：
   熔炉蓄热用 `heat+=HEAT_UP*dt`（3.3s 满膛，**与射速解耦**）。
   若写成"每发 +k"，高射速构筑 1 秒烧穿 —— 机制从"节奏取舍"退化成"不许点射"，
   与堆射速的构筑意图相悖。**充能 / 过热 / 连击衰减都按速率写。**
6. **新机制字段要在 `newPlayer()` 里给默认值**，且**只有该船体置 `heatOn=true`**：
   其余 6 艘 `heat` 恒 0、`heatMul` 恒 1，断言逐船验证零溢出。
   倍率在 `updatePlayer` 每帧刷新、`fireGun` 直接乘进弹丸伤害（主弹 + 背射弹都要乘）。
7. **HUD 新增条要在 `updateHUD()` 里自己管显隐**：`HUDC` 缓存**换船体重开时不自清** ——
   切显示状态顺手把宽度缓存置空（`HUDC.heat=null`）强制重写一次，否则首帧宽度是上局的残留值。
8. **断言两个假象**：
   - `el.style.width` 会被浏览器归一化 —— 写 `'50.0%'` 读回 `'50%'`，`w==='50.0%'` **永远为假**，
     用 `parseFloat(w)===50`；
   - 背射弹标记写作 `back:P.backMax||undefined`，`P.backMax=false` 时 `!b.back` 把背射弹也算成主弹，
     `filter(b=>!b.back).pop()` 拿到的是背射弹（4.3-08 据此算出 0.2559 的假偏差）。
     **测试里先 `P.backMax=true` 再分辨。**
9. 函数锚点：`HULLS` / `hullUnlocked` / `unlockHull` / `openHulls` / `prewarmHulls` /
   `hullPath` / `drawHullBody` / `hullTail` / `HEAT_*`；
   断言脚本 `../.workbuddy/shots/phase4-3-check.js`（**16 项全绿**，自带留档截图）；
   回退点 `.workbuddy/backups/index_*_phase4-3-pre.html`；
   截图 `.workbuddy/shots/phase4/4-3-*.png`。

## 四、改完必跑自查""",
'skill-section')

# ── §四 脚本表 ──────────────────────────────────────────────
rep(""""$NODE" ../.workbuddy/shots/phase4-2-check.js   # 新巨像 14 项（五表同步 / 干扰场节律 / 引力井 / 视界 / 图鉴 8 格），自带截图
```""",
""""$NODE" ../.workbuddy/shots/phase4-2-check.js   # 新巨像 14 项（五表同步 / 干扰场节律 / 引力井 / 视界 / 图鉴 8 格），自带截图
"$NODE" ../.workbuddy/shots/phase4-3-check.js   # 新船体 16 项（四表同步 / 蓄热解耦 / 锁膛 / 冷满膛倍率 / HUD 槽 / 图鉴 7 格），自带截图
```""",
'skill-s4')

# ── §五 进度锚点 ────────────────────────────────────────────
rep("""- **Phase 4 进行中（4.1 新敌型 + 4.2 新 Boss 已完成，2026-09-11）** → **下一个是 4.3 新船体**
  （`HULL_TINT` / `HULL_GEO` / `HULL_TAIL` / `TRAIL_RAMP` **四处全同步** + `hullPath` 形状
  + 机库文案 + 解锁条件；详见上文"⚠️ 新增巨像的五表同步与场机制"小节）
  - **4.2 新 Boss**""",
"""- **Phase 4 进行中（4.1 新敌型 + 4.2 新 Boss + 4.3 新船体已完成，2026-09-11）** → **下一个是 4.4 新武器行为**
  （加进 `MODULES`，并检查 `rollChoices` 的 ability/stat 加权是否失衡；见 `DEV-PLAN.md` §5）
  - **4.3 新船体**：船体 **6 → 7**，第七船体 **「熔炉 FORGE」❖**（熔铜配色），解锁挂
    **肃清第 40 波 · 击碎坍缩之核** —— 与 4.2 的 W40 巨像呼应（无尽 30 波后原先没有里程碑奖励）。
    - **首个带"持续状态"的船体**（其余 6 艘都是一次性属性改写）：**过热膛线** ——
      持续开火 `heat+=HEAT_UP(30)/s`（满膛 3.3s），伤害在 **冷膛 0.85× ↔ 满膛 1.45×** 线性浮动；
      停火 `−HEAT_COOL(34)/s`；见顶**锁死炮膛 `HEAT_LOCK=1.7`s** 并以
      `HEAT_VENT=HEAT_MAX/HEAT_LOCK` 强制排空、解锁瞬间归零。
    - **蓄热按速率、与射速解耦**：按每发累加会让高射速构筑 1 秒烧穿
      （"节奏取舍"退化成"不许点射"）。断言验证射速 ×3 后 1s 蓄热仍是 30。
    - 玩家新字段 `P.heat` / `P.heatMul` / `P.heatLock` / `P.heatOn`；
      非熔炉船体 `heat` 恒 0、`heatMul` 恒 1（逐船断言零溢出）。
    - **HUD 过热槽** `#heatrow`（`HEAT` 标签 + `.bar.heat`，黄铜→朱砂，满膛转警示色），仅熔炉显示。
    - **五处同改**：`HULL_TINT` / `HULL_GEO` / `HULL_TAIL` / `TRAIL_RAMP` + `hullPath` 分支
      （宽厚砧形 + 双侧散热鳍 + 方形炉尾喷口）；`HULL_TAIL=15` 对齐 `-HULL_GEO.t`。
    - **联动四处**：机库数字键 `Digit[1-6]`→`[1-7]`、`HULL_EN`/`HULL_LOCK_EN`、
      成就「全舰制霸」`goal` 6→7（**id 保留以免丢档**）、`NOVA.counts().hulls` 自动 7。
    - 断言脚本 `../.workbuddy/shots/phase4-3-check.js`（**16 项全绿**）；
      前 11 个 phase（共 **129** 项）无回归。详见上文
      "⚠️ 新增船体的四表同步与机制挂载"小节。
  - **4.2 新 Boss**""",
'skill-s5')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('\\nSKILL.md: %d patches, %d chars' % (n, len(s)))
