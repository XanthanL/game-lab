import { Axis, QUESTIONS } from '../data/questions';
import { IDEOLOGIES, HIDDEN_RESULTS, Ideology } from '../data/ideologies';

export interface RankedIdeology extends Ideology {
  matchPercentage: number;
  distance: number; // 加权欧氏距离原始值，供报告页展示精确数据
  gapToSecond?: number; // 与次选契合度之差（百分点），衡量匹配确定性；undefined 表示无次选
}

// 稳定哈希（FNV-1a 32 位）：用于把答案映射为可复现的档案编号。
// 同输入永远同输出，刷新页面不会变号；与 Math.random 完全不同。
export const stableHash = (input: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, '0');
};

// 答题风格画像（用于隐藏结局与精神状态评估）
export interface AnswerProfile {
  total: number;
  neutralRatio: number;   // 中立比例（理中客浓度）
  extremeRatio: number;   // ±2 极端选项比例（魔怔浓度）
  coherence: number;      // 立场自洽度 0~100：各轴内作答方向的一致程度（|轴内作答和| / 轴内绝对值和 的均值）。
  //   同轴线内方向打架→互相抵消→趋近 0；温和但始终一致→≈100。比"坐标绝对值均值"更精准，
  //   不会把"温和但一致"的用户误判为低自洽，也不会因个别轴极端而虚高。
}

export const calculateUserCoordinates = (answers: Record<number, number>): Record<Axis, number> => {
  const rawScores: Record<Axis, number> = {
    economy: 0, power: 0, culture: 0, identity: 0, ecology: 0, tech: 0, metaphysics: 0
  };
  // 每轴实际作答题数（支持快速/深度两种模式的动态归一化）
  const answeredCount: Record<Axis, number> = {
    economy: 0, power: 0, culture: 0, identity: 0, ecology: 0, tech: 0, metaphysics: 0
  };

  QUESTIONS.forEach(q => {
    if (!(q.id in answers)) return;
    const answerValue = answers[q.id];
    // 基础逻辑：answerValue (-2 ~ 2) * q.direction
    let score = answerValue * q.direction;

    // 极性修正：确保 -100 对应 AXIS_CONFIG 的 LeftLabel，100 对应 RightLabel
    // Power: +1 为权威。在 AXIS_CONFIG 中 Left 是权威。
    // 所以权威应该是负分。我们需要对 Power, Culture, Identity, Ecology, Tech 进行取反。
    if (['power', 'culture', 'identity', 'ecology', 'tech', 'metaphysics'].includes(q.axis)) {
      score = -score;
    }

    rawScores[q.axis] += score;
    answeredCount[q.axis] += 1;
  });

  const normalizedCoords: Record<Axis, number> = {} as any;
  (Object.keys(rawScores) as Axis[]).forEach(axis => {
    // 每轴最大原始分 = 作答题数 * 2，映射到 -100 ~ 100
    const maxScore = answeredCount[axis] * 2;
    normalizedCoords[axis] = maxScore > 0 ? (rawScores[axis] / maxScore) * 100 : 0;
  });

  return normalizedCoords;
};

// 每轴「已含极性修正」的作答贡献列表，供自洽度精确计算同一轴内的方向一致度
const getAxisContributions = (answers: Record<number, number>): Record<Axis, number[]> => {
  const contrib: Record<Axis, number[]> = {
    economy: [], power: [], culture: [], identity: [], ecology: [], tech: [], metaphysics: [],
  };
  QUESTIONS.forEach(q => {
    if (!(q.id in answers)) return;
    let score = answers[q.id] * q.direction;
    if (['power', 'culture', 'identity', 'ecology', 'tech', 'metaphysics'].includes(q.axis)) {
      score = -score;
    }
    contrib[q.axis].push(score);
  });
  return contrib;
};

export const analyzeAnswerProfile = (answers: Record<number, number>): AnswerProfile => {
  const values = Object.values(answers);
  const total = values.length;
  if (total === 0) return { total: 0, neutralRatio: 0, extremeRatio: 0, coherence: 0 };
  const neutral = values.filter(v => v === 0).length;
  const extreme = values.filter(v => Math.abs(v) === 2).length;
  // 立场自洽度：逐轴计算"方向一致度" = |轴内作答和| / 轴内绝对值和。
  // 同轴线内方向一致→比值≈1；反复横跳（正负抵消）→比值趋近 0。
  // 跨轴无所谓（经济左+文化右是真实组合，不算矛盾），故只对单轴内部求一致度。
  const contrib = getAxisContributions(answers);
  let consistencySum = 0;
  let axesCounted = 0;
  (Object.keys(contrib) as Axis[]).forEach(axis => {
    const arr = contrib[axis];
    if (arr.length === 0) return;
    const sum = arr.reduce((x, y) => x + y, 0);
    const absSum = arr.reduce((x, y) => x + Math.abs(y), 0);
    const ratio = absSum === 0 ? 1 : Math.abs(sum) / absSum;
    consistencySum += ratio;
    axesCounted += 1;
  });
  const coherence = axesCounted === 0 ? 0 : (consistencySum / axesCounted) * 100;
  return { total, neutralRatio: neutral / total, extremeRatio: extreme / total, coherence };
};

// 隐藏结局判定：
// - 理中客：中立超过 1/3
// - 魔怔人：大量极端选项（≥80%）且立场自相矛盾（自洽度 < 50，极端答案在轴内互相抵消）。
//   坚定但逻辑一致的极端者不算魔怔——他们会被正常归入其真实意识形态。
export const detectHiddenResult = (profile: AnswerProfile): Ideology | null => {
  if (profile.total === 0) return null;
  if (profile.neutralRatio > 1 / 3) return HIDDEN_RESULTS.centrist;
  if (profile.extremeRatio >= 0.8 && profile.coherence < 50) return HIDDEN_RESULTS.maniac;
  return null;
};

// ============ 网络人格（隐藏网络意识形态） ============
// 七种中文互联网键政身份：乐子人、网左、网右、粉红、基本盘、非基本、殖人。
// 内容型六种由坐标复合强度判定；乐子人由答题行为判定（比魔怔轻一档的立场横跳）。
// 强度 ≥ NETWORK_DIRECT_THRESHOLD 视为"最直接的形式"→ 升格为隐藏结局；
// 强度 ≥ NETWORK_ATTACH_THRESHOLD 但未达直接线 → 附着在常规结论下方作为隐藏网络人格。
export interface NetworkPersona {
  key: string;      // HIDDEN_RESULTS 中的键（net_ 前缀）
  strength: number; // 0 ~ 100
}

export const NETWORK_DIRECT_THRESHOLD = 80;
export const NETWORK_ATTACH_THRESHOLD = 42;

const clampStrength = (v: number) => Math.max(0, Math.min(100, v));

export const scoreNetworkPersonas = (
  coords: Record<Axis, number>,
  profile?: AnswerProfile
): NetworkPersona[] => {
  const c = coords;
  const raw: Record<string, number> = {};

  // 民族-秩序复合强度：认同偏民族 + 权力偏集中。按档位互斥：狂热 → 粉红，温和 → 基本盘
  const nat = clampStrength(0.55 * Math.max(0, c.identity) + 0.45 * Math.max(0, -c.power));
  if (nat >= 55) raw['net_pink'] = nat;
  else if (nat >= 30) raw['net_base'] = nat;

  // 离心复合强度：认同偏全球 + 经济偏市场 + 权力偏自由。极端 → 殖人，温和 → 非基本
  const cosmo = clampStrength(0.5 * Math.max(0, -c.identity) + 0.3 * Math.max(0, c.economy) + 0.2 * Math.max(0, c.power));
  if (cosmo >= 55) raw['net_colonized'] = cosmo;
  else if (cosmo >= 30) raw['net_nonbase'] = cosmo;

  // 网左 / 网右：以经济轴符号互斥
  const netLeft = clampStrength(0.6 * Math.max(0, -c.economy) + 0.4 * Math.max(0, -c.culture));
  if (c.economy < 0 && netLeft >= NETWORK_ATTACH_THRESHOLD) raw['net_left'] = netLeft;
  const netRight = clampStrength(0.55 * Math.max(0, c.economy) + 0.45 * Math.max(0, c.power));
  if (c.economy > 0 && netRight >= NETWORK_ATTACH_THRESHOLD) raw['net_right'] = netRight;

  // 乐子人（行为型）：大量极端但未达魔怔线，且立场自洽度低——横跳搅局，不真诚持方
  if (profile && profile.total > 0) {
    let troll = 0;
    if (profile.extremeRatio >= 0.4 && profile.extremeRatio < 0.8 && profile.coherence < 45) {
      troll = clampStrength(profile.extremeRatio * 100 + (45 - profile.coherence));
    } else if (profile.extremeRatio >= 0.3 && profile.neutralRatio >= 0.2 && profile.coherence < 40) {
      troll = clampStrength((profile.extremeRatio + profile.neutralRatio) * 90);
    }
    if (troll >= NETWORK_ATTACH_THRESHOLD) raw['net_troll'] = troll;
  }

  return Object.entries(raw)
    .map(([key, strength]) => ({ key, strength }))
    .sort((a, b) => b.strength - a.strength);
};

const AXES: Axis[] = ['economy', 'power', 'culture', 'identity', 'ecology', 'tech', 'metaphysics'];

// 每轴作答明细：题数、原始分、满分与归一化坐标（供报告页展示精确数据）
export interface AxisBreakdown {
  answered: number; // 该轴实际作答题数
  raw: number;      // 原始得分（已含极性修正）
  max: number;      // 该轴满分 = 题数 × 2
  value: number;    // 归一化坐标 -100 ~ 100
}

export const getAxisBreakdown = (answers: Record<number, number>): Record<Axis, AxisBreakdown> => {
  const result = {} as Record<Axis, AxisBreakdown>;
  AXES.forEach(a => { result[a] = { answered: 0, raw: 0, max: 0, value: 0 }; });
  QUESTIONS.forEach(q => {
    if (!(q.id in answers)) return;
    let score = answers[q.id] * q.direction;
    if (['power', 'culture', 'identity', 'ecology', 'tech', 'metaphysics'].includes(q.axis)) {
      score = -score;
    }
    result[q.axis].raw += score;
    result[q.axis].answered += 1;
  });
  AXES.forEach(a => {
    result[a].max = result[a].answered * 2;
    result[a].value = result[a].max > 0 ? (result[a].raw / result[a].max) * 100 : 0;
  });
  return result;
};

// 无权重欧氏距离（七维坐标空间，理论最大值 √(7×200²) ≈ 529.2）
export const plainDistance = (a: Record<Axis, number>, b: Record<Axis, number>): number =>
  Math.sqrt(AXES.reduce((sum, axis) => sum + Math.pow(a[axis] - b[axis], 2), 0));

// --- VETO SYSTEM（一票否决机制）---
// 坐标已含极性修正（power 正向=个人自由、负向=权威集中；economy 正向=自由市场、负向=公有再分配；
// identity 正向=民族本位、负向=全球开放）。以下阈值为"定义性维度"上的硬红线：
// 用户坐标只要落在与某意识形态锚点相反的一侧超过阈值，物理上不可能是该意识形态。
// 各阈值均严于对应意识形态锚点坐标（如 fascism.power=-100，故 power>10 才排除，留足缓冲，不会误杀真实近邻）。
const VETO = {
  proFreedomMin: 10,    // 个人自由指数 > 10 → 不可能是权威型（极权/威权/法西斯/红褐/神权）
  proAuthorityMax: -10, // 权威集中指数 < -10 → 不可能是自由型（自由意志/无政府/无政府唯我）
  proMarketMin: 20,     // 自由市场指数 > 20 → 不可能是公有制型（马列/托派/无政共/红褐）
  proStateMax: -20,     // 公有再分配指数 < -20 → 不可能是市场原教旨（客观/无政资/社达/有效加速）
  cosmopolitanMax: -30, // 全球开放指数 < -30 → 不可能是种族民族型（种族民族/法西斯/红褐）
};

const passesVeto = (ideology: Ideology, userCoords: Record<Axis, number>): boolean => {
  // 1. 权力/自由维度红线
  if ((['totalitarianism', 'authoritarianism', 'fascism', 'nazbol', 'theocracy'].includes(ideology.id)) && userCoords.power > VETO.proFreedomMin) {
    return false; // 偏向自由的人绝对不可能是法西斯、极权或神权
  }
  if ((['libertarianism', 'ancap', 'anarchism', 'anarchoegoism'].includes(ideology.id)) && userCoords.power < VETO.proAuthorityMax) {
    return false; // 偏向权威的人绝对不可能是无政府或自由意志主义
  }

  // 2. 经济/阶级维度红线
  if ((['ml', 'trotskyism', 'ancom', 'nazbol'].includes(ideology.id)) && userCoords.economy > VETO.proMarketMin) {
    return false; // 支持纯市场的人绝对不可能是托派或马列
  }
  if ((['objectivism', 'ancap', 'social_darwinism', 'effective_accelerationism'].includes(ideology.id)) && userCoords.economy < VETO.proStateMax) {
    return false; // 支持公有制的人绝对不可能是客观主义者
  }

  // 3. 认同/民族维度红线
  if ((['ethnonationalism', 'fascism', 'nazbol'].includes(ideology.id)) && userCoords.identity < VETO.cosmopolitanMax) {
    return false; // 世界主义者绝对不可能是种族民族主义、法西斯或红褐
  }

  return true;
};

const weightedDistance = (ideology: Ideology, userCoords: Record<Axis, number>): number => {
  return Math.sqrt(
    AXES.reduce((sum, axis) => {
      const diff = userCoords[axis] - ideology.coordinates[axis];
      const weight = ideology.axisWeights[axis] || 1.0;
      return sum + weight * Math.pow(diff, 2);
    }, 0)
  );
};

// 距离 → 契合度：以该意识形态权重下的最大可能距离为基准做线性映射（保留 1 位小数）
const toMatchPercentage = (ideology: Ideology, dist: number): number => {
  const maxDist = Math.sqrt(
    AXES.reduce((sum, axis) => sum + (ideology.axisWeights[axis] || 1.0) * Math.pow(200, 2), 0)
  );
  const pct = 100 * (1 - dist / maxDist);
  return Math.max(1, Math.round(pct * 10) / 10);
};

// 返回按契合度排序的完整榜单（已通过一票否决过滤）
export const rankIdeologies = (userCoords: Record<Axis, number>): RankedIdeology[] => {
  const ranked: RankedIdeology[] = IDEOLOGIES
    .filter(i => passesVeto(i, userCoords))
    .map(i => {
      const dist = weightedDistance(i, userCoords);
      return { ...i, distance: dist, matchPercentage: toMatchPercentage(i, dist) };
    })
    .sort((a, b) => b.matchPercentage - a.matchPercentage);
  // 匹配确定性：榜首与次选的契合度之差。差距小说明结论"仅供参考"，而非高契合度本身虚高。
  if (ranked.length >= 2) {
    ranked[0].gapToSecond = Math.max(0, ranked[0].matchPercentage - ranked[1].matchPercentage);
  }
  return ranked;
};

// 宿敌：光谱上离你最远的意识形态（不加权，纯坐标距离）
export const findNemesis = (userCoords: Record<Axis, number>): Ideology => {
  let nemesis: Ideology = IDEOLOGIES[0];
  let maxDist = -Infinity;
  IDEOLOGIES.forEach(ideology => {
    const dist = plainDistance(userCoords, ideology.coordinates);
    if (dist > maxDist) {
      maxDist = dist;
      nemesis = ideology;
    }
  });
  return nemesis;
};

// 兼容旧接口
export const findClosestIdeology = (userCoords: Record<Axis, number>) => {
  const ranked = rankIdeologies(userCoords);
  return ranked[0] || { ...IDEOLOGIES[0], matchPercentage: 100 };
};
