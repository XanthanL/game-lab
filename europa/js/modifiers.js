// 全国统一修正值（modifier）聚合层。
//
// 之前各系统各自去翻 ideas / tech / stability，加成散落一地，
// 想加一条「+10% 税收」得改三个文件。现在所有加成归一成这一张表：
// 经济、军事、外交、UI 全部只读 modsFor(world, tag)。
//
// 约定：
//   · 百分比类字段一律「点数制」，10 表示 +10%，-10 表示 -10%。
//   · 绝对值类（landMorale / navalMorale）直接相加。
//   · 结果按 tag + 月份缓存，每月初失效一次。

import { ideaMods, policyMods } from './ideas.js';
import { estateMods } from './estates.js';

const BASE = {
  // 经济
  taxMod: 0, prodMod: 0, tradeEff: 0, tradeSteer: 0, tradePowerMod: 0,
  buildCost: 0, devCost: 0, coreCost: 0,
  // 人力与上限
  manpowerMod: 0, sailorMod: 0, forceLimitMod: 0, navalLimitMod: 0,
  // 军事
  landMorale: 0, navalMorale: 0, discipline: 0, combatAbility: 0,
  siegeAbility: 0, fortDefense: 0, supplyLimitMod: 0,
  // 点数花费（负数是好事）
  techCost: 0, ideaCost: 0, stabilityCost: 0, wsCost: 0,
  // 金融
  interestMod: 0,
  // 外交
  aeImpact: 0, improveRelations: 0, merchants: 0,
  // 内政
  unrest: 0, warExhaustDecay: 0,
};

export function newMods() { return { ...BASE }; }

export function addMods(target, src) {
  if (!src) return target;
  for (const k in src) if (k in target) target[k] += src[k];
  return target;
}

/** 理念/科技/稳定度变动后调用，让缓存失效 */
export function invalidateMods(world) {
  world._modCache = new Map();
}

export function modsFor(world, tag) {
  if (!world._modCache) world._modCache = new Map();
  const hit = world._modCache.get(tag);
  if (hit) return hit;

  const m = newMods();
  const c = world.countries.get(tag);
  if (c) {
    addMods(m, ideaMods(c));
    addMods(m, policyMods(c));
    addMods(m, estateMods(c));

    // 科技：三条线各自给一点实在的收益，别让玩家觉得点数白花
    m.taxMod += c.tech.adm * 0.8;
    m.prodMod += c.tech.adm * 0.6;
    m.buildCost -= c.tech.adm * 0.5;
    m.coreCost -= c.tech.adm * 0.6;

    m.tradeEff += c.tech.dip * 1.2;
    m.navalMorale += c.tech.dip * 0.02;
    m.improveRelations += c.tech.dip * 0.8;

    m.discipline += c.tech.mil * 0.7;
    m.landMorale += c.tech.mil * 0.03;
    m.siegeAbility += c.tech.mil * 1.0;

    // 内政状态
    m.taxMod += c.stability * 3;
    m.prodMod += c.stability * 2;
    m.manpowerMod += c.stability * 2;
    m.unrest -= c.stability * 0.6;

    m.tradeEff += c.prestige * 0.06;
    m.landMorale += c.prestige * 0.004;

    m.unrest += c.warExhaustion * 0.35;
    m.manpowerMod -= c.warExhaustion * 1.6;
    m.taxMod -= c.warExhaustion * 1.6;
    m.prodMod -= c.warExhaustion * 1.6;

    m.buildCost += c.inflation * 1.2;
    m.techCost += c.inflation * 1.0;
    m.devCost += c.inflation * 0.8;

    m.unrest += (80 - c.legitimacy) * 0.02;
    m.manpowerMod += (c.legitimacy - 80) * 0.1;

    // 权力投射：每个宿敌 +3% 人力（威望收益在月度经济里结算）
    if (c.rivals && c.rivals.size) m.manpowerMod += c.rivals.size * 3;

    // 王室领地份额：领地多 → 税好、兵足；被贵族吃得太狠 → 全面萎缩
    if (Number.isFinite(c.crownland)) {
      const cl = c.crownland - 50;
      m.taxMod += cl * 0.15;
      m.manpowerMod += cl * 0.12;
      if (cl < 0) m.unrest -= cl * 0.08;   // 领地流失，地方坐大
    }

    // 军事传统：老兵带新兵，纪律与士气随传统水涨船高
    if (Number.isFinite(c.armyTradition)) {
      m.discipline += c.armyTradition * 0.03;      // 100 传统 = +3 纪律
      m.landMorale += c.armyTradition * 0.002;     // 100 传统 = +0.2 士气
    }

    // 国家银行：利息更轻，铸币更克制
    if (c.nationalBank) {
      m.interestMod -= 30;
      m.techCost -= 2;
    }
  }

  world._modCache.set(tag, m);
  return m;
}

/** UI 用：把修正值渲染成一行人话 */
export function describeMods(m, keys) {
  const out = [];
  for (const [key, label, suffix] of keys) {
    const v = m[key] || 0;
    if (Math.abs(v) < 0.01) continue;
    const sign = v > 0 ? '+' : '';
    out.push(`${label} ${sign}${Math.round(v * 100) / 100}${suffix}`);
  }
  return out;
}
