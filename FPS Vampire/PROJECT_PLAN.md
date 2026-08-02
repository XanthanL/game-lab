# 第一人称网页版吸血鬼幸存者 — 项目规划

> 版本：v0.1（初始规划）
> 目标：在浏览器中运行的第一人称视角（FPS）类《吸血鬼幸存者》玩法 —— 海量敌人、自动攻击、升级选择、生存挑战。

---

## 1. 项目概述

### 1.1 玩法核心
- 玩家以**第一人称视角**在地图中移动，通过 **WASD** 移动、**鼠标**转向。
- 武器**自动攻击**（如吸血鬼幸存者），无需瞄准操作。
- 海量敌人从四面八方涌向玩家，击杀敌人获取经验宝石。
- 升级时**三选一**随机强化（新武器 / 升级武器 / 被动属性）。
- 坚持尽可能久的时间，倒计时生存，挑战高分。

### 1.2 技术选型
| 项目 | 选型 | 理由 |
|------|------|------|
| 语言 | TypeScript | 类型安全，适合复杂游戏逻辑 |
| 渲染 | Three.js | 成熟 WebGL 引擎，支持 FPS 视角、实例化绘制大量敌人 |
| 构建 | Vite | 快速开发，HMR，易于部署 |
| 状态管理 | 自研轻量（或 zustand） | 游戏状态与 UI 解耦 |
| 物理/碰撞 | 自研（简化：圆形/胶囊碰撞） | 避免引入重型物理引擎 |
| UI | HTML/CSS + DOM 覆盖层 | HUD、升级选择界面用 DOM 实现更简单 |

### 1.3 目标平台
- 桌面浏览器（Chrome / Edge / Firefox），优先支持鼠标 + 键盘。
- 后期可扩展触屏。

---

## 2. 里程碑规划

### M1 — 项目骨架与基础场景（第 1 步）
- [ ] Vite + TS + Three.js 工程搭建
- [ ] 第一人称控制器（WASD 移动 + 鼠标视角）
- [ ] 基础地图（地面网格、边界、简单环境）
- [ ] HUD 雏形（血量、时间、击杀数）

### M2 — 战斗核心循环 ✅
- [x] 玩家数据模型（血量、护甲、移速、伤害倍率）
- [x] 敌人生成系统（波次生成、出生点远离玩家）
- [x] 敌人 AI（朝玩家移动、碰撞伤害）
- [x] 基础武器：自动索敌 + 投射物（魔弹）
- [x] 击杀掉落经验宝石 + 拾取
- [x] 玩家受击伤害、死亡与重开

### M3 — 升级与成长系统 ✅
- [x] 经验/升级机制（升级阈值曲线）
- [x] 三选一升级面板（暂停游戏）
- [x] 武器系统框架（可扩展武器类型，behavior 字段）
- [x] 被动属性系统（移速、最大血量、伤害、护甲、磁力、急速）
- [x] 武器升级合并（同武器重复选中自动合并进阶）
- [x] SVG 图标集（武器/被动图标手绘 SVG）

### M4 — 内容扩充 ✅
- [x] 更多武器：飞剑（回旋镖）、圣水（地面 AOE）、雷击（光束）、鞭刃（近战挥舞）
- [x] 更多敌人类型（小怪、突进、重装、精英）
- [x] 精英怪与 BOSS 战（时间事件强制刷出）
- [x] 时间事件（60s 精英解锁、90s 精英波、180s/330s Boss）
- [x] 战斗公告横幅（BOSS 降临等）

### M5 — 表现与打磨 ✅
- [x] 实例化绘制敌人（InstancedMesh，M2 起即生效）
- [x] 粒子效果（命中火花、死亡爆裂、宝石拾取、拾取拖尾）
- [x] 音效与背景音乐（Web Audio 全程合成，M 键静音）
- [x] 屏幕震动、伤害数字、命中反馈（红闪+爆闪）
- [x] 敌人模型增强（朝向玩家 + 发光眼睛 + 自发光材质、星空背景）

### M6 — 完善与发布
- [ ] 开始界面 / 暂停 / 死亡结算界面
- [ ] 存档（本地 LocalStorage）：最高存活时间、击杀数
- [ ] 难度曲线调优与数值平衡
- [ ] 性能优化（对象池、Draw Call 合并）
- [ ] 构建部署（GitHub Pages 等）

---

## 3. 核心系统设计

### 3.1 游戏循环（Game Loop）
```
update(dt)
  ├─ 玩家移动与转向
  ├─ 敌人生成器（根据时间/击杀数调节生成速率）
  ├─ 敌人 AI 更新（朝向玩家、移动、碰撞）
  ├─ 武器更新（冷却、索敌、生成投射物）
  ├─ 投射物更新（移动、命中、销毁）
  ├─ 经验宝石更新（掉落动画、拾取检测）
  ├─ 粒子/特效更新
  ├─ 伤害结算与死亡判定
  └─ HUD 更新
render()
```

### 3.2 战斗系统
- 所有伤害源 → `damage(target, amount, sourceType)` 统一入口
- 敌人血条用简单贴片/颜色变化表示
- 伤害数字以 Sprite/文本粒子弹出
- 受击无敌帧（短暂闪红）

### 3.3 武器设计（数据驱动）
```ts
interface WeaponConfig {
  id: string;
  name: string;
  icon: string;
  damage: number;
  cooldown: number;      // 秒
  level: number;
  maxLevel: number;
  targets: 'nearest' | 'random' | 'aoe' | 'melee';
  projectileSpeed?: number;
  pierce?: number;
  area?: number;         // 作用范围/弹体半径
  behavior: 'bullet' | 'boomerang' | 'melee_swing' | 'ground_aoe' | 'beam';
}
```
- 每种行为对应一个 `WeaponBehavior` 类
- 升级时同类武器 level+1，属性按成长曲线提升

### 3.4 敌人设计
```ts
interface EnemyConfig {
  id: string;
  hp: number;
  speed: number;
  damage: number;        // 接触伤害
  xpValue: number;
  scale: number;
  model: 'skeleton' | 'bat' | 'brute' | 'boss';
  spawnWeight: number;   // 生成权重（随游戏时间变化）
}
```
- 生成规则：只在地图边缘外/玩家视野外生成，避免"凭空出现"
- 每 30 秒一波，波次强度曲线 = f(时间)

### 3.5 数值平衡（参考）
- 升级经验需求：`nextLevel = 5 + level * 3`（可调）
- 敌人数量：从 3 只/秒 逐渐增长到 30+ 只/秒
- 玩家初始：HP 100，移速 6 m/s，默认武器"魔弹"1 级

---

## 4. 目录结构（规划）

```
fps-vampire/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
├─ public/                  # 静态资源（音效、图标）
├─ src/
│  ├─ main.ts               # 入口
│  ├─ core/                 # 引擎核心
│  │  ├─ Game.ts            # 游戏主类/循环
│  │  ├─ EventBus.ts        # 事件总线
│  │  ├─ ObjectPool.ts      # 对象池
│  │  └─ MathUtils.ts
│  ├─ engine/               # 渲染相关
│  │  ├─ Renderer.ts        # Three.js 封装
│  │  ├─ Camera.ts          # FPS 摄像机
│  │  ├─ Instances.ts       # 实例化绘制（敌人/投射物）
│  │  └─ Particles.ts
│  ├─ player/
│  │  ├─ Player.ts          # 玩家状态
│  │  └─ PlayerController.ts# 移动/视角
│  ├─ enemies/
│  │  ├─ EnemyManager.ts    # 生成与更新
│  │  ├─ Enemy.ts
│  │  └─ enemyConfigs.ts
│  ├─ weapons/
│  │  ├─ Weapon.ts          # 武器基类
│  │  ├─ WeaponManager.ts
│  │  ├─ behaviors/         # 各武器行为
│  │  └─ weaponConfigs.ts
│  ├─ systems/
│  │  ├─ UpgradeSystem.ts   # 升级三选一
│  │  ├─ DamageSystem.ts
│  │  ├─ XpSystem.ts
│  │  ├─ WaveSystem.ts      # 波次/时间事件
│  │  └─ PassiveSystem.ts   # 被动属性
│  ├─ ui/
│  │  ├─ HUD.ts
│  │  ├─ UpgradeMenu.ts
│  │  ├─ GameOverScreen.ts
│  │  └─ MainMenu.ts
│  ├─ config/
│  │  ├─ balance.ts         # 数值配置
│  │  └─ constants.ts
│  └─ utils/
└─ docs/                    # 后续补充设计文档
```

---

## 5. 关键实现要点

### 5.1 海量敌人性能
- 敌人/投射物/宝石全部用 **InstancedMesh**，单次 draw call
- 敌人状态用 JS 数组管理，按存活状态复用实例
- 远距离敌人低精度渲染或剔除

### 5.2 FPS 视角
- 指针锁定（Pointer Lock API）控制鼠标视角
- Pitch/Yaw 相机，限制俯仰角
- 玩家不可见自身模型（或仅显示武器）

### 5.3 自动索敌
- 每帧/每 0.2s 从敌人列表选取最近目标
- 空间分区（网格分桶）优化近邻查询

### 5.4 地图
- 阶段 1：开阔平原 + 边界墙
- 阶段 2：可加障碍物、草丛、装饰（仅视觉）
- 无限地图可选（后期）：区块生成 + 敌人随玩家位置刷新

---

## 6. 风险与对策

| 风险 | 对策 |
|------|------|
| 敌人过多导致帧率下降 | 实例化绘制、对象池、数量上限（动态降级） |
| 近战武器手感差（第一人称） | 武器挥舞动画+屏幕反馈+范围判定 |
| 数值失衡（太简单/太难） | 数据驱动配置，集中 balance.ts，便于调优 |
| 浏览器指针锁定兼容性 | 提供 Esc 退出与暂停兜底 |

---

## 7. 执行顺序建议

按里程碑 M1 → M6 顺序推进，每步完成即运行验证：
1. **M1 骨架**（能走能看）
2. **M2 战斗循环**（能打能死）← 第一个可玩版本
3. **M3 升级系统**（核心乐趣闭环完成）
4. **M4 内容扩充**
5. **M5 表现打磨**
6. **M6 发布**

> 每次迭代先在 `docs/` 下更新设计细节，再动代码，保证设计与实现同步。

---

## 8. 后续文档索引（占位）

- `docs/game-design.md` — 详细玩法设计
- `docs/weapons.md` — 武器与升级表
- `docs/enemies.md` — 敌人与波次设计
- `docs/balance.md` — 数值平衡表
