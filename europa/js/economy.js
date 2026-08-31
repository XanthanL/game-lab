// 经济系统：月度收入、支出、人力、君主点数、科技、理念
import { recalcCountries } from './world.js';
import { clamp } from './rng.js';

export const GOOD_VALUE = {
  grain: 2, wine: 4, wool: 3, cloth: 6, fish: 2.5, salt: 3.5, iron: 4, gold: 8, copper: 3.5,
  lumber: 2.5, fur: 4, horses: 3.5, cotton: 3, spices: 7, silk: 7,
};

export function monthlyTick(world) {
  // 日期推进
  const d = world.date;
  d.m++;
  if (d.m > 12) { d.m = 1; d.y++; }

  // 人力恢复
  for (const c of world.countries.values()) {
    c.maxManpower = Math.max(100, Math.round(c.development * 25));
    c.manpower = clamp(c.manpower + c.maxManpower * 0.05, 0, c.maxManpower);
  }

  // 君主点数
  for (const c of world.countries.values()) {
    const base = 3 + c.monarch.adm;
    c.powers.adm = clamp(c.powers.adm + base, 0, 9999);
    c.powers.dip = clamp(c.powers.dip + 3 + c.monarch.dip, 0, 9999);
    c.powers.mil = clamp(c.powers.mil + 3 + c.monarch.mil, 0, 9999);
  }

  // 收入与支出
  for (const c of world.countries.values()) {
    let tax = 0, production = 0, trade = 0;
    let provCount = 0, coastal = 0, fortCost = 0;
    const atWar = world.wars.some((w) => w.active && (w.attackers.has(c.tag) || w.defenders.has(c.tag)));
    for (const pid of c.provinces) {
      const p = world.provinces.get(pid);
      if (p.sea) continue;
      provCount++;
      if (p.coastal) coastal++;
      fortCost += p.fort * 0.8;
      // 被占领的省不计入收入
      if (p.controller !== c.tag) continue;
      const eff = 1 - p.autonomy * 0.5;
      tax += p.baseTax * eff * 0.12;
      production += p.baseProduction * (GOOD_VALUE[p.tradeGood] || 3) * 0.05 * eff;
    }
    trade = coastal * 0.25 + provCount * 0.06;
    c.stats.income = tax + production + trade;

    // 维护费：战时翻倍
    const maintMult = atWar ? 2 : 1;
    const armyMaint = c.armies.reduce((s, a) => s + a.size * 0.12, 0) * maintMult;
    const navyMaint = c.fleets.reduce((s, f) => s + f.size * 0.12, 0) * maintMult;
    c.stats.expense = armyMaint + navyMaint + fortCost;
    c.treasury += c.stats.income - c.stats.expense;
    if (c.treasury < 0) {
      // 破产：强制裁军 + 厌战飙升
      c.inflation += 1;
      c.warExhaustion = Math.min(20, c.warExhaustion + 1);
      for (const a of c.armies) a.size = Math.max(1, Math.floor(a.size * 0.7));
      c.treasury = 0;
    }

    // 稳定/厌战衰减
    if (!atWar && c.warExhaustion > 0) c.warExhaustion = Math.max(0, c.warExhaustion - 0.15);
    if (c.legitimacy < 100) c.legitimacy = Math.min(100, c.legitimacy + 0.2);
    if (c.prestige > 0) c.prestige = Math.max(0, c.prestige - 0.1);
    if (c.prestige < 0) c.prestige = Math.min(0, c.prestige + 0.1);

    // 士气恢复：驻扎在己方省份恢复更快
    for (const a of c.armies) {
      a.maxMorale = 3 + c.tech.mil * 0.15 + c.prestige * 0.01;
      const p = world.provinces.get(a.prov);
      const friendly = p && (p.owner === c.tag || p.controller === c.tag);
      const rate = friendly && !a.movement ? c.maxManpower > 0 ? 0.45 : 0.2 : 0.12;
      a.morale = Math.min(a.maxMorale, a.morale + rate);
    }
  }

  recalcCountries(world);
  return d;
}

export function takeTech(world, tag, branch) {
  const c = world.countries.get(tag);
  const baseCost = 600;
  const mult = { western: 1, eastern: 1.15, ottoman: 1.1, muslim: 1.2, nomad: 1.35 }[c.techGroup] || 1;
  const cost = Math.round(baseCost * (1 + c.tech[branch] * 0.15) * mult);
  if (c.powers[branch] < cost) return false;
  c.powers[branch] -= cost;
  c.tech[branch]++;
  return true;
}

export function buildBuilding(world, pid, type) {
  const p = world.provinces.get(pid);
  const c = world.countries.get(p.owner);
  const costs = { temple: 100, workshop: 120, barracks: 150, shipyard: 180, fort: 200 };
  if (p.buildings[type]) return false;
  if (c.treasury < costs[type]) return false;
  c.treasury -= costs[type];
  p.buildings[type] = true;
  if (type === 'fort') p.fort = Math.max(p.fort, 1);
  return true;
}
