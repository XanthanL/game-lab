// 轻量动画系统：缓动函数 + 对象池化的瞬时动画管理器
// 设计原则：零额外 draw call、复用对象（避免 GC 抖动）、与现有 rAF 主循环集成，
// 不显著增加 CPU/内存开销。可在不引入第三方库的前提下为角色/特效提供"弹性"手感。
(function () {
  'use strict';
  const A = {};
  PVZ.anim = A;

  // ===== 缓动函数（输入 t∈[0,1] → 输出） =====
  A.linear = (t) => t;
  A.inQuad = (t) => t * t;
  A.outQuad = (t) => 1 - (1 - t) * (1 - t);
  A.inOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  A.outCubic = (t) => 1 - Math.pow(1 - t, 3);
  A.inCubic = (t) => t * t * t;
  A.outBack = (t, s) => {
    s = s === undefined ? 1.70158 : s;
    const c3 = s + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
  };
  A.outElastic = (t) => {
    const c4 = (2 * Math.PI) / 3;
    if (t === 0) return 0;
    if (t === 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  };
  A.outBounce = (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  };

  A.clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

  // ===== 瞬时动画管理器（对象池） =====
  // 每个动画是一个 { update(dt) -> boolean 是否仍存活 } 的句柄。
  // 在 main.js 主循环中每帧调用 PVZ.anim.update(dt) 即可驱动。
  let active = [];
  const pool = [];

  A.update = function (dt) {
    for (let i = active.length - 1; i >= 0; i--) {
      if (!active[i].update(dt)) {
        const done = active[i];
        active.splice(i, 1);
        if (pool.length < 128) pool.push(done);
      }
    }
  };

  // 注册一个动画：tick(dt) 返回 false 表示结束。返回句柄（可用于提前取消）
  A.run = function (tick) {
    let handle = pool.pop();
    if (!handle) handle = {};
    handle.update = tick;
    active.push(handle);
    return handle;
  };

  A.clear = function () { active.length = 0; };

  // 便捷：经过 dur 秒将 from→to 缓动插值，每帧回调 onUpdate(v)，结束回调 onDone
  A.tween = function (from, to, dur, ease, onUpdate, onDone) {
    const e = ease || A.outCubic;
    let t = 0;
    return A.run((dt) => {
      t += dt;
      const k = A.clamp01(t / dur);
      onUpdate(from + (to - from) * e(k), k);
      if (k >= 1) { if (onDone) onDone(); return false; }
      return true;
    });
  };
})();
