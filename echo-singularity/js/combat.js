;(function () {
'use strict';
/* ============================================================================
   combat.js —— 战斗核心（纯逻辑，不碰画布）
   ----------------------------------------------------------------------------
   Stage 1 最小闭环：移动 / 自动开火 / 波次 / 协同压缩 / 暂停 / 死亡结算。
   所有绘制都在 render.js，这里只推进状态。

   奇点在这里**不是**装饰：敌机、弹丸、玩家三方都要过一遍引力场，
   时间膨胀会直接改写各自的 dt。
   ========================================================================== */

const U = require('./util.js');
const T = require('./tokens.js');
const E = require('./entities.js');
const ARENA = require('./arena.js');
const SG = require('./singularity.js');
const RG = require('./regions.js');
const PK = require('./pickups.js');
const CD = require('./cards.js');   // 卡池已独立成模块，不再借道 ui.js
const clamp = U.clamp, TAU = U.TAU;
const AW = ARENA.ARENA_W, AH = ARENA.ARENA_H;

/* ── 拾取 buff 数值（与网页版一致，方便对照平衡） ─────────────────────── */
const BUFF = {
  BOOST_ACC: 1.5,      // 推进超频：加速度 ×1.5
  BOOST_SPD: 1.5,      // 推进超频：极速 ×1.5
  RATE_MUL: 1.6,       // 火力超频：射速 ×1.6
  SHIELD_AMT: 40,      // 相位屏障：40 点
  SHIELD_DECAY: 7,     // 相位屏障：每秒自减 7（≈5.7s 自然消退）
  HEAL_PCT: 0.30,      // 应急修复：+30% 最大船体
};

/* ── 波次编排 ─────────────────────────────────────────────────────────── */
/* 巨像 = 每个区域的收尾波。直接引用区域长度，两者永远一致 ——
   以前写死 5，改区域长度时很容易忘，结果巨像出现在区域中间（不开门）。 */
const BOSS_EVERY = RG.REGION_LEN;
const WAVE_BASE = 6;          // 第 1 波敌机数
const WAVE_GROW = 1.9;

function waveQuota(w) { return Math.round(WAVE_BASE + (w - 1) * WAVE_GROW); }
function waveHpMul(w) { return 1 + (w - 1) * 0.16; }

/* 每波可用的敌型 —— 由所在区域决定（区域差异的「换敌型池」那一半） */
function waveKinds(w) { return RG.regionOf(w).kinds; }
/* 无尽层：跑完一轮三个区域后，血量/伤害按层递增 */
function tierMul(w) {
  const t = RG.endlessTier(w);
  return t > 0 ? Math.pow(1.22, t) : 1;
}

/* ── 粒子（击中 / 爆炸 / 拾取） ───────────────────────────────────────── */
function FXPool(n) {
  this.a = new Array(n);
  for (let i = 0; i < n; i++) this.a[i] = { alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, r: 2, col: 'cyanHi', kind: 0 };
  this.n = n; this.head = 0;
}
FXPool.prototype.burst = function (x, y, cnt, col, spd, kind) {
  for (let i = 0; i < cnt; i++) {
    let p = null;
    for (let j = 0; j < this.n; j++) {
      const k = (this.head + j) % this.n;
      if (!this.a[k].alive) { p = this.a[k]; this.head = (k + 1) % this.n; break; }
    }
    if (!p) return;
    const a = Math.random() * TAU, s = spd * (0.35 + Math.random() * 0.65);
    p.alive = true; p.x = x; p.y = y;
    p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
    p.max = p.life = 0.32 + Math.random() * 0.42;
    p.r = 1.2 + Math.random() * 1.8;
    p.col = col; p.kind = kind || 0;
  }
};
FXPool.prototype.update = function (dt) {
  for (let i = 0; i < this.n; i++) {
    const p = this.a[i];
    if (!p.alive) continue;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= (1 - 2.6 * dt); p.vy *= (1 - 2.6 * dt);
    p.life -= dt;
    if (p.life <= 0) p.alive = false;
  }
};
FXPool.prototype.clear = function () { for (let i = 0; i < this.n; i++) this.a[i].alive = false; };

/* ══════════════════════════════════════════════════════════════════════
   Combat
   ════════════════════════════════════════════════════════════════════ */
function Combat(seed, hullId) {
  this.rng = U.RNG(seed || 'void');
  this.seedStr = String(seed || '');
  this.p = E.mkPlayer(hullId);
  this.pb = new E.BulletPool(260);
  this.eb = new E.BulletPool(220);
  this.en = new E.EnemyPool(90);
  this.fx = new FXPool(220);
  this.sing = new SG.Singularity();
  this.sing.reset(0, AW / 2, AH * 0.40);
  this.echo = new SG.Echo();

  this.wave = 0;
  this.score = 0;
  this.kills = 0;
  this.synergy = 0;
  this.time = 0;
  this.spawnLeft = 0;
  this.spawnCd = 0;
  this.gapT = 0;            // 波间隔
  this.state = 'run';       // run | clear | dead
  this.deadT = 0;
  this.shakeT = 0; this.shakeA = 0;
  this.banner = null;       // {zh,en,t,max}
  this.pendingCard = false; // 波次结束 → 等待选卡
  this.warps = 0;           // 已穿越次数（压缩的第二来源）
  this.pendingWarp = false; // 玩家已飞进门 → 请求进入通道
  this._f = { ax: 0, ay: 0, dilate: 1, burn: 0, prox: 0 };

  this.pendingEchoSave = null;

  /* 拾取物（地图上刷新的 buff）—— 效果见 applyPickup */
  this.pk = new PK.PickupField();
  this._onPick = this.applyPickup.bind(this);   // 预绑定，别每帧建闭包
  /* 飘字：拾取 / 破盾这类"发生了一次"的瞬时反馈。banner 太重，这里走轻量队列。 */
  this.toasts = [];
  /* 屏幕脉冲（触发式拾取反馈：回血 / 升级 / 拿到 buff 的那一刻）。
     ⚠️ 队列挂在 cb 上、由 Aura 去画 —— 战斗逻辑**不直接 require 渲染层**。
        （CARDS 寄放在 ui.js 那次已经踩过"逻辑依赖渲染"的坑，不再犯第二次。） */
  this.pulses = [];

  /* 尾流：扁平数组 [x,y,x,y...]，最新在尾部 */
  this.trail = [];
  this.trailN = 26;
}

Combat.prototype.say = function (zh, en, dur) {
  this.banner = { zh: zh, en: en, t: dur || 1.8, max: dur || 1.8 };
};
Combat.prototype.shake = function (a) {
  this.shakeA = Math.max(this.shakeA, a);
  this.shakeT = Math.max(this.shakeT, 0.22);
};

/* ── 波次 ─────────────────────────────────────────────────────────────── */
Combat.prototype.startWave = function (n) {
  this.wave = n;
  const reg = RG.regionOf(n);
  /* 区域换了 → 奇点换形态（外环 / 视界 / 核心）—— 注意是**同一个**奇点 */
  const st = this.sing.stageForWave(n);
  if (st !== this.sing.stage) {
    this.sing.setStage(st);
    this.say('进入 ' + reg.zh, 'ENTER ' + reg.en, 2.0);
  }
  const boss = (n % BOSS_EVERY === 0);
  this.spawnLeft = boss ? waveQuota(n) - 3 : waveQuota(n);
  this.spawnCd = 0.4;
  this.state = 'run';
  if (boss) {
    const e = this.en.spawn(reg.boss, AW / 2, -40, waveHpMul(n) * 1.6 * tierMul(n));
    if (e) e.vy = 26;
    /* BOSS_EVERY 现在直接等于区域长度，所以巨像必然是区域收尾 ——
       倒下后原地坍缩成门，肃清残敌即可进入通道。提示说得越直白越好，
       因为玩家 90% 的时间在被训练「躲开奇点」，这一刻必须反过来说清楚。 */
    this.say('区域巨像 · 肃清后开启通道', 'GATEKEEPER · CLEAR TO OPEN', 2.0);
  } else if (n === 1) {
    this.say('第 1 波', 'WAVE 1', 1.4);
  }
};

Combat.prototype.spawnOne = function () {
  const n = this.wave;
  const kinds = waveKinds(n);
  const k = kinds[Math.floor(this.rng.next() * kinds.length) % kinds.length];
  const x = 24 + this.rng.next() * (AW - 48);
  const e = this.en.spawn(k, x, -26, waveHpMul(n));
  if (e && k === 'dart') { e.vy = e.spd * 0.9; }
  return e;
};

/* ── 玩家 ─────────────────────────────────────────────────────────────── */
Combat.prototype.updatePlayer = function (dt, input) {
  const p = this.p;
  if (!p.alive) return;

  /* ── buff 计时器递减 ────────────────────────────────────────────────
     ⚠️ 用**真实 dt**，不吃奇点的时间膨胀：站进引力井里 buff 反而烧得慢，
        等于奖励玩家去危险区，这个反馈方向是错的。 */
  if (p.boostT > 0) p.boostT = Math.max(0, p.boostT - dt);
  if (p.rateT > 0) p.rateT = Math.max(0, p.rateT - dt);
  if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
  if (p.shieldTmp > 0) {
    p.shieldTmp = Math.max(0, p.shieldTmp - BUFF.SHIELD_DECAY * dt);
    if (p.shieldTmp <= 0) p.shieldTmpMax = 0;
  }

  /* 奇点场：加速度 + 时间膨胀 + 灼烧 */
  const f = this.sing.fieldAt(p.x, p.y);
  const ldt = dt * f.dilate;

  /* 推进超频：加速度与极速**同时**放大。只放一个的话手感很怪 ——
     只放极速会"起步肉、后段飞"，只放加速会"起步猛、撞墙"。 */
  const boosting = p.boostT > 0;
  const acc = p.accel * (boosting ? BUFF.BOOST_ACC : 1);
  const cap = p.maxSpeed * (boosting ? BUFF.BOOST_SPD : 1);

  /* 输入 → 加速度 */
  const s = input && input.stick ? input.stick : null;
  let ax = 0, ay = 0;
  if (s && s.active) { ax = s.dx * acc; ay = s.dy * acc; }
  ax += f.ax; ay += f.ay;

  p.vx += ax * ldt;
  p.vy += ay * ldt;

  /* 阻尼（指数趋近，帧率无关） */
  const k = Math.exp(-p.damp * ldt);
  p.vx *= k; p.vy *= k;

  const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  if (sp > cap) { p.vx = p.vx / sp * cap; p.vy = p.vy / sp * cap; }

  p.x += p.vx * ldt;
  p.y += p.vy * ldt;

  /* 边界：撞墙就把该轴速度吃掉，避免"贴边抖动" */
  const m = p.r + 2;
  if (p.x < m) { p.x = m; if (p.vx < 0) p.vx = 0; }
  if (p.x > AW - m) { p.x = AW - m; if (p.vx > 0) p.vx = 0; }
  if (p.y < m) { p.y = m; if (p.vy < 0) p.vy = 0; }
  if (p.y > AH - m) { p.y = AH - m; if (p.vy > 0) p.vy = 0; }

  /* 朝向：指向移动方向，不动时保持朝上 */
  if (sp > 8) p.ang = Math.atan2(p.vy, p.vx);
  else p.ang = U.angleLerp(p.ang, -Math.PI / 2, 1 - Math.exp(-9 * dt));

  /* 事件视界灼烧 */
  if (f.burn > 0) this.hurtPlayer(f.burn * dt, true);

  if (p.inv > 0) p.inv -= dt;
  if (p.hitFlash > 0) p.hitFlash -= dt;

  /* 尾流采样（每帧一点，超出长度就丢最老的） */
  this.trail.push(p.x, p.y);
  if (this.trail.length > this.trailN * 2) this.trail.splice(0, 2);

  /* 自动开火（火力超频：射速 ×1.6） */
  const rate = p.fireRate * (p.rateT > 0 ? BUFF.RATE_MUL : 1);
  p.cd -= dt;
  if (p.cd <= 0) {
    p.cd += 1 / rate;
    if (p.cd < 0) p.cd = 0;
    this.fire();
  }
};

Combat.prototype.fire = function () {
  const p = this.p;
  /* 找最近的敌机；没有就朝正上方 */
  let tx = p.x, ty = p.y - 100, best = 1e9;
  for (let i = 0; i < this.en.n; i++) {
    const e = this.en.a[i];
    if (!e.alive) continue;
    if (e.y > p.y + 20) continue;
    const d = U.dist2(p.x, p.y, e.x, e.y);
    if (d < best) { best = d; tx = e.x; ty = e.y; }
  }
  let a = Math.atan2(ty - p.y, tx - p.x);
  const crit = this.rng.chance(p.crit);
  const dmg = p.dmg * (crit ? p.critMul : 1);
  const sp = p.bspd;
  this.pb.spawn(p.x, p.y, Math.cos(a) * sp, Math.sin(a) * sp, dmg, false, crit ? 3.2 : 2.6, crit);
  this.fx.burst(p.x + Math.cos(a) * 12, p.y + Math.sin(a) * 12, 2, crit ? 'amberHi' : 'cyanHi', 60, 1);
};

Combat.prototype.hurtPlayer = function (dmg, silent) {
  const p = this.p;
  if (!p.alive) return;
  /* 无敌力场（拾取 buff）→ 完全免疫。连闪白都不给 —— 玩家要能明确感到
     「这一下根本没碰到我」，而不是「碰到但我没掉血」。 */
  if (p.invuln > 0) return;
  if (p.inv > 0) return;                 // 受击后的短无敌帧
  let d = dmg;
  /* 相位屏障是最外层：先于常驻护盾与船体扛，破了自己就没了（不回充） */
  if (p.shieldTmp > 0) {
    const use = Math.min(p.shieldTmp, d);
    p.shieldTmp -= use; d -= use;
    if (p.shieldTmp <= 0) {
      p.shieldTmpMax = 0;
      this.toast(p.x, p.y - 26, '屏障破碎', 'shieldB');
      this.fx.burst(p.x, p.y, 10, 'shieldB', 150, 2);
    }
  }
  if (p.shield > 0) {
    const use = Math.min(p.shield, d);
    p.shield -= use; d -= use;
  }
  p.hp -= d;
  p.hitFlash = 0.16;
  if (!silent) { p.inv = 0.55; this.shake(4.5); this.fx.burst(p.x, p.y, 8, 'dangerHi', 130, 1); }
  if (p.hp <= 0) { p.hp = 0; this.killPlayer(); }
};

/* ── 飘字 ─────────────────────────────────────────────────────────────────
   瞬时反馈（拾到什么 / 屏障破了）。banner 是全宽横幅，太重；这里只是
   在世界坐标上浮一行小字，1 秒就没。 */
Combat.prototype.toast = function (x, y, text, col) {
  if (this.toasts.length > 12) this.toasts.shift();   // 别让一波拾取顶出一屏
  this.toasts.push({ x: x, y: y, text: text, col: col, t: 0, max: 1.0 });
};

/* 屏幕脉冲：拾取那一瞬间的一次性反馈。
   持续型 buff（加速/攻速/护盾/无敌）除了常驻光带，也会来一发短的 ——
   "我拿到了"和"我还挂着"是两件事，前者必须有个明确的起点。 */
Combat.prototype.pulse = function (type, x, y) {
  this.pulses.push({ type: type, x: x, y: y, t: 0, max: T.PULSE[type] || T.PULSE._def });
  if (this.pulses.length > 6) this.pulses.shift();
};

Combat.prototype.killPlayer = function () {
  const p = this.p;
  if (!p.alive) return;
  p.alive = false;
  this.state = 'dead';
  this.deadT = 0;
  this.shake(11);
  this.fx.burst(p.x, p.y, 26, 'dangerHi', 210, 1);
  this.fx.burst(p.x, p.y, 14, 'cyanHi', 130, 1);
  /* 回响：把这一局的航迹与死亡点存下来 */
  this.pendingEchoSave = { x: p.x, y: p.y };
};

/* ── 敌机 ─────────────────────────────────────────────────────────────── */
Combat.prototype.updateEnemies = function (dt) {
  const p = this.p;
  for (let i = 0; i < this.en.n; i++) {
    const e = this.en.a[i];
    if (!e.alive) continue;
    const f = this.sing.fieldAt(e.x, e.y);
    const ldt = dt * f.dilate;
    e.t += ldt;
    if (e.flash > 0) e.flash -= dt;

    const d = E.ENEMY_DEFS[e.kind] || E.ENEMY_DEFS.drift;
    if (d.ai === 'down') {
      e.vx = f.ax * 0.35; e.vy = e.spd;
    } else if (d.ai === 'dive') {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      e.vx = U.damp(e.vx, Math.cos(a) * e.spd, 1.6, ldt);
      e.vy = U.damp(e.vy, Math.sin(a) * e.spd, 1.6, ldt);
    } else if (d.ai === 'hover') {
      /* 停在某个高度带，然后横向巡弋 */
      const band = AH * 0.24;
      e.vy = U.damp(e.vy, e.y < band ? e.spd * 0.9 : -e.spd * 0.25, 2.2, ldt);
      e.vx = U.damp(e.vx, Math.sin(e.t * 0.9 + e.seed) * e.spd * 1.4, 1.6, ldt);
    } else { // sine
      e.vy = e.spd;
      e.vx = Math.sin(e.t * 4.2 + e.seed) * 78;
    }

    e.x += (e.vx + f.ax * 0.55) * ldt;
    e.y += (e.vy + f.ay * 0.55) * ldt;

    /* 开火 */
    if (d.fire > 0) {
      e.cd -= ldt;
      if (e.cd <= 0) {
        e.cd += 1 / d.fire;
        if (e.cd < 0) e.cd = 0;
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        const sp = 150;
        this.eb.spawn(e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp, 8, true, 3.4, false);
      }
    }

    /* 出界回收（下边界给足余量，别刚出屏幕就算漏怪） */
    if (e.y > AH + 60 || e.x < -90 || e.x > AW + 90) { e.alive = false; continue; }

    /* 撞玩家 */
    if (p.alive) {
      const rr = e.r + p.r;
      if (U.dist2(e.x, e.y, p.x, p.y) < rr * rr) {
        this.hurtPlayer(12);
        e.hp -= 6;
        if (e.hp <= 0) this.killEnemy(e, true);
      }
    }

    /* 被奇点吞掉：进入事件视界即湮灭 —— 这是奇点存在的另一种证明 */
    const dm = U.dist(e.x, e.y, this.sing.x, this.sing.y);
    const met = this.sing.metrics();
    if (dm < met.R * 0.72) {
      this.sing.eaten++;
      this.fx.burst(e.x, e.y, 10, 'singCore', 90, 1);
      e.alive = false;
      this.score += 5;
    }
  }
};

Combat.prototype.killEnemy = function (e, byContact) {
  e.alive = false;
  const d = E.ENEMY_DEFS[e.kind] || E.ENEMY_DEFS.drift;
  this.kills++;
  this.score += d.score;
  this.fx.burst(e.x, e.y, 7, d.col, 120, 1);
  if (!byContact) this.fx.burst(e.x, e.y, 3, 'inkHi', 70, 1);
  /* 区域收尾巨像倒下 → 原地坍缩成「亚稳态」门。
     ⚠️ 巨像不掉任何东西 —— 奖励全在通道里，这是刻意的设计。 */
  if (this.isBossKind(e.kind) && RG.isRegionFinal(this.wave) && this.sing.gate === 0) {
    this.onGateKeeperDown(e.x, e.y);
  }
};

Combat.prototype.isBossKind = function (k) { return k === 'warden'; };

Combat.prototype.onGateKeeperDown = function (x, y) {
  /* 奇点滑到巨像的死亡点并停在那儿 —— 「它把尸体吞了，然后张开了嘴」 */
  this.sing.setGate(1, clamp(x, 64, AW - 64), clamp(y, 130, AH - 150));
  this.shake(10);
  this.fx.burst(x, y, 30, 'steel', 210, 1);
  this.fx.burst(x, y, 16, 'singCore', 130, 1);
  this.say('亚稳态 · 肃清残敌以开启', 'METASTABLE · CLEAR TO OPEN', 2.6);
};

/* ── 碰撞 ─────────────────────────────────────────────────────────────── */
Combat.prototype.collide = function (dt) {
  const p = this.p;
  /* 我方弹 → 敌机 */
  for (let i = 0; i < this.pb.n; i++) {
    const b = this.pb.a[i];
    if (!b.alive) continue;
    for (let j = 0; j < this.en.n; j++) {
      const e = this.en.a[j];
      if (!e.alive) continue;
      const rr = e.r + b.r;
      if (U.dist2(b.x, b.y, e.x, e.y) < rr * rr) {
        b.alive = false;
        e.hp -= b.dmg;
        e.flash = 0.12;
        this.fx.burst(b.x, b.y, 2, b.crit ? 'amberHi' : 'cyanHi', 80, 1);
        if (e.hp <= 0) this.killEnemy(e, false);
        break;
      }
    }
  }
  /* 敌弹 → 玩家 */
  if (p.alive) {
    for (let i = 0; i < this.eb.n; i++) {
      const b = this.eb.a[i];
      if (!b.alive) continue;
      const rr = p.r + b.r;
      if (U.dist2(b.x, b.y, p.x, p.y) < rr * rr) {
        b.alive = false;
        this.hurtPlayer(b.dmg);
      }
    }
  }
  /* 敌弹被奇点吞掉（视界也挡弹 —— 这是可以利用的战术掩体） */
  const met = this.sing.metrics();
  for (let i = 0; i < this.eb.n; i++) {
    const b = this.eb.a[i];
    if (!b.alive) continue;
    if (U.dist2(b.x, b.y, this.sing.x, this.sing.y) < (met.R * 0.85) * (met.R * 0.85)) {
      b.alive = false;
      this.fx.burst(b.x, b.y, 3, 'singCore', 60, 1);
    }
  }
};

/* ── 主推进 ───────────────────────────────────────────────────────────── */
Combat.prototype.update = function (dt, input) {
  this.time += dt;
  this.sing.update(dt);

  if (this.state === 'dead') {
    this.deadT += dt;
    this.pb.update(dt); this.eb.update(dt);
    this.fx.update(dt);
    if (this.shakeT > 0) { this.shakeT -= dt; this.shakeA *= 0.9; }
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    return;
  }

  this.updatePlayer(dt, input);
  this.updateEnemies(dt);
  this.pb.update(dt);
  this.eb.update(dt);
  this.collide(dt);
  this.fx.update(dt);

  /* 拾取物：刷新 / 磁吸 / 吃到（死了就吃不到了） */
  if (this.p.alive) {
    this.pk.update(dt, this.p, this.sing, this.rng, this.fx, this._onPick);
  }
  /* 飘字：向上飘并淡出 */
  for (let i = this.toasts.length - 1; i >= 0; i--) {
    const t = this.toasts[i];
    t.t += dt; t.y -= 26 * dt;
    if (t.t >= t.max) this.toasts.splice(i, 1);
  }
  /* 脉冲：归一化进度 0→1，具体时长与画法由 Aura 决定（这里只管推进） */
  for (let i = this.pulses.length - 1; i >= 0; i--) {
    const q = this.pulses[i];
    q.t += dt;
    if (q.t >= q.max) this.pulses.splice(i, 1);
  }

  /* 出怪 */
  if (this.spawnLeft > 0) {
    this.spawnCd -= dt;
    if (this.spawnCd <= 0) {
      this.spawnCd = Math.max(0.18, 0.62 - this.wave * 0.012);
      this.spawnOne();
      this.spawnLeft--;
    }
  } else if (this.en.count() === 0 && this.state === 'run') {
    this.state = 'clear';
    this.gapT = 1.1;
    this.say('第 ' + this.wave + ' 波肃清', 'WAVE ' + this.wave + ' CLEAR', 1.5);
  }

  if (this.state === 'clear') {
    this.gapT -= dt;
    if (this.gapT <= 0) {
      /* 区域收尾且巨像已倒 → 开门（奖励走通道，本波不发牌） */
      if (this.sing.gate === 1) {
        this.sing.setGate(2);
        this.shake(8);
        this.fx.burst(this.sing.x, this.sing.y, 26, 'singCore', 230, 1);
        this.say('奇点已开启 · 进入', 'SINGULARITY OPEN · ENTER', 2.4);
        this.state = 'gate';
      } else {
        /* 每 2 波给一次选卡 —— 协同卡会直接压缩奇点 */
        this.pendingCard = true;
        this.state = 'wait';
      }
    }
  }

  /* 门已开启：飞进去即穿越（引力会帮你一把，metrics 里 gate=2 是强吸引） */
  if (this.state === 'gate' && this.p.alive) {
    const r = this.sing.enterR();
    if (U.dist2(this.p.x, this.p.y, this.sing.x, this.sing.y) < r * r) {
      this.pendingWarp = true;
      this.state = 'warp';
      this.fx.burst(this.p.x, this.p.y, 24, 'singCore', 240, 1);
    }
  }

  if (this.shakeT > 0) { this.shakeT -= dt; this.shakeA *= 0.88; }
  if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }

  /* 回响采样 */
  if (this.p.alive) this.echo.sample(dt, this.p.x, this.p.y);
};

/* 波间选卡：应用一张 */
Combat.prototype.applyCard = function (card) {
  const p = this.p;
  if (card.id === 'atk') p.dmg *= 1.18;
  else if (card.id === 'rate') p.fireRate *= 1.14;
  else if (card.id === 'spd') { p.maxSpeed *= 1.08; p.accel *= 1.06; }
  else if (card.id === 'armor') { p.maxHp = Math.round(p.maxHp * 1.16); p.hp += Math.round(p.maxHp * 0.16); }
  else if (card.id === 'magnet') p.magnet *= 1.35;
  else if (card.id === 'synergy') {
    this.synergy++;
    /* ★ 构筑隐喻的核心：协同 = 压缩奇点 */
    this.sing.setSynergy(this.synergy);
    this.shake(6);
    this.fx.burst(this.sing.x, this.sing.y, 20, 'singCore', 190, 1);
  }
  if (p.hp > p.maxHp) p.hp = p.maxHp;
  this.pendingCard = false;
  /* ⚠️ 不在这里进下一波 —— 由 app 决定：普通波直接 +1，通道折算的卡发完才 afterWarp */
};

/* ── 拾取生效 ─────────────────────────────────────────────────────────────
   数值与网页版一致；唯一改写的是 level，见下面分支里的说明。 */
Combat.prototype.applyPickup = function (type, x, y) {
  const p = this.p;
  const def = PK.PU[type] || PK.PU.heal;
  let label = def.zh;

  if (type === 'boost') {
    p.boostT = def.dur; label = def.zh + ' ' + def.dur + 's';
  } else if (type === 'rate') {
    p.rateT = def.dur; label = def.zh + ' ' + def.dur + 's';
  } else if (type === 'invuln') {
    p.invuln = def.dur; label = def.zh + ' ' + def.dur + 's';
  } else if (type === 'shield') {
    p.shieldTmpMax = Math.max(p.shieldTmpMax, BUFF.SHIELD_AMT);
    p.shieldTmp = p.shieldTmpMax;
    label = def.zh + ' +' + BUFF.SHIELD_AMT;
  } else if (type === 'heal') {
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * BUFF.HEAL_PCT);
    label = def.zh + ' +' + Math.round(p.hp - before);
  } else if (type === 'level') {
    /* 网页版这里是 +1 LV，但本作**没有 XP/等级系统**，所以改成立刻白给一张
       永久强化。「协同」排除在外 —— 它是直接压缩奇点的核心资源，只能玩家
       自己在选卡时取舍，白送会破坏「构筑 = 压缩」这条隐喻的重量。 */
    const pool = CD.CARDS.filter(function (cd) { return cd.id !== 'synergy'; });
    const cd = pool[Math.floor(this.rng.next() * pool.length) % pool.length];
    this.applyCard(cd);
    label = def.zh + ' · ' + cd.zh;
  }

  this.toast(x, y - 24, label, def.col);
  this.pulse(type, x, y);        // 屏幕边缘的一次性反馈（触发式 / buff 入场）
  this.shake(3);
  this.fx.burst(x, y, 8, def.col, 150, 2);
};

/* 通道结束，从另一端被吐出来：奇点关上门、回到战场中心、压缩 +1 档，进入下一区域。
   ⚠️ 全程是**同一个**奇点 —— 只是它又被压致密了一层。 */
Combat.prototype.afterWarp = function () {
  this.warps++;
  this.sing.gate = 0; this.sing.gateT = 0;
  this.sing.x = AW / 2; this.sing.y = AH * 0.40;
  this.sing._gx = this.sing.x; this.sing._gy = this.sing.y;
  this.sing._moveT = 1;
  this.sing.setWarp(this.warps);
  this.sing.setSynergy(this.synergy);
  this.pendingWarp = false;
  this.p.inv = 1.2;                       // 吐出来给点无敌帧，别一出来就被撞
  this.startWave(this.wave + 1);
};

module.exports = {
  Combat: Combat, FXPool: FXPool,
  waveQuota: waveQuota, waveKinds: waveKinds, BOSS_EVERY: BOSS_EVERY,
};
})();
