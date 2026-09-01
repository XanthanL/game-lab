// 阶级系统：贵族、教士、市民、平民。
//
// 每个阶级有两条刻度：影响力（决定它从王室手里抢走多少领地与话语权）
// 和忠诚度（低到失控就会起兵逼宫）。王权领地（crownland）是全国一份
// 共享数值：领地多 → 税好兵足；领地被吃光 → 动荡、人力萎缩。
//
// 玩家可做的事：授予/收回特权（换忠诚、加影响、吃修正）、夺取领地
// （得罪所有阶级换回王室领地）、召开议会（安抚 + 小奖励）、出售头衔
// （拿钱换领地，市民乐意买）。
//
// 注意依赖方向：本模块不 import modifiers.js（modifiers 会 import 本模块
// 的 estateMods），estateMods 返回裸对象，由 addMods 按键合并。

import { clamp, makeRng } from './rng.js';

/* ─────────────── 阶级定义 ─────────────── */

export const ESTATES = {
  nobles: { name: '贵族', desc: '仗剑的领主。他们要的是领地、军职与免税。' },
  clergy: { name: '教士', desc: '祈祷的教团。他们要的是什一税与对信仰的发言权。' },
  burghers: { name: '市民', desc: '数钱的行会。他们要的是市镇自治与商业特许。' },
  commoners: { name: '平民', desc: '耕地的绝大多数。他们只求税别太重，别拉得太勤。' },
};

/** 各政体的开局阶级力量分布 */
const BASE_INFLUENCE = {
  monarchy: { nobles: 45, clergy: 35, burghers: 30, commoners: 25 },
  theocracy: { nobles: 25, clergy: 55, burghers: 25, commoners: 25 },
  republic: { nobles: 20, clergy: 20, burghers: 50, commoners: 30 },
  horde: { nobles: 60, clergy: 15, burghers: 10, commoners: 35 },
};

export function initEstates(world, c, rng) {
  const infl = { ...(BASE_INFLUENCE[c.gov] || BASE_INFLUENCE.monarchy) };
  for (const k in infl) infl[k] = clamp(infl[k] + rng.int(-5, 5), 5, 70);
  c.estates = {};
  for (const id in ESTATES) {
    c.estates[id] = { influence: infl[id], loyalty: clamp(50 + rng.int(-8, 8), 0, 100) };
  }
  // 王权领地：阶级总影响力越高，开局王室手里越少
  const sum = Object.values(infl).reduce((s, v) => s + v, 0);
  c.crownland = clamp(Math.round(100 - sum * 0.4), 25, 70);
  c.privileges = new Set();
  c.estateCd = { seize: -999, diet: -999 };
}

/* ─────────────── 特权 ─────────────── */

/*
  每条特权：给修正（mods，键对齐 modifiers.BASE）、+影响 +忠诚。
  收回特权：立即掉忠诚、掉影响，且 10 年内无法重新授予同一特权。
*/
export const PRIVILEGES = [
  // 贵族
  { id: 'nob_officers', estate: 'nobles', name: '贵族军官团', desc: '陆军士气 +10%，人力 +10%', mods: { landMorale: 0.1, manpowerMod: 10 }, inf: 8, loy: 12 },
  { id: 'nob_exempt', estate: 'nobles', name: '贵族免税权', desc: '税收 −10%，人力 +20%', mods: { taxMod: -10, manpowerMod: 20 }, inf: 10, loy: 15 },
  { id: 'nob_estates', estate: 'nobles', name: '世袭庄园', desc: '陆军上限 +15%，发展花费 +5%', mods: { forceLimitMod: 15, devCost: 5 }, inf: 10, loy: 12 },
  // 教士
  { id: 'clg_tithe', estate: 'clergy', name: '什一税', desc: '税收 +10%，动荡 +1', mods: { taxMod: 10, unrest: 1 }, inf: 8, loy: 12 },
  { id: 'clg_inquisition', estate: 'clergy', name: '宗教裁判所', desc: '动荡 −2，侵略扩张 +5%', mods: { unrest: -2, aeImpact: 5 }, inf: 8, loy: 12 },
  { id: 'clg_icons', estate: 'clergy', name: '圣像捐', desc: '稳定花费 −15%', mods: { stabilityCost: -15 }, inf: 6, loy: 10 },
  // 市民
  { id: 'bch_charter', estate: 'burghers', name: '市镇特许状', desc: '贸易效率 +10%，生产 +10%，税收 −5%', mods: { tradeEff: 10, prodMod: 10, taxMod: -5 }, inf: 8, loy: 12 },
  { id: 'bch_loans', estate: 'burghers', name: '低息借贷特权', desc: '利息 −25%', mods: { interestMod: -25 }, inf: 6, loy: 10 },
  { id: 'bch_monopoly', estate: 'burghers', name: '商业垄断', desc: '贸易力 +15%', mods: { tradePowerMod: 15 }, inf: 10, loy: 12 },
  // 平民
  { id: 'cmn_village', estate: 'commoners', name: '村社自治', desc: '动荡 −2，人力 +10%', mods: { unrest: -2, manpowerMod: 10 }, inf: 5, loy: 12 },
  { id: 'cmn_corvee', estate: 'commoners', name: '徭役征发', desc: '人力 +15%，动荡 +1.5，生产 −5%', mods: { manpowerMod: 15, unrest: 1.5, prodMod: -5 }, inf: 6, loy: 8 },
  { id: 'cmn_market', estate: 'commoners', name: '集市自由', desc: '生产 +10%，税收 +5%', mods: { prodMod: 10, taxMod: 5 }, inf: 5, loy: 10 },
];

export const PRIV_BY_ID = new Map(PRIVILEGES.map((p) => [p.id, p]));

export function privilegesOf(world, tag) {
  const c = world.countries.get(tag);
  return c ? [...c.privileges].map((id) => PRIV_BY_ID.get(id)).filter(Boolean) : [];
}

/** 授予特权。返回 {ok, why} */
export function grantPrivilege(world, tag, pid) {
  const c = world.countries.get(tag);
  const p = PRIV_BY_ID.get(pid);
  if (!c || !p) return { ok: false, why: '特权不存在' };
  if (c.privileges.has(pid)) return { ok: false, why: '已授予该特权' };
  const est = c.estates[p.estate];
  if (!est) return { ok: false, why: '阶级不存在' };
  if (c['privCooldown'] && c.privCooldown[pid] > world.stats.tick) {
    const months = Math.ceil((c.privCooldown[pid] - world.stats.tick) / 4);
    return { ok: false, why: `被收回的特权 ${months} 个月后才可重新授予` };
  }
  if (est.influence + p.inf > 80) return { ok: false, why: `${ESTATES[p.estate].name}的影响力将超过 80%，过于危险` };
  c.privileges.add(pid);
  est.influence = clamp(est.influence + p.inf, 0, 100);
  est.loyalty = clamp(est.loyalty + p.loy, 0, 100);
  if (world.invalidateMods) world.invalidateMods();
  return { ok: true };
}

export function revokePrivilege(world, tag, pid) {
  const c = world.countries.get(tag);
  const p = PRIV_BY_ID.get(pid);
  if (!c || !p || !c.privileges.has(pid)) return { ok: false, why: '并未授予该特权' };
  c.privileges.delete(pid);
  if (!c.privCooldown) c.privCooldown = {};
  c.privCooldown[pid] = world.stats.tick + 40;   // 10 年
  const est = c.estates[p.estate];
  if (est) {
    est.influence = clamp(est.influence - p.inf * 0.6, 0, 100);
    est.loyalty = clamp(est.loyalty - 20, 0, 100);
  }
  if (world.invalidateMods) world.invalidateMods();
  return { ok: true };
}

/* ─────────────── 王室行动 ─────────────── */

const SEIZE_CD = 96;   // 24 年太长；24 个月 = 96 tick
const DIET_CD = 96;

/** 夺取领地：王室领地 +5，所有阶级忠诚 −10 */
export function seizeLand(world, tag) {
  const c = world.countries.get(tag);
  if (!c) return { ok: false, why: '国家不存在' };
  if (world.stats.tick - c.estateCd.seize < SEIZE_CD) {
    return { ok: false, why: `还需要 ${Math.ceil((SEIZE_CD - (world.stats.tick - c.estateCd.seize)) / 4)} 个月才能再次行动` };
  }
  if (c.crownland >= 65) return { ok: false, why: '王权领地份额已经足够高' };
  c.crownland = clamp(c.crownland + 5, 0, 100);
  for (const id in c.estates) c.estates[id].loyalty = clamp(c.estates[id].loyalty - 10, 0, 100);
  c.estateCd.seize = world.stats.tick;
  if (world.invalidateMods) world.invalidateMods();
  return { ok: true };
}

/** 召开议会：随机一个阶级忠诚 +12，王室得点好处 */
export function summonDiet(world, tag, rng) {
  const c = world.countries.get(tag);
  if (!c) return { ok: false, why: '国家不存在' };
  if (world.stats.tick - c.estateCd.diet < DIET_CD) {
    return { ok: false, why: `还需要 ${Math.ceil((DIET_CD - (world.stats.tick - c.estateCd.diet)) / 4)} 个月才能再次召开` };
  }
  const ids = Object.keys(ESTATES);
  const pick = ids[rng.int(0, ids.length - 1)];
  const est = c.estates[pick];
  est.loyalty = clamp(est.loyalty + 12, 0, 100);
  est.influence = clamp(est.influence + 4, 0, 100);
  c.estateCd.diet = world.stats.tick;
  // 议会总得办点事：钱、点数或稳定度
  const roll = rng.int(0, 2);
  if (roll === 0) {
    const amt = Math.round(20 + c.development * 0.5);
    c.treasury += amt;
    return { ok: true, estate: pick, reward: `国库进账 ${amt} 金币` };
  }
  if (roll === 1) {
    const br = rng.pick(['adm', 'dip', 'mil']);
    c.powers[br] += 60;
    return { ok: true, estate: pick, reward: `获得 60 ${br.toUpperCase()} 点数` };
  }
  c.prestige = clamp(c.prestige + 5, -100, 100);
  return { ok: true, estate: pick, reward: '威望 +5' };
}

/** 出售头衔：领地 −5 换一笔现金，市民高兴 */
export function sellTitles(world, tag) {
  const c = world.countries.get(tag);
  if (!c) return { ok: false, why: '国家不存在' };
  if (c.crownland < 30) return { ok: false, why: '王室领地太少，不能再卖了' };
  const amt = Math.round(30 + c.development * 0.9);
  c.crownland = clamp(c.crownland - 5, 0, 100);
  c.treasury += amt;
  const b = c.estates.burghers;
  if (b) { b.loyalty = clamp(b.loyalty + 8, 0, 100); b.influence = clamp(b.influence + 5, 0, 100); }
  if (world.invalidateMods) world.invalidateMods();
  return { ok: true, amount: amt };
}

/* ─────────────── 修正值 ─────────────── */

/**
 * 阶级对国政的影响，供 modifiers.modsFor 合并。
 *  · 已授特权的修正
 *  · 影响力带来的阶层利益（贵族强 → 军贵；市民强 → 商盛）
 *  · 忠诚度低带来的报复（怠工、抗税、民变）
 */
export function estateMods(c) {
  const m = {};
  const add = (k, v) => { if (k in m) m[k] += v; else m[k] = v; };
  if (!c || !c.estates) return m;

  for (const pid of c.privileges || []) {
    const p = PRIV_BY_ID.get(pid);
    if (!p) continue;
    for (const k in p.mods) add(k, p.mods[k]);
  }

  const e = c.estates;
  // 影响力：阶层坐大各取所长
  add('forceLimitMod', (e.nobles.influence - 30) * 0.12);
  add('stabilityCost', (e.clergy.influence - 30) * -0.2);
  add('tradeEff', (e.burghers.influence - 30) * 0.15);
  add('taxMod', (e.commoners.influence - 30) * -0.1);

  // 忠诚度：低于 40 开始怠工
  const grudge = (v) => clamp((40 - v), 0, 40);
  const nG = grudge(e.nobles.loyalty), cG = grudge(e.clergy.loyalty);
  const bG = grudge(e.burghers.loyalty), pG = grudge(e.commoners.loyalty);
  if (nG > 0) { add('landMorale', -nG * 0.004); add('manpowerMod', -nG * 0.25); }
  if (cG > 0) { add('stabilityCost', cG * 0.5); add('unrest', cG * 0.03); }
  if (bG > 0) { add('tradeEff', -bG * 0.2); add('tradePowerMod', -bG * 0.2); }
  if (pG > 0) { add('taxMod', -pG * 0.12); add('manpowerMod', -pG * 0.2); }

  // 低忠诚 + 高影响 = 内战边缘，再加一层动荡
  for (const id in e) {
    if (e[id].loyalty < 35 && e[id].influence > 55) add('unrest', 1.5);
  }
  return m;
}

/* ─────────────── 月度结算 ─────────────── */

/**
 * 每月一次（由 economy.monthlyTick 调用）：
 *  · 影响力 ≥ 40 的阶级按超出量蚕食王室领地
 *  · 没有特权的阶级忠诚缓慢流失；领地充足时全体回忠
 *  · 忠诚 < 30 且影响 > 50 → 有概率掀桌子：叛军 + 抢领地 + 掉稳定
 */
export function estatesTick(world) {
  const rng = makeRng(world.seed + '/estate/' + world.stats.tick);
  const out = [];
  for (const c of world.countries.values()) {
    if (!c.estates || c.provinces.size === 0) continue;

    // 1) 领地蚕食：影响力超出的部分慢慢吃进王室领地
    let grab = 0;
    for (const id in c.estates) {
      const over = c.estates[id].influence - 40;
      if (over > 0) grab += over * 0.008;
    }
    if (grab > 0 && c.crownland > 15) c.crownland = clamp(c.crownland - grab, 0, 100);
    // 王权触底回升：行政机器总会一点点收回失地，聊胜于无
    else if (c.crownland < 20) c.crownland = clamp(c.crownland + 0.03, 0, 100);

    // 2) 忠诚漂移
    for (const id in c.estates) {
      const est = c.estates[id];
      const hasPriv = [...c.privileges].some((pid) => PRIV_BY_ID.get(pid)?.estate === id);
      if (hasPriv) est.loyalty = clamp(est.loyalty + 0.1, 0, 100);
      else est.loyalty = clamp(est.loyalty - 0.18, 0, 100);
      if (c.crownland > 60) est.loyalty = clamp(est.loyalty + 0.08, 0, 100);
      else if (c.crownland < 25) est.loyalty = clamp(est.loyalty - 0.1, 0, 100);
    }

    // 3) 灾难：忠诚崩坏的阶级起兵
    for (const id in c.estates) {
      const est = c.estates[id];
      if (est.loyalty >= 30 || est.influence < 50) continue;
      if (!rng.chance(0.08)) continue;
      const provs = [...c.provinces].map((pid) => world.provinces.get(pid))
        .filter((p) => p && !p.sea && p.owner === c.tag && p.controller === c.tag)
        .sort((a, b) => (b.baseTax + b.baseProduction + b.baseManpower) - (a.baseTax + a.baseProduction + a.baseManpower));
      const p = provs[0];
      if (p) {
        const dev = p.baseTax + p.baseProduction + p.baseManpower;
        world.rebels.push({
          id: world.nextId++, home: c.tag, prov: p.id,
          size: Math.max(2, Math.round(dev * (0.8 + est.influence / 100))),
          morale: 2.5, maxMorale: 3, hold: 0,
          name: `${ESTATES[id].name}叛军`,
        });
      }
      est.loyalty = 45;
      est.influence = clamp(est.influence - 10, 0, 100);
      c.crownland = clamp(c.crownland - 4, 0, 100);
      c.stability = clamp(c.stability - 1, -3, 3);
      const name = ESTATES[id].name;
      world.log.push(`${c.name} 的${name}揭竿而起：领地被强行瓜分，稳定度下降。`);
      out.push({ tag: c.tag, estate: id, pid: p ? p.id : -1 });
    }
  }
  return out;
}
