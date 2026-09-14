;(function () {
'use strict';
/* ============================================================================
   tokens.js —— 设计 token 单一事实源
   ----------------------------------------------------------------------------
   小游戏没有 CSS 变量，颜色只能写在 JS 里。为了避免重蹈网页版「色值散落各处」
   的覆辙，这里把整套色板集中定义，并提供 rgba() / mix() 工具。

   规则（与网页版 audit-tokens R1–R5 同源）：
     R1  任何绘制颜色只允许引用本表，不得再写字面色值
     R2  `--c-x` 必配 `--c-x-rgb`；JS 里每个色必须同时给出 hex 与 rgb 数组
     R3  改 token 名要全局扫引用
     R5  字号 / 时长 / 缓动一律走本表的 SCALE / TIME / EASE，不写字面值
   ========================================================================== */

/* ── 颜色 ──────────────────────────────────────────────────────────────────
   每项 {hex:'#rrggbb', rgb:[r,g,b]。只写一次，别处一律引用。 */
function C(hex, rgb) { return { hex: hex, rgb: rgb }; }

const COLORS = {
  /* 基底 / 表面 —— 深墨蓝，大面积负空间 */
  void:       C('#0e1520', [14, 21, 32]),     // 画布清屏
  voidDeep:   C('#070b12', [7, 11, 18]),      // 渐晕外层
  void2:      C('#161f2d', [22, 31, 45]),     // 面板底
  panel:      C('#141d29', [20, 29, 41]),     // 面板 / 按钮底
  line:       C('#35597d', [53, 89, 125]),    // 钢蓝结构线

  /* 文字 · 中性铅白 */
  ink:        C('#e4e9f0', [228, 233, 240]),
  inkHi:      C('#f7fafd', [247, 250, 253]),
  steel:      C('#9aa7b6', [154, 167, 182]),
  secInk:     C('#8d99a8', [141, 153, 168]),

  /* 线条 · 冷钢蓝（唯一线色） */
  cyan:       C('#7cb2dd', [124, 178, 221]),
  cyanHi:     C('#d8ecff', [216, 236, 255]),
  cyanHi2:    C('#bcd8f2', [188, 216, 242]),
  syn:        C('#a6c8e6', [166, 200, 230]),

  /* 状态 */
  danger:     C('#c0402b', [192, 64, 43]),    // 朱砂 —— 全画面唯一高饱和
  dangerHi:   C('#e07a62', [224, 122, 98]),
  foe:        C('#ffb08a', [255, 176, 138]),  // 敌方弹丸
  hpA:        C('#3f7a56', [63, 122, 86]),    // 血条
  hpB:        C('#9ed4ac', [158, 212, 172]),
  shieldA:    C('#33708f', [51, 112, 143]),
  shieldB:    C('#8fd0dd', [143, 208, 221]),
  amber:      C('#c9a227', [201, 162, 39]),   // 黄铜 —— 满级 / 高值
  amberHi:    C('#ecd08a', [236, 208, 138]),
  violet:     C('#9a7aab', [154, 122, 171]),  // 锰紫 —— 技能
  violetHi:   C('#c2a3d0', [194, 163, 208]),

  /* 奇点专用 —— 三阶段各有主色 */
  singHalo:   C('#6f8fc4', [111, 143, 196]),  // 外环：冷，远
  singHoriz:  C('#d1662f', [209, 102, 47]),   // 视界：朱，灼烧
  singCore:   C('#f2e6c8', [242, 230, 200]),  // 核心：白热
  singDisk:   C('#e8a04a', [232, 160, 74]),   // 吸积盘：熔金
  singLens:   C('#4a6f9c', [74, 111, 156]),   // 引力透镜偏折色

  /* 拾取物 —— 只新增两个，其余四种复用既有 token（见 pickups.js 的 PU 表）。
     原则：能复用就复用，色板每多一个色，边缘晕影的辨识度就摊薄一分。
     puHeal 刻意比 danger 更亮更粉 —— 回血不能长得像受伤。 */
  puBoost:    C('#6effb4', [110, 255, 180]),  // 推进超频：石绿（呼应 bulwark 的石绿辉光）
  puHeal:     C('#ff9aa4', [255, 154, 164]),  // 应急修复：暖粉
  /* rate 复用 cyanHi（跟我方弹同色 = 我方火力）· shield 复用 shieldB（护盾已有色）
     invuln 复用 amberHi（黄铜 = 最高价值）· level 复用 violetHi（锰紫 = 技能） */
};

/* ── 船体色板（天然矿物颜料） ───────────────────────────────────────────── */
const HULL_TINT = {
  peregrine: { fill: '#0a1420', line: '#a8c8e8', glow: [110, 160, 210] },  // 石青
  rapier:    { fill: '#1a0a07', line: '#e89a80', glow: [200, 85, 60] },    // 朱砂
  bulwark:   { fill: '#081310', line: '#9ccfae', glow: [110, 180, 140] },  // 石绿
  raven:     { fill: '#130d18', line: '#c2a3d0', glow: [150, 110, 175] },  // 锰紫
  swarm:     { fill: '#161004', line: '#e0c088', glow: [200, 150, 75] },   // 赭石
  nemesis:   { fill: '#16151a', line: '#eff4fa', glow: [228, 233, 240] },  // 铅白
  forge:     { fill: '#1a0e07', line: '#f0a468', glow: [236, 132, 58] },   // 熔铜
};

/* ── 字号阶梯（R5：不写字面字号） ───────────────────────────────────────── */
const SCALE = {
  micro: 10,   // 脚注 / 单位
  tiny:  11,   // 三级标签
  small: 13,   // 次级读数
  body:  15,   // 正文
  lead:  18,   // HUD 主数值
  title: 24,   // 面板标题
  hero:  34,   // 结算大数
};

/* ── 字重 ───────────────────────────────────────────────────────────────── */
const WEIGHT = { regular: 400, medium: 500, bold: 600 };

/* ── 时长（秒） ─────────────────────────────────────────────────────────── */
const TIME = {
  fast:   0.12,
  normal: 0.24,
  slow:   0.45,
  banner: 1.6,
};

/* ── 屏幕脉冲时长（秒）—— 拾取时的触发式反馈 ───────────────────────────────
   分两档是刻意的：
     · 触发式（回血 / 升级）是一次**事件**，没有后续状态，要给足时间看清发生了什么
     · 持续型 buff 的入场 sweep 只是"我拿到了"的起点提示，必须短 ——
       它后面还跟着常驻光带，太长会跟常驻态打架（看着像在闪而不是在持续） */
const PULSE = {
  heal:   0.62,
  level:  0.85,
  invuln: 0.48,
  boost:  0.38,
  rate:   0.38,
  shield: 0.38,
  _def:   0.45,
};

/* ── 缓动 ───────────────────────────────────────────────────────────────── */
const EASE = {
  outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
  inCubic:  function (t) { return t * t * t; },
  outQuint: function (t) { return 1 - Math.pow(1 - t, 5); },
  inOut:    function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
};

/* ── 工具 ───────────────────────────────────────────────────────────────── */

/* rgba(name, a) —— 取 token 的 rgb 拼 alpha。name 是 COLORS 的键。 */
function rgba(name, a) {
  const c = COLORS[name];
  if (!c) throw new Error('未知颜色 token: ' + name);
  return 'rgba(' + c.rgb[0] + ',' + c.rgb[1] + ',' + c.rgb[2] + ',' + a + ')';
}

/* hex(name) —— 取 token 的十六进制 */
function hex(name) {
  const c = COLORS[name];
  if (!c) throw new Error('未知颜色 token: ' + name);
  return c.hex;
}

/* mix(nameA, nameB, t) —— 两个 token 之间线性插值，返回 rgb 字符串 */
function mix(a, b, t) {
  const A = COLORS[a], B = COLORS[b];
  if (!A || !B) throw new Error('未知颜色 token');
  const r = Math.round(A.rgb[0] + (B.rgb[0] - A.rgb[0]) * t);
  const g = Math.round(A.rgb[1] + (B.rgb[1] - A.rgb[1]) * t);
  const bl = Math.round(A.rgb[2] + (B.rgb[2] - A.rgb[2]) * t);
  return 'rgb(' + r + ',' + g + ',' + bl + ')';
}

/* font(size, weight) —— 组装 canvas font 串，size 走 SCALE 阶梯 */
function font(scaleKey, weightKey, px) {
  const s = px != null ? px : (SCALE[scaleKey] || SCALE.body);
  const w = WEIGHT[weightKey || 'regular'];
  return w + ' ' + s + 'px sans-serif';
}

module.exports = {
  COLORS: COLORS, HULL_TINT: HULL_TINT,
  SCALE: SCALE, WEIGHT: WEIGHT, TIME: TIME, EASE: EASE, PULSE: PULSE,
  rgba: rgba, hex: hex, mix: mix, font: font,
};
})();
