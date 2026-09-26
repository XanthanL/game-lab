'use strict';
/* ============================================================
 * 卡牌定义
 * type: damage / shield / special / curse
 * 效果字段（playCard 中按序结算）：
 *   value            主数值（伤害或护盾）
 *   hits             多段次数
 *   pierce           无视护盾
 *   percentDamage    敌人最大生命百分比
 *   statusEffect     施加状态 {type,stacks}，可数组
 *   selfTarget       状态施加给自己
 *   statusEffectAction:'doubleBurn'  灼烧翻倍
 *   drawCards        抽牌
 *   conditionalDraw  手牌<=3 时额外抽 1
 *   gainBattery      获得电量
 *   damageTakenBonus 本回合受伤 +N
 *   heal / lifesteal / selfDamage
 *   shieldFromStrength 护盾 = 力量 x2
 *   gainThorns       获得反伤
 *   purifySelf       清除自身负面
 *   consumeStrength  消耗力量
 *   retainBlock      护盾下回合不清零
 *   exhaust          打出后消耗（进消耗堆，本局战斗不再回抽）
 *   shieldDamage     伤害 = 当前护盾 x 该系数（工程兵「盾击」）
 *   comboDamage      本回合每打出过一张牌 +N 伤害（突击兵「连击终结」）
 *   char             所属职业（职业专属卡）。没有则是通用卡。
 * ============================================================ */
const CARD_DEFS = {
  /* ---------- 初始卡 ---------- */
  laserShot:        { id: 'laserShot', name: '激光射击', cost: 1, desc: '造成 6 点伤害', type: 'damage', value: 6, icon: 'damage', rarity: 'starter' },
  plasmaShield:     { id: 'plasmaShield', name: '电浆护盾', cost: 1, desc: '获得 5 点护盾', type: 'shield', value: 5, icon: 'shield', rarity: 'starter' },
  overchargeBlast:  { id: 'overchargeBlast', name: '过载轰击', cost: 2, desc: '造成 14 点伤害', type: 'damage', value: 14, icon: 'damage', rarity: 'uncommon' },
  shieldMatrix:     { id: 'shieldMatrix', name: '矩阵防御', cost: 2, desc: '获得 12 点护盾', type: 'shield', value: 12, icon: 'shield', rarity: 'uncommon' },

  /* ---------- 攻击 ---------- */
  piercingBeam:     { id: 'piercingBeam', name: '穿透光束', cost: 2, desc: '造成 10 点伤害\n无视护盾', type: 'damage', value: 10, icon: 'pierce', rarity: 'rare', pierce: true },
  antimatterRailgun:{ id: 'antimatterRailgun', name: '反物质轨道炮', cost: 3, desc: '造成 24 点伤害', type: 'damage', value: 24, icon: 'damage', rarity: 'rare' },
  empCannon:        { id: 'empCannon', name: '电磁脉冲炮', cost: 2, desc: '4 次 3 点伤害\n每次 +1 灼烧', type: 'damage', value: 3, hits: 4, icon: 'multi', rarity: 'rare', statusEffect: { type: 'burn', stacks: 1 } },
  tacticalMark:     { id: 'tacticalMark', name: '战术标记', cost: 1, desc: '5 点伤害\n+1 易伤', type: 'damage', value: 5, icon: 'damage', rarity: 'common', statusEffect: { type: 'vulnerable', stacks: 1 } },
  gravityCrush:     { id: 'gravityCrush', name: '引力碾压', cost: 2, desc: '造成敌人最大\n生命 15% 伤害', type: 'damage', value: 0, icon: 'special', rarity: 'rare', percentDamage: 0.15 },
  meltdown:         { id: 'meltdown', name: '核心熔毁', cost: 0, desc: '20 点伤害\n自伤 10', type: 'damage', value: 20, icon: 'damage', rarity: 'rare', selfDamage: 10 },
  voidSlash:        { id: 'voidSlash', name: '虚空斩击', cost: 1, desc: '12 点伤害\n消耗 1 力量', type: 'damage', value: 12, icon: 'pierce', rarity: 'rare', consumeStrength: 1 },
  bloodDrain:       { id: 'bloodDrain', name: '生命汲取', cost: 2, desc: '8 点伤害\n恢复等量生命', type: 'damage', value: 8, icon: 'lifesteal', rarity: 'uncommon', lifesteal: true },
  vampiricStrike:   { id: 'vampiricStrike', name: '吸血打击', cost: 1, desc: '5 点伤害\n恢复 3 生命', type: 'damage', value: 5, icon: 'lifesteal', rarity: 'common', heal: 3 },

  /* ---------- 护盾 / 治疗 ---------- */
  emergencyRepair:  { id: 'emergencyRepair', name: '应急焊补', cost: 1, desc: '8 点护盾\n下回合不清零', type: 'shield', value: 8, icon: 'shield', rarity: 'common', retainBlock: true },
  nanoRepairBoost:  { id: 'nanoRepairBoost', name: '纳米修复', cost: 1, desc: '4 护盾\n恢复 3 生命', type: 'shield', value: 4, icon: 'heal', rarity: 'common', heal: 3 },
  nanoArmor:        { id: 'nanoArmor', name: '纳米护甲', cost: 1, desc: '6 护盾\n恢复 2 生命', type: 'shield', value: 6, icon: 'heal', rarity: 'common', heal: 2 },
  forceResonance:   { id: 'forceResonance', name: '力场共振', cost: 1, desc: '护盾 =\n力量 x 2', type: 'shield', value: 0, icon: 'shield', rarity: 'uncommon', shieldFromStrength: true },
  thornArmor:       { id: 'thornArmor', name: '荆棘装甲', cost: 1, desc: '6 护盾\n+2 反伤', type: 'shield', value: 6, icon: 'thorns', rarity: 'uncommon', gainThorns: 2 },

  /* ---------- 状态 / 运转 ---------- */
  thermalConduction:{ id: 'thermalConduction', name: '热能传导', cost: 1, desc: '敌人灼烧\n层数翻倍', type: 'special', value: 0, icon: 'burn', rarity: 'rare', statusEffectAction: 'doubleBurn' },
  corrosiveFog:     { id: 'corrosiveFog', name: '腐蚀毒雾', cost: 1, desc: '施加 2 层中毒', type: 'special', value: 0, icon: 'poison', rarity: 'uncommon', statusEffect: { type: 'poison', stacks: 2 } },
  sporeRelease:     { id: 'sporeRelease', name: '孢子释放', cost: 0, desc: '1 层中毒\n抽 1 张', type: 'special', value: 0, icon: 'poison', rarity: 'common', statusEffect: { type: 'poison', stacks: 1 }, drawCards: 1 },
  weaknessScan:     { id: 'weaknessScan', name: '弱点扫描', cost: 1, desc: '施加 2 层易伤', type: 'special', value: 0, icon: 'vulnerable', rarity: 'uncommon', statusEffect: { type: 'vulnerable', stacks: 2 } },
  plasmaBurn:       { id: 'plasmaBurn', name: '等离子燃烧弹', cost: 1, desc: '4 点伤害\n+3 灼烧', type: 'damage', value: 4, icon: 'burn', rarity: 'uncommon', statusEffect: { type: 'burn', stacks: 3 } },
  adrenaline:       { id: 'adrenaline', name: '肾上腺素', cost: 1, desc: '自身 +2 力量\n抽 1 张', type: 'special', value: 0, icon: 'strength', rarity: 'rare', statusEffect: { type: 'strength', stacks: 2 }, selfTarget: true, drawCards: 1 },
  overclockOverload:{ id: 'overclockOverload', name: '超频过载', cost: 0, desc: '自身 +3 力量\n失去 6 生命', type: 'special', value: 0, icon: 'strength', rarity: 'rare', statusEffect: { type: 'strength', stacks: 3 }, selfTarget: true, selfDamage: 6 },
  emergencyOverloadValve: { id: 'emergencyOverloadValve', name: '应急过载阀', cost: 0, desc: '+1 电量\n本回合受伤 +2', type: 'special', value: 1, icon: 'battery', rarity: 'uncommon', gainBattery: 1, damageTakenBonus: 2 },
  quickReload:      { id: 'quickReload', name: '快速装填', cost: 0, desc: '抽 2 张牌', type: 'special', value: 0, icon: 'draw', rarity: 'common', drawCards: 2 },
  tacticalAnalysis: { id: 'tacticalAnalysis', name: '战术分析', cost: 0, desc: '抽 1 张\n+1 电量', type: 'special', value: 0, icon: 'draw', rarity: 'uncommon', drawCards: 1, gainBattery: 1 },
  battlePlan:       { id: 'battlePlan', name: '战术规划', cost: 0, desc: '抽 1 张\n手牌<=3 再抽 1', type: 'special', value: 0, icon: 'draw', rarity: 'uncommon', conditionalDraw: true },
  systemReboot:     { id: 'systemReboot', name: '系统重启', cost: 1, desc: '清除自身负面\n抽 2 张', type: 'special', value: 0, icon: 'purify', rarity: 'uncommon', purifySelf: true, drawCards: 2 },

  /* ---------- 新增：深空篇专属 ---------- */
  singularityCollapse: { id: 'singularityCollapse', name: '奇点坍缩', cost: 3, desc: '造成 30 点\n无视护盾伤害\n消耗', type: 'damage', value: 30, icon: 'pierce', rarity: 'rare', pierce: true, exhaust: true },
  darkMatterWall:   { id: 'darkMatterWall', name: '暗物质壁', cost: 1, desc: '7 点护盾\n下回合不清零', type: 'shield', value: 7, icon: 'shield', rarity: 'uncommon', retainBlock: true },
  curvatureSlingshot:{ id: 'curvatureSlingshot', name: '曲率弹射', cost: 0, desc: '抽 1 张\n+1 电量\n消耗', type: 'special', value: 0, icon: 'draw', rarity: 'uncommon', drawCards: 1, gainBattery: 1, exhaust: true },
  entropyField:     { id: 'entropyField', name: '熵增力场', cost: 2, desc: '最大生命 10%\n+2 中毒', type: 'damage', value: 0, icon: 'special', rarity: 'rare', percentDamage: 0.10, statusEffect: { type: 'poison', stacks: 2 } },
  quantumLock:      { id: 'quantumLock', name: '量子锁定', cost: 0, desc: '+3 易伤\n+2 虚弱', type: 'special', value: 0, icon: 'vulnerable', rarity: 'uncommon', statusEffect: [{ type: 'vulnerable', stacks: 3 }, { type: 'weak', stacks: 2 }] },
  phaseShift:       { id: 'phaseShift', name: '相位跃迁', cost: 1, desc: '9 点护盾\n抽 1 张', type: 'shield', value: 9, icon: 'shield', rarity: 'uncommon', drawCards: 1 },

  /* ============================================================
   * 职业专属卡（STS2 式：每个乘员一套自己的基础牌，卡面带职业色）
   * ⚠️ rarity 一律 'starter'：这样它们不会进通用奖励池；
   *    rollRewards() 会按当前职业把本职业的 starter 卡单独加回池子。
   * ============================================================ */

  /* ---------- 宇航员 · 平衡的探索者（蓝） ---------- */
  aeroShot:      { id: 'aeroShot', name: '气动射击', cost: 1, desc: '造成 7 点伤害', type: 'damage', value: 7, icon: 'damage', rarity: 'starter', char: 'astronaut' },
  aeroGuard:     { id: 'aeroGuard', name: '气动护壁', cost: 1, desc: '获得 6 点护盾', type: 'shield', value: 6, icon: 'shield', rarity: 'starter', char: 'astronaut' },
  driftThrust:   { id: 'driftThrust', name: '漂移推进', cost: 0, desc: '3 点护盾\n抽 1 张', type: 'shield', value: 3, icon: 'draw', rarity: 'starter', char: 'astronaut', drawCards: 1 },
  orbitalScan:   { id: 'orbitalScan', name: '轨道扫描', cost: 1, desc: '5 点伤害\n抽 1 张', type: 'damage', value: 5, icon: 'draw', rarity: 'starter', char: 'astronaut', drawCards: 1 },

  /* ---------- 工程兵 · 护盾大师（绿） ---------- */
  rivetShot:     { id: 'rivetShot', name: '铆钉射流', cost: 1, desc: '造成 5 点伤害', type: 'damage', value: 5, icon: 'pierce', rarity: 'starter', char: 'engineer' },
  bulkhead:      { id: 'bulkhead', name: '隔舱壁', cost: 1, desc: '获得 7 点护盾', type: 'shield', value: 7, icon: 'shield', rarity: 'starter', char: 'engineer' },
  thornPlating:  { id: 'thornPlating', name: '尖刺镀层', cost: 1, desc: '5 点护盾\n+3 反伤', type: 'shield', value: 5, icon: 'thorns', rarity: 'starter', char: 'engineer', gainThorns: 3 },
  shieldBash:    { id: 'shieldBash', name: '盾击', cost: 1, desc: '伤害 = 当前护盾\n的 60%', type: 'damage', value: 0, icon: 'damage', rarity: 'starter', char: 'engineer', shieldDamage: 0.6 },

  /* ---------- 异变者 · 状态操控者（紫） ---------- */
  sporeBolt:     { id: 'sporeBolt', name: '孢子箭', cost: 1, desc: '4 点伤害\n+2 中毒', type: 'damage', value: 4, icon: 'poison', rarity: 'starter', char: 'mutant', statusEffect: { type: 'poison', stacks: 2 } },
  chitin:        { id: 'chitin', name: '几丁质层', cost: 1, desc: '获得 5 点护盾', type: 'shield', value: 5, icon: 'shield', rarity: 'starter', char: 'mutant' },
  mutagen:       { id: 'mutagen', name: '诱变剂', cost: 0, desc: '+2 中毒\n抽 1 张', type: 'special', value: 0, icon: 'poison', rarity: 'starter', char: 'mutant', statusEffect: { type: 'poison', stacks: 2 }, drawCards: 1 },
  mutagenicCloud:{ id: 'mutagenicCloud', name: '诱变云', cost: 1, desc: '敌人 +2 中毒\n+2 灼烧 +2 虚弱', type: 'special', value: 0, icon: 'special', rarity: 'starter', char: 'mutant', statusEffect: [{ type: 'poison', stacks: 2 }, { type: 'burn', stacks: 2 }, { type: 'weak', stacks: 2 }] },

  /* ---------- 突击兵 · 连击杀手（红） ---------- */
  burstFire:     { id: 'burstFire', name: '点射', cost: 1, desc: '2 次 5 点伤害', type: 'damage', value: 5, hits: 2, icon: 'multi', rarity: 'starter', char: 'assault' },
  quickGuard:    { id: 'quickGuard', name: '速防', cost: 1, desc: '获得 4 点护盾', type: 'shield', value: 4, icon: 'shield', rarity: 'starter', char: 'assault' },
  fragGrenade:   { id: 'fragGrenade', name: '破片手雷', cost: 2, desc: '3 次 5 点伤害', type: 'damage', value: 5, hits: 3, icon: 'multi', rarity: 'starter', char: 'assault' },
  comboFinisher: { id: 'comboFinisher', name: '连击终结', cost: 2, desc: '10 点伤害\n本回合每打出过\n一张牌 +3', type: 'damage', value: 10, icon: 'damage', rarity: 'starter', char: 'assault', comboDamage: 3 },
};

/* 升级表：覆盖字段 + 新描述 */
const UPGRADES = {
  laserShot:        { value: 9, desc: '造成 9 点伤害' },
  plasmaShield:     { value: 8, desc: '获得 8 点护盾' },
  overchargeBlast:  { value: 20, desc: '造成 20 点伤害' },
  shieldMatrix:     { value: 16, desc: '获得 16 点护盾' },
  piercingBeam:     { value: 15, desc: '造成 15 点伤害\n无视护盾' },
  antimatterRailgun:{ value: 32, desc: '造成 32 点伤害' },
  empCannon:        { value: 4, desc: '4 次 4 点伤害\n每次 +1 灼烧' },
  tacticalMark:     { value: 7, statusEffect: { type: 'vulnerable', stacks: 2 }, desc: '7 点伤害\n+2 易伤' },
  gravityCrush:     { percentDamage: 0.25, desc: '造成敌人最大\n生命 25% 伤害' },
  meltdown:         { value: 28, selfDamage: 6, desc: '28 点伤害\n自伤 6' },
  voidSlash:        { value: 16, desc: '16 点伤害\n消耗 1 力量' },
  bloodDrain:       { value: 12, desc: '12 点伤害\n恢复等量生命' },
  vampiricStrike:   { value: 7, heal: 5, desc: '7 点伤害\n恢复 5 生命' },
  emergencyRepair:  { value: 12, desc: '12 点护盾\n下回合不清零' },
  nanoRepairBoost:  { value: 6, heal: 5, desc: '6 护盾\n恢复 5 生命' },
  nanoArmor:        { value: 8, heal: 3, desc: '8 护盾\n恢复 3 生命' },
  forceResonance:   { cost: 0, desc: '护盾 =\n力量 x 2（0 费）' },
  thornArmor:       { value: 9, gainThorns: 3, desc: '9 护盾\n+3 反伤' },
  thermalConduction:{ cost: 0, desc: '敌人灼烧\n层数翻倍（0 费）' },
  corrosiveFog:     { statusEffect: { type: 'poison', stacks: 3 }, desc: '施加 3 层中毒' },
  sporeRelease:     { statusEffect: { type: 'poison', stacks: 2 }, drawCards: 2, desc: '2 层中毒\n抽 2 张' },
  weaknessScan:     { statusEffect: { type: 'vulnerable', stacks: 3 }, desc: '施加 3 层易伤' },
  plasmaBurn:       { value: 6, statusEffect: { type: 'burn', stacks: 4 }, desc: '6 点伤害\n+4 灼烧' },
  adrenaline:       { statusEffect: { type: 'strength', stacks: 3 }, desc: '自身 +3 力量\n抽 1 张' },
  overclockOverload:{ statusEffect: { type: 'strength', stacks: 4 }, selfDamage: 4, desc: '自身 +4 力量\n失去 4 生命' },
  emergencyOverloadValve: { gainBattery: 2, desc: '+2 电量\n本回合受伤 +2' },
  quickReload:      { drawCards: 3, desc: '抽 3 张牌' },
  tacticalAnalysis: { drawCards: 2, gainBattery: 2, desc: '抽 2 张\n+2 电量' },
  battlePlan:       { drawCards: 1, desc: '抽 1 张\n手牌<=4 再抽 2' },
  systemReboot:     { cost: 0, drawCards: 3, desc: '清除自身负面\n抽 3 张（0 费）' },
  singularityCollapse: { value: 40, desc: '造成 40 点\n无视护盾伤害\n消耗' },
  darkMatterWall:   { value: 11, desc: '11 点护盾\n下回合不清零' },
  curvatureSlingshot: { drawCards: 2, gainBattery: 2, desc: '抽 2 张\n+2 电量\n消耗' },
  entropyField:     { percentDamage: 0.16, statusEffect: { type: 'poison', stacks: 3 }, desc: '最大生命 16%\n+3 中毒' },
  quantumLock:      { statusEffect: [{ type: 'vulnerable', stacks: 4 }, { type: 'weak', stacks: 3 }], desc: '+4 易伤\n+3 虚弱' },
  phaseShift:       { value: 13, drawCards: 1, desc: '13 点护盾\n抽 1 张' },

  /* ---------- 职业专属卡的升级 ---------- */
  aeroShot:         { value: 10, desc: '造成 10 点伤害' },
  aeroGuard:        { value: 9, desc: '获得 9 点护盾' },
  driftThrust:      { value: 5, desc: '5 点护盾\n抽 1 张' },
  orbitalScan:      { value: 7, desc: '7 点伤害\n抽 1 张' },

  rivetShot:        { value: 7, desc: '造成 7 点伤害' },
  bulkhead:         { value: 10, desc: '获得 10 点护盾' },
  thornPlating:     { value: 7, gainThorns: 4, desc: '7 点护盾\n+4 反伤' },
  shieldBash:       { shieldDamage: 0.85, desc: '伤害 = 当前护盾\n的 85%' },

  sporeBolt:        { value: 6, statusEffect: { type: 'poison', stacks: 3 }, desc: '6 点伤害\n+3 中毒' },
  chitin:           { value: 8, desc: '获得 8 点护盾' },
  mutagen:          { statusEffect: { type: 'poison', stacks: 3 }, desc: '+3 中毒\n抽 1 张' },
  mutagenicCloud:   { statusEffect: [{ type: 'poison', stacks: 3 }, { type: 'burn', stacks: 3 }, { type: 'weak', stacks: 3 }], desc: '敌人 +3 中毒\n+3 灼烧 +3 虚弱' },

  burstFire:        { value: 7, desc: '2 次 7 点伤害' },
  quickGuard:       { value: 7, desc: '获得 7 点护盾' },
  fragGrenade:      { value: 7, desc: '3 次 7 点伤害' },
  comboFinisher:    { value: 14, comboDamage: 4, desc: '14 点伤害\n每张已出牌 +4' },
};

const CURSE_CARDS = {
  voidCurse: { id: 'voidCurse', name: '虚空之咒', cost: 0, desc: '无法打出\n占用手牌位', type: 'curse', icon: 'curse', rarity: 'curse', curse: true, unplayable: true },
  parasite:  { id: 'parasite', name: '寄生孢子', cost: 0, desc: '无法打出\n回合结束受 1 伤', type: 'curse', icon: 'curse', rarity: 'curse', curse: true, unplayable: true, endTurnDamage: 1 },
  frail:     { id: 'frail', name: '虚弱之咒', cost: 0, desc: '无法打出\n在手中受伤 +1', type: 'curse', icon: 'curse', rarity: 'curse', curse: true, unplayable: true, damageAmplify: 1 },
};

let CARD_UID = 0;
function createCardInstance(def) { return { ...def, uid: CARD_UID++ }; }
/* ⚠️ CURSE_CARDS 是**对象**不是数组 —— 拿数字下标去索引只会得到 undefined，
   于是生成出来的「诅咒」是一张没有 id / 没有 curse 标记的空壳卡：
   不占手牌位、不受伤、也不算进 r.curses，整条诅咒玩法等于不存在。
   必须先取键名再用键名索引。 */
function createCurseCard() {
  const keys = Object.keys(CURSE_CARDS);
  return createCardInstance(CURSE_CARDS[keys[(Math.random() * keys.length) | 0]]);
}
function upgradeCard(card) {
  if (card.upgraded || !UPGRADES[card.id]) return null;
  return { ...card, ...UPGRADES[card.id], name: card.name + '+', upgraded: true, uid: card.uid };
}

/* 战后奖励池 = 通用卡（非 starter） + **本职业的** starter 卡。
   ⚠️ 其它职业的专属卡绝不能出现：那是别人的职业特色，混进来就稀释了四个乘员的差异。 */
function rewardPool(charId) {
  return Object.keys(CARD_DEFS).filter(k => {
    const d = CARD_DEFS[k];
    if (d.rarity === 'curse') return false;
    if (d.rarity !== 'starter') return true;
    return !!charId && d.char === charId;
  });
}
function rollRewards(count = 3, charId) {
  const pool = rewardPool(charId), out = [];
  while (out.length < count && pool.length) out.push(createCardInstance(CARD_DEFS[pool.splice((Math.random() * pool.length) | 0, 1)[0]]));
  return out;
}

/* 药水 */
const POTION_DEFS = {
  healthSerum: { id: 'healthSerum', name: '生命血清', icon: 'heal', desc: '恢复 15 生命', effect: { type: 'heal', value: 15 } },
  energyCell:  { id: 'energyCell', name: '能量电池', icon: 'battery', desc: '+2 电量', effect: { type: 'battery', value: 2 } },
  shieldSpray: { id: 'shieldSpray', name: '护盾喷雾', icon: 'shield', desc: '+12 护盾', effect: { type: 'shield', value: 12 } },
  fireBottle:  { id: 'fireBottle', name: '燃烧瓶', icon: 'burn', desc: '敌人 +5 灼烧', effect: { type: 'status', status: 'burn', stacks: 5 } },
  poisonBomb:  { id: 'poisonBomb', name: '毒气弹', icon: 'poison', desc: '敌人 +5 中毒', effect: { type: 'status', status: 'poison', stacks: 5 } },
  purifier:    { id: 'purifier', name: '净化剂', icon: 'purify', desc: '清除自身负面', effect: { type: 'purify' } },
};
function rollPotion() {
  const k = Object.keys(POTION_DEFS);
  return POTION_DEFS[k[(Math.random() * k.length) | 0]];
}

function shuffleArray(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
