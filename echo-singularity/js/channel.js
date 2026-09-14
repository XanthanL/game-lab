;(function () {
'use strict';
/* ============================================================================
   channel.js —— 通道（巨像奖励关）
   ----------------------------------------------------------------------------
   定位：**打掉区域巨像的奖励**，不是普通战斗关。
     · 纵版向上卷轴（雷霆战机 bonus 关那个味道）
     · 三样东西：吃星尘、躲静态障碍、抢升级舱
     · 巨像本身不掉任何东西 —— 所有回报都在这一段里

   ★ 通道里飞的就是**玩家自己那架船**：同一型号、进场时的属性原样带进来
     （堆过「推进喷口」的玩家在这里真的更快，磁吸更宽）。
     做法是从 cb.p **快照**一份，不是直接持有 —— 通道里撞障碍、吃升级
     都不该反向污染战斗状态。

   ★ 升级舱是击杀巨像的**奖励本体**：一个 = 一张永久强化（非协同）。
     星尘仍然是「分」，结束时折算成额外选卡次数（1～3 张）。

   为什么不在这里放敌人：放了就变成普通战斗关，跟「奖励」的定位冲突。
   障碍是静态的，赌的是走位与速度感，不是火力。
   ========================================================================== */

const U = require('./util.js');
const T = require('./tokens.js');
const ARENA = require('./arena.js');
const E = require('./entities.js');
const Combat = require('./combat.js');
const Input = require('./input.js');
const PK = require('./pickups.js');
const CD = require('./cards.js');
const PAL = require('./pal.js');
const clamp = U.clamp, TAU = U.TAU;
const AW = ARENA.ARENA_W, AH = ARENA.ARENA_H;

const DUR = 22;            // 通道时长（秒）
const SPEED = 250;         // 向上卷轴速度（px/s）
const WALL = 34;           // 两侧管壁留白（可飞行区是 AW-2*WALL）
const MOTE_EVERY = 130;    // 星尘簇的纵向间距
const ROCK_EVERY = 190;    // 障碍的纵向间距
const POD_EVERY = 1150;    // 升级舱的纵向间距（22s × 250px/s ≈ 5500px → 约 4~5 个）
const HIT_SLOW = 0.55;     // 撞击后的减速倍率
const HIT_SLOW_T = 0.9;    // 减速持续

/* 手感放大系数 —— 基准机体（maxSpeed 168 / accel 1150 / damp 5.2）算出来
   正好等于改前的 210 / 1437 / 6.5，所以默认手感一帧都不变；
   而堆过「推进喷口」的玩家会真的更快 —— 这就是「进场属性带进来」的意义。 */
const ACC_MUL = 1.25;
const SPD_MUL = 1.25;
const DAMP_MUL = 1.25;
/* 磁吸半径 = 机体 magnet + 6（基准 46+6 = 52，等于改前值；nemesis / 牵引场更宽） */
const MAGNET_ADD = 6;

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

/* 从玩家本体快照的机体属性。缺哪个都不会崩 —— 走 mkPlayer 的默认值。 */
const STAT_KEYS = [
  'maxSpeed', 'accel', 'damp',
  'fireRate', 'dmg', 'bspd', 'crit', 'critMul',
  'magnet', 'maxHp', 'shieldMax', 'r',
];

function Channel(seed, src, opts) {
  opts = opts || {};
  this.rng = U.RNG(seed || 'channel');
  this.fx = new Combat.FXPool(180);
  this.onUpgrade = opts.onUpgrade || null;   // 拿到升级舱时回写给战斗层

  /* ── 机体：从玩家本体快照，一模一样 ──────────────────────────────────
     先 mkPlayer 出一台干净的同型机（保证基础字段齐全），
     再用玩家当前的实际属性覆盖 —— 这就是「进场时的属性」。 */
  /* 兼容两种调用：新的是传玩家本体（对象），老的 / 探针可能只传 hullId 字符串。
     ⚠️ 不兼容会**静默退化成 peregrine**（字符串没有 .hullId），宁可多几行也别让
        调用方写出"以为换了机体其实没换"的 bug。 */
  let srcObj = null;
  if (src && typeof src === 'object') { srcObj = src; this.hullId = src.hullId || 'peregrine'; }
  else if (typeof src === 'string' && src) { this.hullId = src; }
  else this.hullId = 'peregrine';

  const p = E.mkPlayer(this.hullId);
  if (srcObj) {
    for (let i = 0; i < STAT_KEYS.length; i++) {
      const k = STAT_KEYS[i];
      if (typeof srcObj[k] === 'number' && isFinite(srcObj[k])) p[k] = srcObj[k];
    }
    /* 血量 / 护盾也一起带进来 —— 这是"你的船"最直观的证据 */
    if (typeof srcObj.hp === 'number') p.hp = srcObj.hp;
    if (typeof srcObj.shield === 'number') p.shield = srcObj.shield;
  }
  p.x = AW / 2; p.y = AH * 0.74;
  p.vx = 0; p.vy = 0; p.ang = -Math.PI / 2;
  p.inv = 0; p.hitFlash = 0; p.cd = 0; p.alive = true;
  /* 通道是奖励关，不该带着战斗里的**临时 buff 计时器**进来 —— 全部清零。
     否则会出现"进场瞬间边缘光带还挂着上一场的无敌"这种割裂。 */
  p.boostT = 0; p.rateT = 0; p.invuln = 0; p.shieldTmp = 0; p.shieldTmpMax = 0;
  if (p.hp > p.maxHp) p.hp = p.maxHp;
  if (p.shield > p.shieldMax) p.shield = p.shieldMax;
  this.p = p;

  this.t = 0;
  this.camY = 0;            // 已飞过的距离（越大 = 越往上）
  this.motes = [];
  this.rocks = [];
  this.pods = [];           // 升级舱
  this.upgrades = [];       // 已拿到的强化 id
  this.toasts = [];         // 飘字（拿到升级时）
  this.got = 0;
  this.hits = 0;
  this.combo = 0;
  this.slowT = 0;
  this.shakeT = 0; this.shakeA = 0;
  this.done = false;
  this.bornT = 0;           // 入场（从奇点被吐出来）
  this._nextMote = -60;
  this._nextRock = -260;
  this._nextPod = -520;
  this._trail = [];
}

Channel.prototype.progress = function () { return clamp(this.t / DUR, 0, 1); };
Channel.prototype.cards = function () { return cardsFor(this.got); };

Channel.prototype.toast = function (x, y, zh) {
  this.toasts.push({ x: x, y: y, zh: zh, t: 1.5, max: 1.5 });
  if (this.toasts.length > 6) this.toasts.shift();
};

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
  /* 升级舱：击杀巨像的奖励本体。比星尘稀有得多，位置也更靠中间好抢。 */
  while (this._nextPod > -this.camY - AH - 200) {
    this.pods.push({
      alive: true,
      x: WALL + 30 + this.rng.next() * (AW - 2 * WALL - 60),
      y: this._nextPod,
      v: this.rng.range(0, TAU),
    });
    this._nextPod -= POD_EVERY * this.rng.range(0.85, 1.2);
  }
};

Channel.prototype.shake = function (a) {
  this.shakeA = Math.max(this.shakeA, a);
  this.shakeT = Math.max(this.shakeT, 0.22);
};

/* 拿到一个升级舱 —— 立刻给一张**非协同**永久强化。
   协同不白送：它是直接压缩奇点的核心资源，只能玩家自己在选卡时取舍，
   白送会破坏「构筑 = 压缩」这条隐喻的重量。（与拾取物「数据注入」同一条规则） */
Channel.prototype.grantUpgrade = function (x, y) {
  const pool = CD.CARDS.filter(function (cd) { return cd.id !== 'synergy'; });
  const cd = pool[Math.floor(this.rng.next() * pool.length) % pool.length];
  this.upgrades.push(cd.id);
  if (this.onUpgrade) this.onUpgrade(cd);
  this.toast(x, y - 20, cd.zh);
  this.fx.burst(x, y, 14, 'violetHi', 170, 1);
  this.shake(4);
  return cd;
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

  /* ── 操纵 ────────────────────────────────────────────────────────────
     A/D（含 ←/→）是横向主控。触摸时仍是左下角摇杆 —— 手机没有物理键盘，
     键盘只能做**增益**，不能成为唯一入口。两者可以叠加（键盘 + 摇杆同时给）。
     加速度 / 极速 / 阻尼全部来自机体属性，所以堆过速度的玩家真的更灵活。 */
  const acc = p.accel * ACC_MUL;
  const vmax = p.maxSpeed * SPD_MUL;
  let ax = 0, ay = 0;
  const kx = PAL.Keys.axisX();
  if (kx !== 0) ax += kx * acc;
  const s = input && input.stick ? input.stick : null;
  if (s && s.active) { ax += s.dx * acc; ay += s.dy * acc; }
  p.vx += ax * dt; p.vy += ay * dt;
  const k = Math.exp(-p.damp * DAMP_MUL * dt);
  p.vx *= k; p.vy *= k;
  const v = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  if (v > vmax) { p.vx = p.vx / v * vmax; p.vy = p.vy / v * vmax; }
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

  const mg = p.magnet + MAGNET_ADD;

  /* 星尘 */
  for (let i = 0; i < this.motes.length; i++) {
    const m = this.motes[i];
    if (!m.alive) continue;
    const yy = sy(this, m.y);
    if (yy > AH + 40) { m.alive = false; continue; }
    const dx = m.x - p.x, dy = yy - p.y;
    /* 磁吸：靠近就吸过来，手感好很多 */
    const d2 = dx * dx + dy * dy;
    if (d2 < mg * mg) {
      m.x -= dx * 5.5 * dt; m.y -= dy * 5.5 * dt / Math.max(0.2, 1);
    }
    if (d2 < 16 * 16) {
      m.alive = false;
      this.got++;
      this.combo++;
      this.fx.burst(m.x, yy, 3, 'amberHi', 70, 1);
    }
  }

  /* 升级舱 */
  for (let i = 0; i < this.pods.length; i++) {
    const q = this.pods[i];
    if (!q.alive) continue;
    const yy = sy(this, q.y);
    if (yy > AH + 40) { q.alive = false; continue; }
    const dx = q.x - p.x, dy = yy - p.y;
    const d2 = dx * dx + dy * dy;
    /* 判定比星尘宽一点 —— 它是奖励本体，抢到手要干脆 */
    if (d2 < mg * mg * 1.35) { q.x -= dx * 4.2 * dt; q.y -= dy * 4.2 * dt; }
    const gr = 18 + p.r;
    if (d2 < gr * gr) {
      q.alive = false;
      this.grantUpgrade(q.x, yy);
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

  /* 飘字 */
  for (let i = this.toasts.length - 1; i >= 0; i--) {
    const q = this.toasts[i];
    q.t -= dt; q.y -= 26 * dt;
    if (q.t <= 0) this.toasts.splice(i, 1);
  }

  /* 回收 */
  if (this.motes.length > 260) this.motes = this.motes.filter(function (m) { return m.alive; });
  if (this.rocks.length > 90) this.rocks = this.rocks.filter(function (r) { return r.alive; });
  if (this.pods.length > 40) this.pods = this.pods.filter(function (q) { return q.alive; });

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

  /* 升级舱 —— 奖励本体，画在障碍之上，必须比星尘显眼。
     六边舱体 + 自转刻度环 + 升级箭头（几何路径，跟 pickups 的字形同一套语言） */
  c.save();
  for (let i = 0; i < this.pods.length; i++) {
    const q = this.pods[i];
    if (!q.alive) continue;
    const yy = sy(this, q.y);
    if (yy < -46 || yy > AH + 46) continue;
    const puls = 0.72 + 0.28 * Math.sin(this.t * 4 + q.v);
    c.save();
    c.translate(q.x, yy);

    /* 自转刻度环（手写刻度，不用 setLineDash —— 少一个平台差异面） */
    c.save();
    c.rotate(this.t * 0.9 + q.v);
    c.strokeStyle = T.rgba('violetHi', 0.55 * puls);
    c.lineWidth = 1.1;
    c.beginPath();
    for (let k = 0; k < 8; k++) {
      const a0 = k * TAU / 8, a1 = a0 + TAU / 8 * 0.5;
      c.moveTo(Math.cos(a0) * 18, Math.sin(a0) * 18);
      c.lineTo(Math.cos(a1) * 18, Math.sin(a1) * 18);
    }
    c.stroke();
    c.restore();

    /* 六边舱体 */
    c.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + k * TAU / 6;
      const px = Math.cos(a) * 11.5, py = Math.sin(a) * 11.5;
      if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fillStyle = T.rgba('violet', 0.20 + 0.16 * puls);
    c.fill();
    c.strokeStyle = T.rgba('violetHi', 0.92 * puls);
    c.lineWidth = 1.5;
    c.stroke();

    /* 升级箭头 */
    c.strokeStyle = T.rgba('violetHi', 0.95);
    PK.drawGlyph(c, 'level', 6.2, 1.5);
    c.restore();
  }
  c.restore();

  /* ── 尾流 + 船 ───────────────────────────────────────────────────────
     ★ 与 render.js 的 drawPlayer 用**同一套画法**：尾焰公式、机身、座舱、
       受击闪白全部对齐 —— 这就是你自己的那架船，不是"通道专用小飞机"。 */
  const tint = T.HULL_TINT[p.hullId] || T.HULL_TINT.peregrine;
  const glow = tint.glow;
  c.save();
  c.lineCap = 'round';
  const n = this._trail.length / 2;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    c.strokeStyle = 'rgba(' + glow[0] + ',' + glow[1] + ',' + glow[2] + ',' + (0.06 + 0.34 * t * t) + ')';
    c.lineWidth = 1 + 5.5 * t * t;
    c.beginPath();
    c.moveTo(this._trail[(i - 1) * 2], this._trail[(i - 1) * 2 + 1]);
    c.lineTo(this._trail[i * 2], this._trail[i * 2 + 1]);
    c.stroke();
  }
  c.restore();

  /* 无敌帧闪烁：8Hz 方波（跟战场一致，别用正弦 —— 太柔和看不出"打不到"） */
  const blink = (p.inv > 0 && Math.floor(p.inv * 16) % 2 === 0);

  c.save();
  c.translate(p.x, p.y);
  c.rotate(p.ang);
  if (blink) c.globalAlpha = 0.35;

  /* 尾焰：朝船尾(-x)喷，长度随速度 —— 与 drawPlayer 同公式 */
  const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  const fl = 8 + clamp(spd / 170, 0, 1) * 16;
  const fg = c.createLinearGradient(-8, 0, -8 - fl, 0);
  fg.addColorStop(0, 'rgba(' + glow[0] + ',' + glow[1] + ',' + glow[2] + ',0.55)');
  fg.addColorStop(1, 'rgba(' + glow[0] + ',' + glow[1] + ',' + glow[2] + ',0)');
  c.fillStyle = fg;
  c.beginPath();
  c.moveTo(-8, -3.2); c.lineTo(-8 - fl, 0); c.lineTo(-8, 3.2);
  c.closePath(); c.fill();

  /* 出厂护盾环（堡垒有 30 护盾）—— 它是"你的船"的一部分，不能丢 */
  if (p.shieldMax > 0 && p.shield > 0) {
    const sr = p.r + 7;
    c.strokeStyle = T.rgba('shieldB', 0.30 + 0.35 * clamp(p.shield / p.shieldMax, 0, 1));
    c.lineWidth = 1.4;
    c.beginPath(); c.arc(0, 0, sr, 0, TAU); c.stroke();
  }

  E.hullPath(c, p.hullId);
  c.fillStyle = tint.fill; c.fill();
  c.strokeStyle = tint.line; c.lineWidth = 1.5; c.stroke();

  /* 座舱 */
  c.fillStyle = T.rgba('cyanHi', 0.6);
  c.beginPath(); c.arc(2.5, 0, 1.9, 0, TAU); c.fill();

  /* 受击闪白 */
  if (p.hitFlash > 0) {
    E.hullPath(c, p.hullId);
    c.fillStyle = T.rgba('inkHi', clamp(p.hitFlash / 0.16, 0, 1) * 0.7);
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

  /* 飘字：拿到升级时冒出来 */
  if (this.toasts.length) {
    c.save();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i < this.toasts.length; i++) {
      const q = this.toasts[i];
      const a = clamp(q.t / q.max, 0, 1);
      c.fillStyle = T.rgba('violetHi', a);
      c.font = T.font('small', 'bold');
      c.fillText(q.zh, q.x, q.y);
    }
    c.restore();
  }

  Input.drawStick(c);
};

/* HUD：进度 + 收集 + 升级 + 折算的卡数 */
Channel.prototype.drawHUD = function (c) {
  c.save();
  c.textBaseline = 'middle';

  const g = c.createLinearGradient(0, 0, 0, 62);
  g.addColorStop(0, T.rgba('voidDeep', 0.8));
  g.addColorStop(1, T.rgba('voidDeep', 0));
  c.fillStyle = g;
  c.fillRect(0, 0, AW, 62);

  /* 左：关卡名 + 机体读数（"这就是你自己的船"） */
  c.textAlign = 'left';
  c.fillStyle = T.rgba('secInk', 0.9);
  c.font = T.font('tiny', 'medium');
  c.fillText('通道 · THE CHANNEL', 12, 16);
  let hullZh = this.hullId;
  for (let i = 0; i < E.HULLS.length; i++) if (E.HULLS[i].id === this.hullId) { hullZh = E.HULLS[i].zh; break; }
  c.fillStyle = T.rgba('steel', 0.85);
  c.font = T.font('micro', 'regular');
  c.fillText(hullZh + ' · ' +
    Math.max(0, Math.round(this.p.hp)) + '/' + Math.round(this.p.maxHp), 12, 32);

  /* 中：星尘 → 折算卡数 */
  c.textAlign = 'center';
  c.fillStyle = T.rgba('amberHi', 1);
  c.font = T.font('lead', 'bold');
  c.fillText(String(this.got), AW / 2, 20);
  c.fillStyle = T.rgba('secInk', 0.9);
  c.font = T.font('micro', 'regular');
  c.fillText('星尘 · ' + this.cards() + ' 张强化', AW / 2, 38);

  /* 右：倒计时 + 已拿升级 */
  c.textAlign = 'right';
  c.fillStyle = T.rgba('cyanHi', 0.95);
  c.font = T.font('small', 'medium');
  c.fillText(Math.ceil(Math.max(0, DUR - this.t)) + 's', AW - 12, 16);
  c.fillStyle = T.rgba('violetHi', this.upgrades.length ? 1 : 0.35);
  c.font = T.font('micro', 'bold');
  c.fillText('升级 ×' + this.upgrades.length, AW - 12, 32);
  c.restore();

  /* 操作提示：A/D 是主控，但手机没有键盘 —— 摇杆那条路要让人看见 */
  c.save();
  c.textAlign = 'right'; c.textBaseline = 'bottom';
  c.fillStyle = T.rgba('steel', 0.5);
  c.font = T.font('micro', 'regular');
  c.fillText('A / D 左右 · 或左下摇杆', AW - 12, AH - 22);
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
  POD_EVERY: POD_EVERY, ACC_MUL: ACC_MUL, SPD_MUL: SPD_MUL, MAGNET_ADD: MAGNET_ADD,
  STAT_KEYS: STAT_KEYS,
};
})();
