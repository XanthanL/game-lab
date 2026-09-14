;(function () {
'use strict';
/* ============================================================================
   regions.js —— 区域（地图）数据层
   ----------------------------------------------------------------------------
   设计前提（作者拍板）：
     · 区域差异先做**轻**量级：换色调 + 换敌型池。地形要素与独立背景机制
       留到后面，先把「区域」这条骨架立起来。
     · 每个区域的最后一波是 Boss 波；Boss 倒下后奇点开启，玩家自己飞进去
       → 穿越 → 下一个区域。

   ⚠️ 区域与奇点三阶段是一一对应的（区域 1=外环 / 2=视界 / 3=核心），
      因为它们是**同一个奇点**在这个深度上的形态，不是三个不同的天体。
   ========================================================================== */

/* ⚠️ 每个区域的波数。原为 10，作者实测「玩到第 12 波还没见到可进入的奇点」，
   端到端量出第一个可进入的奇点在游戏内 233.6 秒 ≈ 3 分 54 秒 —— 微信小游戏
   单次会话典型 3–5 分钟，新玩家很可能玩不到就退出，永远见不到核心玩法。
   缩到 5 → 约 2 分钟就能钻进第一个奇点。
   ⚠️ 改这里必须同步改 singularity.js 的 STAGES[].from（两者是同一套划分），
      probe.cjs 有断言盯着，不同步会直接 FAIL。 */
const REGION_LEN = 5;

const REGIONS = [
  {
    id: 'debris', n: 1, zh: '外环碎屑带', en: 'DEBRIS BELT', from: 1,
    kinds: ['drift', 'shard'],
    boss: 'warden',
    note: '碎屑在引力边缘缓慢公转 —— 它还只是远处的一个异常',
    star: 'steel', starMul: 1.0, grid: 'line', gridStep: 46, gridA: 0.055,
    voidT: 'void', voidDeep: 'voidDeep',
    accent: 'cyan',
  },
  {
    id: 'veil', n: 2, zh: '中子星云', en: 'NEUTRON VEIL', from: 6,
    kinds: ['drift', 'shard', 'dart'],
    boss: 'warden',
    note: '星云稠密，视线被散射 —— 视界已经能灼伤船体',
    star: 'violet', starMul: 1.6, grid: 'violet', gridStep: 38, gridA: 0.07,
    voidT: 'void', voidDeep: 'voidDeep',
    accent: 'violet',
  },
  {
    id: 'sing', n: 3, zh: '深空奇点', en: 'SINGULARITY', from: 11,
    kinds: ['dart', 'orb', 'warden'],
    boss: 'warden',
    note: '这里就是它本身 —— 吸积盘在你脚下转动',
    star: 'singDisk', starMul: 0.65, grid: 'singHoriz', gridStep: 54, gridA: 0.085,
    voidT: 'voidDeep', voidDeep: 'voidDeep',
    accent: 'danger',
  },
];

/* 波次 → 区域下标（第 4 区域起循环回最后一个，并叠加无尽强化层） */
function regionIndex(w) {
  let i = 0;
  for (let k = 0; k < REGIONS.length; k++) if (w >= REGIONS[k].from) i = k;
  return i;
}
function regionOf(w) { return REGIONS[regionIndex(w)]; }

/* 无尽层：跑完 3 个区域之后，每再跑一轮 +1 层（血量/伤害/速度递增） */
function endlessTier(w) {
  const full = REGIONS.length * REGION_LEN;      // 30
  return Math.max(0, Math.floor((w - 1) / full));
}

/* 该波是不是这个区域的收尾 Boss 波 */
function isRegionFinal(w) { return w % REGION_LEN === 0; }

module.exports = {
  REGIONS: REGIONS, REGION_LEN: REGION_LEN,
  regionIndex: regionIndex, regionOf: regionOf,
  endlessTier: endlessTier, isRegionFinal: isRegionFinal,
};
})();
