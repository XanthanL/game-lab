;(function () {
'use strict';
/* ============================================================================
   singularity.js —— 奇点系统
   ----------------------------------------------------------------------------
   这是本作与网页版最大的分野：**奇点不再是第 40 波才露一面的 Boss 机制，
   而是战场本身的状态。** 名字叫「奇点回响」，就必须让玩家从第 1 波起就
   看见它、绕开它、最后被它吞掉。

   ── B 视觉叙事：三阶段逼近 ──────────────────────────────────────────────
     0 外环 THE HALO    远处的一个异常。只有引力透镜能证明它存在 ——
                        背景星图在它周围被折弯。不施力，不伤人。
                        玩家感受到的是「有什么东西在那儿」。
     1 视界 THE HORIZON 它长大了。事件视界变成一个黑圆，靠近会持续灼烧，
                        而且时间被拉长（移动变迟滞）。玩家必须绕行。
     2 核心 THE CORE    吸积盘点亮，引力每隔几秒倒转为斥力。
                        战场中心不再是可通行区域，而是必须处理的威胁。

   ── C 构筑隐喻：协同 = 压缩奇点 ─────────────────────────────────────────
     玩家每拿到一张协同卡，奇点就被压得更致密：
       半径 ↓  ·  引力 ↑  ·  吸积盘更亮  ·  透镜更强
     即「你的构筑越强，你把奇点压得越小越危险」。
     构筑的力量不是抽象的数值增长，而是肉眼可见的天体演化 —— 这是本作
     的核心表达。

   ── C 构筑隐喻：幽灵回放 = 回响 ─────────────────────────────────────────
     上一局的航迹被保存下来，本局以极淡的线重现在同一个战场上，
     从你的死亡点向外扩散一圈「回响环」。你是在和自己的上一次对撞。
   ========================================================================== */

const U = require('./util.js');
const T = require('./tokens.js');
const PAL = require('./pal.js');
const ARENA = require('./arena.js');
const clamp = U.clamp, lerp = U.lerp, TAU = U.TAU;

/* ── 三阶段定义 ───────────────────────────────────────────────────────── */
const STAGES = [
  {
    id: 'halo', zh: '外环', en: 'THE HALO', from: 1,
    note: '引力异常已被记录 —— 尚不构成威胁',
    grav: 0,        // 引力强度倍率（0 = 只画不拽）
    burn: 0,        // 事件视界灼烧 DPS
    dilate: 0,      // 时间膨胀强度
    disk: 0,        // 吸积盘亮度
    flip: false,    // 是否周期反转
    /* ⚠️ 原来是 0.55 —— 配上 BASE.R=16 只有 8.8px 半径，比拾取物还小，
       玩家全程看不见奇点（作者实测到第 12 波都没发现它存在）。
       0.80 → 12.8px 半径（直径 25.6 ≈ 拾取物大小），既保住「远、还没长大」
       的叙事，又保证余光能收到。 */
    rMul: 0.80,     // 视界半径倍率（相对基准）
  },
  {
    /* ⚠️ from 必须与 regions.js 的 REGIONS[].from 完全一致（同一套区域划分
       的两种表达：那边管色调/敌型，这边管奇点形态）。改一处忘另一处，
       就会出现「区域横幅说视界、奇点读数还是外环」的割裂。
       probe.cjs 的 55-stage-region-sync 盯着这个。 */
    id: 'horizon', zh: '视界', en: 'THE HORIZON', from: 6,
    note: '事件视界成型 —— 靠近即灼烧，时间被拉长',
    grav: 1, burn: 13, dilate: 1, disk: 0.45, flip: false, rMul: 1.0,
  },
  {
    id: 'core', zh: '核心', en: 'THE CORE', from: 11,
    note: '吸积盘点亮 —— 引力将周期性倒转为斥力',
    grav: 1.35, burn: 18, dilate: 1, disk: 1, flip: true, rMul: 1.25,
  },
];

/* ── 基准数值（arena 宽 360 的坐标系） ─────────────────────────────────── */
const BASE = {
  /* R 是「事件视界」半径。作者要求：不要很大，大约比升级道具大一倍。
     拾取物本体直径约 24（r=11 × 1.12）→ 这里取 16，视界直径 32 ≈ 1.3 倍。 */
  R: 16,
  /* ⚠️ 视界下限。压缩会让 R 再乘 (1-0.45c)，满压缩时 stage0 会缩到 7px ——
     比拾取物还小，玩家会彻底失去「它在哪」的感知。压缩是核心隐喻，
     但表达要有底线：再压也得看得见。 */
  R_MIN: 9,
  PULL_R: 96,     // 引力作用半径（边缘趋零、中心最强）—— 跟着 R 一起收窄
  PULL_A: 340,    // 引力加速度峰值（范围收窄了，力得更猛才够威胁）
  LENS: 5200,     // 引力透镜位移系数（星空用的老办法，透镜另算）
  DILATE: 0.42,   // 时间膨胀最大比例（1-0.42 = 贴脸时只剩 58% 速度）
  FLIP_T: 4.2,    // 核心阶段：引力持续时间（秒）
  FLIP_R: 2.0,    // 核心阶段：斥力持续时间（秒）
};

/* ── 黑洞透镜 ───────────────────────────────────────────────────────────
   真逐像素偏折要 shader，而微信小游戏官方文档明确「离屏 canvas 类型不可混用」
   —— webgl 离屏画布不能往 2d 主画布上 drawImage，不同 canvas 创建的图片对象
   也不支持混用。所以主画布走 2D 时，真 shader 后处理在这个架构下不可行。
   改用几何近似：把奇点周围那块从主画布抠下来，按**同心圆环逐环**做
     径向放大 = 光线被拉向视界
     旋转     = 参考系拖曳（frame dragging，自转的黑洞会拖着时空一起转）
   再贴回去。因为是从主画布采样，星空 / 网格 / 敌机 / 弹幕会**一起**被扭，
   不只是背景 —— 这才是「扭曲周围光线」该有的样子。 */
const LENS = {
  /* 影响半径 = R × 4。再大视觉上就「占半个屏幕」了，跟「不要很大」的要求冲突。
     各阶段实际直径：外环 ~70 / 视界 ~128 / 核心 ~160（arena 宽 360）—— 逐级逼近。 */
  REACH: 4.0,
  PULL: 0.62,     // 最内环的径向放大增量
  TWIST: 0.55,    // 最内环的旋转量（弧度）
  RINGS: 9,       // 环数（越多越平滑，也越贵）
  MAXPX: 448,     // 离屏画布边长上限（物理像素）
};

/* ── 压缩曲线：协同数 → 压缩度 0..1 ───────────────────────────────────── */
const SYNERGY_FULL = 6;                 // 拿到 6 张协同卡 = 压缩到临界
function compressionOf(synCount) { return clamp(synCount / SYNERGY_FULL, 0, 1); }

/* 压缩 → 密度分档文案（玩家可读的「奇点状态」） */
const DENSITY_TIER = [
  { at: 0.00, zh: '弥散', en: 'DIFFUSE' },
  { at: 0.20, zh: '凝聚', en: 'COAGULATING' },
  { at: 0.45, zh: '致密', en: 'DENSE' },
  { at: 0.70, zh: '临界', en: 'CRITICAL' },
  { at: 0.95, zh: '坍缩', en: 'COLLAPSING' },
];
function densityTier(c) {
  let t = DENSITY_TIER[0];
  for (const x of DENSITY_TIER) if (c >= x.at) t = x;
  return t;
}

/* ══════════════════════════════════════════════════════════════════════
   奇点主体
   ════════════════════════════════════════════════════════════════════ */
function Singularity() {
  this.reset(0, 180, 320);
}
Singularity.prototype.reset = function (stage, cx, cy) {
  this.x = cx; this.y = cy;
  this.stage = stage | 0;
  this.stageT = 1;          // 阶段过渡进度 0..1（切阶段时回落再升）
  this.pendingStage = this.stage;
  this.compression = 0;     // 总压缩度（协同 + 穿越 两个来源之和）
  this.diskA = 0;           // 吸积盘转角
  this.pulse = 0;           // 呼吸相位
  this.flipT = 0;           // 反转计时
  this.flipped = false;     // true = 当前是斥力
  this.warnT = 0;           // 反转前的预警时长
  this.eaten = 0;           // 累计吞噬计数（吞掉的敌机 / 弹丸）
  this._shake = 0;

  /* ── 门（通道口） ────────────────────────────────────────────────
     0 = 无门（普通天体，纯障碍）
     1 = 亚稳态 METASTABLE：巨像刚倒下，奇点把它吞了并停在那儿；
         无引力、不灼烧、撞上弹开，明确告诉玩家「还不能进」
     2 = 开启 OPEN：残敌肃清，白热的洞，强吸引，飞进去即穿越
     ⚠️ 从头到尾都是**同一个**奇点，只是它在不同时刻的形态。 */
  this.gate = 0;
  this.gateT = 0;           // 开启过渡 0..1
  this._gx = cx; this._gy = cy;   // 门位（巨像死亡点）
  this._mx = cx; this._my = cy;   // 成门前的原位
  this._moveT = 1;          // 从原位滑到门位的过渡
  this.synC = 0;            // 压缩来源之一：协同数
  this.warpC = 0;           // 压缩来源之二：已穿越次数
  this.lensOn = true;       // 黑洞透镜开关（低端机 / 低画质档可关）
};

/* 波次 → 阶段 */
Singularity.prototype.stageForWave = function (w) {
  let s = 0;
  for (let i = 0; i < STAGES.length; i++) if (w >= STAGES[i].from) s = i;
  return s;
};
/* 请求切阶段（带过渡，不瞬变） */
Singularity.prototype.setStage = function (i) {
  i = clamp(i | 0, 0, STAGES.length - 1);
  if (i === this.stage) return false;
  this.pendingStage = i;
  this.stageT = 0;
  return true;
};
Singularity.prototype.stageDef = function () {
  /* 阶段过渡期间（0.9s）就读目标阶段，避免 HUD 显示"已进入新区域但奇点还是旧的"那种割裂感 */
  return STAGES[this.stageT < 1 ? this.pendingStage : this.stage] || STAGES[0];
};

/* ── 压缩有两个来源 ─────────────────────────────────────────────────
     · 协同（构筑）  占 0.65 —— 你把牌打得多协同
     · 穿越（深度）  占 0.35 —— 你钻进去了几次
   两者相加封顶 1。HUD 上分开显示，玩家能看懂自己是哪一路把它压小的。 */
const WARP_FULL = 3;
function recompute(s) {
  s.compression = clamp(compressionOf(s.synC) * 0.65 + clamp(s.warpC / WARP_FULL, 0, 1) * 0.35, 0, 1);
  return s.compression;
}
Singularity.prototype.setSynergy = function (n) { this.synC = n | 0; return recompute(this); };
Singularity.prototype.setWarp = function (n) { this.warpC = n | 0; return recompute(this); };

/* 门状态切换。g=1/2 时要把奇点挪到巨像的死亡点 (gx,gy)。 */
Singularity.prototype.setGate = function (g, gx, gy) {
  if (gx != null) { this._gx = gx; this._gy = gy; }
  if (g > 0 && this.gate === 0) { this._mx = this.x; this._my = this.y; this._moveT = 0; }
  if (g === this.gate) return false;
  this.gate = g;
  this.gateT = (g === 2) ? 0 : 1;
  return true;
};
/* 进入判定半径 */
Singularity.prototype.enterR = function () { return this.metrics().R * 1.05; };

/* ── 派生量（每帧算一次，别到处重算） ─────────────────────────────────── */
Singularity.prototype.metrics = function () {
  const s = this.stageDef(), c = this.compression;
  /* 压缩：半径变小、引力变强、范围略收 —— 更小但更凶 */
  let R = BASE.R * s.rMul * (1 - 0.45 * c);
  /* 保底：压缩归压缩，不能缩到看不见 —— 否则玩家失去「它在哪」的感知 */
  R = Math.max(R, BASE.R_MIN);
  let pullR = BASE.PULL_R * s.rMul * (1 - 0.15 * c);
  let pullA = BASE.PULL_A * s.grav * (1 + 1.6 * c);
  let diskA = s.disk * (0.35 + 0.65 * c);
  const lensK = BASE.LENS * (0.5 + 0.9 * c) * (0.6 + 0.4 * s.rMul);
  let burn = s.burn * (1 + 0.5 * c);
  let dilate = s.dilate * BASE.DILATE;

  /* 门改写一切：
       亚稳态 = 死的（无引力、不灼烧、不膨胀时间），撞上去弹开
       开启   = 饿的（强吸引、不灼烧、不许时间膨胀，否则玩家挪不进去） */
  if (this.gate === 1) {
    R *= 0.85; pullA = 0; burn = 0; diskA = 0; dilate = 0;
  } else if (this.gate === 2) {
    const g = this.gateT;
    R *= 1 + 0.24 * g;
    pullR *= 1 + 0.60 * g;
    pullA = (pullA > 0 ? pullA : BASE.PULL_A) * (1 + 1.5 * g);
    burn = 0;
    diskA *= (1 - g);
    dilate = 0;
  }
  return {
    R: R,
    pullR: pullR,
    pullA: pullA,
    burn: burn,
    dilate: dilate,
    disk: diskA,
    lensK: lensK,
    flip: this.gate ? false : s.flip,
    gate: this.gate,
  };
};

/* ── 场：给定坐标，返回该点的加速度 / 时间膨胀 / 灼烧 ─────────────────── */
Singularity.prototype.fieldAt = function (x, y) {
  const m = this.metrics();
  const dx = this.x - x, dy = this.y - y;
  const d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
  const out = { ax: 0, ay: 0, dilate: 1, burn: 0, prox: 0 };
  if (d >= m.pullR || m.pullA <= 0) return out;

  /* 边缘趋零、中心最强：远了能甩掉，近了必须一直推进 */
  const k = 1 - d / m.pullR;
  const sign = this.flipped ? -1 : 1;
  const a = m.pullA * k * sign;
  out.ax = (dx / d) * a;
  out.ay = (dy / d) * a;

  /* 时间膨胀：越靠近视界越迟滞（引力时间膨胀的玩法化） */
  const p = clamp((m.pullR - d) / m.pullR, 0, 1);
  out.prox = p;
  out.dilate = 1 - m.dilate * p * p;

  /* 事件视界灼烧 */
  if (m.burn > 0 && d < m.R) out.burn = m.burn;
  return out;
};

/* ── 引力透镜：把背景星的位置向外推（小游戏里最省的做法） ─────────────── */
Singularity.prototype.lens = function (x, y, out) {
  const m = this.metrics();
  const dx = x - this.x, dy = y - this.y;
  const d2 = dx * dx + dy * dy;
  const d = Math.sqrt(d2) || 0.0001;
  /* 位移 ∝ 1/d，近处折得厉害；上限截断避免炸开 */
  const s = Math.min(m.lensK / (d2 + 900), d * 0.62);
  out = out || {};
  out.x = x + (dx / d) * s;
  out.y = y + (dy / d) * s;
  out.k = clamp(s / (d * 0.62 + 0.001), 0, 1);   // 0..1，用于给折弯的星加亮
  return out;
};

/* ── 每帧推进 ─────────────────────────────────────────────────────────── */
Singularity.prototype.update = function (dt) {
  const m = this.metrics();
  this.pulse += dt;
  /* 吸积盘转速：压缩越高转得越快 */
  this.diskA += dt * (0.55 + 1.5 * this.compression) * (this.flipped ? -1.6 : 1);

  /* 阶段过渡 */
  if (this.stageT < 1) {
    this.stageT = Math.min(1, this.stageT + dt / 0.9);
    if (this.stageT >= 1) this.stage = this.pendingStage;
  }

  /* 成门：奇点从原位滑向巨像的死亡点 —— 「它把尸体吞了，然后停在那儿」 */
  if (this._moveT < 1) {
    this._moveT = Math.min(1, this._moveT + dt / 0.85);
    const k = T.EASE.inOut(this._moveT);
    this.x = lerp(this._mx, this._gx, k);
    this.y = lerp(this._my, this._gy, k);
  }
  /* 开启过渡（亚稳态 → 白热的洞） */
  if (this.gate === 2 && this.gateT < 1) this.gateT = Math.min(1, this.gateT + dt / 0.7);

  /* 核心阶段：引力 / 斥力周期反转 */
  if (m.flip) {
    this.flipT += dt;
    const span = this.flipped ? BASE.FLIP_R : BASE.FLIP_T;
    /* 反转前 0.8 秒预警 —— 玩家要有机会撤离 */
    this.warnT = (span - this.flipT < 0.8) ? (0.8 - (span - this.flipT)) / 0.8 : 0;
    if (this.flipT >= span) {
      this.flipT = 0;
      this.flipped = !this.flipped;
      this._shake = 0.28;
    }
  } else {
    this.flipped = false;
    this.flipT = 0;
    this.warnT = 0;
  }
  if (this._shake > 0) this._shake = Math.max(0, this._shake - dt);
  return m;
};

/* ══════════════════════════════════════════════════════════════════════
   绘制 —— 分底/面两层，实体画在中间
   ════════════════════════════════════════════════════════════════════ */

/* 底层：引力晕 + 透镜辉光（画在星空之上、实体之下） */
Singularity.prototype.drawBack = function (c) {
  const m = this.metrics();
  const tr = this.stageT;
  const a = tr >= 1 ? 1 : T.EASE.outCubic(tr);
  if (m.pullR <= 0) return;

  /* 作用范围虚线环 —— 测绘仪的「读数圈」
     ⚠️ 0.22 → 0.38：外环阶段没有吸积盘，这圈是玩家判断「它在哪、范围多大」
        的唯一线索，太淡等于没画。 */
  c.save();
  c.globalAlpha = 0.5 * a;
  c.strokeStyle = T.rgba(this.stage === 0 ? 'singHalo' : 'singHoriz', 0.38);
  c.lineWidth = 1;
  c.setLineDash([3, 6]);
  c.beginPath();
  c.arc(this.x, this.y, m.pullR, 0, TAU);
  c.stroke();
  c.setLineDash([]);
  c.restore();

  /* 引力晕：从中心向外衰减的径向渐变 */
  const g = c.createRadialGradient(this.x, this.y, m.R * 0.6, this.x, this.y, m.pullR);
  const cc = this.compression;
  g.addColorStop(0, T.rgba('voidDeep', 0));
  g.addColorStop(0.35, T.rgba(this.flipped ? 'cyanHi' : 'singDisk', 0.10 + 0.14 * cc));
  g.addColorStop(1, T.rgba(this.flipped ? 'cyanHi' : 'singDisk', 0));
  c.save();
  c.globalAlpha = a;
  c.fillStyle = g;
  c.beginPath();
  c.arc(this.x, this.y, m.pullR, 0, TAU);
  c.fill();
  c.restore();
};

/* ── 离屏画布（懒创建，尺寸按需改） ───────────────────────────────────── */
let _off = null, _offCtx = null;
function offscreen(px) {
  const s = Math.min(LENS.MAXPX, Math.max(32, px | 0));
  if (!_off) {
    _off = PAL.createOffscreen2D(s, s);
    _offCtx = _off ? _off.getContext('2d') : null;
  } else if (_off.width !== s) {
    _off.width = s; _off.height = s;
  }
  return _offCtx;
}

/* ── 黑洞透镜 ───────────────────────────────────────────────────────────
   必须在**实体画完之后**调用（drawFront 里），否则扭不到敌机和弹幕。 */
Singularity.prototype._lens = function (c) {
  if (!this.lensOn) return;
  const main = PAL.canvas;
  if (!main || !main.width) return;
  const R = this.metrics().R;
  const reach = R * LENS.REACH;
  const Lw = reach * 2;                                   // 世界单位
  const Lp = Math.min(LENS.MAXPX, Math.ceil(Lw * ARENA.View.totalScale));
  const octx = offscreen(Lp);
  if (!octx || !_off) return;

  /* 抠图。⚠️ 源坐标是画布的**物理像素**，跟当前 transform 无关 */
  const p = ARENA.toPx(this.x, this.y);
  const sx = Math.round(p.x - Lp / 2), sy = Math.round(p.y - Lp / 2);
  if (sx < 0 || sy < 0 || sx + Lp > main.width || sy + Lp > main.height) {
    /* 贴边时抠不到完整一块 —— 直接跳过，避免拖出黑边 */
    if (sx + Lp <= 0 || sy + Lp <= 0 || sx >= main.width || sy >= main.height) return;
  }
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.clearRect(0, 0, _off.width, _off.height);
  try {
    octx.drawImage(main, sx, sy, Lp, Lp, 0, 0, Lp, Lp);
  } catch (e) { return; }

  /* 压缩越高，时空弯得越厉害；门开启时洞张开，透镜也更强 */
  const k = (1 + 0.7 * this.compression) * (this.gate === 2 ? 1.35 : 1);

  c.save();
  /* 只在影响圆内生效 */
  c.beginPath();
  c.arc(this.x, this.y, reach, 0, TAU);
  c.clip();

  for (let i = 0; i < LENS.RINGS; i++) {
    const t0 = i / LENS.RINGS, t1 = (i + 1) / LENS.RINGS;
    const rIn = R * (1 + (LENS.REACH - 1) * t0);
    const rOut = R * (1 + (LENS.REACH - 1) * t1);
    const rm = (rIn + rOut) * 0.5;
    const f = (R / rm) * (R / rm);                 // 越靠近视界，偏折越剧烈
    const s = 1 + LENS.PULL * f * k;
    const rot = (LENS.TWIST * k + this.diskA * 0.25) * f;

    c.save();
    c.beginPath();
    c.arc(this.x, this.y, rOut + 0.7, 0, TAU);
    c.closePath();
    c.moveTo(this.x + rIn, this.y);
    c.arc(this.x, this.y, rIn, 0, TAU, true);
    c.closePath();
    c.clip();
    c.translate(this.x, this.y);
    c.rotate(rot);
    c.scale(s, s);
    c.drawImage(_off, 0, 0, Lp, Lp, -Lw / 2, -Lw / 2, Lw, Lw);
    c.restore();
  }
  c.restore();
};

/* 面层：吸积盘 + 事件视界 + 光子环（画在实体之上） */
Singularity.prototype.drawFront = function (c) {
  this._lens(c);
  if (this.gate === 1) return this._drawDormant(c);
  if (this.gate === 2) return this._drawOpen(c);
  const m = this.metrics();
  const tr = this.stageT;
  const a = tr >= 1 ? 1 : T.EASE.outCubic(tr);
  const cc = this.compression;
  const R = m.R;

  c.save();
  c.globalAlpha = a;

  /* 1) 吸积盘：三道向内收束的虚线环，转速随压缩上升 */
  if (m.disk > 0.01) {
    for (let i = 0; i < 3; i++) {
      const rr = R * (2.05 + i * 0.62);
      const sp = this.diskA * (1 + i * 0.42);
      const seg = 14 - i * 3;
      const step = TAU / seg;
      const al = m.disk * (0.5 - i * 0.12) * (0.55 + 0.45 * cc);
      c.strokeStyle = T.rgba('singDisk', Math.max(0, al));
      c.lineWidth = 2.2 - i * 0.55;
      c.beginPath();
      for (let s = 0; s < seg; s++) {
        const a0 = sp + s * step;
        const a1 = a0 + step * 0.58;
        c.arc(this.x, this.y, rr, a0, a1);
        c.moveTo(this.x + Math.cos(sp + (s + 1) * step) * rr, this.y + Math.sin(sp + (s + 1) * step) * rr);
      }
      c.stroke();
    }
    /* 盘面暖辉 */
    const dg = c.createRadialGradient(this.x, this.y, R * 1.4, this.x, this.y, R * 3.2);
    dg.addColorStop(0, T.rgba('singDisk', 0.16 * m.disk * (0.5 + 0.5 * cc)));
    dg.addColorStop(1, T.rgba('singDisk', 0));
    c.fillStyle = dg;
    c.beginPath();
    c.arc(this.x, this.y, R * 3.2, 0, TAU);
    c.fill();
  }

  /* 2) 事件视界：绝对的暗 —— 用 voidDeep 实心盖住后面的东西 */
  c.fillStyle = T.hex('voidDeep');
  c.beginPath();
  c.arc(this.x, this.y, R, 0, TAU);
  c.fill();

  /* 3) 光子环：视界边缘那一圈亮线；反转期转冷色
     ⚠️ 原来 alpha 只有 0.5、线宽 1.4 —— 在深墨底上几乎糊没了，这是
        「玩家全程没看见奇点」的直接原因。视界本体是纯黑（要吃掉后面的东西），
        唯一的轮廓就靠这一圈，必须给足对比度。 */
  const ringCol = this.flipped ? 'cyanHi' : (this.stage >= 2 ? 'singCore' : 'singHoriz');
  const breathe = 1 + Math.sin(this.pulse * (1.6 + 2.4 * cc)) * 0.045 * (0.4 + cc);
  c.strokeStyle = T.rgba(ringCol, 0.72 + 0.28 * cc);
  c.lineWidth = 1.8 + 1.4 * cc;
  c.beginPath();
  c.arc(this.x, this.y, R * breathe, 0, TAU);
  c.stroke();

  /* 内侧一圈更细的高光，做出「边缘在燃烧」的厚度 */
  c.strokeStyle = T.rgba(ringCol, 0.30 + 0.30 * cc);
  c.lineWidth = 0.9;
  c.beginPath();
  c.arc(this.x, this.y, R * breathe - 2.2, 0, TAU);
  c.stroke();

  /* 4) 外环阶段的「读数刻度」—— 这一阶段视界还很暗、也没有吸积盘，
        光靠一个黑圆玩家根本注意不到。加一圈缓慢自转的测绘刻度，
        把「这里有异常」这件事说清楚（跟测绘仪的语言一致）。 */
  if (this.stage === 0) {
    const sa = this.pulse * 0.35;
    c.strokeStyle = T.rgba('singHalo', 0.45 + 0.2 * cc);
    c.lineWidth = 1.2;
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = sa + i * TAU / 8;
      const r1 = R * 1.30, r2 = R * 1.52;
      c.moveTo(this.x + Math.cos(a) * r1, this.y + Math.sin(a) * r1);
      c.lineTo(this.x + Math.cos(a) * r2, this.y + Math.sin(a) * r2);
    }
    c.stroke();
  }

  /* 4) 反转预警：外圈一道收缩的警示环 */
  if (this.warnT > 0) {
    const w = this.warnT;
    c.strokeStyle = T.rgba('danger', 0.15 + 0.5 * w);
    c.lineWidth = 2;
    c.setLineDash([5, 5]);
    c.beginPath();
    c.arc(this.x, this.y, R * 2.6 + w * R * 1.6, 0, TAU);
    c.stroke();
    c.setLineDash([]);
  }
  c.restore();
};

/* ── 亚稳态 METASTABLE ────────────────────────────────────────────────
   视觉目标：一眼看出「这是个死物、还不能进」。
   做法：去掉一切暖色与运动感 —— 灰冷环、暗核、一道缺口的未完成弧在缓慢转。 */
Singularity.prototype._drawDormant = function (c) {
  const m = this.metrics();
  const R = m.R;
  c.save();
  /* 暗核 */
  c.fillStyle = T.hex('voidDeep');
  c.beginPath(); c.arc(this.x, this.y, R, 0, TAU); c.fill();

  /* 灰冷外环 */
  c.strokeStyle = T.rgba('steel', 0.5);
  c.lineWidth = 1.4;
  c.beginPath(); c.arc(this.x, this.y, R, 0, TAU); c.stroke();

  /* 未完成的弧：270° 缺口，缓慢正转 —— 「还在成形」 */
  const a0 = this.pulse * 0.55;
  c.strokeStyle = T.rgba('secInk', 0.75);
  c.lineWidth = 2;
  c.setLineDash([4, 5]);
  c.beginPath(); c.arc(this.x, this.y, R * 1.42, a0, a0 + Math.PI * 1.5); c.stroke();
  c.setLineDash([]);

  /* 内向的刻度（提示"入口"，但被压住：很短、很淡） */
  c.strokeStyle = T.rgba('steel', 0.32);
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = a0 + i * TAU / 8;
    c.moveTo(this.x + Math.cos(a) * R * 1.62, this.y + Math.sin(a) * R * 1.62);
    c.lineTo(this.x + Math.cos(a) * R * 1.82, this.y + Math.sin(a) * R * 1.82);
  }
  c.stroke();

  /* 中心一枚冷色小核 —— 死掉的光 */
  c.fillStyle = T.rgba('steel', 0.22);
  c.beginPath(); c.arc(this.x, this.y, R * 0.3, 0, TAU); c.fill();
  c.restore();
};

/* ── 开启 OPEN ────────────────────────────────────────────────────────
   视觉目标：一眼看出「这是个洞、快进来」。
   做法：白热径向渐变 + 粗脉动光子环 + 向内收束的能量环 + 四枚指向中心的箭头。 */
Singularity.prototype._drawOpen = function (c) {
  const m = this.metrics();
  const g = this.gateT;
  const R = m.R;
  c.save();

  /* 洞：中心白热 → 向外衰减（与亚稳态的纯黑正好相反） */
  const rg = c.createRadialGradient(this.x, this.y, 0, this.x, this.y, R * 2.4);
  rg.addColorStop(0, T.rgba('singCore', 0.95 * g));
  rg.addColorStop(0.42, T.rgba('singDisk', 0.55 * g));
  rg.addColorStop(1, T.rgba('singDisk', 0));
  c.fillStyle = rg;
  c.beginPath(); c.arc(this.x, this.y, R * 2.4, 0, TAU); c.fill();

  /* 纯白的核心 */
  c.fillStyle = T.rgba('inkHi', 0.9 * g);
  c.beginPath(); c.arc(this.x, this.y, R * 0.55, 0, TAU); c.fill();

  /* 光子环：粗、快速脉动 */
  const br = 1 + Math.sin(this.pulse * 5.2) * 0.075;
  c.strokeStyle = T.rgba('singCore', 0.95);
  c.lineWidth = 2.2 + 2.6 * g;
  c.beginPath(); c.arc(this.x, this.y, R * br, 0, TAU); c.stroke();

  /* 向内收束的能量环：三道，相位错开 —— 「被吸进去」的方向感 */
  for (let i = 0; i < 3; i++) {
    const p = ((this.pulse * 0.85 + i / 3) % 1);
    const rr = R * (2.6 - p * 1.5);
    c.strokeStyle = T.rgba('singCore', (1 - p) * 0.5 * g);
    c.lineWidth = 1.6;
    c.beginPath(); c.arc(this.x, this.y, rr, 0, TAU); c.stroke();
  }

  /* 四枚指向中心的箭头 —— 明确的「这里进」 */
  const spin = this.pulse * 0.6;
  for (let i = 0; i < 4; i++) {
    const a = spin + i * TAU / 4;
    const ox = Math.cos(a), oy = Math.sin(a);
    const r1 = R * 1.9, r2 = R * 1.45;
    c.strokeStyle = T.rgba('singCore', 0.8 * g);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(this.x + ox * r1, this.y + oy * r1);
    c.lineTo(this.x + ox * r2, this.y + oy * r2);
    c.stroke();
    /* 箭尖 */
    const bx = this.x + ox * r2, by = this.y + oy * r2;
    const pa = a + Math.PI;
    c.beginPath();
    c.moveTo(bx, by);
    c.lineTo(bx + Math.cos(pa + 0.4) * 7, by + Math.sin(pa + 0.4) * 7);
    c.moveTo(bx, by);
    c.lineTo(bx + Math.cos(pa - 0.4) * 7, by + Math.sin(pa - 0.4) * 7);
    c.stroke();
  }
  c.restore();
};

/* ══════════════════════════════════════════════════════════════════════
   回响 —— 上一局的航迹
   ════════════════════════════════════════════════════════════════════ */
const ECHO_HZ = 6;           // 采样频率
const ECHO_MAX = 240;        // 最多 40 秒
const ECHO_KEY = 'es-echo';

function Echo() {
  this.pts = [];             // 上一局的轨迹 [x,y,x,y,...]
  this.death = null;         // 上一局的死亡点 {x,y}
  this.cur = [];             // 本局采样缓冲
  this.acc = 0;
  this.t = 0;
}
Echo.prototype.load = function (store) {
  const d = store.get(ECHO_KEY, null);
  if (d && d.p && d.p.length >= 4) {
    this.pts = d.p;
    this.death = d.d || null;
  }
};
Echo.prototype.save = function (store, deathPt) {
  store.set(ECHO_KEY, { p: this.cur.slice(-ECHO_MAX * 2), d: deathPt || null, w: Date.now() });
};
/* 每帧采样（内部按 ECHO_HZ 节流） */
Echo.prototype.sample = function (dt, x, y) {
  this.t += dt;
  this.acc += dt;
  const step = 1 / ECHO_HZ;
  if (this.acc >= step) {
    this.acc = 0;
    this.cur.push(Math.round(x), Math.round(y));
    if (this.cur.length > ECHO_MAX * 2) this.cur.splice(0, 2);
  }
};
/* 绘制：极淡的航迹 + 死亡点向外扩散的回响环 */
Echo.prototype.draw = function (c, alpha) {
  if (this.pts.length < 4) return;
  const a = alpha == null ? 1 : alpha;
  c.save();
  c.globalAlpha = 0.16 * a;
  c.strokeStyle = T.rgba('cyan', 0.9);
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(this.pts[0], this.pts[1]);
  for (let i = 2; i < this.pts.length; i += 2) c.lineTo(this.pts[i], this.pts[i + 1]);
  c.stroke();
  c.restore();

  if (this.death) {
    const ph = (this.t % 3) / 3;
    for (let k = 0; k < 2; k++) {
      const p = (ph + k * 0.5) % 1;
      c.save();
      c.globalAlpha = (1 - p) * 0.3 * a;
      c.strokeStyle = T.rgba('cyanHi2', 1);
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(this.death.x, this.death.y, 6 + p * 46, 0, TAU);
      c.stroke();
      c.restore();
    }
  }
};

module.exports = {
  STAGES: STAGES, BASE: BASE, SYNERGY_FULL: SYNERGY_FULL, WARP_FULL: WARP_FULL,
  DENSITY_TIER: DENSITY_TIER, densityTier: densityTier, compressionOf: compressionOf,
  Singularity: Singularity, Echo: Echo,
  ECHO_KEY: ECHO_KEY,
};
})();
