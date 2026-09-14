;(function () {
'use strict';
/* ============================================================================
   aura.js —— 屏幕边缘状态层
   ----------------------------------------------------------------------------
   为什么放在边缘：玩家的注意力 90% 在准星附近，边缘是**余光**能收到但不抢戏
   的位置。血量、buff 这类"持续中的状态"正适合放这儿 —— 不用低头看 HUD，
   也不用弹横幅打断节奏。

   ── 视觉语法：每种状态一套**纹理**，不只是换个颜色 ────────────────────────
   只靠颜色区分会失败：四个 buff 同时挂上时，四条同样形状的彩带叠在边上，
   玩家能看出"有四个东西"，但说不出哪个是哪个 —— 颜色在余光里是糊的。
   所以每种状态给一套**独立的纹理语法**，形状本身就是标签：

     · 无敌 invuln → **力场穹顶**：最厚 + 慢呼吸 + 内缘亮线（罩住你的东西）
     · 护盾 shield → **分段装甲**：切成 8 块板，亮几块 = 还剩几成（边缘可读量）
     · 攻速 rate   → **频闪刻度梳**：9Hz 硬闪 + 沿边滚动的刻线（弹链在走）
     · 加速 boost  → **流动速度线**：从边缘向内流动的短划线（在往前冲）

   低血量仍是**最外一条**、最厚、随心跳脉动 —— 它是唯一一条"坏消息"，
   位置恒定、形状独立（没有纹理，纯渐变），玩家不用找。

   ── 触发式 vs 持续式 ──────────────────────────────────────────────────────
   两类反馈混在一起会互相削弱，所以分开：
     · **触发式**（升级 / 回血）：一次性脉冲，没有后续状态，要给足时间看清。
       - 升级 level → 紫色**向内收缩双环**（能量被注进船里）+ 世界空间扩散环
       - 回血 heal  → 暖粉**向内涌入波**（两层宽窄不同的余波）+ 扩散环
     · **持续式**（攻速 / 护盾 / 无敌 / 加速）：常驻光带，另外在**拿到那一刻**
       来一发很短的 sweep —— "我拿到了"和"我还挂着"是两件事，
       前者必须有个明确的起点，但不能长到跟常驻态打架。

   ── 与 HUD 的分工 ───────────────────────────────────────────────────────
   颜色 + 纹理只负责"有 / 没有"和"是哪一类"，**精确辨识交给 HUD 徽章**
   （字形 + 倒计时）。这样即便两个 buff 颜色相近也不会读错。

   ── 依赖方向 ────────────────────────────────────────────────────────────
   脉冲队列挂在 `cb.pulses` 上（战斗层 push + 推进），本模块只**读**它。
   战斗逻辑绝不 require 渲染层 —— CARDS 寄放在 ui.js 那个坑不再踩第二次。
   ========================================================================== */

const U = require('./util.js');
const T = require('./tokens.js');
const ARENA = require('./arena.js');
const PK = require('./pickups.js');
const clamp = U.clamp, TAU = U.TAU;
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
/* 每种 buff 的带厚 —— 无敌最厚（最强的状态该占最多边幅） */
const BAND_W = { invuln: 18, shield: 15, rate: 12, boost: 12 };
const GAP = 3;          // 带间暗隙（没有它，两条带会糊成一条）
const BUFF_A = 0.30;    // buff 带浓度
const FADE_T = 1.5;     // 剩余不足 1.5s 开始闪 —— 提醒"要没了"
const SEG_N = 8;        // 护盾装甲板数量

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

/* ── 四边统一坐标系 ───────────────────────────────────────────────────────
   局部 (u, v)：u 沿边、v 从边缘(0) 向内。
   有了它，每种纹理只写一遍，四条边自动一致 —— 不用给每条边抄四份代码
   （抄四份 = 改纹理时必漏一条边，而且角落对不上）。 */
const EDGE_LEN = [AW, AH, AW, AH];   // 上 / 右 / 下 / 左
function edgeXf(c, i) {
  if (i === 1) { c.translate(AW, 0); c.rotate(Math.PI / 2); }
  else if (i === 2) { c.translate(AW, AH); c.rotate(Math.PI); }
  else if (i === 3) { c.translate(0, AH); c.rotate(-Math.PI / 2); }
  return EDGE_LEN[i];
}

/* ── 单条光带：距屏幕边缘 [d0, d1] 的环带，d0 侧最浓，d1 侧为 0 ──────────
   四角会被相邻两边各画一次 → 角落更浓，这跟真实镜头暗角的行为一致，
   是想要的效果，不是 bug。 */
function band(c, d0, d1, col, a) {
  const w = d1 - d0;
  if (w <= 0 || a <= 0.002) return;
  for (let i = 0; i < 4; i++) {
    c.save();
    const len = edgeXf(c, i);
    const g = c.createLinearGradient(0, d0, 0, d1);
    g.addColorStop(0, T.rgba(col, a));
    g.addColorStop(1, T.rgba(col, 0));
    c.fillStyle = g;
    c.fillRect(0, d0, len, w);
    c.restore();
  }
}

/* ══════════════════════════════════════════════════════════════════════
   持续态纹理（四种，各一套语法）
   ════════════════════════════════════════════════════════════════════ */

/* 无敌 —— 力场穹顶：慢呼吸 + 内缘亮线 */
function texInvuln(c, d0, d1, col, a, time) {
  const br = 0.72 + 0.28 * Math.sin(time * 2.1);
  band(c, d0, d1, col, a * br);
  /* 内缘亮线 = 穹顶的边。没有它，光带只是"一圈颜色"；
     有了它才读成"一层罩住你的东西"。 */
  for (let i = 0; i < 4; i++) {
    c.save();
    const len = edgeXf(c, i);
    c.strokeStyle = T.rgba(col, 0.55 * br);
    c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(0, d1 - 1); c.lineTo(len, d1 - 1); c.stroke();
    c.restore();
  }
}

/* 护盾 —— 分段装甲：八块板，亮几块 = 还剩几成（边缘就能读出盾量） */
function texShield(c, d0, d1, col, a, time, st) {
  const ratio = st.max > 0 ? clamp(st.left / st.max, 0, 1) : 1;
  const lit = Math.max(1, Math.ceil(ratio * SEG_N));
  const w = d1 - d0;
  for (let i = 0; i < 4; i++) {
    c.save();
    const len = edgeXf(c, i);
    const segW = len / SEG_N;
    for (let k = 0; k < SEG_N; k++) {
      const on = k < lit;
      /* 段间留 4px 实缝 —— 缝要够宽才读成"一块块装甲板"。
         ⚠️ 2px 时探针量出的沿边起伏跟加速的流线几乎一样（差 19%），
            玩家余光更分不出。缝是这条带唯一的辨识点，别省。 */
      const x0 = k * segW + 2, x1 = (k + 1) * segW - 2;
      const g = c.createLinearGradient(0, d0, 0, d1);
      g.addColorStop(0, T.rgba(col, on ? a : a * 0.16));
      g.addColorStop(1, T.rgba(col, 0));
      c.fillStyle = g;
      c.fillRect(x0, d0, x1 - x0, w);
      /* 亮着的板：内缘高光条。这条亮线把"板"的边缘勾出来，
         是整条带读成装甲而不是渐变的关键。 */
      if (on) { c.fillStyle = T.rgba(col, 0.72); c.fillRect(x0, d1 - 2.4, x1 - x0, 2.4); }
    }
    c.restore();
  }
}

/* 攻速 —— 频闪刻度梳：射速快 = 闪得快，刻线沿边滚动（弹链在走） */
function texRate(c, d0, d1, col, a, time) {
  /* |sin| 的 0.5 次方：把柔和的正弦削成"硬"闪，才像射速不像呼吸 */
  const strobe = 0.55 + 0.45 * Math.pow(Math.abs(Math.sin(time * Math.PI * 9)), 0.5);
  band(c, d0, d1, col, a * strobe);
  const gap = 13;
  const off = (time * 110) % gap;
  for (let i = 0; i < 4; i++) {
    c.save();
    const len = edgeXf(c, i);
    c.strokeStyle = T.rgba(col, 0.42 * strobe);
    c.lineWidth = 1;
    c.beginPath();
    for (let x = -gap + off; x < len + gap; x += gap) {
      c.moveTo(x, d0 + 1); c.lineTo(x, d1 - 1);
    }
    c.stroke();
    c.restore();
  }
}

/* 加速 —— 流动速度线：从边缘向内流动的短划线，两端淡出 */
function texBoost(c, d0, d1, col, a, time) {
  band(c, d0, d1, col, a * 0.7);
  for (let i = 0; i < 4; i++) {
    c.save();
    const len = edgeXf(c, i);
    /* 渐变描边：线在带子两端自然淡出，不用给每条线单独设 alpha */
    const g = c.createLinearGradient(0, d0, 0, d1);
    g.addColorStop(0, T.rgba(col, 0));
    g.addColorStop(0.35, T.rgba(col, 0.6));
    g.addColorStop(1, T.rgba(col, 0));
    c.strokeStyle = g;
    c.lineWidth = 2.2;
    c.beginPath();
    /* 线要够密够粗 —— 稀疏细线在余光里是"隐约有点东西"，
       密而粗才读成"在往前冲"。这也是它跟护盾静态块拉开差距的地方。 */
    const n = Math.max(6, Math.round(len / 18));
    for (let k = 0; k < n; k++) {
      /* 相位由 k 派生（不调 rand —— 会污染 RNG 序列，同 6-1-07 那个坑） */
      const ph = ((time * 260 + k * 97) % 260) / 260;
      const u = (k + 0.5) * (len / n) + ((k * 53) % 17) - 8;
      const v0 = d0 + ph * (d1 - d0 + 12) - 6;
      c.moveTo(u, v0); c.lineTo(u, v0 + 15);
    }
    c.stroke();
    c.restore();
  }
}

const TEX = { invuln: texInvuln, shield: texShield, rate: texRate, boost: texBoost };

/* ══════════════════════════════════════════════════════════════════════
   触发式脉冲
   ════════════════════════════════════════════════════════════════════ */
const PULSE_KIND = {
  heal: 'surge', level: 'converge',
  boost: 'sweep', rate: 'sweep', shield: 'sweep', invuln: 'sweep',
};
const PULSE_COL = {
  heal: 'puHeal', level: 'violetHi',
  boost: 'puBoost', rate: 'cyanHi', shield: 'shieldB', invuln: 'amberHi',
};

/* 回血 —— 向内涌入波：两层宽窄不同的暖色余波扫进来 */
function pulseSurge(c, col, t) {
  const e = T.EASE.outCubic(t);
  band(c, 0, 26 + 96 * e, col, 0.30 * (1 - t));
  band(c, 0, 18 + 150 * e, col, 0.12 * (1 - t) * (1 - t));
}

/* 升级 —— 向内收缩双环：能量被"吸"进船里（inCubic 先慢后快） */
function pulseConverge(c, col, t) {
  const e = T.EASE.inCubic(t);
  const fade = 1 - t;
  band(c, 0, 30, col, 0.34 * fade);
  for (let k = 0; k < 2; k++) {
    const ins = 18 + 92 * e + k * 20;
    const a = 0.5 * fade * (1 - k * 0.4);
    if (a <= 0.004 || ins * 2 >= Math.min(AW, AH)) continue;
    c.strokeStyle = T.rgba(col, a);
    c.lineWidth = 1.6 + k * 0.4;
    c.strokeRect(ins, ins, AW - ins * 2, AH - ins * 2);
  }
}

/* 持续型 buff 的入场 sweep —— 短促，只负责标记"拿到了"这个起点 */
function pulseSweep(c, col, t) {
  band(c, 0, 10 + 58 * T.EASE.outCubic(t), col, 0.22 * (1 - t));
}

/* 世界空间的扩散环（拾取点） */
function burstRing(c, x, y, col, t) {
  if (x == null || y == null) return;
  const e = T.EASE.outCubic(t);
  c.strokeStyle = T.rgba(col, 0.85 * (1 - t));
  c.lineWidth = 2.4 * (1 - t) + 0.6;
  c.beginPath(); c.arc(x, y, 14 + 86 * e, 0, TAU); c.stroke();
}

/* ── 主入口 ─────────────────────────────────────────────────────────────── */
function draw(c, cb) {
  const list = activeList(cb);
  const pulses = cb.pulses || [];
  if (!list.length && !pulses.length) return;
  const time = cb.time;

  c.save();
  let d = 0;

  /* 低血量：固定最外一条，纯渐变无纹理（跟 buff 带在形状上就区分开）。
     血越少 → 越浓、心跳越快。 */
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

  /* buff 带：按固定顺序紧凑排列，每种走自己的纹理 */
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
    const w = BAND_W[id] || 13;
    (TEX[id] || texBoost)(c, d, d + w, s.col, a, time, s);
    d += w + GAP;
  }

  /* 触发式脉冲：画在最上，它们是"刚刚发生了什么" */
  for (let i = 0; i < pulses.length; i++) {
    const q = pulses[i];
    const t = clamp(q.t / q.max, 0, 1);
    const col = PULSE_COL[q.type] || 'cyanHi';
    const kind = PULSE_KIND[q.type] || 'sweep';
    if (kind === 'surge') pulseSurge(c, col, t);
    else if (kind === 'converge') pulseConverge(c, col, t);
    else pulseSweep(c, col, t);
    /* 世界空间的扩散环只给触发式（sweep 已经有了常驻带，再加环就吵了） */
    if (kind !== 'sweep') {
      burstRing(c, q.x, q.y, col, t);
      if (kind === 'converge') {
        burstRing(c, q.x, q.y, col, clamp((t - 0.18) / 0.82, 0, 1));
      }
    }
  }
  c.restore();
}

module.exports = {
  draw: draw, activeList: activeList, buffList: buffList,
  LOW: LOW, ORDER: ORDER, BAND_W: BAND_W, GAP: GAP, SEG_N: SEG_N,
  PULSE_KIND: PULSE_KIND, PULSE_COL: PULSE_COL,
};
})();
