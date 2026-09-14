;(function () {
'use strict';
/* ============================================================================
   pickups.js —— 地图刷新拾取物（从网页版 singularity-echo 移植，原 index.html:5930）
   ----------------------------------------------------------------------------
   原作者（网页版）的掉落权重：boost 30 / heal 26 / rate 20 / 屏障 13 / 无敌 6 / 升级 5
   —— «越强的越稀有»。这条曲线我原样搬过来，不动。

   ⚠️ 移植版的唯一改动：`level`（数据注入）原本是 +1 LV，但本作**没有 XP/等级
   系统**（网页版有 gainXp）。改成「立即随机获得一张强化卡」，语义上「数据注入」
   依然贴切，而且复用现成的选卡池，不用再建一套成长线。

   ── 为什么字形用几何路径而不是字符 ──────────────────────────────────────
   网页版用的是 '≫ ✚ ↻ ◈ ☼ ↑' 这些 Unicode 符号。小游戏跑在安卓上时字体覆盖
   不确定，缺字会直接变成豆腐块□ —— 而拾取物是玩家要**一眼认出**的东西，
   认不出来等于没做。所以这里全部改用 canvas 路径画，任何设备都一致。
   ========================================================================== */

const U = require('./util.js');
const T = require('./tokens.js');
const ARENA = require('./arena.js');
const clamp = U.clamp, TAU = U.TAU;
const AW = ARENA.ARENA_W, AH = ARENA.ARENA_H;

/* ── 拾取物定义 ─────────────────────────────────────────────────────────
   w     掉落权重（累计阈值，见 pickType）
   dur   buff 持续秒数；0 = 即时生效，不占边缘槽位
   col   主色 token（边缘晕影 / 图标 / 飘字共用，保证三者是同一个颜色来源） */
const PU = {
  boost:  { zh: '推进超频', en: 'OVERDRIVE', col: 'puBoost',  dur: 7,   w: 0.30 },
  heal:   { zh: '应急修复', en: 'REPAIR',    col: 'puHeal',   dur: 0,   w: 0.56 },
  rate:   { zh: '火力超频', en: 'CYCLONIC',  col: 'cyanHi',   dur: 7,   w: 0.76 },
  shield: { zh: '相位屏障', en: 'BARRIER',   col: 'shieldB',  dur: 0,   w: 0.89 },
  invuln: { zh: '无敌力场', en: 'INVULN',    col: 'amberHi',  dur: 4,   w: 0.95 },
  level:  { zh: '数据注入', en: 'INJECT',    col: 'violetHi', dur: 0,   w: 1.00 },
};
const PU_ORDER = ['boost', 'heal', 'rate', 'shield', 'invuln', 'level'];

/* ── 刷新参数 ───────────────────────────────────────────────────────────── */
const CFG = {
  FIRST: 5.0,          // 开局第一个来得早一点，让玩家早点见到这套系统
  GAP_MIN: 7.0, GAP_MAX: 12.0,
  MAX_ALIVE: 3,        // 场上最多 3 个（网页版同值）
  LIFE: 12.0,          // 没人吃就消失
  MAGNET_K: 0.64,      // 磁吸范围² = magnet² × K（网页版同值）
  MAGNET_SPD: 320,     // 磁吸飞行速度
  GRAB_R: 16,          // 拾取判定半径 = p.r + 16
  TRAIL_DT: 0.05,      // 磁吸拖尾间隔
};

/* ── 几何字形 ───────────────────────────────────────────────────────────
   全部在**已 translate 到中心**的坐标系里画，尺寸按 r 归一。
   设计约束：缩到 10px 也能认出来 —— 所以宁可简笔，不要细节。 */
function drawGlyph(c, type, r, lw) {
  c.lineWidth = lw;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  if (type === 'boost') {
    /* » 双箭头 —— 推进 */
    for (let i = 0; i < 2; i++) {
      const ox = -r * 0.42 + i * r * 0.62;
      c.beginPath();
      c.moveTo(ox - r * 0.22, -r * 0.52);
      c.lineTo(ox + r * 0.26, 0);
      c.lineTo(ox - r * 0.22, r * 0.52);
      c.stroke();
    }
  } else if (type === 'heal') {
    /* + 十字 —— 修复 */
    c.beginPath();
    c.moveTo(-r * 0.6, 0); c.lineTo(r * 0.6, 0);
    c.moveTo(0, -r * 0.6); c.lineTo(0, r * 0.6);
    c.stroke();
  } else if (type === 'rate') {
    /* 圆环 + 三道放射 —— 射速（转得快的意象） */
    c.beginPath(); c.arc(0, 0, r * 0.52, 0, TAU); c.stroke();
    c.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + i * TAU / 3;
      c.moveTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
      c.lineTo(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98);
    }
    c.stroke();
  } else if (type === 'shield') {
    /* ◈ 菱形 —— 屏障 */
    c.beginPath();
    c.moveTo(0, -r * 0.72); c.lineTo(r * 0.72, 0);
    c.lineTo(0, r * 0.72); c.lineTo(-r * 0.72, 0);
    c.closePath(); c.stroke();
  } else if (type === 'invuln') {
    /* ☼ 圆 + 八道放射 —— 无敌力场 */
    c.beginPath(); c.arc(0, 0, r * 0.34, 0, TAU); c.stroke();
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8;
      c.moveTo(Math.cos(a) * r * 0.56, Math.sin(a) * r * 0.56);
      c.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
    }
    c.stroke();
  } else {
    /* ↑ 上箭头 —— 数据注入（升级） */
    c.beginPath();
    c.moveTo(0, r * 0.72); c.lineTo(0, -r * 0.5);
    c.moveTo(-r * 0.46, -r * 0.08); c.lineTo(0, -r * 0.5); c.lineTo(r * 0.46, -r * 0.08);
    c.stroke();
  }
}

/* ══════════════════════════════════════════════════════════════════════
   PickupField
   ════════════════════════════════════════════════════════════════════ */
function PickupField() {
  this.a = [];
  this.t = CFG.FIRST;      // 距下次刷新的秒数
  this.picked = [];        // 本帧拾取到的（供 combat 消费）
}

PickupField.prototype.reset = function () {
  this.a.length = 0;
  this.t = CFG.FIRST;
  this.picked.length = 0;
};

/* 按权重挑类型 */
function pickType(r01) {
  for (let i = 0; i < PU_ORDER.length; i++) {
    if (r01 < PU[PU_ORDER[i]].w) return PU_ORDER[i];
  }
  return 'heal';
}

/* 刷新点：避开奇点（刷进去会被瞬间吞掉，玩家会觉得"它自己没了"）、
   避开顶部 HUD 区与底部血条 / 摇杆区。 */
PickupField.prototype._spot = function (rng, sing) {
  const met = sing.metrics();
  const avoid = met.R * 2.8;
  for (let k = 0; k < 14; k++) {
    const x = 30 + rng.next() * (AW - 60);
    const y = 96 + rng.next() * (AH - 260);
    if (U.dist2(x, y, sing.x, sing.y) > avoid * avoid) return { x: x, y: y };
  }
  /* 14 次都撞上奇点（奇点已经很大了）→ 退到最下面一行，总比刷不出来强 */
  return { x: 30 + rng.next() * (AW - 60), y: AH - 190 };
};

PickupField.prototype.spawn = function (rng, sing, force) {
  if (this.a.length >= CFG.MAX_ALIVE && !force) return null;
  const s = this._spot(rng, sing);
  const u = {
    type: pickType(rng.next()),
    x: s.x, y: s.y,
    t: 0, life: CFG.LIFE,
    tr: 0,            // 拖尾计时
    pulled: false,    // 本帧是否被磁吸（决定拖尾）
  };
  this.a.push(u);
  return u;
};

/* ── 主推进 ─────────────────────────────────────────────────────────────
   onPick(type, x, y) 由 combat 传入 —— 效果归属逻辑层，本模块只管"碰到了"。 */
PickupField.prototype.update = function (dt, p, sing, rng, fx, onPick) {
  this.picked.length = 0;

  /* 刷新 */
  this.t -= dt;
  if (this.t <= 0) {
    this.t = CFG.GAP_MIN + rng.next() * (CFG.GAP_MAX - CFG.GAP_MIN);
    this.spawn(rng, sing, false);
  }

  const grabR = p.r + CFG.GRAB_R;
  const grab2 = grabR * grabR;
  /* 磁吸范围²（跟网页版同一个公式）—— 这是 p.magnet 唯一被读到的地方。
     移植版基础值 46 → 半径 ≈37，约为战场宽度的 10%。 */
  const mag2 = p.magnet * p.magnet * CFG.MAGNET_K;

  for (let i = this.a.length - 1; i >= 0; i--) {
    const u = this.a[i];
    u.t += dt;
    if (u.t > u.life) { this.a.splice(i, 1); continue; }

    const q = U.dist2(u.x, u.y, p.x, p.y);
    u.pulled = false;

    /* 磁吸：进范围就被拽向玩家。没有拖尾的话，玩家看到的是"东西凭空出现在
       身上"；有了拖尾，才读得出是**什么正朝自己飞过来**。 */
    if (q < mag2 && q > grab2) {
      const a = Math.atan2(p.y - u.y, p.x - u.x);
      u.x += Math.cos(a) * CFG.MAGNET_SPD * dt;
      u.y += Math.sin(a) * CFG.MAGNET_SPD * dt;
      u.pulled = true;
      u.tr -= dt;
      if (u.tr <= 0) {
        u.tr = CFG.TRAIL_DT;
        const def = PU[u.type];
        fx.burst(u.x, u.y, 1, def.col, 26, 2);
      }
    }

    /* 吃到 */
    if (q < grab2) {
      const def = PU[u.type];
      fx.burst(u.x, u.y, 12, def.col, 200, 2);
      if (onPick) onPick(u.type, u.x, u.y);
      this.picked.push(u.type);
      this.a.splice(i, 1);
    }
  }
  return this.picked;
};

/* ── 绘制 ─────────────────────────────────────────────────────────────── */
PickupField.prototype.draw = function (c, time) {
  for (let i = 0; i < this.a.length; i++) {
    const u = this.a[i];
    const def = PU[u.type] || PU.heal;
    /* 剩余寿命 < 2.5s 开始闪，提醒"要没了，快去拿" */
    const left = u.life - u.t;
    let a = 1;
    if (left < 2.5) a = 0.35 + 0.65 * Math.abs(Math.sin(time * 9));
    /* 刚刷出来 0.3s 内淡入，别凭空出现 */
    if (u.t < 0.3) a *= u.t / 0.3;

    const br = 1 + Math.sin(time * 3.4 + i) * 0.07;   // 呼吸
    const r = 11 * br;

    c.save();
    c.globalAlpha = a;
    c.translate(u.x, u.y);

    /* 外圈虚线环：测绘仪的"读数圈"，跟奇点的作用圈是同一套语言 */
    c.strokeStyle = T.rgba(def.col, 0.5);
    c.lineWidth = 1;
    c.setLineDash([3, 4]);
    c.beginPath(); c.arc(0, 0, r * 1.62, 0, TAU); c.stroke();
    c.setLineDash([]);

    /* 辉光 */
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 1.9);
    g.addColorStop(0, T.rgba(def.col, 0.30));
    g.addColorStop(1, T.rgba(def.col, 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, r * 1.9, 0, TAU); c.fill();

    /* 本体：深色底 + 主色描边，保证在星空上不会糊掉 */
    c.fillStyle = T.rgba('voidDeep', 0.72);
    c.beginPath(); c.arc(0, 0, r * 1.12, 0, TAU); c.fill();
    c.strokeStyle = T.rgba(def.col, 0.85);
    c.lineWidth = 1.2;
    c.beginPath(); c.arc(0, 0, r * 1.12, 0, TAU); c.stroke();

    /* 字形 */
    c.strokeStyle = T.rgba(def.col, 0.98);
    drawGlyph(c, u.type, r, 1.6);
    c.restore();
  }
};

module.exports = {
  PU: PU, PU_ORDER: PU_ORDER, CFG: CFG,
  PickupField: PickupField, drawGlyph: drawGlyph, pickType: pickType,
};
})();
