;(function () {
'use strict';
/* ============================================================================
   aura.js —— 屏幕边缘状态层
   ----------------------------------------------------------------------------
   为什么放在边缘：玩家的注意力 90% 在准星附近，边缘是**余光**能收到但不抢戏
   的位置。血量、buff 这类"持续中的状态"正适合放这儿 —— 不用低头看 HUD，
   也不用弹横幅打断节奏。

   ── 视觉语法 ────────────────────────────────────────────────────────────
   每个激活状态在屏幕边缘占**一条光带**，从边缘（最浓）向内渐隐到 0。
   多条状态从外向内依次排列 —— 像测绘仪上层层套着的读数环，
   数得清有几个、看得出各是什么颜色。

   为什么不用「整屏叠一层颜色」：多个 buff 同时开时颜色会混成一坨脏色，
   玩家分不出自己身上到底挂了什么。分带排列则天生可数。

   ── 排序 ────────────────────────────────────────────────────────────────
   低血量**固定占最外一条**（slot 0），且比 buff 带更厚、随心跳脉动。
   它是唯一一条"坏消息"，理应最靠边、最醒目、位置恒定 —— 玩家不用找。
   其余 buff 在它内侧紧凑排列（不留空档），顺序固定，便于形成肌肉记忆。

   ── 与 HUD 的分工 ───────────────────────────────────────────────────────
   颜色只负责"有 / 没有"和"大致是哪一类"，**精确辨识交给 HUD 徽章**
   （字形 + 倒计时）。这样即便两个 buff 颜色相近也不会读错。
   ========================================================================== */

const U = require('./util.js');
const T = require('./tokens.js');
const ARENA = require('./arena.js');
const PK = require('./pickups.js');
const clamp = U.clamp;
const AW = ARENA.ARENA_W, AH = ARENA.ARENA_H;

/* ── 几何 ───────────────────────────────────────────────────────────────── */
const LOW = {
  AT: 0.35,        // 低于 35% 船体才开始报警
  BAND: 26,        // 低血带更厚 —— 它是警告，不是装饰
  A_MIN: 0.10,     // 刚跌破阈值时的浓度
  A_MAX: 0.42,     // 濒死时的浓度
  BPM_MIN: 5,      // 心跳频率（血越少跳越快）
  BPM_MAX: 12,
};
const BUFF_BAND = 13;   // 单条 buff 带厚度
const GAP = 3;          // 带间暗隙（没有它，两条带会糊成一条）
const BUFF_A = 0.30;    // buff 带浓度
const FADE_T = 1.5;     // 剩余不足 1.5s 开始闪 —— 提醒"要没了"

/* 显示顺序（不含低血，低血永远在最外） */
const ORDER = ['invuln', 'rate', 'boost', 'shield'];

/* ── 激活状态列表 ★ 全项目唯一的状态判定点 ───────────────────────────────
   HUD 徽章、边缘光带、探针三处都读这里 —— 判定逻辑只写一遍，
   不会出现"边缘显示了但 HUD 没显示"这种割裂。 */
function activeList(cb) {
  const p = cb.p;
  const out = [];
  const hpR = p.maxHp > 0 ? p.hp / p.maxHp : 1;
  if (p.alive && hpR < LOW.AT) {
    out.push({ id: 'low', col: 'danger', left: 0, max: 0, k: clamp(1 - hpR / LOW.AT, 0, 1) });
  }
  if (p.invuln > 0) out.push({ id: 'invuln', col: 'amberHi', left: p.invuln, max: PK.PU.invuln.dur });
  if (p.rateT > 0) out.push({ id: 'rate', col: 'cyanHi', left: p.rateT, max: PK.PU.rate.dur });
  if (p.boostT > 0) out.push({ id: 'boost', col: 'puBoost', left: p.boostT, max: PK.PU.boost.dur });
  if (p.shieldTmp > 0) out.push({ id: 'shield', col: 'shieldB', left: p.shieldTmp, max: p.shieldTmpMax || PK.PU.shield.dur });
  return out;
}

/* 只给 HUD 用的：过滤掉低血（低血有血条，不需要徽章），并保持排序 */
function buffList(cb) {
  return activeList(cb).filter(function (x) { return x.id !== 'low'; });
}

/* ── 单条光带：距屏幕边缘 [d0, d1] 的环带，d0 侧最浓，d1 侧为 0 ──────────
   四条边各画一个渐变矩形。四角会被相邻两边各画一次 → 角落更浓，
   这跟真实镜头暗角的行为一致，是想要的效果，不是 bug。 */
function band(c, d0, d1, col, a) {
  const w = d1 - d0;
  if (w <= 0 || a <= 0.002) return;
  const A0 = T.rgba(col, a);
  const A1 = T.rgba(col, 0);
  let g;
  /* 上 */
  g = c.createLinearGradient(0, d0, 0, d1);
  g.addColorStop(0, A0); g.addColorStop(1, A1);
  c.fillStyle = g; c.fillRect(0, d0, AW, w);
  /* 下 */
  g = c.createLinearGradient(0, AH - d0, 0, AH - d1);
  g.addColorStop(0, A0); g.addColorStop(1, A1);
  c.fillStyle = g; c.fillRect(0, AH - d1, AW, w);
  /* 左 */
  g = c.createLinearGradient(d0, 0, d1, 0);
  g.addColorStop(0, A0); g.addColorStop(1, A1);
  c.fillStyle = g; c.fillRect(d0, 0, w, AH);
  /* 右 */
  g = c.createLinearGradient(AW - d0, 0, AW - d1, 0);
  g.addColorStop(0, A0); g.addColorStop(1, A1);
  c.fillStyle = g; c.fillRect(AW - d1, 0, w, AH);
}

/* ── 主入口 ─────────────────────────────────────────────────────────────── */
function draw(c, cb) {
  const list = activeList(cb);
  if (!list.length) return;
  const time = cb.time;

  c.save();
  let d = 0;

  /* 低血量：固定最外一条。血越少 → 越浓、心跳越快。 */
  let low = null;
  for (let i = 0; i < list.length; i++) if (list[i].id === 'low') low = list[i];
  if (low) {
    const t = low.k;
    const bpm = LOW.BPM_MIN + (LOW.BPM_MAX - LOW.BPM_MIN) * t;
    /* 心跳不是正弦 —— 用正弦的 3 次方，收缩快、舒张慢，才像心跳而不是呼吸 */
    const beat = Math.pow(Math.max(0, Math.sin(time * bpm)), 3);
    const pulse = 0.55 + 0.45 * beat;
    band(c, 0, LOW.BAND, 'danger', (LOW.A_MIN + (LOW.A_MAX - LOW.A_MIN) * t) * pulse);
    d = LOW.BAND + GAP;
  }

  /* buff 带：按固定顺序紧凑排列 */
  for (let i = 0; i < ORDER.length; i++) {
    const id = ORDER[i];
    let s = null;
    for (let j = 0; j < list.length; j++) if (list[j].id === id) s = list[j];
    if (!s) continue;
    let a = BUFF_A;
    /* 快结束了 → 闪烁。玩家得知道自己什么时候会失去它，
       否则"突然没了"会被误读成 bug。 */
    if (s.max > 0 && s.left < FADE_T) {
      a *= 0.30 + 0.70 * Math.abs(Math.sin(time * 11));
    }
    band(c, d, d + BUFF_BAND, s.col, a);
    d += BUFF_BAND + GAP;
  }
  c.restore();
}

module.exports = {
  draw: draw, activeList: activeList, buffList: buffList,
  LOW: LOW, ORDER: ORDER, BUFF_BAND: BUFF_BAND, GAP: GAP,
};
})();
