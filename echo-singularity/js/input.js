;(function () {
'use strict';
/* ============================================================================
   input.js —— 触摸输入（左下角固定摇杆 + 点击）
   ----------------------------------------------------------------------------
   ★ 摇杆基座固定在左下角，不再跟着手指落点跑。
     浮动基座（手指按哪儿基座就长在哪儿）看着自由，实战里是灾难：
     手指出汗 / 换握姿 / 误触都会让操纵中心瞬移，玩家会觉得「船不受控」。
     固定基座 + 大判定区 = 位置可预期，肌肉记忆能建立。

   两条来自网页版的硬教训，在这里从一开始就按小游戏的事件模型处理：
     1) touchcancel **不能立刻打死摇杆**。微信在来电 / 下拉通知 / 手势返回时
        会发 onTouchCancel，但很多时候手指其实还按着、随后还会继续发 move。
        立刻清掉会表现为「移动突然断掉且再也接不回来」。
        → 延迟 120ms 拆除，期间收到 move 就取消拆除。
     2) 延迟拆除期间必须能**接管新输入**，不能因为「正在拆除」就吞掉事件。

   另一条是从 H5 预览里量出来的真 bug（别再犯）：
     打包事件时必须优先读 changedTouches —— touchend / touchcancel 的 touches
     是空列表，若优先读 touches 就会回退成原生 event，identifier 变成 0，
     跟摇杆 id 对不上，摇杆永远释放不掉（表现为松手后船还在飘）。
   ========================================================================== */

const PAL = require('./pal.js');
const U = require('./util.js');
const T = require('./tokens.js');
const ARENA = require('./arena.js');

const AW = ARENA.ARENA_W, AH = ARENA.ARENA_H;

/* ── 固定摇杆几何（世界坐标） ─────────────────────────────────────────── */
const STICK_R = 52;                       // 摇杆半径
const STICK_CX = 74;                      // 基座圆心 —— 固定，永不改变
const STICK_CY = AH - 74;
/* 判定区：左下角一大块（比基座大得多，手不用瞄） */
const HIT = { x: 0, y: AH * 0.30, w: AW * 0.54, h: AH * 0.70 };

function inHit(x, y) {
  return x >= HIT.x && x <= HIT.x + HIT.w && y >= HIT.y && y <= HIT.y + HIT.h;
}

const Input = {
  stick: {
    active: false, id: -1,
    ox: STICK_CX, oy: STICK_CY,     // 基座（保留字段，兼容旧引用）
    x: STICK_CX, y: STICK_CY,       // 摇杆帽：跟随手指，但被夹在基座半径内
    dx: 0, dy: 0,                   // 归一化偏移 -1..1
    mag: 0,                         // 0..1
    pendingCancel: false,
    _timer: null,
  },
  taps: [],              // 本帧待消费的点击 {x,y}（UI 自己判矩形）
  _touches: {},          // id -> {x0,y0,t0,moved}
};

function killStick() {
  const s = Input.stick;
  if (s._timer) { clearTimeout(s._timer); s._timer = null; }
  s.active = false; s.id = -1;
  s.x = STICK_CX; s.y = STICK_CY;
  s.dx = 0; s.dy = 0; s.mag = 0;
  s.pendingCancel = false;
}

/* 手指位置 → 摇杆帽位置 → 归一化方向（基座恒定） */
function aim(id, x, y) {
  const s = Input.stick;
  s.id = id;
  let dx = x - STICK_CX, dy = y - STICK_CY;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > STICK_R) { dx = dx / d * STICK_R; dy = dy / d * STICK_R; }
  s.x = STICK_CX + dx; s.y = STICK_CY + dy;
  const ed = Math.sqrt(dx * dx + dy * dy);
  if (ed < 6) { s.dx = 0; s.dy = 0; s.mag = 0; }
  else {
    s.dx = dx / STICK_R; s.dy = dy / STICK_R;
    const m = Math.sqrt(s.dx * s.dx + s.dy * s.dy);
    if (m > 1) { s.dx /= m; s.dy /= m; }
    s.mag = Math.min(1, ed / STICK_R);
  }
}

/* 统一的触点读取：兼容小游戏原生 event 与浏览器原生 Event */
function touchesOf(e) {
  if (e.changedTouches && e.changedTouches.length) return e.changedTouches;
  if (e.touches && e.touches.length) return e.touches;
  return [e];
}
function idOf(t) { return (t.identifier != null) ? t.identifier : 0; }
/* ★ 触点坐标是**屏幕**逻辑像素，而摇杆基座 / UI 全在**世界**坐标里。
   两者差一个 View.scale 与 oy 偏移 —— 必须换算，否则判定区整体错位，
   表现为「按左下角没反应 / 按中间反而动」。微信原生与小游戏一视同仁。 */
function ptOf(t) {
  return ARENA.toWorld((t.clientX != null) ? t.clientX : (t.x || 0),
                       (t.clientY != null) ? t.clientY : (t.y || 0));
}

function onStart(e) {
  const list = touchesOf(e);
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    const id = idOf(t), p = ptOf(t), x = p.x, y = p.y;
    Input._touches[id] = { x0: x, y0: y, t0: PAL.now(), moved: false };

    /* 只有落在左下判定区、且当前没人握着杆，才接管 */
    if (!Input.stick.active && inHit(x, y)) {
      const s = Input.stick;
      // 延迟拆除期间来了新手指 → 直接接管（教训 2）
      if (s._timer) { clearTimeout(s._timer); s._timer = null; }
      s.active = true; s.pendingCancel = false;
      aim(id, x, y);
    }
  }
}

function onMove(e) {
  const list = touchesOf(e);
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    const id = idOf(t), p = ptOf(t), x = p.x, y = p.y;
    const rec = Input._touches[id];
    if (rec) {
      const dx = x - rec.x0, dy = y - rec.y0;
      if (dx * dx + dy * dy > 12 * 12) rec.moved = true;
    }
    const s = Input.stick;
    if (s.active && id === s.id) {
      /* 教训 1：延迟拆除期间收到 move → 说明手指还在，撤销拆除 */
      if (s.pendingCancel) {
        s.pendingCancel = false;
        if (s._timer) { clearTimeout(s._timer); s._timer = null; }
      }
      aim(id, x, y);
    }
  }
}

function onEnd(e) {
  const list = touchesOf(e);
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    const id = idOf(t), p = ptOf(t), x = p.x, y = p.y;
    const rec = Input._touches[id];
    /* 抬起且几乎没移动、时长够短 → 记为一次点击（UI 按钮用） */
    if (rec && !rec.moved && (PAL.now() - rec.t0) < 400) {
      Input.taps.push({ x: x, y: y });
      if (Input.taps.length > 8) Input.taps.shift();
    }
    delete Input._touches[id];
    if (Input.stick.active && id === Input.stick.id) killStick();
  }
}

function onCancel(e) {
  const list = touchesOf(e);
  for (let i = 0; i < list.length; i++) {
    const id = idOf(list[i]);
    delete Input._touches[id];
    const s = Input.stick;
    if (s.active && id === s.id) {
      /* 不立刻打死：120ms 内若还有 move 就续上 */
      s.pendingCancel = true;
      if (s._timer) clearTimeout(s._timer);
      s._timer = setTimeout(function () {
        s._timer = null;
        if (s.pendingCancel) killStick();
      }, 120);
    }
  }
}

Input.init = function () {
  PAL.Touch.onStart(onStart);
  PAL.Touch.onMove(onMove);
  PAL.Touch.onEnd(onEnd);
  PAL.Touch.onCancel(onCancel);
};

/* UI 每帧消费完 taps 后调用，清空本帧点击 */
Input.flush = function () { Input.taps.length = 0; };

/* 消费一次点击：命中矩形返回 true 并移除该点击 */
Input.consumeTap = function (x, y, w, h) {
  for (let i = 0; i < Input.taps.length; i++) {
    const t = Input.taps[i];
    if (t.x >= x && t.x <= x + w && t.y >= y && t.y <= y + h) {
      Input.taps.splice(i, 1);
      return true;
    }
  }
  return false;
};
Input.peekTap = function (x, y, w, h) {
  for (let i = 0; i < Input.taps.length; i++) {
    const t = Input.taps[i];
    if (t.x >= x && t.x <= x + w && t.y >= y && t.y <= y + h) return t;
  }
  return null;
};
/* 圆形命中（暂停按钮之类） */
Input.consumeTapCircle = function (cx, cy, r) {
  for (let i = 0; i < Input.taps.length; i++) {
    const t = Input.taps[i];
    const dx = t.x - cx, dy = t.y - cy;
    if (dx * dx + dy * dy <= r * r) { Input.taps.splice(i, 1); return true; }
  }
  return false;
};

Input.killStick = killStick;
Input.STICK_R = STICK_R;
Input.STICK_CX = STICK_CX;
Input.STICK_CY = STICK_CY;
Input.HIT = HIT;
Input.inHit = inHit;

/* 摇杆可视化：基座常驻（让玩家一眼看到操纵中心），摇杆帽只在握持时出现 */
Input.drawStick = function (c) {
  const s = Input.stick;
  c.save();
  /* 基座：未握持时很淡，握持时提亮 */
  c.globalAlpha = s.active ? 0.55 : 0.26;
  c.strokeStyle = T.rgba('syn', 0.6);
  c.lineWidth = 1.2;
  c.beginPath(); c.arc(STICK_CX, STICK_CY, STICK_R, 0, U.TAU); c.stroke();
  /* 十字刻度 —— 测绘仪器感，也提示四个正方向 */
  c.globalAlpha = s.active ? 0.32 : 0.15;
  c.strokeStyle = T.rgba('line', 1);
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(STICK_CX - STICK_R * 0.3, STICK_CY); c.lineTo(STICK_CX + STICK_R * 0.3, STICK_CY);
  c.moveTo(STICK_CX, STICK_CY - STICK_R * 0.3); c.lineTo(STICK_CX, STICK_CY + STICK_R * 0.3);
  c.stroke();
  if (s.active) {
    /* 从基座到摇杆帽的牵引线 */
    c.globalAlpha = 0.5;
    c.strokeStyle = T.rgba('cyan', 0.8);
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(STICK_CX, STICK_CY); c.lineTo(s.x, s.y); c.stroke();
    /* 摇杆帽 */
    c.globalAlpha = 0.9;
    c.fillStyle = T.rgba('cyanHi', 0.8);
    c.beginPath(); c.arc(s.x, s.y, 16, 0, U.TAU); c.fill();
    c.strokeStyle = T.rgba('syn', 0.7);
    c.lineWidth = 1;
    c.beginPath(); c.arc(s.x, s.y, 16, 0, U.TAU); c.stroke();
  }
  c.restore();
};

module.exports = Input;
})();
