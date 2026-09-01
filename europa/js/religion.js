// 宗教系统：传教、宗教改革、教派转换
//
// EU4 的宗教改革是核心机制之一：
// - 天主教会拥有 "正统信仰" 特权
// - 1517 年后宗教改革事件开始，省份可能转向新教
// - 玩家可选择自己的国家成为新教派领袖 (Lutheran/Calvinist/Anglican)
// - 宗教影响外交关系、战争理由 (Crusade/Jihad)、AE 获取

/* ─────────────── 宗教定义 ─────────────── */

export const RELIGIONS = {
  catholic: { name: '天主教', abbr: 'C', color: '#FFD700' },
  protestant: { name: '新教', abbr: 'P', color: '#3CB371' },
  lutheran: { name: '路德宗', abbr: 'L', color: '#4682B4' },
  calvinist: { name: '加尔文宗', abbr: 'C', color: '#5F9EA0' },
  anglican: { name: '安立甘宗', abbr: 'A', color: '#9370DB' },
  orthodox: { name: '东正教', abbr: 'O', color: '#FF6347' },
  sunni: { name: '逊尼派', abbr: 'S', color: '#2E8B57' },
  shia: { name: '什叶派', abbr: 'I', color: '#8B0000' },
  hussite: { name: '胡斯派', abbr: 'H', color: '#CD5C5C' },
  jewish: { name: '犹太教', abbr: 'J', color: '#696969' },
  muslim: { name: '穆斯林', abbr: 'M', color: '#006400' },
  pagan: { name: '异教徒', abbr: 'PG', color: '#A0522D' },
};

/** 宗教分支树 */
export const RELIGION_BRANCHES = {
  western: ['catholic', 'protestant'],
  eastern: ['orthodox', 'hussite'],
  muslim: ['sunni', 'shia'],
};

/* ─────────────── 传教士系统 ─────────────── */

export function initReligion(world) {
  world.religiousReform = {
    started: false,       // 是否开始宗教改革 (1517 年后随机触发)
    year: null,          // 开始的年份
    leader: null,        // 新教阵营的领袖国家 tag
    reformedCountries: new Set(),  // 已改信新教的国家
  };
  
  world.missionaries = [];  // [{ fromTag, toProv, progress }] 正在进行的传教活动
}

/** 派遣传教士到目标省份 */
export function sendMissionary(world, fromTag, targetProvId, onLog) {
  const c = world.countries.get(fromTag);
  const t = world.provinces.get(targetProvId);
  
  if (!c || !t) return { ok: false, why: '无效的国家或省份' };
  if (t.sea) return { ok: false, why: '无法向海域派遣传教士' };
  if (!t.owner) return { ok: false, why: '该省份无人统治' };
  
  /* 检查是否在己方领土 */
  if (t.owner !== fromTag && t.controller !== fromTag) {
    return { ok: false, why: '只能在自己控制的省份内派遣传教士' };
  }
  
  /* 如果已经是其他宗教，需要有足够的 missionary 点数 */
  const maxMissionaries = 3 + Math.floor(c.tech.adm / 10);
  if (world.missionaries.filter(m => m.fromTag === fromTag).length >= maxMissionaries) {
    return { ok: false, why: '传教士数量已达上限' };
  }
  
  world.missionaries.push({
    fromTag: fromTag,
    toProv: targetProvId,
    progress: 0,
    createdAt: world.stats.tick,
  });
  
  onLog(`✅ 从 ${c.name} 向 ${t.name} 派遣了传教士`);
  return { ok: true };
}

/** 计算传教进度 */
function calculateMissionaryProgress(missionary, p, owner) {
  // 基础进度：每 tick 增加
  let progress = 0.5;
  
  // 宗教相似度加成
  const sameBranch = getSameReligionBranch(owner.religion, 'lutheran');
  const differentBranch = getSameReligionBranch(owner.religion, p.religion);
  
  if (sameBranch === missionary.fromTag) {
    progress += 0.5;  // 同教派加速
  }
  
  // 发展度惩罚
  progress *= (1 - p.baseProduction * 0.005);
  
  // 稳定度加成
  const mods = world.modsFor ? world.modsFor(missionary.fromTag) : null;
  progress *= (1 + (mods?.missionaryEffectiveness || 0) / 100);
  
  return progress;
}

/** 判断两个宗教是否属于同一分支 */
function getSameReligionBranch(rel1, rel2) {
  if (rel1 === rel2) return rel1;
  
  // 天主教与新教分支
  if ((rel1 === 'catholic' && rel2 === 'protestant') || 
      (rel1 === 'protestant' && rel2 === 'catholic')) {
    return 'western';
  }
  
  // 路德宗与天主教的关系
  if (rel1 === 'lutheran' || rel2 === 'lutheran') return 'western';
  
  return null;
}

/** 更新所有传教士进度 */
export function updateMissionaries(world, onLog) {
  const now = world.stats.tick;
  
  for (const missionary of world.missionaries) {
    const p = world.provinces.get(missionary.toProv);
    const owner = world.countries.get(p.owner);
    
    if (!p || !owner) continue;
    
    // 跳过非目标省份
    if (owner.religion !== 'catholic' && owner.religion !== 'protestant') continue;
    
    const progressPerTick = calculateMissionaryProgress(missionary, p, owner);
    missionary.progress += progressPerTick;
    
    // 达到阈值，转换宗教
    if (missionary.progress >= 100) {
      const oldReligion = p.religion;
      p.religion = missionary.fromTag === owner.tag ? 'lutheran' : 'protestant';
      
      onLog(`🙏 ${p.name} 的宗教信仰已从 ${RELIGIONS[oldReligion].name} 改为 ${RELIGIONS[p.religion].name}`);
      
      // 移除已完成传教的传教士
      missionary.progress = 0;
    }
  }
  
  // 清理空的传教任务
  world.missionaries = world.missionaries.filter(m => m.progress > 0);
}

/* ─────────────── 宗教改革事件 ─────────────── */

/** 宗教改革触发条件：1517 年后，概率触发 */
export function triggerReformationEvent(world, onLog) {
  if (world.date.y < 1517 || world.religiousReform.started) return;
  
  // 10% 概率每年尝试触发
  if (Math.random() > 0.1) return;
  
  // 必须有足够多的天主教国家
  const catholicCount = [...world.countries.values()]
    .filter(c => c.religion === 'catholic').length;
  
  if (catholicCount < 5) return;
  
  world.religiousReform.started = true;
  world.religiousReform.year = world.date.y;
  
  // 随机选择一个德意志诸侯作为改革发起者
  const germanCountries = [...world.countries.values()]
    .filter(c => c.hre && c.religion === 'catholic');
  
  if (germanCountries.length > 0) {
    const initiator = germanCountries[Math.floor(Math.random() * germanCountries.length)];
    world.religiousReform.leader = initiator.tag;
    
    onLog(`🔥 📜 历史事件：${initiator.name} 发起了宗教改革！新教在欧洲开始传播...`);
  }
}

/** 随机省份可能皈依新教 (基于传教士强度) */
export function randomConversion(world, onLog) {
  if (!world.religiousReform.started) return;
  
  const catholicProvinces = [...world.provinces.values()]
    .filter(p => !p.sea && p.religion === 'catholic' && p.owner && 
                 world.countries.get(p.owner)?.religion === 'catholic');
  
  if (catholicProvinces.length === 0) return;
  
  // 30% 概率每月尝试
  if (Math.random() > 0.3) return;
  
  const province = catholicProvinces[Math.floor(Math.random() * catholicProvinces.length)];
  const oldReligion = province.religion;
  province.religion = 'protestant';
  
  onLog(`⛪ ${province.name} 在传教影响下改信了新教 (${oldReligion} → protestant)`);
}

/* ─────────────── 圣战机制 ─────────────── */

/** 获取战争理由：十字军圣战 */
export function crusadeCasusBelli(world, attacker, defender, onLog) {
  const att = world.countries.get(attacker);
  const def = world.countries.get(defender);
  
  if (!att || !def) return { ok: false, why: '无效国家' };
  if (isAtWar(world, attacker, defender)) return { ok: false, why: '已在交战中' };
  
  /* 必须是不同宗教才能发动圣战 */
  if (att.religion === def.religion) {
    return { ok: false, why: '只有对不同宗教才能发动圣战' };
  }
  
  /* 检查是否有圣战特权 */
  if (!hasCrusadePrivilege(world, attacker)) {
    return { ok: false, why: '没有发动圣战的资格 (需要异端审判权)' };
  }
  
  addWarReason(world, attacker, defender, 'crusade');
  
  world.wars.push({
    attacker: attacker,
    defender: defender,
    warType: 'crusade',
    active: true,
    score: { [attacker]: 50, [defender]: 50 },
    startTick: world.stats.tick,
  });
  
  onLog(`⚔️ ${att.name} 对 ${def.name} 发动了圣战 (Crusade)!`);
  return { ok: true };
}

/** 检查国家是否有圣战特权 */
function hasCrusadePrivilege(world, countryTag) {
  const c = world.countries.get(countryTag);
  if (!c) return false;
  
  /* 神圣罗马帝国皇帝有特权 */
  if (c.emperor) return true;
  
  /* 或者某个特定政策 */
  const mods = world.modsFor ? world.modsFor(countryTag) : null;
  return (mods?.crusadePrivilege || 0) > 0;
}

/** 添加战争理由 */
function addWarReason(world, a, b, type) {
  const key = a < b ? `${a}:${b}` : `${b}:${a}`;
  const r = world.relations.get(key);
  if (!r.reasons) r.reasons = [];
  r.reasons.push(type);
}

/** 检查是否交战 */
export function isAtWar(world, a, b) {
  return world.wars.some(w => w.active && 
    ((w.attacker === a && w.defender === b) || 
     (w.attacker === b && w.defender === a)));
}
