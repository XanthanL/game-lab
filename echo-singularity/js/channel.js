;(function () {
'use strict';
/* ============================================================================
   channel.js —— 通道（巨像奖励关）
   ----------------------------------------------------------------------------
   定位：**打掉区域巨像的奖励**，不是普通战斗关。
     · 纵版向上卷轴（雷霆战机 bonus 关那个味道）
     · 只做两件事：吃星尘、躲静态障碍
     · 巨像本身不掉任何东西 —— 所有回报都在这一段里

   收集数在结束时折算成额外选卡次数（1～3 张，收集越多给越多）。

   为什么不在这里放敌人：放了就变成普通战斗关，跟「奖励」的定位冲突。
   障碍是静态的，赌的是走位与速度感，不是火力。
   ========================================================================== */

const U = require('./util.js');
const T = require('./tokens.js');
const ARENA = require('./arena.js');
const E = require('./entities.js');
const Combat = require('./combat.js');
const Input = require('./input.js');
const clamp = U.clamp, TAU = U.TAU;
const AW = ARENA.ARENA_W, AH = ARENA.ARENA_H;

const DUR = 22;            // 通道时长（秒）
const SPEED = 250;         // 向上卷轴速度（px/s）
const WALL = 34;           // 两侧管壁留白（可飞行区是 AW-2*WALL）
const MOTE_EVERY = 130;    // 星尘簇的纵向间距
const ROCK_EVERY = 190;    // 障碍的纵向间距
const HIT_SLOW = 0.55;     // 撞击后的减速倍率
const HIT_SLOW_T = 0.9;    // 减速持续

/* 收集数 → 额外选卡次数 */
const TIERS = [
  { at: 0,  cards: 1 },
  { at: 15, cards: 2 },
  { at: 34, cards: 3 },
];
function cardsFor(got) {
  let c = 1;
  for (const t of TIERS) if (got >= t.at) c = t.cards;
  return c;
}

function Channel(seed, hullId) {
  this.rng = U.RNG(seed || 'channel');
  this.fx = new Combat.FXPool(180);
  this.hullId = hullId || 'peregrine';
  this.p = { x: AW / 2, y: AH * 0.74, vx: 0, vy: 0, ang: -Math.PI / 2, r: 9, inv: 0, hitFlash: 0 };
  this.t = 0;
  this.camY = 0;            // 已飞过的距离（越大 = 越往上）
  this.motes = [];
  this.rocks = [];
  this.got = 0;
  this.hits = 0;
  this.combo = 0;
  this.slowT = 0;
  this.shakeT = 0; this.shakeA = 0;
  this.done = false;
  this.bornT = 0;           // 入场（从奇点被吐出来）
  this._nextMote = -60;
  this._nextRock = -260;
  this._trail = [];
}

Channel.prototype.progress = function () { return clamp(this.t / DUR, 0, 1); };
Channel.prototype.cards = function () { return cardsFor(this.got); };

/* 屏幕 y = 物体 y + camY */
function sy(ch, y) { return y + ch.camY; }

Channel.prototype.spawnAhead = function () {
  /* 星尘：一簇 3～6 个，横排或斜排 */
  while (this._nextMote > -this.camY - AH - 200) {
    const y = this._nextMote;
    const n = 3 + Math.floor(this.rng.next() * 4);
    const cx = WALL + 22 + this.rng.next() * (AW - 2 * WALL - 44);
    const slant = this.rng.range(-0.35, 0.35);
    const gapX = this.rng.range(15, 26);
    for (let i = 0; i < n; i++) {
      this.motes.push({
        alive: true,
        x: clamp(cx + (i - (n - 1) / 2) * gapX, WALL + 10, AW - WALL - 10),
        y: y + (i - (n - 1) / 2) * gapX * slant,
        v: this.rng.range(0, TAU),
      });
    }
    this._nextMote -= MOTE_EVERY * this.rng.range(0.8, 1.25);
  }
  /* 障碍：1～2 块，留出可通过的缝 */
  while (this._nextRock > -this.camY - AH - 200) {
    const y = this._nextRock;
    const k = 1 + (this.rng.chance(0.45) ? 1 : 0);
    const slots = [0, 1, 2, 3];
    this.rng.shuffle(slots);
    for (let i = 0; i < k; i++) {
      const s = slots[i];
      const w = (AW - 2 * WALL) / 4;
      this.rocks.push({
        alive: true,
        x: WALL + w * s + w / 2 + this.rng.range(-14, 14),
        y: y + this.rng.range(-24, 24),
        r: this.rng.range(15, 23),
        rot: this.rng.range(0, TAU),
        spin: this.rng.range(-1.6, 1.6),
        shape: 5 + Math.floor(this.rng.next() * 3),
      });
    }
    this._nextRock -= ROCK_EVERY * this.rng.range(0.75, 1.3);
  }
};

Channel.prototype.shake = function (a) {
  this.shakeA = Math.max(this.shakeA, a);
  this.shakeT = Math.max(this.shakeT, 0.22);
};

Channel.prototype.update = function (dt, input) {
  const p = this.p;
  this.t += dt;
  this.bornT += dt;
  if (this.shakeT > 0) { this.shakeT -= dt; this.shakeA *= 0.88; }
  if (p.inv > 0) p.inv -= dt;
  if (p.hitFlash > 0) p.hitFlash -= dt;
  if (this.slowT > 0) this.slowT -= dt;

  /* 卷轴：撞后短暂减速，撞了也要付时间代价 —— 时长固定，慢了就少吃 */
  const sp = SPEED * (this.slowT > 0 ? HIT_SLOW : 1);
  this.camY += sp * dt;
  this.spawnAhead();

  /* 操纵：复用同一个左下角摇杆 */
  const s = input && input.stick ? input.stick : null;
  let ax = 0, ay = 0;
  if (s && s.active) { ax = s.dx * 1400; ay = s.dy * 1400; }
  p.vx += ax * dt; p.vy += ay * dt;
  const k = Math.exp(-6.5 * dt);
  p.vx *= k; p.vy *= k;
  const v = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  if (v > 210) { p.vx = p.vx / v * 210; p.vy = p.vy / v * 210; }
  p.x += p.vx * dt; p.y += p.vy * dt;

  /* 撞管壁：软墙，把速度吃掉（不是死亡，奖励关不该有死亡） */
  const minX = WALL + p.r, maxX = AW - WALL - p.r;
  if (p.x < minX) { p.x = minX; if (p.vx < 0) p.vx *= -0.25; }
  if (p.x > maxX) { p.x = maxX; if (p.vx > 0) p.vx *= -0.25; }
  const minY = 90, maxY = AH - 40;
  if (p.y < minY) { p.y = minY; if (p.vy < 0) p.vy *= -0.25; }
  if (p.y > maxY) { p.y = maxY; if (p.vy > 0) p.vy *= -0.25; }
  if (v > 8) p.ang = Math.atan2(p.vy, p.vx) + Math.PI / 2 - Math.PI / 2;
  p.ang = U.angleLerp(p.ang, -Math.PI / 2, 1 - Math.exp(-7 * dt));

  /* 星尘 */
  for (let i = 0; i < this.motes.length; i++) {
    const m = this.motes[i];
    if (!m.alive) continue;
    const yy = sy(this, m.y);
    if (yy > AH + 40) { m.alive = false; continue; }
    const dx = m.x - p.x, dy = yy - p.y;
    /* 磁吸：靠近就吸过来，手感好很多 */
    const d2 = dx * dx + dy * dy;
    if (d2 < 52 * 52) {
      m.x -= dx * 5.5 * dt; m.y -= dy * 5.5 * dt / Math.max(0.2, 1);
    }
    if (d2 < 16 * 16) {
      m.alive = false;
      this.got++;
      this.combo++;
      this.fx.burst(m.x, yy, 3, 'amberHi', 70, 1);
    }
  }

  /* 障碍 */
  for (let i = 0; i < this.rocks.length; i++) {
    const r = this.rocks[i];
    if (!r.alive) continue;
    r.rot += r.spin * dt;
    const yy = sy(this, r.y);
    if (yy > AH + 60) { r.alive = false; continue; }
    const dx = r.x - p.x, dy = yy - p.y;
    const rr = r.r * 0.78 + p.r;
    if (dx * dx + dy * dy < rr * rr && p.inv <= 0) {
      p.inv = 1.0;
      p.hitFlash = 0.2;
      this.hits++;
      this.combo = 0;
      this.slowT = HIT_SLOW_T;
      this.shake(7);
      /* 弹开而不是死 */
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      p.vx += dx / d * 190; p.vy += dy / d * 190;
      this.fx.burst(p.x, p.y, 12, 'dangerHi', 150, 1);
    }
  }

  /* 回收 */
  if (this.motes.length > 260) this.motes = this.motes.filter(function (m) { return m.alive; });
  if (this.rocks.length > 90) this.rocks = this.rocks.filter(function (r) { return r.alive; });

  this._trail.push(p.x, p.y);
  if (this._trail.length > 24 * 2) this._trail.splice(0, 2);
  this.fx.update(dt);

  if (this.t >= DUR) this.done = true;
  return this.done;
};

/* ══════════════════════════════════════════════════════════════════════
   绘制
   ════════════════════════════════════════════════════════════════════ */
Channel.prototype.draw = function (c) {
  const p = this.p;

  /* 底：通道内是冷蓝的，跟战场区分开 */
  c.save();
  c.fillStyle = T.hex('voidDeep');
  c.fillRect(0, 0, AW, AH);
  const g = c.createLinearGradient(0, 0, 0, AH);
  g.addColorStop(0, T.rgba('cyan', 0.09));
  g.addColorStop(0.5, T.rgba('void', 0));
  g.addColorStop(1, T.rgba('cyan', 0.05));
  c.fillStyle = g;
  c.fillRect(0, 0, AW, AH);
  c.restore();

  /* 速度线：向下流动，制造「在往上飞」 */
  c.save();
  c.strokeStyle = T.rgba('cyan', 0.16);
  c.lineWidth = 1;
  const lane = 40;
  for (let i = 0; i < AW / lane; i++) {
    const x = i * lane + 20;
    const off = ((this.camY * 1.9 + i * 97) % 160);
    c.beginPath();
    c.moveTo(x, off - 30); c.lineTo(x, off + 22);
    c.stroke();
  }
  c.restore();

  /* 两侧管壁 —— 带滚动刻度的测绘感 */
  c.save();
  c.strokeStyle = T.rgba('syn', 0.4);
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(WALL, 0); c.lineTo(WALL, AH);
  c.moveTo(AW - WALL, 0); c.lineTo(AW - WALL, AH);
  c.stroke();
  c.strokeStyle = T.rgba('line', 0.55);
  c.lineWidth = 1;
  c.beginPath();
  const tick = 46;
  const off2 = this.camY % tick;
  for (let y = -tick + off2; y < AH + tick; y += tick) {
    c.moveTo(WALL - 7, y); c.lineTo(WALL, y);
    c.moveTo(AW - WALL, y); c.lineTo(AW - WALL + 7, y);
  }
  c.stroke();
  c.restore();

  /* 星尘 */
  c.save();
  for (let i = 0; i < this.motes.length; i++) {
    const m = this.motes[i];
    if (!m.alive) continue;
    const yy = sy(this, m.y);
    if (yy < -20 || yy > AH + 20) continue;
    const tw = 0.75 + 0.25 * Math.sin(this.t * 6 + m.v);
    c.fillStyle = T.rgba('amberHi', 0.30 * tw);
    c.beginPath(); c.arc(m.x, yy, 6.5, 0, TAU); c.fill();
    c.fillStyle = T.rgba('amberHi', 0.95 * tw);
    c.beginPath(); c.arc(m.x, yy, 2.6, 0, TAU); c.fill();
  }
  c.restore();

  /* 障碍 */
  c.save();
  for (let i = 0; i < this.rocks.length; i++) {
    const r = this.rocks[i];
    if (!r.alive) continue;
    const yy = sy(this, r.y);
    if (yy < -60 || yy > AH + 60) continue;
    c.save();
    c.translate(r.x, yy);
    c.rotate(r.rot);
    c.beginPath();
    for (let k = 0; k < r.shape; k++) {
      const a = k * TAU / r.shape;
      const rr = r.r * (0.72 + 0.36 * ((k * 37) % 7) / 7);
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fillStyle = T.rgba('void2', 0.95);
    c.fill();
    c.strokeStyle = T.rgba('steel', 0.7);
    c.lineWidth = 1.4;
    c.stroke();
    c.restore();
  }
  c.restore();

  /* 尾流 + 船 */
  const tint = T.HULL_TINT[this.hullId] || T.HULL_TINT.peregrine;
  c.save();
  c.lineCap = 'round';
  const n = this._trail.length / 2;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    c.strokeStyle = 'rgba(' + tint.glow[0] + ',' + tint.glow[1] + ',' + tint.glow[2] + ',' + (0.06 + 0.34 * t * t) + ')';
    c.lineWidth = 1 + 5.5 * t * t;
    c.beginPath();
    c.moveTo(this._trail[(i - 1) * 2], this._trail[(i - 1) * 2 + 1]);
    c.lineTo(this._trail[i * 2], this._trail[i * 2 + 1]);
    c.stroke();
  }
  c.restore();

  c.save();
  c.translate(p.x, p.y);
  c.rotate(p.ang);
  const fl = 12 + Math.sin(this.t * 22) * 2;
  const fg = c.createLinearGradient(-8, 0, -8 - fl, 0);
  fg.addColorStop(0, 'rgba(' + tint.glow[0] + ',' + tint.glow[1] + ',' + tint.glow[2] + ',0.6)');
  fg.addColorStop(1, 'rgba(' + tint.glow[0] + ',' + tint.glow[1] + ',' + tint.glow[2] + ',0)');
  c.fillStyle = fg;
  c.beginPath();
  c.moveTo(-8, -3.2); c.lineTo(-8 - fl, 0); c.lineTo(-8, 3.2);
  c.closePath(); c.fill();
  E.hullPath(c, this.hullId);
  c.fillStyle = tint.fill; c.fill();
  c.strokeStyle = tint.line; c.lineWidth = 1.5; c.stroke();
  if (p.inv > 0 && Math.floor(p.inv * 16) % 2 === 0) c.globalAlpha = 0.35;
  c.fillStyle = T.rgba('cyanHi', 0.6);
  c.beginPath(); c.arc(2.5, 0, 1.9, 0, TAU); c.fill();
  c.globalAlpha = 1;
  if (p.hitFlash > 0) {
    E.hullPath(c, this.hullId);
    c.fillStyle = T.rgba('inkHi', clamp(p.hitFlash / 0.2, 0, 1) * 0.7);
    c.fill();
  }
  c.restore();

  /* 粒子 */
  const fx = this.fx;
  for (let i = 0; i < fx.n; i++) {
    const q = fx.a[i];
    if (!q.alive) continue;
    const tt = q.life / q.max;
    c.fillStyle = T.rgba(q.col, clamp(tt, 0, 1) * 0.9);
    c.beginPath(); c.arc(q.x, q.y, q.r * (0.4 + 0.6 * tt), 0, TAU); c.fill();
  }

  Input.drawStick(c);
};

/* HUD：进度 + 收集 + 折算的卡数 */
Channel.prototype.drawHUD = function (c) {
  c.save();
  c.textBaseline = 'middle';

  const g = c.createLinearGradient(0, 0, 0, 56);
  g.addColorStop(0, T.rgba('voidDeep', 0.8));
  g.addColorStop(1, T.rgba('voidDeep', 0));
  c.fillStyle = g;
  c.fillRect(0, 0, AW, 56);

  c.textAlign = 'left';
  c.fillStyle = T.rgba('secInk', 0.9);
  c.font = T.font('tiny', 'medium');
  c.fillText('通道 · THE CHANNEL', 12, 16);

  c.textAlign = 'center';
  c.fillStyle = T.rgba('amberHi', 1);
  c.font = T.font('lead', 'bold');
  c.fillText(String(this.got), AW / 2, 20);
  c.fillStyle = T.rgba('secInk', 0.9);
  c.font = T.font('micro', 'regular');
  c.fillText('星尘 · ' + this.cards() + ' 张强化', AW / 2, 38);

  c.textAlign = 'right';
  c.fillStyle = T.rgba('cyanHi', 0.95);
  c.font = T.font('small', 'medium');
  c.fillText(Math.ceil(Math.max(0, DUR - this.t)) + 's', AW - 12, 16);
  c.restore();

  /* 进度条（贴底，表示飞了多远） */
  const bw = AW - 24;
  c.save();
  c.fillStyle = T.rgba('voidDeep', 0.7);
  c.fillRect(12, AH - 14, bw, 5);
  const gg = c.createLinearGradient(12, 0, 12 + bw, 0);
  gg.addColorStop(0, T.hex('cyan')); gg.addColorStop(1, T.hex('amberHi'));
  c.fillStyle = gg;
  c.fillRect(12, AH - 14, bw * this.progress(), 5);
  c.strokeStyle = T.rgba('line', 0.5);
  c.lineWidth = 1;
  c.strokeRect(12, AH - 14, bw, 5);
  c.restore();
};

module.exports = {
  Channel: Channel, cardsFor: cardsFor,
  DUR: DUR, TIERS: TIERS,
};
})();
