;(function () {
'use strict';
/* ============================================================================
   app.js —— 状态机与主循环
   ----------------------------------------------------------------------------
   状态：
     menu → playing ⇄ paused → cardpick → playing
                   ↘ gate（巨像倒下后开门，仍属 playing）
                     → warp（穿越过场）→ channel（奖励关）→ chanend
                     → cardpick ×N（通道折算的强化）→ playing（下一区域）
                   ↘ over

   两条小游戏特有的坑：
     1) 切后台回来 dt 会是个巨大的值 —— 必须夹住，并在 onShow 里重置计时。
     2) onHide 时自动暂停，否则回来第一帧就把玩家撞死了。
   ========================================================================== */

const PAL = require('./pal.js');
const U = require('./util.js');
const T = require('./tokens.js');
const ARENA = require('./arena.js');
const SG = require('./singularity.js');
const RG = require('./regions.js');
const Combat = require('./combat.js');
const Channel = require('./channel.js');
const WM = require('./warp.js');
const Render = require('./render.js');
const UI = require('./ui.js');
const Aura = require('./aura.js');
const CD = require('./cards.js');
const Input = require('./input.js');

const AW = ARENA.ARENA_W, AH = ARENA.ARENA_H;
const BEST_KEY = 'es-best';
const MAX_DT = 1 / 30;      // dt 上限：低于 30fps 时宁可慢放也不要"瞬移"

function App() {
  this.state = 'menu';
  this.pausedFrom = 'playing';
  this.cb = null;
  this.stars = new ARENA.Starfield(U.RNG('starfield'));
  this.best = PAL.Store.get(BEST_KEY, 0) || 0;
  this.cards = null;
  this.cardQueue = 0;      // 还需发几张卡（通道折算出来的）
  this.warpPending = false; // 发完卡要走 afterWarp 而不是普通进波
  this.chan = null;
  this.warp = null;
  this.last = 0;
  this.fps = 60;
  this._fpsN = 0; this._fpsT = 0;
  this.started = false;
}

App.prototype.newRun = function () {
  const seed = U.randomSeedStr();
  this.cb = new Combat.Combat(seed, 'peregrine');
  this.cb.echo.load(PAL.Store);
  this.cb.startWave(1);
  this.stars.setRegion(RG.regionOf(1));
  this.chan = null; this.warp = null;
  this.cardQueue = 0; this.warpPending = false;
  this.state = 'playing';
  this.resetClock();
};

App.prototype.resetClock = function () { this.last = PAL.now(); };

/* ── 选卡 ─────────────────────────────────────────────────────────────── */
App.prototype._rollCards = function () {
  const cb = this.cb;
  const pool = CD.CARDS.slice();
  const a = pool.splice(Math.floor(cb.rng.next() * pool.length), 1)[0];
  let b = pool.splice(Math.floor(cb.rng.next() * pool.length), 1)[0];
  /* 保证「协同」有稳定出场率，否则压缩隐喻看不到 */
  if (a.id !== 'synergy' && b.id !== 'synergy' && cb.rng.chance(0.45)) b = CD.byId('synergy');
  return [a, b];
};
App.prototype._nextCard = function () {
  this.cards = this._rollCards();
  this.state = 'cardpick';
};
/* 一张卡发完：要么继续发，要么进下一波（或走 afterWarp 换区域） */
App.prototype._afterCards = function () {
  if (this.warpPending) {
    this.cardQueue--;
    if (this.cardQueue > 0) { this._nextCard(); return; }
    this.warpPending = false;
    this.chan = null;
    this.cb.afterWarp();
    this.stars.setRegion(RG.regionOf(this.cb.wave));
    this.state = 'playing';
    this.resetClock();
    return;
  }
  this.cb.startWave(this.cb.wave + 1);
  this.state = 'playing';
  this.resetClock();
};

/* ── 分享：把当前成绩带进转发卡片（唯一的天然增长引擎） ───────────────── */
App.prototype.setupShare = function () {
  PAL.Share.setDefault({
    title: '奇点回响 —— 你能把奇点压到多小？',
    imageUrl: '',
    query: 'from=share',
  });
  PAL.Share.onShowQuery(function (qq) { if (qq && qq.from) { /* 归因 */ } });
};
App.prototype.doShare = function () {
  const cb = this.cb;
  const score = cb ? cb.score : 0;
  PAL.Share.show({
    title: '我在《奇点回响》打到第 ' + (cb ? cb.wave : 0) + ' 波，得分 ' + U.fmt(score),
    query: 'from=share&s=' + score,
  });
};

/* H5 预览的小提示条：菜单里显示，进入战斗后藏掉，别挡视野 */
App.prototype._syncChrome = function () {
  if (typeof document === 'undefined') return;
  var h = document.getElementById('hint');
  if (h) h.style.display = (this.state === 'menu') ? '' : 'none';
};

/* ── 抖动 ─────────────────────────────────────────────────────────────── */
App.prototype._shake = function () {
  let a = 0, t = 0;
  if (this.state === 'channel' && this.chan) { a = this.chan.shakeA; t = this.chan.shakeT; }
  else if (this.cb) { a = this.cb.shakeA; t = this.cb.shakeT; }
  if (t > 0 && a > 0) return [(Math.random() * 2 - 1) * a, (Math.random() * 2 - 1) * a];
  return [0, 0];
};

/* ── 每帧 ─────────────────────────────────────────────────────────────── */
App.prototype.step = function (dt) {
  const c = PAL.getCtx();
  const cb = this.cb;

  ARENA.applyTransform(c);
  const sh = this._shake();
  c.save();
  c.translate(sh[0], sh[1]);

  if (this.state === 'menu') {
    /* 菜单也要有活着的奇点 —— 先把一个静态 Combat 造出来当背景 */
    if (!cb) {
      this.cb = new Combat.Combat('menu', 'peregrine');
      this.cb.sing.reset(2, AW / 2, AH * 0.42);
      this.cb.sing.setSynergy(3);
    }
    this.cb.sing.update(dt);
    this.stars.update(dt, 0, 0);
    ARENA.clear(c, null);
    this.stars.draw(c, this.cb.sing);
    ARENA.drawGrid(c, null);
    this.cb.sing.drawBack(c);
    this.cb.sing.drawFront(c);
    if (UI.drawMenu(c, this.cb)) { this.cb = null; this.newRun(); }
    c.restore();
    this._syncChrome();
    Input.flush();
    return;
  }

  /* ── 穿越过场 ─────────────────────────────────────────────────── */
  if (this.state === 'warp') {
    const w = this.warp;
    cb.sing.update(dt);
    /* 玩家被吸向门（前 42% 是吸入段） */
    if (w.p() < 0.45) {
      const k = 1 - Math.exp(-5.5 * dt);
      cb.p.x += (cb.sing.x - cb.p.x) * k;
      cb.p.y += (cb.sing.y - cb.p.y) * k;
    }
    const wa = w.worldAlpha();
    if (wa > 0.01) {
      c.save();
      c.globalAlpha = wa;
      this.stars.update(dt, cb.p.x - AW / 2, cb.p.y - AH / 2);
      Render.drawWorld(c, cb, this.stars);
      c.restore();
    } else {
      ARENA.clear(c, RG.regionOf(cb.wave));
    }
    const va = w.veilAlpha();
    if (va > 0.01) {
      c.save();
      c.fillStyle = T.rgba('voidDeep', va);
      c.fillRect(0, 0, AW, AH);
      c.restore();
    }
    w.draw(c);
    if (w.update(dt)) {
      /* 通道里飞的就是玩家自己那架船 —— 把 cb.p 本体传进去做属性快照
         （通道内部是副本，撞障碍 / 吃升级都不会反向污染战斗状态）。
         onUpgrade 把升级舱换到的永久强化**立刻**写回战斗层，
         这样通道一结束玩家就能感受到自己变强了。 */
      /* ⚠️ 通道态不走 Aura.draw（那是战场边缘层），所以这里**不要**发 cb.pulse ——
         发了也不会被画出来，是死代码。通道有自己的飘字 + 紫色爆散 + 震屏。 */
      this.chan = new Channel.Channel(cb.seedStr + ':' + cb.warps, cb.p, {
        onUpgrade: function (card) { cb.applyCard(card); },
      });
      this.warp = null;
      this.state = 'channel';
      this.resetClock();
    }
    c.restore();
    this._syncChrome();
    Input.flush();
    return;
  }

  /* ── 通道奖励关 ───────────────────────────────────────────────── */
  if (this.state === 'channel' || this.state === 'chanend') {
    const ch = this.chan;
    ARENA.clear(c, null);
    if (this.state === 'channel') ch.update(dt, Input);
    ch.fx.update(dt);
    if (this.state === 'channel' && ch.shakeT > 0) { ch.shakeT -= dt; ch.shakeA *= 0.88; }
    ch.draw(c);
    c.restore();
    c.save();
    ARENA.applyTransform(c);
    ch.drawHUD(c);
    if (this.state === 'chanend') {
      if (UI.drawChannelEnd(c, ch)) {
        this.cardQueue = ch.cards();
        this.warpPending = true;
        this._nextCard();
      }
    } else if (ch.done) {
      this.state = 'chanend';
    }
    c.restore();
    this._syncChrome();
    Input.flush();
    return;
  }

  /* ── 战斗 ─────────────────────────────────────────────────────── */
  if (this.state === 'playing') {
    if (cb.pendingWarp) {
      /* ★ 钻进奇点 → 穿越 */
      const from = RG.regionOf(cb.wave);
      const to = RG.regionOf(cb.wave + 1);
      this.warp = new WM.Warp(from, to);
      cb.pendingWarp = false;
      this.state = 'warp';
      PAL.vibrate('medium');
    } else if (cb.pendingCard) {
      this.cardQueue = 0;
      this._nextCard();
    } else {
      cb.update(dt, Input);
      if (cb.state === 'dead' && cb.deadT > 1.1) this.toOver();
    }
  } else if (this.state === 'cardpick') {
    /* 选卡时战场静止，但奇点继续转 —— 让玩家看清自己的构筑把它压成什么样 */
    cb.sing.update(dt);
  } else if (this.state === 'over') {
    cb.update(dt, Input);
  }

  this.stars.update(dt, cb.p.x - AW / 2, cb.p.y - AH / 2);
  Render.drawWorld(c, cb, this.stars);

  /* 屏幕边缘状态层（低血 / buff）：画在世界之上、HUD 之下 ——
     它是"世界的一部分"，不是 UI，所以跟着震动走；但不能盖住 HUD 读数。 */
  Aura.draw(c, cb);

  /* HUD / 面板画在震动之外，避免跟着晃 */
  c.restore();
  c.save();
  ARENA.applyTransform(c);

  if (this.state === 'playing' || this.state === 'cardpick') {
    UI.drawHUD(c, cb);
    if (this.state === 'playing' && UI.pauseHit()) {
      this.pausedFrom = 'playing';
      this.state = 'paused';
      Input.killStick();
    }
  }

  if (this.state === 'paused') {
    if (this.pausedFrom === 'channel' && this.chan) {
      this.chan.draw(c);
      this.chan.drawHUD(c);
    }
    const r = UI.drawPause(c, cb, this.pausedFrom === 'channel' ? this.chan : null);
    if (r.resume) { this.state = this.pausedFrom; this.resetClock(); }
    else if (r.restart) { this.newRun(); }
  }

  if (this.state === 'cardpick') {
    const pick = UI.drawCardPick(c, this.cards);
    if (pick >= 0) { cb.applyCard(this.cards[pick]); this._afterCards(); }
  }

  if (this.state === 'over') {
    const r = UI.drawOver(c, cb, this.best);
    if (r.retry) this.newRun();
    else if (r.share) this.doShare();
  }

  c.restore();
  this._syncChrome();
  Input.flush();
};

App.prototype.toOver = function () {
  const cb = this.cb;
  this.state = 'over';
  if (cb.score > this.best) { this.best = cb.score; PAL.Store.set(BEST_KEY, this.best); }
  /* 回响：存下这一局的航迹与死亡点，下一局会画出来 */
  if (cb.pendingEchoSave) {
    cb.echo.save(PAL.Store, { x: Math.round(cb.pendingEchoSave.x), y: Math.round(cb.pendingEchoSave.y) });
    cb.pendingEchoSave = null;
  }
};

/* ── 启动 ─────────────────────────────────────────────────────────────── */
App.prototype.start = function () {
  if (this.started) return;
  this.started = true;
  Input.init();
  PAL.initKeys();   // 键盘是增益输入，手机无键盘时静默降级（不报错、不影响触摸）
  this.setupShare();

  const self = this;
  /* 切后台：自动暂停 + 回来重置计时（否则 dt 会是个巨大的值） */
  PAL.Life.onHide(function () {
    if (self.state === 'playing' || self.state === 'channel') {
      self.pausedFrom = self.state;
      self.state = 'paused';
      Input.killStick();
    }
  });
  PAL.Life.onShow(function () { self.resetClock(); });

  this.resetClock();
  function frame() {
    const t = PAL.now();
    let dt = (t - self.last) / 1000;
    self.last = t;
    if (!(dt > 0)) dt = 1 / 60;
    if (dt > MAX_DT) dt = MAX_DT;

    self._fpsT += dt; self._fpsN++;
    if (self._fpsT >= 0.5) { self.fps = Math.round(self._fpsN / self._fpsT); self._fpsT = 0; self._fpsN = 0; }

    try {
      self.step(dt);
    } catch (err) {
      /* 小游戏里一个未捕获异常就是黑屏，兜住并打印，别让整局白打 */
      if (typeof console !== 'undefined') console.error('[frame]', err);
    }
    PAL.raf(frame);
  }
  PAL.raf(frame);
};

module.exports = { App: App };
})();
