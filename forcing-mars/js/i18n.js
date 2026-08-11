/**
 * i18n.js — 强渡火星 中英双语系统
 * 默认英文 (en)，可切换中文 (zh)。
 *
 * 工作原理：
 *  - 游戏是纯 Phaser Canvas，几乎所有可见文案都经 scene.add.text() 或 Text.setText() 输出。
 *  - 本模块在加载时即重写 GameObjectFactory.text 与 Text.prototype.setText，
 *    让所有「字面中文字符串」自动经过 tr() 翻译；原始中文保存在 obj.__orig 上。
 *  - 数据（卡牌/敌人/遗物/角色/剧情）以中文为 key、英文为 value 存入 DICT。
 *  - 动态战斗日志（含插值的模板串）用 TOKENS 片段替换 + 状态层数正则处理。
 *  - 切换语言时调用 refreshAll() 遍历所有存活 Text 对象重新翻译。
 *  - 日志走 addLog() 数组，故在 wrapLog() 中对 sender/msg 即时翻译。
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'fm-lang';

  // 默认英文；若已保存则用保存值
  var saved = 'en';
  try { saved = localStorage.getItem(STORAGE_KEY) || 'en'; } catch (e) {}

  var I18N = {
    lang: saved === 'zh' ? 'zh' : 'en',
    dict: {},
    tokens: [],
    _installed: false,
  };

  /* ============================================================
   * 翻译主函数
   * ============================================================ */
  function tr(s) {
    if (typeof s !== 'string') return s;
    if (I18N.lang !== 'en') return s; // 中文为源语言，原样返回
    if (I18N.dict[s] !== undefined) return I18N.dict[s];
    var out = s;
    // 状态层数：3层灼烧 -> 3 Burn
    out = out.replace(/(\d+)\s*层(灼烧|中毒|易伤|力量|虚弱|反伤)/g, function (m, n, st) {
      return n + ' ' + (I18N.dict[st] || st);
    });
    // 片段替换（TOKENS 已按长度降序排列，避免子串误伤）
    for (var i = 0; i < I18N.tokens.length; i++) {
      var zh = I18N.tokens[i][0], en = I18N.tokens[i][1];
      if (out.indexOf(zh) !== -1) out = out.split(zh).join(en);
    }
    return out;
  }
  I18N.tr = tr;

  /* ============================================================
   * 字典：中文 -> 英文（精确匹配）
   * ============================================================ */
  var D = I18N.dict;

  /* ---- 状态名 ---- */
  D['灼烧'] = 'Burn'; D['中毒'] = 'Poison'; D['易伤'] = 'Vulnerable';
  D['力量'] = 'Strength'; D['虚弱'] = 'Weak'; D['反伤'] = 'Thorns';
  // 状态图标单字（紧凑风格）
  D['灼'] = 'B'; D['毒'] = 'P'; D['易'] = 'V'; D['力'] = 'S'; D['弱'] = 'W'; D['反'] = 'T';

  /* ---- 卡牌名 ---- */
  D['激光射击'] = 'Laser Shot'; D['过载轰击'] = 'Overcharge Blast';
  D['电浆护盾'] = 'Plasma Shield'; D['矩阵防御'] = 'Shield Matrix';
  D['穿透光束'] = 'Piercing Beam'; D['紧急维修'] = 'Emergency Repair';
  D['反物质轨道炮'] = 'Antimatter Railgun'; D['应急过载应急阀'] = 'Emergency Overload Valve';
  D['纳米修复强化'] = 'Nano-Repair Boost'; D['等离子燃烧弹'] = 'Plasma Burn';
  D['热能传导'] = 'Thermal Conduction'; D['腐蚀毒雾'] = 'Corrosive Fog';
  D['孢子释放'] = 'Spore Release'; D['弱点扫描'] = 'Weakness Scan';
  D['战术标记'] = 'Tactical Mark'; D['肾上腺素'] = 'Adrenaline';
  D['超频过载'] = 'Overclock Overload'; D['快速装填'] = 'Quick Reload';
  D['战术分析'] = 'Tactical Analysis'; D['电磁脉冲炮'] = 'EMP Cannon';
  D['力场共振'] = 'Force Resonance'; D['纳米护甲'] = 'Nano Armor';
  D['生命汲取'] = 'Life Drain'; D['吸血打击'] = 'Vampiric Strike';
  D['引力碾压'] = 'Gravity Crush'; D['战术规划'] = 'Battle Plan';
  D['荆棘装甲'] = 'Thorn Armor'; D['核心熔毁'] = 'Meltdown';
  D['系统重启'] = 'System Reboot'; D['虚空斩击'] = 'Void Slash';
  // 诅咒卡
  D['虚空之咒'] = 'Void Curse'; D['寄生孢子'] = 'Parasite Spore'; D['虚弱之咒'] = 'Frail Curse';
  // 药水
  D['生命血清'] = 'Health Serum'; D['能量电池'] = 'Energy Cell'; D['护盾喷雾'] = 'Shield Spray';
  D['燃烧瓶'] = 'Fire Bottle'; D['毒气弹'] = 'Poison Bomb'; D['净化剂'] = 'Purifier';

  /* ---- 卡牌描述（CARD_DEFS） ---- */
  D['造成 6 点伤害'] = 'Deal 6 damage';
  D['造成 14 点伤害'] = 'Deal 14 damage';
  D['获得 5 点护盾'] = 'Gain 5 Shield';
  D['获得 12 点护盾'] = 'Gain 12 Shield';
  D['造成 10 点伤害，无视护盾'] = 'Deal 10 damage, ignore Shield';
  D['获得 8 点护盾，下一回合保留'] = 'Gain 8 Shield, retain next turn';
  D['造成 24 点毁灭伤害'] = 'Deal 24 annihilating damage';
  D['获得 1 点电量，本回合受伤 +2'] = 'Gain 1 Energy, take +2 damage this turn';
  D['获得 4 护盾并恢复 3 生命'] = 'Gain 4 Shield and restore 3 HP';
  D['造成 4 点伤害，施加 3 层灼烧'] = 'Deal 4 damage, apply 3 Burn';
  D['灼烧层数翻倍'] = 'Double Burn stacks';
  D['施加 2 层中毒'] = 'Apply 2 Poison';
  D['施加 1 层中毒，抽 1 张牌'] = 'Apply 1 Poison, draw 1 card';
  D['施加 2 层易伤'] = 'Apply 2 Vulnerable';
  D['造成 5 点伤害，施加 1 层易伤'] = 'Deal 5 damage, apply 1 Vulnerable';
  D['获得 2 层力量，抽 1 张牌'] = 'Gain 2 Strength, draw 1 card';
  D['获得 3 层力量，失去 6 点生命'] = 'Gain 3 Strength, lose 6 HP';
  D['抽 2 张牌'] = 'Draw 2 cards';
  D['抽 1 张牌，获得 1 点电量'] = 'Draw 1 card, gain 1 Energy';
  D['造成 4 次 3 点伤害，每次施加 1 层灼烧'] = 'Deal 4×3 damage, apply 1 Burn each hit';
  D['获得护盾等于力量层数×2'] = 'Gain Shield equal to Strength×2';
  D['获得 6 护盾并恢复 2 生命'] = 'Gain 6 Shield and restore 2 HP';
  D['造成 8 点伤害，恢复等量生命'] = 'Deal 8 damage, restore that much HP';
  D['造成 5 点伤害，恢复 3 点生命'] = 'Deal 5 damage, restore 3 HP';
  D['造成敌人最大生命值 15% 的伤害'] = 'Deal damage equal to 15% of enemy max HP';
  D['抽 1 张牌，若手牌≤3 则再抽 1 张'] = 'Draw 1 card; if hand ≤3, draw 1 more';
  D['获得 6 护盾，获得 2 层反伤'] = 'Gain 6 Shield, gain 2 Thorns';
  D['造成 20 点伤害，失去 10 点生命'] = 'Deal 20 damage, lose 10 HP';
  D['清除自身所有负面状态，抽 2 张牌'] = 'Cleanse all your debuffs, draw 2 cards';
  // 诅咒描述
  D['无法打出。占用手牌位。'] = 'Unplayable. Occupies a hand slot.';
  D['无法打出。回合结束时受到 1 点伤害。'] = 'Unplayable. Take 1 damage at end of turn.';
  D['无法打出。手牌中存在此卡时，受到伤害 +1。'] = 'Unplayable. While in hand, take +1 damage.';
  // 药水描述
  D['恢复 15 点生命'] = 'Restore 15 HP';
  D['获得 2 点电量'] = 'Gain 2 Energy';
  D['获得 12 点护盾'] = 'Gain 12 Shield';
  D['施加 5 层灼烧'] = 'Apply 5 Burn';
  D['施加 5 层中毒'] = 'Apply 5 Poison';
  D['清除玩家所有负面状态（灼烧/中毒/易伤/虚弱）'] = 'Cleanse all debuffs (Burn/Poison/Vulnerable/Weak)';

  /* ---- 卡牌升级描述（UPGRADES） ---- */
  D['造成 9 点伤害'] = 'Deal 9 damage';
  D['造成 20 点伤害'] = 'Deal 20 damage';
  D['获得 8 点护盾'] = 'Gain 8 Shield';
  D['获得 16 点护盾'] = 'Gain 16 Shield';
  D['造成 15 点伤害，无视护盾'] = 'Deal 15 damage, ignore Shield';
  D['获得 12 点护盾，下一回合保留'] = 'Gain 12 Shield, retain next turn';
  D['造成 32 点毁灭伤害'] = 'Deal 32 annihilating damage';
  D['获得 2 点电量，本回合受伤 +2'] = 'Gain 2 Energy, take +2 damage this turn';
  D['获得 6 护盾并恢复 5 生命'] = 'Gain 6 Shield and restore 5 HP';
  D['造成 6 点伤害，施加 4 层灼烧'] = 'Deal 6 damage, apply 4 Burn';
  D['灼烧层数翻倍（消耗降为 0）'] = 'Double Burn stacks (cost 0)';
  D['施加 3 层中毒'] = 'Apply 3 Poison';
  D['施加 2 层中毒，抽 2 张牌'] = 'Apply 2 Poison, draw 2 cards';
  D['施加 3 层易伤'] = 'Apply 3 Vulnerable';
  D['造成 7 点伤害，施加 2 层易伤'] = 'Deal 7 damage, apply 2 Vulnerable';
  D['获得 3 层力量，抽 1 张牌'] = 'Gain 3 Strength, draw 1 card';
  D['获得 4 层力量，失去 4 点生命'] = 'Gain 4 Strength, lose 4 HP';
  D['抽 3 张牌'] = 'Draw 3 cards';
  D['抽 2 张牌，获得 2 点电量'] = 'Draw 2 cards, gain 2 Energy';
  D['造成 4 次 4 点伤害，每次施加 1 层灼烧'] = 'Deal 4×4 damage, apply 1 Burn each hit';
  D['获得护盾等于力量层数×2（消耗降为 0）'] = 'Gain Shield equal to Strength×2 (cost 0)';
  D['获得 8 护盾并恢复 3 生命'] = 'Gain 8 Shield and restore 3 HP';
  D['造成 12 点伤害，恢复等量生命'] = 'Deal 12 damage, restore that much HP';
  D['造成 7 点伤害，恢复 5 点生命'] = 'Deal 7 damage, restore 5 HP';
  D['造成敌人最大生命值 25% 的伤害'] = 'Deal damage equal to 25% of enemy max HP';
  D['抽 1 张牌，若手牌≤4 则再抽 2 张'] = 'Draw 1 card; if hand ≤4, draw 2 more';
  D['获得 9 护盾，获得 3 层反伤'] = 'Gain 9 Shield, gain 3 Thorns';
  D['造成 28 点伤害，失去 6 点生命'] = 'Deal 28 damage, lose 6 HP';
  D['清除自身所有负面状态，抽 3 张牌（消耗降为 0）'] = 'Cleanse all your debuffs, draw 3 cards (cost 0)';
  D['造成 16 点伤害，消耗 1 层力量'] = 'Deal 16 damage, consume 1 Strength';

  /* ---- 遗物 ---- */
  D['火星动力核心'] = 'Mars Power Core'; D['最大生命值上限 +10'] = '+10 Max HP';
  D['铥元素电池'] = 'Thulium Battery'; D['每回合初始电量 +1'] = '+1 Energy each turn';
  D['赤铁护符'] = 'Hematite Amulet'; D['每回合开始获得 3 点护盾'] = 'Gain 3 Shield at start of each turn';
  D['量子稳定器'] = 'Quantum Stabilizer'; D['灼烧/中毒伤害减半'] = 'Halve Burn/Poison damage';
  D['深空目镜'] = 'Deep-Space Monocle'; D['每回合多抽 1 张牌'] = 'Draw 1 extra card each turn';
  D['纳米修复蜂群'] = 'Nano-Repair Swarm'; D['每回合恢复 2 点生命值'] = 'Restore 2 HP each turn';
  D['反物质核心'] = 'Antimatter Core'; D['力量效果翻倍'] = 'Double Strength effect';
  D['火星古老符文'] = 'Mars Ancient Rune'; D['药水效果翻倍'] = 'Double Potion effect';

  /* ---- 角色 ---- */
  D['宇航员'] = 'Astronaut'; D['平衡的探索者'] = 'Balanced Explorer';
  D['HP 80 / 电量 3。初始牌组均衡，适合新手。每回合开始时 10% 概率获得 1 点护盾。'] =
    'HP 80 / Energy 3. Balanced starter deck, good for beginners. 10% chance to gain 1 Shield at start of each turn.';
  D['工程兵'] = 'Engineer'; D['护盾大师'] = 'Shield Master';
  D['HP 70 / 电量 4。擅长护盾防御，初始牌组含护盾卡。出护盾卡时额外获得 2 点护盾。'] =
    'HP 70 / Energy 4. Shield specialist; starter deck has Shield cards. Gain 2 extra Shield when playing a Shield card.';
  D['异变者'] = 'Mutant'; D['状态操控者'] = 'Status Manipulator';
  D['HP 75 / 电量 3。擅长灼烧和中毒，初始牌组含状态卡。施加状态效果时层数 +1。'] =
    'HP 75 / Energy 3. Burn & Poison specialist; starter deck has status cards. +1 stack when applying a status effect.';
  D['突击兵'] = 'Assault'; D['连击杀手'] = 'Combo Killer';
  D['HP 65 / 电量 3。低血量高输出，初始牌组含多段攻击。打出攻击卡时 15% 概率获得 1 点电量。'] =
    'HP 65 / Energy 3. Low HP, high damage; starter deck has multi-hit attacks. 15% chance to gain 1 Energy when playing an attack card.';

  /* ---- 敌人 ---- */
  D['火星幼蛭'] = 'Mars Leech'; D['沙丘跃行者'] = 'Dune Stalker'; D['红土爬行者'] = 'Red Crawler';
  D['晶化寄生虫'] = 'Crystal Parasite'; D['地底潜伏者'] = 'Deep Lurker'; D['熔岩蜘蛛'] = 'Lava Spider';
  D['引力扭曲者'] = 'Gravity Warp'; D['岩浆魔像'] = 'Magma Golem'; D['虚空蛭'] = 'Void Leech';
  D['量子幽灵'] = 'Quantum Specter'; D['远古守护者'] = 'Ancient Guardian'; D['等离子九头蛇'] = 'Plasma Hydra';
  D['虚空收割者'] = 'Void Reaper'; D['火星吞噬者'] = 'Mars Devourer'; D['沙暴暴君'] = 'Sand Tyrant';
  D['晶化巨像'] = 'Crystal Titan';
  // 阶段2（狂暴）—— 字面串与动态后缀（狂暴 -> Enraged）
  D['火星吞噬者 · 狂暴'] = 'Mars Devourer · Enraged';
  D['沙暴暴君 · 狂暴'] = 'Sand Tyrant · Enraged';
  D['晶化巨像 · 狂暴'] = 'Crystal Titan · Enraged';
  D['· 狂暴'] = ' · Enraged';

  /* ---- 深度关卡 ---- */
  D['地表'] = 'Surface'; D['地下浅层'] = 'Subterranean Shallows'; D['地核深处'] = 'Deep Core';
  D['地表 — 0m'] = 'Surface — 0m';
  D['地下浅层 — 500m'] = 'Subterranean Shallows — 500m';
  D['地核深处 — 2000m'] = 'Deep Core — 2000m';

  /* ---- 通用 UI / 战斗短语（静态字面） ---- */
  D['▶ 玩家回合'] = '▶ Player Turn';
  D['● 敌人回合'] = '● Enemy Turn';
  D['玩家回合'] = 'Player Turn'; D['敌人回合'] = 'Enemy Turn';
  D['结束回合'] = 'End Turn';
  D['休息'] = 'Rest'; D['商店'] = 'Shop';
  D['不同角色拥有不同的生命值、电量和被动技能'] =
    'Different characters have different HP, Energy and passive skills';
  D['信号接入中'] = 'Signal Connecting';
  D['长按 [SPACE] 或 按住屏幕 1.5秒跳过'] = 'Hold [SPACE] or press screen 1.5s to skip';
  D['按任意键或点击屏幕开始'] = 'Press any key or tap to start';
  D['跳过中...'] = 'Skipping...';
  D['金币不足！'] = 'Not enough Gold!';
  D['持有金币：'] = 'Gold: ';
  // 事件相关常见 sender / 短语
  D['系统'] = 'System'; D['商店'] = 'Shop'; D['事件'] = 'Event'; D['药水'] = 'Potion';
  D['被动'] = 'Passive'; D['卡牌'] = 'Card'; D['敌人'] = 'Enemy'; D['玩家'] = 'Player';
  D['Boss'] = 'Boss';
  D['未知行动'] = 'Unknown action'; D['待机'] = 'Idle';

  /* ---- 商店 / 地图节点名称 ---- */
  D['休息'] = 'Rest'; D['商店'] = 'Shop';
  D['卡牌（50金币/张）'] = 'Cards (50 Gold each)';
  D['药水槽已满，获得 10 护盾代替'] = 'Potion slot full; gained 10 Shield instead';
  D['物资缓存：获得 10 护盾'] = 'Supply cache: gained 10 Shield';
  D['安全离开：获得 5 护盾'] = 'Left safely: gained 5 Shield';
  D['休息点：恢复'] = 'Rest site: restored';
  D['点生命'] = 'HP';
  D['获得'] = 'Gain ';
  D['金币'] = 'Gold';

  /* ---- 事件选项文本 ---- */
  D['一位火星地表的流浪商人 offering 你一件遗物，代价是 15 点生命'] =
    'A wandering merchant on Mars surface offers you a relic, for 15 HP';
  D['打开缓存（获得 10 护盾）'] = 'Open cache (gain 10 Shield)';
  D['安全离开（+5 护盾）'] = 'Leave safely (+5 Shield)';
  D['一座浸满暗红色液体的祭坛，散发着不祥的气息。似乎可以用生命换取力量'] =
    'An altar dripping dark-red fluid radiates ominous energy. Life for power?';
  D['献祭 10 HP，获得 30 金币'] = 'Sacrifice 10 HP, gain 30 Gold';
  D['汲取能量（+2 电量上限，-12 HP）'] = 'Draw energy (+2 Max Energy, -12 HP)';
  D['下载数据（获得 25 金币）'] = 'Download data (gain 25 Gold)';
  D['开采水晶（获得 15 金币，-6 HP）'] = 'Mine crystal (gain 15 Gold, -6 HP)';
  D['吸收能量（获得 4 层灼烧抗性 → 获得 10 护盾）'] = 'Absorb energy (gain Burn resist → gain 10 Shield)';
  D['分享金币（-20 金币，获得药水）'] = 'Share gold (-20 Gold, gain a potion)';
  D['锻造升级（升级 1 张卡，-15 金币）'] = 'Forge upgrade (upgrade 1 card, -15 Gold)';
  D['熔炼卡牌（移除 1 张卡，获得 20 金币）'] = 'Smelt card (remove 1 card, gain 20 Gold)';
  D['快速离开（+5 护盾）'] = 'Leave quickly (+5 Shield)';
  D['搜索货舱（获得 20-40 金币）'] = 'Search cargo (gain 20-40 Gold)';
  D['打破镜面（获得 15 金币，获得诅咒卡）'] = 'Break mirror (gain 15 Gold, gain a Curse card)';
  D['汲取大量能量（+2 电量上限，获得 5 层灼烧）'] = 'Draw massive energy (+2 Max Energy, gain 5 Burn)';
  D['温和汲取（+1 电量上限）'] = 'Gentle draw (+1 Max Energy)';
  D['驱逐游魂（+8 护盾）'] = 'Banish wraith (+8 Shield)';
  D['宇航员在火星洞穴中找到片刻安宁...'] = 'The astronaut finds a moment of peace in the Martian cave...';

  /* ---- 剧情（StoryScene） ---- */
  D['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'] = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  D['[ 地球联合防卫阵线 (EDF) · 绝密量子广播 ]'] = '[ Earth Defense Front (EDF) · Top-Secret Quantum Broadcast ]';
  D['[ 时间戳：新纪元 142 年 / 地球资源枯竭第 11 载 ]'] = '[ Timestamp: New Era 142 / 11th year of Earth resource depletion ]';
  D['[ 接收人：编号 #M-07 · 宇航员「你」 ]'] = '[ Recipient: #M-07 · Astronaut "You" ]';
  D['...信号接入中...'] = '...signal connecting...';
  D['...量子纠缠链路建立...信号强度 37%...'] = '...quantum entanglement link established...signal 37%...';
  D['...正在解密...解密完成...'] = '...decrypting...decryption complete...';
  D['「这里是 EDF 最高指挥部。这不是演习。」'] = '"This is EDF High Command. This is not a drill."';
  D['「这是人类文明的最后一则简报。」'] = '"This is the final briefing of human civilization."';
  D['「十一年前，我们的母星死了。」'] = '"Eleven years ago, our home planet died."';
  D['「地核冷却，磁场消散，太阳风在三日内剥离了大气层。海水沸腾蒸发，地表化为焦土。我们倾尽最后的资源，将五十亿幸存者塞进火星轨道殖民站——我们叫它‘温床’。」'] =
    '"The core cooled, the magnetic field faded, solar winds stripped the atmosphere in three days. Oceans boiled away, the surface turned to scorched earth. With our last resources we crammed five billion survivors into an orbital colony above Mars — we call it the \'Cradle\'."';
  D['「我们以为逃出来了。」'] = '"We thought we had escaped."';
  D['「我们以为火星会接纳我们。」'] = '"We thought Mars would welcome us."';
  D['「我们错了。」'] = '"We were wrong."';
  D['「三天前，72 小时整，火星地下传来一道超低频震荡。频率单一，稳定，像是心跳。」'] =
    '"Three days ago — exactly 72 hours — a low-frequency tremor rose from beneath Mars. Single, steady frequency. Like a heartbeat."';
  D['「地核内的引力常数开始坍塌。殖民站轨道每天衰减 12 公里。按照这个速率，47 小时后，温床将坠入火星大气层，五十亿人将化为赤红天空中的一缕青烟。」'] =
    '"The gravitational constant inside the core began to collapse. The colony\'s orbit decays 12 km per day. At this rate, in 47 hours the Cradle will fall into Mars\' atmosphere, and five billion souls will become smoke in a crimson sky."';
  D['「我们向地下 2000 米的‘太古空腔’发射了最后一枚深探针。」'] =
    '"We fired our last deep probe into the \'Primordial Cavity\' two kilometers below the surface."';
  D['「传回的图像让整个指挥部陷入死寂。」'] = '"The images it sent back silenced the entire command."';
  D['「那不是岩石，不是矿物。那是一个正在苏醒的生命体——直径超过 3 公里，缠绕在地核之上，正在用它庞大的身躯抽干这颗行星的引力。」'] =
    '"It was not rock, not mineral. It was a waking lifeform — over 3 kilometers wide, coiled around the core, draining this planet\'s gravity with its vast body."';
  D['「我们给它起了个名字——『火星吞噬者』。」'] = '"We named it — the Mars Devourer."';
  D['「它是星体寄生虫。它杀死了地球，现在它要杀死火星。」'] =
    '"It is a planetary parasite. It killed Earth. Now it will kill Mars."';
  D['「而我们的殖民站，不过是它苏醒前的一粒尘埃。」'] =
    '"And our colony is but a speck of dust before its awakening."';
  D['「EDF 启动了最后的预案——『强渡计划』。」'] = '"EDF activated the final protocol — the Forcing Crossing."';
  D['「你，编号 #M-07，是唯一具备神经接合等级 S 的宇航员。只有你能驾驶单人轨道舱，强行破击降落火星，深入地下，直抵它的心脏。」'] =
    '"You, #M-07, are the only astronaut with Neural Link grade S. Only you can pilot a solo pod, force a landing on Mars, descend, and reach its heart."';
  D['「你已经在路上了。」'] = '"You are already on your way."';
  D['「此时此刻，你的轨道舱正在穿越火星大气层，外壳温度 2400 度，舷窗外是一片赤红的火海。」'] =
    '"Right now your pod is piercing the Martian atmosphere, hull at 2400 degrees, a sea of crimson flame beyond the window."';
  D['「任务简报如下：」'] = '"Mission briefing:"';
  D['▸ 第一阶段 · 地表 0m：辐射沙丘。清剿地表异星幼蛭，建立下降通道。'] =
    '▸ Phase 1 · Surface 0m: irradiated dunes. Clear the surface larvae, open a descent path.';
  D['▸ 第二阶段 · 地下 500m：晶化矿脉。依靠有限的电磁卡组生存下来。'] =
    '▸ Phase 2 · 500m below: crystal veins. Survive with your limited electromagnetic deck.';
  D['▸ 第三阶段 · 地下 2000m：炽热地核。在殖民站坠毁前，彻底抹杀『火星吞噬者』。'] =
    '▸ Phase 3 · 2000m below: the blazing core. Before the colony falls, annihilate the Mars Devourer.';
  D['「你的装甲只配备了 3 点初始充能电量。每往下一层，异变生态将呈指数级恶化。」'] =
    '"Your armor holds only 3 starting Energy. Each level deeper, the mutant ecosystem worsens exponentially."';
  D['「你将在战斗中获取新的电磁卡牌、古老的火星遗物、以及稀有的战术药水。」'] =
    '"In battle you will gain new electromagnetic cards, ancient Martian relics, and rare tactical potions."';
  D['「你将独自选择下潜的路径——是绕开精英怪物，还是冒险获取更丰厚的奖励。」'] =
    '"You alone choose the descent path — evade elites, or risk it for richer rewards."';
  D['「我们没有第二次机会。」'] = '"We do not get a second chance."';
  D['「五十亿人正在轨道上看着你。」'] = '"Five billion souls watch you from orbit."';
  D['「着陆倒计时：3... 2... 1...」'] = '"Landing countdown: 3... 2... 1..."';
  D['「强渡火星。」'] = '"Forcing Mars."';
  D['「祝人类……好运。」'] = '"Good luck, humanity..."';
  D['[ 信号中断 · 任务开始 ]'] = '[ Signal lost · Mission begins ]';

  /* ============================================================
   * 片段替换（TOKENS，按长度降序，避免子串误伤）
   * 用于动态战斗日志 / 浮动文字中等含插值的模板串
   * ============================================================ */
  I18N.tokens = [
    ['火星吞噬者', 'Mars Devourer'],
    ['未处于灼烧状态，', 'is not Burning; '],
    [' 张手牌进入弃牌堆', ' cards go to discard'],
    ['抽牌堆: ', 'Draw Pile: '],
    ['弃牌堆: ', 'Discard Pile: '],
    [' 张', ' cards'],
    ['点护盾', ' Shield'],
    [' 护盾', ' Shield'],
    ['护盾吸收', 'Shield absorb'],
    ['护盾卡', 'Shield card'],
    ['护盾', 'Shield'],
    [' 点伤害', ' damage'],
    ['点生命', ' HP'],
    [' 生命', ' HP'],
    [' 电量', ' Energy'],
    ['电量', 'Energy'],
    [' 金币', ' Gold'],
    ['金币', 'Gold'],
    ['造成 ', 'Deal '],
    ['获得 ', 'Gain '],
    ['失去 ', 'Lose '],
    ['恢复 ', 'Restore '],
    ['施加 ', 'Apply '],
    ['施加', 'Apply '],
    ['抽 ', 'Draw '],
    ['防御！', 'Defend! '],
    ['攻击！', 'Attack! '],
    ['蓄力中', 'Charging'],
    ['致命一击', 'Fatal Strike'],
    ['反伤', 'Thorns'],
    ['净化', 'Purify'],
    ['本回合', 'this turn'],
    ['下一回合', 'next turn'],
    ['每回合', 'each turn'],
    ['回合', ' turn'],
    ['狂暴', 'Enraged'],
    ['玩家', 'Player'],
    ['敌人', 'Enemy'],
    ['精英', 'Elite'],
    ['小Boss', 'Mini-Boss'],
    ['奖励', 'Reward'],
    ['击败', 'Defeat'],
    ['关卡', 'Stage'],
    ['阶段', 'Phase'],
    ['战利品', 'Loot'],
    ['（遗物翻倍）', '(relic doubled)'],
    ['（递增）', '(ramping)'],
    ['（反伤 ', '(thorns '],
    // 状态名单字/短词（无「层」时，如浮动文字 +5 灼烧）
    ['灼烧', 'Burn'], ['中毒', 'Poison'], ['易伤', 'Vulnerable'],
    ['力量', 'Strength'], ['虚弱', 'Weak'], ['反伤', 'Thorns'],
    // 其它战斗片段
    ['吸血', 'Lifesteal'], ['净化！', 'Purify!'], ['总计', 'Total'],
    ['无效', 'invalid'],
    ['购买卡牌：', 'Buy Card: '], ['购买遗物：', 'Buy Relic: '],
    ['购买药水：', 'Buy Potion: '], ['移除卡牌：', 'Remove Card: '],
    ['金币）', 'Gold)'], ['（-', '(-'],
    ['（附加', ' (+'], ['）', ')'],
  ];

  /* ---- 专有名词片段 token（确保动态日志中嵌入的名称也能翻译） ---- */
  var NAMES = [
    ['火星吞噬者', 'Mars Devourer'], ['沙丘跃行者', 'Dune Stalker'], ['红土爬行者', 'Red Crawler'],
    ['晶化寄生虫', 'Crystal Parasite'], ['地底潜伏者', 'Deep Lurker'], ['熔岩蜘蛛', 'Lava Spider'],
    ['引力扭曲者', 'Gravity Warp'], ['岩浆魔像', 'Magma Golem'], ['虚空蛭', 'Void Leech'],
    ['量子幽灵', 'Quantum Specter'], ['远古守护者', 'Ancient Guardian'], ['等离子九头蛇', 'Plasma Hydra'],
    ['虚空收割者', 'Void Reaper'], ['沙暴暴君', 'Sand Tyrant'], ['晶化巨像', 'Crystal Titan'],
    ['火星幼蛭', 'Mars Leech'],
    ['激光射击', 'Laser Shot'], ['过载轰击', 'Overcharge Blast'], ['电浆护盾', 'Plasma Shield'],
    ['矩阵防御', 'Shield Matrix'], ['穿透光束', 'Piercing Beam'], ['紧急维修', 'Emergency Repair'],
    ['反物质轨道炮', 'Antimatter Railgun'], ['应急过载应急阀', 'Emergency Overload Valve'],
    ['纳米修复强化', 'Nano-Repair Boost'], ['等离子燃烧弹', 'Plasma Burn'], ['热能传导', 'Thermal Conduction'],
    ['腐蚀毒雾', 'Corrosive Fog'], ['孢子释放', 'Spore Release'], ['弱点扫描', 'Weakness Scan'],
    ['战术标记', 'Tactical Mark'], ['肾上腺素', 'Adrenaline'], ['超频过载', 'Overclock Overload'],
    ['快速装填', 'Quick Reload'], ['战术分析', 'Tactical Analysis'], ['电磁脉冲炮', 'EMP Cannon'],
    ['力场共振', 'Force Resonance'], ['纳米护甲', 'Nano Armor'], ['生命汲取', 'Life Drain'],
    ['吸血打击', 'Vampiric Strike'], ['引力碾压', 'Gravity Crush'], ['战术规划', 'Battle Plan'],
    ['荆棘装甲', 'Thorn Armor'], ['核心熔毁', 'Meltdown'], ['系统重启', 'System Reboot'], ['虚空斩击', 'Void Slash'],
    ['虚空之咒', 'Void Curse'], ['寄生孢子', 'Parasite Spore'], ['虚弱之咒', 'Frail Curse'],
    ['生命血清', 'Health Serum'], ['能量电池', 'Energy Cell'], ['护盾喷雾', 'Shield Spray'],
    ['燃烧瓶', 'Fire Bottle'], ['毒气弹', 'Poison Bomb'], ['净化剂', 'Purifier'],
    ['火星动力核心', 'Mars Power Core'], ['铥元素电池', 'Thulium Battery'], ['赤铁护符', 'Hematite Amulet'],
    ['量子稳定器', 'Quantum Stabilizer'], ['深空目镜', 'Deep-Space Monocle'], ['纳米修复蜂群', 'Nano-Repair Swarm'],
    ['反物质核心', 'Antimatter Core'], ['火星古老符文', 'Mars Ancient Rune'],
    ['宇航员', 'Astronaut'], ['工程兵', 'Engineer'], ['异变者', 'Mutant'], ['突击兵', 'Assault'],
  ];
  for (var ni = 0; ni < NAMES.length; ni++) I18N.tokens.push(NAMES[ni]);

  /* ============================================================
   * 重写 Phaser 文本输出，使中文自动翻译
   * ============================================================ */
  function installOverrides() {
    if (I18N._installed || typeof Phaser === 'undefined' || !Phaser.GameObjects) return;
    var Factory = Phaser.GameObjects.GameObjectFactory.prototype;
    var TextProto = Phaser.GameObjects.Text.prototype;

    var origText = Factory.text;
    Factory.text = function (x, y, text, style) {
      var out = (typeof text === 'string') ? tr(text) : text;
      var obj = origText.call(this, x, y, out, style);
      if (typeof text === 'string') obj.__orig = text;
      return obj;
    };

    var origSetText = TextProto.setText;
    TextProto.setText = function (value) {
      if (typeof value === 'string') {
        this.__orig = value;
        return origSetText.call(this, tr(value));
      }
      return origSetText.call(this, value);
    };

    I18N._installed = true;
  }

  /* ============================================================
   * 重写 addLog（仅入数组，故在此即时翻译 sender/msg）
   * 由 main.js 在定义完函数后调用 I18N.wrapLog()
   * ============================================================ */
  I18N.wrapLog = function () {
    if (typeof addLog === 'function' && !I18N._logWrapped) {
      var _origAddLog = addLog;
      addLog = function (sender, msg) {
        _origAddLog(tr(sender), tr(msg));
      };
      I18N._logWrapped = true;
    }
  };

  /* ============================================================
   * 重新翻译当前所有存活 Text 对象
   * ============================================================ */
  function walk(obj, out) {
    if (!obj) return;
    if (obj.type === 'Text' && obj.__orig !== undefined) out.push(obj);
    var list = obj.list;
    if (list) { for (var i = 0; i < list.length; i++) walk(list[i], out); }
  }
  I18N.refreshAll = function () {
    if (typeof Phaser === 'undefined' || !Phaser.GAMES) return;
    for (var g = 0; g < Phaser.GAMES.length; g++) {
      var game = Phaser.GAMES[g];
      var scenes = game.scene.getScenes(true);
      for (var s = 0; s < scenes.length; s++) {
        var arr = [];
        var top = scenes[s].children.list || [];
        for (var i = 0; i < top.length; i++) walk(top[i], arr);
        for (var j = 0; j < arr.length; j++) {
          try { arr[j].setText(arr[j].__orig); } catch (e) {}
        }
      }
    }
  };

  /* ============================================================
   * 语言切换
   * ============================================================ */
  I18N.setLang = function (lang) {
    I18N.lang = (lang === 'zh') ? 'zh' : 'en';
    try { localStorage.setItem(STORAGE_KEY, I18N.lang); } catch (e) {}
    I18N.refreshAll();
    I18N.updateButton();
  };
  I18N.toggle = function () {
    I18N.setLang(I18N.lang === 'en' ? 'zh' : 'en');
  };

  /* ============================================================
   * 切换按钮（DOM 覆盖在 canvas 右上角）
   * ============================================================ */
  I18N.createButton = function () {
    if (document.getElementById('fm-lang-toggle')) return;
    var btn = document.createElement('button');
    btn.id = 'fm-lang-toggle';
    btn.textContent = I18N.lang === 'en' ? '中文' : 'EN';
    var st = btn.style;
    st.position = 'fixed';
    st.top = '10px';
    st.right = '10px';
    st.zIndex = '9999';
    st.padding = '7px 14px';
    st.font = "13px 'Courier New', monospace";
    st.letterSpacing = '1px';
    st.color = '#ffd9b0';
    st.background = 'rgba(20,8,8,0.72)';
    st.border = '1px solid rgba(255,120,60,0.55)';
    st.borderRadius = '20px';
    st.cursor = 'pointer';
    st.backdropFilter = 'blur(4px)';
    st.webkitBackdropFilter = 'blur(4px)';
    btn.addEventListener('click', function () { I18N.toggle(); });
    document.body.appendChild(btn);
  };
  I18N.updateButton = function () {
    var btn = document.getElementById('fm-lang-toggle');
    if (btn) btn.textContent = I18N.lang === 'en' ? '中文' : 'EN';
  };

  /* ============================================================
   * 初始化（在 Phaser 之后、main.js 之前加载）
   * ============================================================ */
  installOverrides();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', I18N.createButton);
  } else {
    I18N.createButton();
  }

  window.I18N = I18N;
  window.tr = tr;
})();
