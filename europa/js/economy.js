// 经济：账目明细、维护费、贷款、铸币、建筑、核心化、发展度。
//
// 之前只有一句 `treasury += income - expense`，玩家看不到钱从哪来、
// 也无处可花。现在每项收支都单独记进 c.ledger，UI 直接摊出来；
// 同时补上真正消耗金币的出口：建筑、造舰、补员、提升稳定度、贷款与铸币。

import { recalcCountries, bumpMap } from './world.js';
import { clamp } from './rng.js';
import { runTrade, autoMerchants, tradeIncomeOf, GOOD_VALUE } from './trade.js';
import { fleetMaint } from './navy.js';
import { supplyLimit } from './military.js';
import { estatesTick } from './estates.js';
import { cleanupExpiredAmbassadors } from './diplomacy.js';
import { updateMissionaries, triggerReformationEvent, randomConversion } from './religion.js';

export { GOOD_VALUE };

/* ─────────────── 建筑 ─────────────── */

export const BUILDINGS = {
  temple: { name: '神殿', cost: 100, time: 12, desc: '税收 +40%', mods: { tax: 0.4 } },
  workshop: { name: '工场', cost: 120, time: 12, desc: '生产 +40%', mods: { prod: 0.4 } },
  barracks: { name: '兵营', cost: 150, time: 12, desc: '人力 +50%', mods: { man: 0.5 } },
  marketplace: { name: '市场', cost: 120, time: 12, desc: '贸易实力 +60%', mods: {} },
  dock: { name: '船坞', cost: 180, time: 12, desc: '贸易实力 +35%，水手 +50%', mods: { sailor: 0.5 } },
  fort: { name: '要塞', cost: 200, time: 18, desc: '堡垒等级 +1，敌军进攻 -2', mods: {} },
  university: { name: '大学', cost: 300, time: 24, desc: '发展度花费 -20%', mods: { dev: -0.2 } },
};

export function buildCost(world, pid, type) {
  const c = world.countries.get(world.provinces.get(pid).owner);
  const mods = world.modsFor ? world.modsFor(c.tag) : null;
  const base = BUILDINGS[type]?.cost ?? 100;
  return Math.round(base * (1 + (mods?.buildCost || 0) / 100));
}

export function buildBuilding(world, pid, type) {
  const p = world.provinces.get(pid);
  if (!p || p.sea || !p.owner) return false;
  const c = world.countries.get(p.owner);
  if (!c) return false;
  if (p.buildings[type]) return false;
  const cost = buildCost(world, pid, type);
  if (c.treasury < cost) return false;
  c.treasury -= cost;
  p.buildings[type] = true;
  if (type === 'fort') p.fort = (p.fort || 0) + 1;
  recalcCountries(world);
  return true;
}

export function demolishBuilding(world, pid, type) {
  const p = world.provinces.get(pid);
  if (!p || !p.buildings[type]) return false;
  delete p.buildings[type];
  if (type === 'fort') p.fort = Math.max(0, (p.fort || 1) - 1);
  recalcCountries(world);
  return true;
}

/* ─────────────── 发展度 ─────────────── */

const DEV_COST_BASE = 50;

export function devCost(world, pid, kind) {
  const p = world.provinces.get(pid);
  const c = world.countries.get(p.owner);
  const mods = world.modsFor ? world.modsFor(c.tag) : null;
  const cur = kind === 'tax' ? p.baseTax : kind === 'prod' ? p.baseProduction : p.baseManpower;
  let cost = DEV_COST_BASE * (1 + (cur - 1) * 0.22);
  cost *= 1 + (mods?.devCost || 0) / 100;
  if (p.buildings && p.buildings.university) cost *= 0.8;
  if (p.terrain === 'farmlands') cost *= 0.95;
  if (p.terrain === 'mountains' || p.terrain === 'desert' || p.terrain === 'tundra') cost *= 1.15;
  return Math.round(cost);
}

const DEV_BRANCH = { tax: 'adm', prod: 'dip', man: 'mil' };
const DEV_KEY = { tax: 'baseTax', prod: 'baseProduction', man: 'baseManpower' };

export function developProvince(world, pid, kind) {
  const p = world.provinces.get(pid);
  if (!p || p.sea || !p.owner) return false;
  const c = world.countries.get(p.owner);
  const branch = DEV_BRANCH[kind];
  const cost = devCost(world, pid, kind);
  if (c.powers[branch] < cost) return false;
  c.powers[branch] -= cost;
  p[DEV_KEY[kind]] += 1;
  recalcCountries(world);
  if (world.invalidateMods) world.invalidateMods();
  return true;
}

/* ─────────────── 核心化 ─────────────── */

export function coreCost(world, tag, pid) {
  const p = world.provinces.get(pid);
  const c = world.countries.get(tag);
  const mods = world.modsFor ? world.modsFor(tag) : null;
  const dev = p.baseTax + p.baseProduction + p.baseManpower;
  return Math.max(3, Math.round(dev * 1.4 * (1 + (mods?.coreCost || 0) / 100)));
}

export function coreProvince(world, tag, pid) {
  const p = world.provinces.get(pid);
  const c = world.countries.get(tag);
  if (!p || p.sea || p.owner !== tag || p.cores.has(tag)) return false;
  const cost = coreCost(world, tag, pid);
  if (c.powers.adm < cost) return false;
  c.powers.adm -= cost;
  p.cores.add(tag);
  p.autonomy = Math.max(0, p.autonomy - 0.25);
  return true;
}

/* ─────────────── 财政操作 ─────────────── */

export function loanSize(c) {
  return Math.max(20, Math.round((c.development * 1.2 + c.provinceCount * 3) * (c.nationalBank ? 1.25 : 1)));
}

export function takeLoan(world, tag) {
  const c = world.countries.get(tag);
  const maxLoans = Math.max(3, Math.floor(c.development / 25) + 3);
  if (c.loans.length >= maxLoans) return false;
  const amt = loanSize(c);
  c.treasury += amt;
  c.loans.push({ amount: amt, rate: 0.04 + c.loans.length * 0.005 });
  c.inflation += 0.5;
  return true;
}

export function repayLoan(world, tag) {
  const c = world.countries.get(tag);
  if (!c.loans.length) return false;
  const l = c.loans[0];
  const need = Math.round(l.amount * 1.1);
  if (c.treasury < need) return false;
  c.treasury -= need;
  c.loans.shift();
  return true;
}

export function mintCoins(world, tag) {
  const c = world.countries.get(tag);
  const amt = Math.round(c.development * 0.35 + 8);
  c.treasury += amt;
  c.inflation += 0.35;
  return amt;
}

export function raiseStability(world, tag) {
  const c = world.countries.get(tag);
  if (c.stability >= 3) return false;
  const mods = world.modsFor ? world.modsFor(tag) : null;
  const cost = Math.round((100 + c.development * 0.4) * (1 + (mods?.stabilityCost || 0) / 100));
  if (c.powers.adm < cost) return false;
  c.powers.adm -= cost;
  c.stability = clamp(c.stability + 1, -3, 3);
  if (world.invalidateMods) world.invalidateMods();
  return true;
}

export function stabilityCost(world, tag) {
  const c = world.countries.get(tag);
  const mods = world.modsFor ? world.modsFor(tag) : null;
  return Math.round((100 + c.development * 0.4) * (1 + (mods?.stabilityCost || 0) / 100));
}

export function reduceWarExhaustion(world, tag) {
  const c = world.countries.get(tag);
  if (c.warExhaustion <= 0.05) return false;
  const cost = Math.round(30 + c.development * 0.25);
  if (c.powers.dip < cost) return false;
  c.powers.dip -= cost;
  c.warExhaustion = Math.max(0, c.warExhaustion - 2);
  if (world.invalidateMods) world.invalidateMods();
  return true;
}

/* ─────────────── 战争税与国家银行 ─────────────── */

export const BANK_GOLD = 300;
export const BANK_ADM = 100;

export function warTaxCooldownMonths(world, tag) {
  const c = world.countries.get(tag);
  if (!c) return 0;
  return Math.max(0, Math.ceil((96 - (world.stats.tick - c.lastWarTax)) / 4));
}

/** 战争税：一次性征 4 个月左右的税入，代价是厌战与冷却 */
export function levyWarTax(world, tag) {
  const c = world.countries.get(tag);
  if (!c) return { ok: false, why: '国家不存在' };
  const atWar = world.wars.some((w) => w.active && (w.attackers.has(tag) || w.defenders.has(tag)));
  if (!atWar) return { ok: false, why: '只有战时才能征收战争税' };
  const cd = warTaxCooldownMonths(world, tag);
  if (cd > 0) return { ok: false, why: `还需 ${cd} 个月才能再次征收` };
  const amt = Math.max(10, Math.round((c.stats.income || 5) * 4));
  c.treasury += amt;
  c.warExhaustion = Math.min(20, c.warExhaustion + 1.5);
  c.lastWarTax = world.stats.tick;
  return { ok: true, amount: amt };
}

export function foundNationalBank(world, tag) {
  const c = world.countries.get(tag);
  if (!c || c.nationalBank) return false;
  if (c.treasury < BANK_GOLD || c.powers.adm < BANK_ADM) return false;
  c.treasury -= BANK_GOLD;
  c.powers.adm -= BANK_ADM;
  c.nationalBank = true;
  if (world.invalidateMods) world.invalidateMods();
  return true;
}

/* ─────────────── 科技 ─────────────── */

const TECH_GROUP_MULT = { western: 1, eastern: 1.15, ottoman: 1.1, muslim: 1.2, nomad: 1.35 };

export function techCost(world, tag, branch) {
  const c = world.countries.get(tag);
  const mods = world.modsFor ? world.modsFor(tag) : null;
  const mult = TECH_GROUP_MULT[c.techGroup] || 1;
  // 领先时代要加价：跟同年科技相比越超前越贵
  const ahead = clamp(c.tech[branch] - (techYear(world) - 1444) / 12, 0, 6);
  const base = 600 * (1 + c.tech[branch] * 0.13) * mult * (1 + ahead * 0.1);
  return Math.round(base * (1 + (mods?.techCost || 0) / 100));
}

function techYear(world) { return world.date.y + world.date.m / 12; }

export function takeTech(world, tag, branch) {
  const c = world.countries.get(tag);
  const cost = techCost(world, tag, branch);
  if (c.powers[branch] < cost) return false;
  c.powers[branch] -= cost;
  c.tech[branch]++;
  if (world.invalidateMods) world.invalidateMods();
  return true;
}

/* ─────────────── 迁都 ─────────────── */

/** 迁都：100 行政点。首都城防提到 2 级，本土贸易节点跟着首都走。 */
export function moveCapital(world, tag, pid) {
  const c = world.countries.get(tag);
  const p = world.provinces.get(pid);
  if (!c || !p || p.sea) return { ok: false, why: '省份不存在' };
  if (p.owner !== tag) return { ok: false, why: '不是本国领土' };
  if (!p.cores.has(tag)) return { ok: false, why: '只能迁往核心省份' };
  if (p.controller !== tag) return { ok: false, why: '省份不在控制之下' };
  if (c.capital === pid) return { ok: false, why: '这里已经是首都' };
  if (c.powers.adm < 100) return { ok: false, why: '行政点数不足（需 100）' };
  const old = world.provinces.get(c.capital);
  if (old) old.capital = false;
  c.capital = pid;
  p.capital = true;
  p.fort = Math.max(p.fort || 0, 2);
  if (p.tradeNode) c.homeNode = p.tradeNode;
  c.powers.adm -= 100;
  c.prestige = clamp(c.prestige - 3, -100, 100);
  bumpMap(world);
  return { ok: true };
}

/* ─────────────── 月度结算 ─────────────── */

const led = (c) => {
  if (!c.ledger) {
    c.ledger = {
      tax: 0, production: 0, trade: 0, gold: 0,
      army: 0, navy: 0, fort: 0, interest: 0,
      subsidiesIn: 0, subsidiesOut: 0,
      income: 0, expense: 0, balance: 0,
    };
  }
  return c.ledger;
};

export function monthlyTick(world) {
  const d = world.date;
  d.m++;
  if (d.m > 12) { d.m = 1; d.y++; }

  if (world.invalidateMods) world.invalidateMods();
  // 阶级漂移（领地蚕食、忠诚、叛乱灾难）先跑，随后再失效一次修正缓存
  estatesTick(world);
  if (world.invalidateMods) world.invalidateMods();

  // 贸易先算，收入要用
  runTrade(world);

  for (const c of world.countries.values()) {
    if (world.trade.merchants.has(c.tag) && c.tag !== world.playerTag) autoMerchants(world, c.tag);
  }

  /* 补贴只做记账：实际的金币变动由下方 treasury += balance 统一结算，
     否则收款方会被重复入账。 */
  const received = new Map();   // tag -> 本月收到的补贴
  const paidOut = new Map();    // tag -> 本月付出的补贴
  for (const c of world.countries.values()) {
    for (const s of c.subsidiesOut) {
      if (s.months <= 0) continue;
      if (c.treasury < s.amount) { s.months = 0; continue; }   // 付不起即断供
      const rc = world.countries.get(s.to);
      if (!rc || rc.provinces.size === 0) { s.months = 0; continue; }
      received.set(s.to, (received.get(s.to) || 0) + s.amount);
      paidOut.set(c.tag, (paidOut.get(c.tag) || 0) + s.amount);
      s.months--;
    }
    c.subsidiesOut = c.subsidiesOut.filter((s) => s.months > 0);
  }

  for (const c of world.countries.values()) {
    const mods = world.modsFor ? world.modsFor(c.tag) : null;
    const L = led(c);
    for (const k in L) L[k] = 0;

    const atWar = world.wars.some((w) => w.active && (w.attackers.has(c.tag) || w.defenders.has(c.tag)));

    /* 收入 */
    let tax = 0, production = 0;
    for (const pid of c.provinces) {
      const p = world.provinces.get(pid);
      if (p.sea) continue;
      if (p.controller !== c.tag) continue;      // 被占领的省不计入
      const eff = (1 - p.autonomy * 0.5) * (1 - (p.devastation || 0) * 0.004);
      const b = p.buildings || {};
      tax += p.baseTax * eff * 0.105 * (1 + (b.temple ? 0.4 : 0)) * (1 + (mods.taxMod || 0) / 100);
      production += p.baseProduction * (GOOD_VALUE[p.tradeGood] || 3) * 0.048 * eff
        * (1 + (b.workshop ? 0.4 : 0)) * (1 + (mods.prodMod || 0) / 100);
      if (p.tradeGood === 'gold') production += p.baseProduction * 1.2;   // 金矿直接产钱
    }
    const trade = tradeIncomeOf(world, c.tag);
    L.tax = tax; L.production = production; L.trade = trade;
    L.subsidiesIn = received.get(c.tag) || 0;
    L.subsidiesOut = paidOut.get(c.tag) || 0;
    L.income = tax + production + trade + L.subsidiesIn;

    /* 支出 */
    const maintMult = atWar ? 2 : 1;
    let army = 0;
    for (const a of c.armies) {
      let m = a.size * 0.16;
      m += (a.comp?.cav || 0) * 0.10;      // 骑兵贵
      m += (a.comp?.art || 0) * 0.22;      // 炮兵最贵
      army += m * maintMult;
    }
    let navy = 0;
    for (const f of c.fleets) navy += fleetMaint(f) * maintMult;
    let fort = 0;
    for (const pid of c.provinces) {
      const p = world.provinces.get(pid);
      if (!p.sea && p.controller === c.tag) fort += p.fort * 1.6;
    }
    // 超上限惩罚
    const total = c.armies.reduce((s, a) => s + a.size, 0);
    if (total > c.forceLimit) army += (total - c.forceLimit) * 0.5;
    // 利息吃修正（低息特权、国家银行都能压低它）
    const intMod = 1 + clamp((mods.interestMod || 0) / 100, -0.8, 2);
    const interest = c.loans.reduce((s, l) => s + l.amount * l.rate / 12, 0) * intMod;

    L.army = army; L.navy = navy; L.fort = fort; L.interest = interest;
    L.expense = army + navy + fort + interest + L.subsidiesOut;
    L.balance = L.income - L.expense;

    c.stats.income = L.income;
    c.stats.expense = L.expense;
    c.treasury += L.balance;

    if (c.treasury < 0) {
      // 破产：强制裁军、通胀飙升、厌战暴涨
      c.inflation += 2;
      c.warExhaustion = Math.min(20, c.warExhaustion + 2);
      c.prestige = Math.max(-100, c.prestige - 8);
      for (const a of c.armies) {
        a.size = Math.max(1, Math.floor(a.size * 0.7));
        const k = 0.7;
        a.comp.inf = Math.max(0, Math.round(a.comp.inf * k));
        a.comp.cav = Math.max(0, Math.round(a.comp.cav * k));
        a.comp.art = Math.max(0, Math.round(a.comp.art * k));
      }
      c.treasury = 0;
      world.log.push(`${c.name} 国库见底，军队因欠饷溃散。`);
    }

    /* 人力与水手 */
    const mm = 1 + (mods.manpowerMod || 0) / 100;
    c.maxManpower = Math.max(200, Math.round(c.development * 55 * mm));
    c.manpower = clamp(c.manpower + c.maxManpower * 0.04, 0, c.maxManpower);
    const ms = 1 + (mods.sailorMod || 0) / 100;
    c.maxSailors = Math.max(100, Math.round(c.development * 8 * ms));
    c.sailors = clamp(c.sailors + c.maxSailors * 0.05, 0, c.maxSailors);

    /* 君主点数 */
    c.powers.adm = clamp(c.powers.adm + 3 + c.monarch.adm, 0, 9999);
    c.powers.dip = clamp(c.powers.dip + 3 + c.monarch.dip, 0, 9999);
    c.powers.mil = clamp(c.powers.mil + 3 + c.monarch.mil, 0, 9999);

    /* 状态衰减 */
    const decay = 1 + (mods.warExhaustDecay || 0) / 100;
    if (!atWar && c.warExhaustion > 0) c.warExhaustion = Math.max(0, c.warExhaustion - 0.12 * decay);
    if (c.legitimacy < 100) c.legitimacy = Math.min(100, c.legitimacy + 0.2);
    if (c.prestige > 0) c.prestige = Math.max(0, c.prestige - 0.1);
    if (c.prestige < 0) c.prestige = Math.min(0, c.prestige + 0.1);
    // 权力投射：挂着宿敌本身就是一种威望
    if (c.rivals.size) c.prestige = clamp(c.prestige + c.rivals.size * 0.1, -100, 100);
    // 首都沦陷的国政代价：厌战与威望双失
    const capP = c.capital != null ? world.provinces.get(c.capital) : null;
    if (capP && capP.controller !== c.tag) {
      c.warExhaustion = Math.min(20, c.warExhaustion + 0.15);
      c.prestige = clamp(c.prestige - 0.2, -100, 100);
    }
    if (c.inflation > 0 && c.treasury > 0) c.inflation = Math.max(0, c.inflation - (c.nationalBank ? 0.05 : 0.02));
    // 刀剑入库，马放南山：军事传统和平时期缓慢流失
    if (Number.isFinite(c.armyTradition)) c.armyTradition = Math.max(0, c.armyTradition - (atWar ? 0.05 : 0.18));

    /* 自治度缓慢下降；非核心、异文化异教、破坏度推高动荡 */
    for (const pid of c.provinces) {
      const p = world.provinces.get(pid);
      if (p.sea) continue;
      if (p.autonomy > 0) p.autonomy = Math.max(0, p.autonomy - 0.004);
      // 废墟缓慢复原；占领区的破坏只会更重
      p.devastation = Math.max(0, (p.devastation || 0) - (p.controller === c.tag ? 0.25 : 0.1));
      let unrest = (mods.unrest || 0) * 0.5;
      if (!p.cores.has(c.tag)) unrest += 2.5;
      if (c.crownland < 25) unrest += 0.8;    // 王室领地被吃空，地方势力坐大
      if (p.devastation > 0) unrest += p.devastation / 40;
      if (p.culture !== c.culture) unrest += 1.2;
      if (p.religion !== c.religion) unrest += 1.8;
      if (p.autonomy > 0.3) unrest -= p.autonomy * 1.5;
      p.unrest = Math.max(0, unrest + p.autonomy * 0.5);
      // 高动荡 → 叛军
      if (p.unrest > 7 && Math.random() < (p.unrest - 7) * 0.02) {
        spawnRebels(world, c, p);
      }
    }

    /* 士气恢复 */
    for (const a of c.armies) {
      a.maxMorale = 3 + c.tech.mil * 0.15 + (mods.landMorale || 0);
      const p = world.provinces.get(a.prov);
      const friendly = p && (p.owner === c.tag || p.controller === c.tag);
      const rate = friendly && !a.movement ? 0.45 : 0.12;
      a.morale = Math.min(a.maxMorale, a.morale + rate);
    }
    for (const f of c.fleets) {
      f.maxMorale = 3 + (mods.navalMorale || 0);
      f.morale = Math.min(f.maxMorale, f.morale + 0.4);
    }

    /* 补给损耗：超出省份供养能力的部队每月掉人，敌占区尤其残酷 */
    for (const a of c.armies) {
      const cap = supplyLimit(world, a.prov);
      if (a.size <= cap) continue;
      const lose = Math.max(1, Math.ceil((a.size - cap) * 0.08));
      const k = Math.max(0, a.size - lose) / a.size;
      a.size -= lose;
      a.comp.inf = Math.round(a.comp.inf * k);
      a.comp.cav = Math.round(a.comp.cav * k);
      a.comp.art = Math.round(a.comp.art * k);
      if (a.tag === world.playerTag && Math.random() < 0.35) {
        const p = world.provinces.get(a.prov);
        world.log.push(`部队在 ${p ? p.name : '?'} 因补给不足折损 ${lose} 千人（当地补给上限 ${cap} 千）。`);
      }
    }
    c.armies = c.armies.filter((a) => a.size >= 1);
  }

  // 清理过期使节
  cleanupExpiredAmbassadors(world);
  
  /* 宗教更新 */
  triggerReformationEvent(world, (msg) => world.log.push(msg));
  randomConversion(world, (msg) => world.log.push(msg));
  updateMissionaries(world, (msg) => world.log.push(msg));

  recalcCountries(world);
  return d;
}

/**
 * 叛军不放进 c.armies —— 放进去了会污染维护费、陆军上限，
 * 而且两支部队同 tag 时战斗判定会直接跳过。单独存 world.rebels，
 * 由 military.resolveRebels 专门处理。
 */
function spawnRebels(world, c, p) {
  if (world.rebels.some((r) => r.prov === p.id)) return;
  const dev = p.baseTax + p.baseProduction + p.baseManpower;
  const size = Math.max(1, Math.round(dev * 0.6));
  world.rebels.push({
    id: world.nextId++, home: c.tag, prov: p.id, size,
    morale: 2.5, maxMorale: 3, hold: 0, name: '叛军',
  });
  p.unrest = Math.max(0, p.unrest - 4);
  world.log.push(`${p.name} 爆发叛乱（${size} 千人）。`);
}
