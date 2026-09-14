;(function () {
'use strict';
/* ============================================================================
   entities.js —— 玩家 / 弹丸 / 敌机
   ----------------------------------------------------------------------------
   全部用**对象池**，不在战斗循环里 new —— 小游戏的 GC 抖动在低端机上是肉眼
   可见的掉帧。
   ========================================================================== */

const U = require('./util.js');
const T = require('./tokens.js');
const ARENA = require('./arena.js');
const clamp = U.clamp, TAU = U.TAU;
const AW = ARENA.ARENA_W, AH = ARENA.ARENA_H;

/* ── 机体基础属性 ─────────────────────────────────────────────────────── */
const HULL_BASE = {
  maxSpeed: 168, accel: 1150, damp: 5.2,
  fireRate: 3.2, dmg: 10, bspd: 430,
  crit: 0.05, critMul: 1.6, magnet: 46,
  maxHp: 100, shieldMax: 0, r: 10,
};

const HULLS = [
  { id: 'peregrine', zh: '游隼', en: 'Peregrine', desc: '标准巡逻船体 —— 速度、火力、装甲均衡', apply: function (p) { } },
  { id: 'rapier', zh: '轻剑', en: 'Rapier', desc: '玻璃大炮：速度与射速 +15%，最大船体 -20%', apply: function (p) { p.maxSpeed *= 1.15; p.accel *= 1.15; p.fireRate *= 1.15; p.maxHp = Math.round(p.maxHp * 0.8); } },
  { id: 'bulwark', zh: '堡垒', en: 'Bulwark', desc: '重装甲：船体 +45%、出厂带 30 护盾，速度 -12%', apply: function (p) { p.maxHp = Math.round(p.maxHp * 1.45); p.shieldMax = 30; p.maxSpeed *= 0.88; } },
  { id: 'nemesis', zh: '回响', en: 'Nemesis', desc: '终焉残骸：全属性小幅提升、射速 +12%、拾取 +30%', apply: function (p) { p.dmg *= 1.08; p.fireRate *= 1.12; p.magnet *= 1.3; p.crit += 0.04; p.maxHp = Math.round(p.maxHp * 1.1); p.maxSpeed *= 1.04; } },
];

function mkPlayer(hullId) {
  const p = {
    x: AW / 2, y: AH * 0.78,
    vx: 0, vy: 0, ang: -Math.PI / 2,
    hp: 100, maxHp: 100, shield: 0, shieldMax: 0,
    r: HULL_BASE.r,
    cd: 0, alive: true,
    inv: 0,          // 无敌帧（受击后）
    hitFlash: 0,
    hullId: hullId || 'peregrine',
  };
  for (const k in HULL_BASE) p[k] = HULL_BASE[k];
  const h = HULLS.filter(function (x) { return x.id === p.hullId; })[0] || HULLS[0];
  h.apply(p);
  p.hp = p.maxHp;
  p.shield = p.shieldMax;
  /* ── 拾取 buff 计时器（来自 pickups.js，全部是**临时**状态）─────────────
     ⚠️ 与 p.inv（受击后的短无敌帧）区分开：inv 是"刚被打到"的 0.55s，
        invuln 是"无敌力场"给的 4s。两者都要在 hurtPlayer 里挡伤害，
        但视觉上完全不同 —— inv 是船体闪烁，invuln 是金色力场 + 边缘晕影。 */
  p.boostT = 0;         // 推进超频剩余秒（accel / maxSpeed ×1.5）
  p.rateT = 0;          // 火力超频剩余秒（fireRate ×1.6）
  p.invuln = 0;         // 无敌力场剩余秒（免疫一切）
  p.shieldTmp = 0;      // 相位屏障当前值（先于护盾和船体扛伤害）
  p.shieldTmpMax = 0;   // 相位屏障上限（HUD 画条用）
  return p;
}

/* ── 船体路径（世界坐标已 translate 到船心，angle 已 rotate） ─────────── */
function hullPath(c, id) {
  c.beginPath();
  if (id === 'rapier') {
    c.moveTo(15, 0); c.lineTo(2, 1.6); c.lineTo(-5, 2.6); c.lineTo(-10, 6.5);
    c.lineTo(-8, 0.8); c.lineTo(-11, 0); c.lineTo(-8, -0.8); c.lineTo(-10, -6.5);
    c.lineTo(-5, -2.6); c.lineTo(2, -1.6); c.closePath();
  } else if (id === 'bulwark') {
    c.moveTo(9, 0); c.lineTo(5, 5.5); c.lineTo(5, 8.5); c.lineTo(-3, 8.5); c.lineTo(-6, 5);
    c.lineTo(-8, 3); c.lineTo(-8, -3); c.lineTo(-6, -5); c.lineTo(-3, -8.5); c.lineTo(5, -8.5); c.lineTo(5, -5.5); c.closePath();
  } else if (id === 'nemesis') {
    c.moveTo(14, 0); c.lineTo(3, 4.5); c.lineTo(-3, 9); c.lineTo(-6.5, 7); c.lineTo(-4.5, 2.5);
    c.lineTo(-11, 0); c.lineTo(-4.5, -2.5); c.lineTo(-6.5, -7); c.lineTo(-3, -9); c.lineTo(3, -4.5); c.closePath();
  } else { // peregrine
    c.moveTo(13, 0); c.lineTo(2, 2.2); c.lineTo(-4, 3.4); c.lineTo(-9, 7);
    c.lineTo(-7, 0.9); c.lineTo(-10, 0); c.lineTo(-7, -0.9); c.lineTo(-9, -7);
    c.lineTo(-4, -3.4); c.lineTo(2, -2.2); c.closePath();
  }
}

/* ── 敌型定义 ─────────────────────────────────────────────────────────── */
const ENEMY_DEFS = {
  drift:  { hp: 18, r: 11, spd: 54,  score: 10, ai: 'down',  fire: 0,   col: 'foe' },
  dart:   { hp: 12, r: 9,  spd: 124, score: 14, ai: 'dive',  fire: 0,   col: 'foe' },
  orb:    { hp: 28, r: 13, spd: 34,  score: 18, ai: 'hover', fire: 1.6, col: 'violet' },
  shard:  { hp: 8,  r: 7,  spd: 152, score: 8,  ai: 'sine',  fire: 0,   col: 'foe' },
  warden: { hp: 90, r: 20, spd: 30,  score: 60, ai: 'hover', fire: 1.1, col: 'danger' },
};

/* ══════════════════════════════════════════════════════════════════════
   弹丸池
   ════════════════════════════════════════════════════════════════════ */
function BulletPool(n) {
  this.a = new Array(n);
  for (let i = 0; i < n; i++) {
    this.a[i] = { alive: false, x: 0, y: 0, vx: 0, vy: 0, r: 2.5, dmg: 0, life: 0, foe: false, crit: false };
  }
  this.n = n; this.head = 0;
}
BulletPool.prototype.spawn = function (x, y, vx, vy, dmg, foe, r, crit) {
  /* 环形扫描找空位；池满就复用最老的（宁可丢一发也不要 new） */
  let b = null;
  for (let i = 0; i < this.n; i++) {
    const k = (this.head + i) % this.n;
    if (!this.a[k].alive) { b = this.a[k]; this.head = (k + 1) % this.n; break; }
  }
  if (!b) { b = this.a[this.head]; this.head = (this.head + 1) % this.n; }
  b.alive = true; b.x = x; b.y = y; b.vx = vx; b.vy = vy;
  b.dmg = dmg; b.foe = !!foe; b.r = r || 2.5; b.life = 3.2; b.crit = !!crit;
  return b;
};
BulletPool.prototype.update = function (dt) {
  const a = this.a;
  for (let i = 0; i < this.n; i++) {
    const b = a[i];
    if (!b.alive) continue;
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -30 || b.x > AW + 30 || b.y < -30 || b.y > AH + 30) b.alive = false;
  }
};
BulletPool.prototype.draw = function (c) {
  const a = this.a;
  for (let i = 0; i < this.n; i++) {
    const b = a[i];
    if (!b.alive) continue;
    if (b.foe) {
      c.fillStyle = T.rgba('foe', 0.95);
      c.beginPath(); c.arc(b.x, b.y, b.r + 1.6, 0, TAU); c.fill();
      c.fillStyle = T.rgba('dangerHi', 0.95);
    } else {
      c.fillStyle = b.crit ? T.rgba('amberHi', 0.95) : T.rgba('cyanHi', 0.95);
    }
    c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fill();
  }
};
BulletPool.prototype.count = function () {
  let k = 0; for (let i = 0; i < this.n; i++) if (this.a[i].alive) k++;
  return k;
};
BulletPool.prototype.clear = function () {
  for (let i = 0; i < this.n; i++) this.a[i].alive = false;
};

/* ══════════════════════════════════════════════════════════════════════
   敌机池
   ════════════════════════════════════════════════════════════════════ */
function EnemyPool(n) {
  this.a = new Array(n);
  for (let i = 0; i < n; i++) {
    this.a[i] = {
      alive: false, kind: 'drift', x: 0, y: 0, vx: 0, vy: 0,
      hp: 1, maxHp: 1, r: 10, spd: 0, cd: 0, t: 0, flash: 0, seed: 0,
    };
  }
  this.n = n; this.head = 0;
}
EnemyPool.prototype.spawn = function (kind, x, y, hpMul) {
  const d = ENEMY_DEFS[kind] || ENEMY_DEFS.drift;
  let e = null;
  for (let i = 0; i < this.n; i++) {
    const k = (this.head + i) % this.n;
    if (!this.a[k].alive) { e = this.a[k]; this.head = (k + 1) % this.n; break; }
  }
  if (!e) return null;
  const hp = Math.round(d.hp * (hpMul || 1));
  e.alive = true; e.kind = kind; e.x = x; e.y = y;
  e.vx = 0; e.vy = d.spd; e.hp = hp; e.maxHp = hp;
  e.r = d.r; e.spd = d.spd; e.cd = 0; e.t = 0; e.flash = 0;
  e.seed = Math.random() * TAU;
  return e;
};
EnemyPool.prototype.count = function () {
  let k = 0; for (let i = 0; i < this.n; i++) if (this.a[i].alive) k++;
  return k;
};
EnemyPool.prototype.clear = function () {
  for (let i = 0; i < this.n; i++) this.a[i].alive = false;
};
EnemyPool.prototype.draw = function (c) {
  const a = this.a;
  for (let i = 0; i < this.n; i++) {
    const e = a[i];
    if (!e.alive) continue;
    const d = ENEMY_DEFS[e.kind] || ENEMY_DEFS.drift;
    c.save();
    c.translate(e.x, e.y);
    /* 血条：只在受伤后显示 */
    const hit = e.flash > 0;
    c.strokeStyle = T.rgba(hit ? 'inkHi' : d.col, hit ? 0.9 : 0.75);
    c.lineWidth = 1.6;
    c.beginPath();
    if (e.kind === 'orb' || e.kind === 'warden') {
      c.arc(0, 0, e.r, 0, TAU);
      c.moveTo(e.r * 0.45, 0); c.arc(0, 0, e.r * 0.45, 0, TAU);
    } else if (e.kind === 'shard') {
      c.moveTo(0, -e.r); c.lineTo(e.r, e.r * 0.8); c.lineTo(0, e.r * 0.35); c.lineTo(-e.r, e.r * 0.8); c.closePath();
    } else if (e.kind === 'drift') {
      c.rect(-e.r, -e.r * 0.75, e.r * 2, e.r * 1.5);
    } else { // dart
      c.moveTo(0, e.r); c.lineTo(e.r * 0.8, -e.r); c.lineTo(0, -e.r * 0.4); c.lineTo(-e.r * 0.8, -e.r); c.closePath();
    }
    c.stroke();
    if (e.flash > 0) {
      c.fillStyle = T.rgba('inkHi', e.flash * 0.5);
      c.fill();
    }
    c.restore();
  }
};

module.exports = {
  HULLS: HULLS, HULL_BASE: HULL_BASE, ENEMY_DEFS: ENEMY_DEFS,
  mkPlayer: mkPlayer, hullPath: hullPath,
  BulletPool: BulletPool, EnemyPool: EnemyPool,
};
})();
