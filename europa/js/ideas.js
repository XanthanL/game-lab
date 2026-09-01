// 理念系统：12 个理念组，每组 7 条理念 + 1 条完成奖励。
//
// 花费该组对应类型的君主点数（行政/外交/军事），一条 400 点起。
// 能同时开几组由行政科技决定——这是 EU4 的核心节奏阀门，
// 玩家必须在「早点数组拿加成」和「留点数冲科技」之间做取舍。

import { newMods, addMods } from './modifiers.js';

export const IDEA_COST = 400;
const IDEAS_PER_GROUP = 7;

/*
  mods 字段与 modifiers.js 的 BASE 对齐。
  百分比类按「点数」写：10 = +10%。
*/
export const IDEA_GROUPS = [
  /* ─────────── 行政 ─────────── */
  {
    id: 'administrative', branch: 'adm', name: '行政理念',
    desc: '把国家机器拧成一股绳：更便宜的核心化、更高的行政效率。',
    ideas: [
      { name: '官僚制度', mods: { coreCost: -25 } },
      { name: '组织化政府', mods: { taxMod: 10 } },
      { name: '行政改革', mods: { ideaCost: -10 } },
      { name: '法制统一', mods: { unrest: -1 } },
      { name: '文官选拔', mods: { techCost: -5 } },
      { name: '中央集权', mods: { taxMod: 10 } },
      { name: '行政效率', mods: { coreCost: -25 } },
    ],
    bonus: { name: '完成：行政国家', mods: { coreCost: -25, ideaCost: -10 } },
  },
  {
    id: 'economic', branch: 'adm', name: '经济理念',
    desc: '税制、行会与基础建设。想靠内政滚雪球就选它。',
    ideas: [
      { name: '农业改革', mods: { taxMod: 10 } },
      { name: '手工业行会', mods: { prodMod: 10 } },
      { name: '铸币改革', mods: { buildCost: -10 } },
      { name: '基础设施建设', mods: { buildCost: -10 } },
      { name: '度量衡统一', mods: { taxMod: 10 } },
      { name: '自由市场', mods: { devCost: -10 } },
      { name: '国库管理', mods: { taxMod: 10 } },
    ],
    bonus: { name: '完成：重商财政', mods: { buildCost: -20, devCost: -10 } },
  },
  {
    id: 'innovative', branch: 'adm', name: '创新理念',
    desc: '思潮、教育与宽容。科技走得更远，厌战消得更快。',
    ideas: [
      { name: '文艺复兴思潮', mods: { techCost: -5 } },
      { name: '学术赞助', mods: { ideaCost: -10 } },
      { name: '印刷术', mods: { warExhaustDecay: 25 } },
      { name: '科学革命', mods: { techCost: -5 } },
      { name: '教育改革', mods: { techCost: -5 } },
      { name: '宽容政策', mods: { unrest: -2 } },
      { name: '专利制度', mods: { prodMod: 10 } },
    ],
    bonus: { name: '完成：启蒙图家', mods: { techCost: -10, warExhaustDecay: 25 } },
  },
  {
    id: 'religious', branch: 'adm', name: '宗教理念',
    desc: '信仰即秩序：稳定、正统，以及征服异教徒时的舆论折扣。',
    ideas: [
      { name: '教会改革', mods: { stabilityCost: -25 } },
      { name: '正统信仰', mods: { unrest: -2 } },
      { name: '宗教法庭', mods: { unrest: -1.5 } },
      { name: '圣战号召', mods: { aeImpact: -10 } },
      { name: '什一税', mods: { taxMod: 10 } },
      { name: '教权至上', mods: { stabilityCost: -25 } },
      { name: '神圣同盟', mods: { landMorale: 0.25 } },
    ],
    bonus: { name: '完成：信仰守护者', mods: { aeImpact: -15, unrest: -1 } },
  },

  /* ─────────── 外交 ─────────── */
  {
    id: 'trade', branch: 'dip', name: '贸易理念',
    desc: '商人、商站与航线。配合贸易节点系统是中后期的主要财源。',
    ideas: [
      { name: '商人行会', mods: { merchants: 1 } },
      { name: '贸易站', mods: { tradeEff: 10 } },
      { name: '远洋贸易', mods: { tradeSteer: 15 } },
      { name: '汇率制度', mods: { tradeEff: 10 } },
      { name: '商业舰队', mods: { navalLimitMod: 10, tradeEff: 5 } },
      { name: '商品流通', mods: { prodMod: 10 } },
      { name: '垄断特许', mods: { tradeEff: 10 } },
    ],
    bonus: { name: '完成：全球贸易网', mods: { merchants: 1, tradeEff: 10 } },
  },
  {
    id: 'diplomatic', branch: 'dip', name: '外交理念',
    desc: '关系恢复更快，割地激起的风评更小，谈判桌上更从容。',
    ideas: [
      { name: '常驻使节', mods: { improveRelations: 25 } },
      { name: '外交文书', mods: { aeImpact: -10 } },
      { name: '秘密外交', mods: { wsCost: -10 } },
      { name: '王室联姻', mods: { improveRelations: 25 } },
      { name: '调停者', mods: { warExhaustDecay: 20 } },
      { name: '外交豁免', mods: { aeImpact: -10 } },
      { name: '国际信誉', mods: { improveRelations: 25 } },
    ],
    bonus: { name: '完成：欧洲仲裁者', mods: { improveRelations: 25, wsCost: -10 } },
  },
  {
    id: 'maritime', branch: 'dip', name: '海事理念',
    desc: '舰队、水手与制海权。想打跨海战争就必须走这条路。',
    ideas: [
      { name: '造船术', mods: { navalLimitMod: 15 } },
      { name: '海洋传统', mods: { sailorMod: 20 } },
      { name: '舰队操典', mods: { navalMorale: 0.25 } },
      { name: '海上补给', mods: { siegeAbility: 10 } },
      { name: '领航术', mods: { tradeSteer: 10 } },
      { name: '私掠许可', mods: { tradeEff: 10 } },
      { name: '制海权', mods: { navalMorale: 0.25 } },
    ],
    bonus: { name: '完成：海上霸主', mods: { navalLimitMod: 20, navalMorale: 0.25 } },
  },
  {
    id: 'influence', branch: 'dip', name: '影响理念',
    desc: '把签下的条约压出更多价值：更低的核心化代价、更温和的风评。',
    ideas: [
      { name: '朝贡体系', mods: { manpowerMod: 10 } },
      { name: '高效官僚', mods: { coreCost: -10 } },
      { name: '势力范围', mods: { aeImpact: -10 } },
      { name: '保护国', mods: { wsCost: -10 } },
      { name: '威慑外交', mods: { improveRelations: 15 } },
      { name: '宫廷礼仪', mods: { unrest: -1 } },
      { name: '宗藩动员', mods: { manpowerMod: 10 } },
    ],
    bonus: { name: '完成：欧陆均势', mods: { aeImpact: -10, coreCost: -10 } },
  },

  /* ─────────── 军事 ─────────── */
  {
    id: 'offensive', branch: 'mil', name: '进攻理念',
    desc: '士气、围城与冲击力。主动开战的国家拿这组。',
    ideas: [
      { name: '现代军制', mods: { landMorale: 0.25 } },
      { name: '攻城战术', mods: { siegeAbility: 15 } },
      { name: '精锐军官', mods: { discipline: 5 } },
      { name: '先锋突击', mods: { combatAbility: 10 } },
      { name: '集中兵力', mods: { forceLimitMod: 10 } },
      { name: '野战工事', mods: { siegeAbility: 15 } },
      { name: '军功爵制', mods: { manpowerMod: 10 } },
    ],
    bonus: { name: '完成：常胜之师', mods: { discipline: 5, siegeAbility: 15 } },
  },
  {
    id: 'defensive', branch: 'mil', name: '防御理念',
    desc: '要塞、纵深与国民士气。适合体量小、要挨打的国家。',
    ideas: [
      { name: '边防要塞', mods: { fortDefense: 15 } },
      { name: '民兵征召', mods: { manpowerMod: 15 } },
      { name: '纵深防御', mods: { combatAbility: 10 } },
      { name: '常备军', mods: { landMorale: 0.25 } },
      { name: '地形利用', mods: { fortDefense: 10 } },
      { name: '坚壁清野', mods: { fortDefense: 15 } },
      { name: '国民士气', mods: { landMorale: 0.25 } },
    ],
    bonus: { name: '完成：铁壁', mods: { landMorale: 0.25, fortDefense: 20 } },
  },
  {
    id: 'quality', branch: 'mil', name: '质量理念',
    desc: '纪律与装备。兵不多，但每一千人都更难打发。',
    ideas: [
      { name: '职业军队', mods: { discipline: 5 } },
      { name: '武器改良', mods: { combatAbility: 10 } },
      { name: '军校制度', mods: { discipline: 5 } },
      { name: '精制铠甲', mods: { combatAbility: 10 } },
      { name: '火力优势', mods: { combatAbility: 10 } },
      { name: '精锐部队', mods: { discipline: 5 } },
      { name: '军备标准化', mods: { combatAbility: 10 } },
    ],
    bonus: { name: '完成：钢铁纪律', mods: { discipline: 5, combatAbility: 10 } },
  },
  {
    id: 'quantity', branch: 'mil', name: '数量理念',
    desc: '人力池与陆军上限。地大人多的国家滚起来最省心。',
    ideas: [
      { name: '征兵制', mods: { manpowerMod: 20 } },
      { name: '后备军', mods: { manpowerMod: 15 } },
      { name: '军需改革', mods: { forceLimitMod: 15 } },
      { name: '人口普查', mods: { manpowerMod: 15 } },
      { name: '廉价装备', mods: { forceLimitMod: 15 } },
      { name: '快速动员', mods: { manpowerMod: 10 } },
      { name: '战时经济', mods: { forceLimitMod: 15 } },
    ],
    bonus: { name: '完成：人海', mods: { manpowerMod: 25, forceLimitMod: 20 } },
  },
];

export const GROUP_BY_ID = new Map(IDEA_GROUPS.map((g) => [g.id, g]));

/** 行政科技决定能同时开几组：adm 4 开第一组，之后每 3 级多一组 */
export function maxGroups(c) {
  if (c.tech.adm < 4) return 0;
  return Math.min(8, 1 + Math.floor((c.tech.adm - 4) / 3));
}

export function groupCount(c) { return Object.keys(c.ideaGroups || {}).length; }

/** 该国在某组里已经点了第几条 */
export function groupProgress(c, gid) { return (c.ideaGroups && c.ideaGroups[gid]) || 0; }

export function ideaCost(c, gid, mods) {
  const g = GROUP_BY_ID.get(gid);
  if (!g) return Infinity;
  const base = IDEA_COST * (1 + groupCount(c) * 0.06); // 开得越多越贵
  return Math.max(120, Math.round(base * (1 + (mods?.ideaCost || 0) / 100)));
}

export function canTakeIdea(world, tag, gid) {
  const c = world.countries.get(tag);
  if (!c) return { ok: false, why: '国家不存在' };
  const g = GROUP_BY_ID.get(gid);
  if (!g) return { ok: false, why: '理念组不存在' };
  const done = groupProgress(c, gid);
  if (done >= IDEAS_PER_GROUP) return { ok: false, why: '本组已完成' };
  if (done === 0 && groupCount(c) >= maxGroups(c)) {
    return { ok: false, why: `行政科技 ${c.tech.adm} 只允许开 ${maxGroups(c)} 组` };
  }
  const mods = world.modsFor ? world.modsFor(tag) : null;
  const cost = ideaCost(c, gid, mods);
  if (c.powers[g.branch] < cost) return { ok: false, why: `${g.branch.toUpperCase()} 点数不足（需 ${cost}）` };
  return { ok: true, cost, branch: g.branch };
}

/** 点一条理念。返回 {ok, reason} */
export function takeIdea(world, tag, gid) {
  const chk = canTakeIdea(world, tag, gid);
  if (!chk.ok) return chk;
  const c = world.countries.get(tag);
  c.powers[chk.branch] -= chk.cost;
  c.ideaGroups[gid] = groupProgress(c, gid) + 1;
  if (world.invalidateMods) world.invalidateMods();
  return { ok: true, cost: chk.cost, branch: chk.branch, done: c.ideaGroups[gid] >= IDEAS_PER_GROUP };
}

/** 汇总一个国家已解锁的全部理念加成 */
export function ideaMods(c) {
  const m = newMods();
  const groups = c.ideaGroups || {};
  for (const gid in groups) {
    const g = GROUP_BY_ID.get(gid);
    if (!g) continue;
    const n = groups[gid];
    for (let i = 0; i < n && i < g.ideas.length; i++) addMods(m, g.ideas[i].mods);
    if (n >= IDEAS_PER_GROUP) addMods(m, g.bonus.mods);
  }
  return m;
}

/** UI 用：列出某国已开的组及其进度 */
export function groupStates(c) {
  return IDEA_GROUPS.map((g) => ({
    group: g,
    done: groupProgress(c, g.id),
    total: IDEAS_PER_GROUP,
    complete: groupProgress(c, g.id) >= IDEAS_PER_GROUP,
  }));
}

/* ─────────────── 政策 ─────────────── */
/*
  每开启 2 个理念组解锁 1 个政策槽。政策由「两个特定理念组」组成，
  两侧各点过至少 1 条理念即可启用，不占点数，随时开关。
  政策有实打实的修正，是理念系统的第二层收益。
*/

export const POLICIES = [
  { id: 'pol_total_war', name: '总体战', requires: ['quantity', 'offensive'], mods: { manpowerMod: 15, landMorale: 0.1 }, desc: '倾国之兵，士气如虹。' },
  { id: 'pol_engineer', name: '工程军团', requires: ['offensive', 'economic'], mods: { siegeAbility: 20, buildCost: -5 }, desc: '随军工兵让城墙形同虚设。' },
  { id: 'pol_drill', name: '队列操练', requires: ['quality', 'defensive'], mods: { discipline: 5, fortDefense: 10 }, desc: '纪律与工事，守方美学。' },
  { id: 'pol_levee', name: '征召佥补', requires: ['quantity', 'defensive'], mods: { manpowerMod: 20, taxMod: -5 }, desc: '田里的农忙兵，一纸令下成军。' },
  { id: 'pol_naval_inf', name: '陆战队', requires: ['maritime', 'offensive'], mods: { navalMorale: 0.25, siegeAbility: 10 }, desc: '从舷梯冲上滩头的步兵。' },
  { id: 'pol_mercantile', name: '重商主义', requires: ['trade', 'economic'], mods: { tradeEff: 10, tradePowerMod: 10 }, desc: '海关与特许状为王国生利。' },
  { id: 'pol_native', name: '商馆网', requires: ['trade', 'maritime'], mods: { merchants: 1, tradeSteer: 10 }, desc: '港口商馆串起远洋航路。' },
  { id: 'pol_ideology', name: '宗教容纳', requires: ['religious', 'innovative'], mods: { unrest: -2, stabilityCost: -10 }, desc: '宽容换来的安定。' },
  { id: 'pol_admin', name: '官僚扩编', requires: ['administrative', 'economic'], mods: { taxMod: 10, coreCost: -10 }, desc: '更多书吏，更多税契。' },
  { id: 'pol_court', name: '宫廷外交', requires: ['diplomatic', 'influence'], mods: { improveRelations: 30, aeImpact: -5 }, desc: '沙龙里的合纵连横。' },
  { id: 'pol_royal_army', name: '王师整编', requires: ['administrative', 'quality'], mods: { discipline: 5, techCost: -5 }, desc: '军政一体的精兵路线。' },
  { id: 'pol_expedition', name: '远征后勤', requires: ['quantity', 'maritime'], mods: { supplyLimitMod: 25, sailorMod: 10 }, desc: '补给船队跟着大军走。' },
];

export function policySlots(c) { return Math.floor(groupCount(c) / 2); }

/** 某政策当前是否可启用（两侧理念组均已开） */
export function policyAvailable(c, pol) {
  return pol.requires.every((gid) => groupProgress(c, gid) >= 1);
}

export function enabledPolicies(c) {
  return [...(c.policies || [])].map((id) => POLICIES.find((p) => p.id === id)).filter(Boolean);
}

export function togglePolicy(world, tag, pid) {
  const c = world.countries.get(tag);
  const pol = POLICIES.find((p) => p.id === pid);
  if (!c || !pol) return { ok: false, why: '政策不存在' };
  if (!c.policies) c.policies = new Set();
  if (c.policies.has(pid)) {
    c.policies.delete(pid);
    if (world.invalidateMods) world.invalidateMods();
    return { ok: true, on: false };
  }
  if (!policyAvailable(c, pol)) return { ok: false, why: '需要先开启对应的两个理念组' };
  if (c.policies.size >= policySlots(c)) {
    return { ok: false, why: `政策槽已满（${c.policies.size}/${policySlots(c)}），先关闭一项` };
  }
  c.policies.add(pid);
  if (world.invalidateMods) world.invalidateMods();
  return { ok: true, on: true };
}

export function policyMods(c) {
  const m = {};
  if (!c || !c.policies) return m;
  for (const pid of c.policies) {
    const pol = POLICIES.find((p) => p.id === pid);
    if (!pol) continue;
    for (const k in pol.mods) m[k] = (m[k] || 0) + pol.mods[k];
  }
  return m;
}
