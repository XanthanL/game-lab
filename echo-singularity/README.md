# 奇点回响 · 微信小游戏版（echo-singularity）

> 网页版（`E:\Code\game-lab\singularity-echo\`）冻结作参考；本作是面向微信小游戏的全新移植。
> 设计语言沿用「星图测绘」，但**奇点不再是第 40 波才露面的 Boss，而是战场本身的状态**。

## 三种打开方式

| 场景 | 怎么做 |
|------|------|
| 微信开发者工具（真宿主） | 用「微信开发者工具」打开 `E:\Code\game-lab\echo-singularity\`，appid 选「测试号」或填你自己的 |
| H5 浏览器预览（推荐日常开发） | 双击 `tools/h5/index.html`，或本地起服务后访问 `tools/h5/index.html` |
| 无头断言（量化验证） | `node tools/h5/probe.cjs`，退出码 = 失败数 |

> ⚠️ H5 预览**不是**微信环境，但通过 PAL 抽象了 `wx.*` 调用：同一份 `game.js` 不改一行就能在两边跑。
> 一切差异只发生在 `js/pal.js` 一个文件。

## 目录

```
echo-singularity/
  game.js                       # 小游戏入口（仅 bootstrap）
  game.json                     # 小游戏配置（竖屏 / subpackages 占位）
  project.config.json           # 微信开发者工具项目配置
  js/
    pal.js          ★ 平台适配层（全项目唯一允许 wx.* 的文件）
    tokens.js       ★ 设计 token（颜色 / 字号 / 时长 / 缓动）单一事实源
    util.js           数学 / 种子化随机 / 缓动
    arena.js          战场尺寸 / 视口变换 / 星空（过引力透镜）
    singularity.js  ★ 奇点系统（B+C）—— 本作核心创意 + 黑洞透镜
    input.js        ★ 触摸输入（左下角固定摇杆）
    entities.js      玩家 / 弹丸池 / 敌机池 / 机型几何
    regions.js        区域表 + 区域判定 + 无尽层
    pickups.js      ★ 拾取物系统（6 种 buff，移植自网页版）
    cards.js          强化卡池（独立成模块，Stage 3 扩展点）
    combat.js        战斗核心 + 波次 + 协同压缩 + 拾取生效
    warp.js           穿越过场（隧道环 + 速度线 + 白闪 + 旋转）
    channel.js        通道奖励关（向上卷轴 + 星尘 + 障碍 + 折算选卡）
    render.js        世界绘制（星 / 网格 / 奇点底层 → 实体 → 拾取 → 奇点面层 → 飘字 → 摇杆）
    aura.js        ★ 屏幕边缘状态层（低血 + buff 光带）
    ui.js            HUD / 暂停 / 结算 / 选卡 / 主菜单 / buff 徽章
    app.js           状态机 + 主循环
  tools/
    h5/
      index.html               # H5 预览壳（假 wx + 迷你 CommonJS 装载器）
      wx-shim.js               # 假 wx —— 浏览器里模拟小游戏 API
      wrap-modules.py          # 给模块加 IIFE 外壳（已运行，可重跑）
      probe.cjs                # 无头真渲染断言（20 项）
      _shots/                  # 截图存档
```

## 奇点系统（B+C 方案）

### B · 视觉叙事三阶段
阶段由当前波次决定，固定中心位置，**从第 1 波起就在那里**：

| 阶段 | 波次 | 表现 | 危险 |
|------|------|------|------|
| **外环 THE HALO** | 1–10 | 引力透镜折弯背景星图 | 视觉提示，尚不构成威胁 |
| **视界 THE HORIZON** | 11–20 | 事件视界变成黑圆，灼烧 + 时间膨胀 | 靠近持续掉血 + 移动变迟滞 |
| **核心 THE CORE** | 21–30 | 吸积盘点亮，引力周期性倒转为斥力 | 必须主动绕行或借势弹射 |

### C · 构筑隐喻

**协同 = 压缩奇点。** 每拿到一张「协同」卡：
```
半径    ↓   （最大 −45%）
引力    ↑   （最大 ×2.6）
吸积盘  亮度 ↑
透镜    折弯 ↑
```
你亲手把天体压成自己的形状——这是本作对「奇点」一词最直接的兑现。

**幽灵回放 = 回响。** 上一局的航迹以极淡的线重现在同一战场，从你的死亡点向外扩散一圈「回响环」。下一局开始时自动加载。

## Stage 1 已完成（最小闭环）

- 战斗：玩家 / 自动开火 / 弹丸池 / 接触伤 / 死亡
- 波次：5 种敌型 / 每 5 波 Boss
- 选卡：每清 2 波一次强化，含「协同」直接压缩奇点
- 暂停 / 继续 / 重开
- 结算 / 分享 / 回响存档
- HUD：奇点读数常驻（阶段 + 密度档 + 压缩度百分比）
- 左下角**固定**摇杆 + 触摸坐标**屏幕→世界**换算
- touchcancel 延迟拆除（120ms）+ 移动期间撤销拆除
- PAL 单点：`wx.*` 全项目只在 `js/pal.js`

## 设计 token（不许再写字面）

```
SCALE   micro/tiny/small/body/lead/title/hero
WEIGHT  regular/medium/bold
TIME    fast/normal/slow/banner
EASE    outCubic/inCubic/outQuint/inOut
COLORS  void/voidDeep/panel/line/ink/inkHi/steel/secInk/cyan/syn/
        danger/dangerHi/foe/hpA/hpB/shieldA/shieldB/amber/violet/
        singHalo/singHoriz/singCore/singDisk/singLens
```

## 移植网页版的"已经做对的"决策

- 战场宽度固定 **360**（手机比例五花八门，固定宽度 → 平衡稳定）
- 触摸坐标是**屏幕**像素，必须 `ARENA.toWorld()` 后再喂给摇杆 / UI（坑死过一遍）
- 打包触点事件要**优先读 changedTouches**：touchend/cancel 时 `touches` 是空列表，否则 identifier 变 0 → 摇杆释放不掉
- 摇杆**基座固定**左下角，浮动基座（按哪儿长哪儿）实战是灾难

## 验证

```powershell
cd E:\Code\game-lab\echo-singularity
$env:NODE_PATH='C:\Users\www27\.workbuddy\binaries\node\workspace\node_modules'
& 'C:/Users/www27/.workbuddy/binaries/node/versions/22.22.2-3/node.exe' tools/h5/probe.cjs
```
输出形如 `54/54 PASS`，截图落在 `tools/h5/_shots/`。

## Stage 2 已完成（区域 / 门 / 通道 / 穿越）

> 三项都按作者拍板的方向走：**同一个奇点越穿越致密 + 区域只换色调换敌型 + Boss 死后手动飞进门**。
> 巨像不再爆东西 —— 回报全在通道里。

### Boss 波 → 通道的链路

| 步 | 事件 | 视觉 |
|----|------|------|
| 1 | 区域收尾巨像（10/20/30）登场 | 正常 Warden |
| 2 | 巨像倒下 → 原地坍缩成**亚稳态 METASTABLE** 门 | 灰冷环 + 未完成的弧 + 暗十字 |
| 3 | 奇点不可通过 → 玩家继续清剿杂兵 | 奇点不拽、不灼烧 |
| 4 | 杂兵清零 → 门**开启 OPEN** | 白热洞 + 强吸引 + 四向箭头 |
| 5 | 玩家飞进去 → **穿越过场**（2 秒） | 隧道环 + 速度线 + 白闪 + 旋转 |
| 6 | 从另一端被吐出 → 通道奖励关 | 22 秒纵版卷 + 星尘 + 障碍 |
| 7 | 通道结束 → 折算成 1～3 张强化卡 | 「继续」→ 发卡 → 进下一区域 |

### 模块（新增三个）

```
js/
  regions.js        ★ 区域表 + 区域判定 + 无尽层
  warp.js           ★ 穿越过场（隧道环 + 速度线 + 白闪 + 旋转）
  channel.js        ★ 通道奖励关（向上卷轴 + 星尘 + 障碍 + 折算选卡）
```

### 压缩有两个来源

```
compression = clamp(synergy/6 × 0.65 + warps/3 × 0.35, 0, 1)
```

- 协同（构筑）—— 选「协同」卡
- 穿越（深度）—— 钻过几次奇点

HUD 顶部读数同步显示两者贡献。穿越 3 次 + 协同 6 张 = 满压缩 1.00。

### 亚稳态 METASTABLE 术语来源

物理学中的 metastable state：看起来稳定、实则随时跃迁到另一状态。
正好对应「Boss 死了、不动了、但通道还没开」，且贴合本作的星图测绘语言。
HUD 在亚稳态与开启态都会切换提示横幅，门离玩家远时还会显示指向箭头。

## 黑洞透镜（Stage 2 之后单独一轮）

> 作者原话：「希望奇点的视觉效果是像黑洞一般扭曲周围光线，
> 它的大小不是很大，稍微比平时吃的升级道具要大一倍。」

### 能做，但有一个绕不开的官方约束

- 微信小游戏 `wx.createOffscreenCanvas` 文档明确「**离屏 Canvas 类型不可混用**」——
  webgl 离屏画布不能 `getContext('2d')`，不同 canvas 创建的 image 对象也不支持混用。
- 主画布是 2D 时，**真 shader 后处理不可行**（要重写整个渲染器为 WebGL，工作量爆炸）。
- 弃用方案：`black-hole.js`（cliffcrosland, 2015, WebGL+glfx.js+numeric.js+jQuery 的 ODE 求解器，**只支持静态图片**）。

### 落地的方案：2D 同心环切片透镜

`js/singularity.js → Singularity.prototype._lens(c)`：

1. **抠图**：从主画布抠出奇点周围 `R × 4` 那块（懒创建的 `PAL.createOffscreen2D` 离屏画布，物理像素采样）。
2. **逐环重绘**：在主画布的「影响圆」clip 内，按 **9 个同心圆环** 重绘这块抠图：
   - 每环 `f = (R/rm)²`（越靠视界偏折越剧烈，符合真实偏折）
   - `scale = 1 + PULL × f × k`（径向放大 = 光线被拉向视界）
   - `rot = (TWIST × k + diskA × 0.25) × f`（旋转 = 参考系拖曳 frame dragging）
3. **关键好处**：因为采样自主画布 → 星空 / 网格 / 敌机 / 弹幕**一起**被扭，不只是背景。
   这才是「扭曲周围光线」该有的样子。

### 尺寸（按作者要求）

- 升级道具视觉直径 ≈ 16 → `BASE.R = 16`（视界直径 32 ≈ 道具两倍）。
- `LENS.REACH = 4` → 影响直径 ≈ 128（屏宽 360 的 36%，不到「半个屏幕」）。
- `PULL_R 96 / PULL_A 340` 同步重调（范围小了，力得更猛才够威胁）。
- 各阶段视界直径（arena 宽 360）：外环 ≈ 70 / 视界 ≈ 128 / 核心 ≈ 160。
- `lensOn` 开关为未来画质档预留。

### 验证

```
$env:NODE_PATH='C:\Users\www27\.workbuddy\binaries\node\workspace\node_modules'
& 'C:/Users/www27/.workbuddy/binaries/node/versions/22.22.2-3/node.exe' tools/h5/probe.cjs
```

`54/54 PASS`（含 38-lens-differs，对比 lens 开/关两帧确认画面**真的不同**）。
截图见 `tools/h5/_shots/03b-lens.png`：网格线在奇点周围被肉眼可见地折弯成同心环，
星点被拉向视界方向。

## Stage 2.5：拾取物系统 + 屏幕边缘状态层

> 作者原话：「当玩家见到加攻速、加速、护盾、无敌等 buff，能不能也给屏幕边缘来一圈符合其的滤镜效果？」

### 拾取物（移植自网页版，原 `index.html:5930`）

网页版就有完整掉落系统，移植时整块漏了——`p.magnet` 定义了却**从没被读过**。这次补齐。

| id | 中文 | 效果 | 时长 | 权重 | 主色 |
|---|---|---|---:|---:|---|
| `boost` | 推进超频 | accel ×1.5 / maxSpeed ×1.5 | 7s | 30% | 石绿 `puBoost` |
| `heal` | 应急修复 | 回血 +30% maxHp | 即时 | 26% | 暖粉 `puHeal` |
| `rate` | 火力超频 | 射速 ×1.6 | 7s | 20% | 冰蓝 `cyanHi` |
| `shield` | 相位屏障 | 屏障 40 点，每秒自减 7 | ~5.7s | 13% | 屏障青 `shieldB` |
| `invuln` | 无敌力场 | 完全免疫伤害 | 4s | 6% | 黄铜 `amberHi` |
| `level` | 数据注入 | 立刻白给一张非协同永久卡 | 即时 | 5% | 锰紫 `violetHi` |

刷新间隔 7–12 秒、场上最多 3 个、存活 12 秒、磁吸 `magnet² × 0.64`、磁吸速度 320。

唯一改造：`level` 在网页版是 +1 LV，但本作没有 XP/等级系统，改为**立即随机白给一张非协同永久强化卡**。协同卡不能白送——它是直接压缩奇点的核心资源，只能玩家自己在选卡时取舍。

⚠️ **顺手修了一个历史遗留**：原来 `p.magnet` 从没被读过，「牵引场」卡选了完全没效果。这次磁吸生效后，这张卡从废卡变活卡——但单卡 +35% 不够看，建议 Stage 3 卡池重构时把 magnet 卡的描述改成"+35% 拾取磁吸"。

### 屏幕边缘状态层（`js/aura.js`）

**为什么放在边缘**：玩家 90% 注意力在准星附近，边缘是余光能收到但不抢戏的位置。血量、buff 这类"持续中的状态"正适合放这儿——不用低头看 HUD，也不用弹横幅打断节奏。

**视觉语法**：每个激活状态占**一条从边缘向内渐隐的光带**（4 边线性渐变）。多条从外向内依次排列——像测绘仪的多层读数环，**数得清有几个、看得出各是什么颜色**。

**为什么不用整屏叠加一层色**：多个 buff 同时开时颜色会混成一坨，玩家分不出自己身上挂了什么。分带排列天生可数。

**排序规则**：
- **低血量固定占最外一条**（slot 0），且比 buff 带更厚（26 vs 13）、随心跳脉动（`sin³` 模拟收缩快舒张慢）、血越少越浓（0.10→0.42）心跳越快（5→12 BPM）
- buff 在它内侧紧凑排列：`invuln → rate → boost → shield`（固定顺序，便于形成肌肉记忆）
- buff 剩余 < 1.5s 开始闪烁（11Hz），提醒"要没了"

**与 HUD 徽章的分工**（`js/ui.js → drawBuffs`）：
- 边缘光带回答"有 / 没有"和"大致是哪一类"
- HUD 徽章（字形 + 倒计时弧）负责精确辨识
- **两边读同一份数据** `Aura.buffList(cb)`——判定逻辑只写一遍，避免一边有一边没有的割裂

**何时不画**：低血 buff 在 `p.alive && hp/maxHp < 0.35` 时才出现。常驻护盾不画（它是状态不是 buff，走 HUD 血条），只有拾取来的临时屏障（`p.shieldTmp`）才挂边缘。

### 副作用：卡片池独立成 `js/cards.js`

为了不产生"逻辑层依赖渲染层"的脆弱加载顺序，把 `CARDS` 从 `ui.js` 抽到 `cards.js`。`combat`（拾取白送卡用）和 `app`（选卡用）都直接 require cards，不再借道 ui。**这正好是 Stage 3「工坊式卡池」的扩展点**。

### 验证

```
$env:NODE_PATH='C:\Users\www27\.workbuddy\binaries\node\workspace\node_modules'
& 'C:/Users/www27/.workbuddy/binaries/node/versions/22.22.2-3/node.exe' tools/h5/probe.cjs
```

`54/54 PASS`。新增 15 项断言（40–54），覆盖：
- 拾取物刷新 / 磁吸 / 吃到
- 六种 buff 数值（与网页版严格对齐）
- buff 实测生效（极速 168→252 = 1.5×、射速 4→6/秒）
- 无敌完全免疫、屏障先扛
- `level` 连开 24 次协同不被白送（保护核心隐喻）
- **边缘颜色的通道验证**（朱砂 G/R=0.27 / 黄铜 G/R=0.85 区分清楚，理论值 0.33 / 0.88）

截图 `tools/h5/_shots/10-buffs.png`：低血 + 四个 buff + 六种拾取物同屏展示。

## Stage 3+ 待办（不在 Stage 2 范围）

- 工坊式卡池（稀有度 / 协同流派）
- 难度档 / 自定义挑战 / 种子分享（`wx.shareAppMessage({query:'g=...'})` 替换网页版 `#g=`）
- 排行榜（开放数据域）
- 分享卡截图 + 转发
- 航行日志图鉴 / 星图
- 设置面板（画质档 / 减弱动态 / 色盲）
- BGM 分包 + 64k 单声道压缩
- PAL 完成（语音 / 启动参数归因 / 退款式等）