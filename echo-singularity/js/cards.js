;(function () {
'use strict';
/* ============================================================================
   cards.js —— 强化卡池（内容数据）
   ----------------------------------------------------------------------------
   为什么单独成文件：它原先寄放在 ui.js，但战斗逻辑（拾取物白送一张）也要用。
   如果让 combat.js 去 require ui.js，就变成「逻辑层依赖渲染层」，
   而且 H5 预览的脚本加载顺序会被迫把 ui 排到 combat 前面 —— 非常脆弱。
   卡池是**内容数据**，不属于任何一层，独立出来是它本来的位置。
   Stage 3 做「工坊式卡池（稀有度 / 协同流派）」时，扩展点也在这里。
   ========================================================================== */

const CARDS = [
  { id: 'atk',     zh: '膛线校准', en: 'RIFLING',   desc: '伤害 +18%' },
  { id: 'rate',    zh: '冷却回路', en: 'CYCLER',    desc: '射速 +14%' },
  { id: 'spd',     zh: '推进喷口', en: 'THRUSTER',  desc: '极速 +8% · 加速 +6%' },
  { id: 'armor',   zh: '装甲板',   en: 'PLATING',   desc: '船体 +16%，并回复等量' },
  { id: 'magnet',  zh: '牵引场',   en: 'MAGNET',    desc: '拾取 +35%' },
  { id: 'synergy', zh: '协同',     en: 'SYNERGY',   desc: '奇点被压得更致密：半径↓ 引力↑ 吸积盘更亮' },
];

/* 按 id 取 —— 别再用下标（UI.CARDS[5] 这种写法加一张卡就错位） */
function byId(id) {
  for (let i = 0; i < CARDS.length; i++) if (CARDS[i].id === id) return CARDS[i];
  return null;
}

module.exports = { CARDS: CARDS, byId: byId };
})();
