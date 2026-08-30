import { Axis } from '../data/questions';

// 全站 UI 文案字典：中文为既有内容，英文为 F 类新增译文。
// 组件通过 useLang() 取 UI[lang].key；数据类内容（题目/意识形态/档案/帽子）见同目录各 .en.ts 资源。

export const UI = {
  zh: {
    // ===== Home =====
    homeTitle: '意识形态坐标测试',
    homeIntro: '在经济、权力、文化、认同、生态、科技和玄学七个维度上进行深度坐标定位，以严谨的算法解析你所处的政治光谱，并颁发专属鉴定档案。',
    deepBtn: '深度鉴定', deepSub: '95 题 / 完整光谱',
    standardBtn: '标准鉴定', standardSub: '65 题 / 均衡精度',
    quickBtn: '快速扫描', quickSub: '30 题 / 5 分钟',
    methodologyHead: '方法论说明', methodologyEn: 'Methodology',
    godPanelTitle: 'GOD MODE / 核心档案注入',
    godPanelSub: 'Authorized Access Only // System Debug',
    godClose: '关闭面板',
    godFactions: { '左': '进步/革命', '兔': '秩序/国家', '右': '市场/个人', '神': '超越/解构', '中': '中立/单议题' } as Record<string, string>,
    godHiddenHead: '隐藏结局 / Hidden Endings',
    godIslamHead: '伊斯兰派别细分 / Islamic Sub-Quiz',
    godIslamBtn: '直接进入伊斯兰子试题',
    scanTag: (mode: string) => mode === 'quick' ? '快速扫描' : mode === 'standard' ? '标准扫描' : '深度扫描',
    godFoot: '[DATA_INJECTION_PROTOCOL]: SELECT AN IDEOLOGY TO OVERRIDE CALCULATED COORDINATES. SYSTEM WILL ADD ±5 JITTER FOR REALISM.',

    // ===== Quiz =====
    optStrongAgree: '强烈同意', optAgree: '同意', optNeutral: '中立 / 纯路人', optDisagree: '反对', optStrongDisagree: '强烈反对',
    neutralHint: '中立选项不计入立场判定，连续选择会触发提示。',
    lastChoice: '// 上次选择',
    back: '// 回退',
    neutralTaunts: [
      '别端着了，选个立场吧！',
      '理中客当多了，是会没有结果的哦~',
      '连续中立警告：档案员已开始怀疑你的诚意。',
      '骑墙久了，裤裆会疼的。',
    ],

    // ===== Result: 通用 =====
    reportTitle: '意识形态坐标鉴定报告',
    reportTitleEn: 'Ideology Coordinate Assessment Report',
    islamSubTag: '伊斯兰派别细分',
    islamSectHead: '派别细分',
    islamSectHeadEn: 'Sect Refinement',
    factionTag: (f: string) => `阵营 · ${f}`,
    factionTagEn: 'Faction',
    serial: '编号：', generated: '生成时间：', sample: '样本量：', qs: '题', godInjected: '外部注入（GOD MODE）',
    noMatchTitle: '坐标全部触发否决红线',
    noMatchBody: '你的作答在多个维度都落在逻辑互斥的极端区间，算法无法收敛到一个最接近的意识形态。这本身也是一种立场——但本系统暂不颁发档案。',
    retake: '重新测试', endOfReport: 'END OF REPORT',

    // §01
    conclusion: '判定结论', conclusionEn: 'Conclusion',
    match: '契合度', wdist: '加权距离 d', compared: '纳入比较',
    hiddenAbort: '// 隐藏结局触发，常规坐标匹配已中止',
    hiddenCentristCond: (r: number) => `触发条件：中立选项占比 ${(r * 100).toFixed(1)}% > 阈值 33.3%`,
    hiddenManiacCond: (e: number, c: number) => `触发条件：极端选项占比 ${(e * 100).toFixed(1)}% ≥ 80.0%，且立场自洽度 ${c.toFixed(1)} < 50.0`,
    hiddenNetworkCond: (name: string, s: number, thr: number) => `触发条件：网络人格「${name}」强度 ${s.toFixed(1)} ≥ 阈值 ${thr.toFixed(1)}，该姿态以最直接的形式出现，盖过了具体意识形态`,
    latentPersonaHead: '隐藏网络人格 · Latent Online Persona',
    latentPersonaBody: (name: string) => `你的坐标归入「${name}」，但在中文网络的论战语境中，你的表达更可能被优先贴上以上标签——它们是附着于意识形态之上的网络身份，而非严谨流派。`,

    // §02
    coords: '七维坐标明细', coordsEn: 'Seven-Axis Coordinates',
    coordsIntro: (hasBreak: boolean) => `每轴取值 −100.0 ～ +100.0：负值偏向左侧极点，正值偏向右侧极点，0 为中立。${hasBreak ? ' 原始分 = Σ(答案值 × 方向 × 极性)，坐标 = 原始分 / 满分 × 100。' : ''}`,
    reading: '判读：', intensityWrap: (s: string) => `（${s}）`,
    rawScore: '原始分', answered: '作答',
    leaning: {
      economy: ['计划公有主导', '倾向再分配与干预', '混合经济居中', '倾向市场竞争', '市场私有主导'],
      power: ['强权威集中', '倾向秩序与管制', '权威与自由平衡', '倾向个人自由', '强个人自由'],
      culture: ['激进进步立场', '倾向进步开放', '进步与传统平衡', '倾向传统保守', '强传统保守'],
      identity: ['彻底全球主义', '倾向全球开放', '全球与民族平衡', '倾向民族本位', '强民族本位'],
      ecology: ['生态绝对优先', '倾向生态保护', '生态与发展平衡', '倾向发展优先', '发展绝对优先'],
      tech: ['激进技术加速', '倾向技术乐观', '技术与自然平衡', '倾向技术审慎', '主张回归自然'],
      metaphysics: ['彻底唯物无神', '倾向理性务实', '唯物唯心之间', '倾向神秘玄想', '沉迷神秘宿命'],
    } as Record<Axis, string[]>,
    intensity: ['接近中立', '温和', '明显', '强烈'] as string[],

    // §03
    ranking: '契合度排行', rankingEn: 'Match Ranking',
    thNo: '#', thFaction: '阵营', thIdeology: '意识形态', thWdist: '加权距离 d', thMatch: '契合度',
    rankingNote: (total: number, vetoed: number, gap?: number) =>
      `注：共 ${total} 个意识形态参与匹配${vetoed > 0 ? `，其中 ${vetoed} 个因触碰一票否决红线被排除` : ''}；仅列出前 10 名。${gap !== undefined ? (gap < 3 ? ` 榜首与次选仅差 ${gap.toFixed(1)} 分，结论仅供参考。` : ` 榜首领先次选约 ${gap.toFixed(1)} 分，匹配较确定。`) : ''}`,

    // §04
    profile: '答题行为画像', profileEn: 'Response Profile',
    prMetric: '指标', prValue: '数值', prRule: '判定规则', prStatus: '状态',
    prExtreme: '极端选项占比（±2）', prExtremeRule: '≥ 80% 且自洽度 < 50 → 魔怔人',
    prNeutral: '中立选项占比（0）', prNeutralRule: '> 33.3% → 理中客',
    prCoherence: '立场自洽度', prCoherenceRule: '各轴内方向一致度（0-100）',
    prTriggered: '已触发', prNotTriggered: '未触发',
    prCoherent: '立场一致', prCancelled: '同轴线内互相抵消',
    profileNote: '说明：自洽度衡量各维度内部立场的一致程度——同一维度里方向相反的极端作答会互相抵消，使自洽度趋近 0；而不同维度之间的立场差异（如经济偏左、文化偏右）是真实组合，不算矛盾。温和但始终一致的作答自洽度同样接近 100。',

    // §05
    divergence: '最大分歧分析', divergenceEn: 'Maximum Divergence',
    divergenceBody: (name: string, nameEn: string, dist: number) =>
      `在七维坐标空间中，与你欧氏距离最远的意识形态是${name}（${nameEn}），距离 ${dist.toFixed(1)}（理论上限 529.2）。`,
    divergenceAxis: (zh: string) => `${zh}轴分歧`,
    divergenceNote: '注：上表为分歧最大的三个维度（两坐标差的绝对值，满值 200）。',

    // §06
    archive: '思想档案', archiveEn: 'Ideology Profile',
    origin: '理论源流', figures: '代表人物 / 案例', keywords: '关键词', analysis: '分析',

    // 附录A
    appendix: '附录：他者视角', appendixEn: 'Appendix: As Others See You',
    appendixIntro: (name: string) => `以下为光谱上其他立场对「${name}」的常见指代，反映的是立场间的敌意话语，不代表本报告观点。`,
    attribTemplate: (from: string, label: string) => `可能被「${from}」视为「${label}」`,

    // 控制中心
    save: '保存鉴定报告', generating: '生成中…', copy: '复制结论', copied: '已复制',

    // 复制分享文案
    sharePrefix: '【ARH · 意识形态坐标鉴定】',
    shareHidden: '隐藏结局触发',
    shareCoord: (name: string, nameEn: string, pct: string, faction: string, coord: string) =>
      `${name}（${nameEn}）\n契合度 ${pct} · 阵营 ${faction}\n坐标：${coord}\n—— 在 ARH 政治档案馆测出来的，你呢？`,

    // ===== ErrorBoundary =====
    faultTitle: '系统异常 // SYSTEM FAULT',
    faultBody: '鉴定过程遇到未预期错误，报告未能生成。这通常是瞬时故障，重新加载即可恢复。',
    reload: '重新加载',

    // 印章
    sealText: '已鉴定',

    // 方法论说明（Home 内联列表，含网络人格阈值插值）
    methodology: (dThr: number, aThr: number) => [
      { lead: '坐标归一化：', body: `每题答案取值 −2 ～ +2，乘以题目方向与极性修正后按轴累加；轴坐标 = 原始分 / (题数 × 2) × 100，范围 −100 ～ +100。` },
      { lead: '匹配算法：', body: `加权欧氏距离 d = √( Σ wᵢ·(uᵢ − cᵢ)² )，其中 wᵢ 为该意识形态在第 i 轴的关注权重，uᵢ 为你的坐标，cᵢ 为该意识形态的锚点坐标；契合度 = (1 − d / d_max) × 100，d_max 为该权重下的最大可能距离。` },
      { lead: '一票否决：', body: `坐标触碰逻辑红线的组合直接排除。例如：权力轴 > +10（偏自由）者不可能匹配极权/法西斯主义；经济轴 > +20（偏市场）者不可能匹配马列/托派；认同轴 < −30（偏全球）者不可能匹配种族民族主义。` },
      { lead: '隐藏结局：', body: `中立占比 > 33.3% 判定为「理中客」；极端占比 ≥ 80% 且立场自洽度 < 50（极端答案相互矛盾）判定为「魔怔人」。坚定且一致的极端作答不会触发隐藏结局，将正常参与坐标匹配。` },
      { lead: '网络人格：', body: `系统另依据坐标复合强度识别七种网络键政身份（网左、网右、粉红、基本盘、非基本、殖人，及行为型的乐子人）：强度 ≥ ${dThr} 时视为以最直接的形式出现，升格为隐藏结局；强度在 ${aThr} ～ ${dThr} 之间时，作为「隐藏网络人格」附着在常规结论下方。` },
      { lead: '局限性：', body: `本测试为定序量表自评工具，结果受题目取样与个人语义理解影响，仅供参考，不构成对任何个体的政治定性。` },
    ],
  },
  en: {
    homeTitle: 'Ideology Coordinate Test',
    homeIntro: 'A rigorous coordinate placement across seven axes — Economy, Power, Culture, Identity, Ecology, Technology, and Metaphysics — to map where you stand on the political spectrum and issue your verified dossier.',
    deepBtn: 'Deep Scan', deepSub: '95 Qs / Full Spectrum',
    standardBtn: 'Standard Scan', standardSub: '65 Qs / Balanced',
    quickBtn: 'Quick Scan', quickSub: '30 Qs / 5 min',
    methodologyHead: 'Methodology', methodologyEn: '方法论说明',
    godPanelTitle: 'GOD MODE / Core Archive Injection',
    godPanelSub: 'Authorized Access Only // System Debug',
    godClose: 'Close Panel',
    godFactions: { '左': 'Progress / Revolution', '兔': 'Order / State', '右': 'Market / Individual', '神': 'Transcend / Deconstruct', '中': 'Neutral / Single-issue' } as Record<string, string>,
    godHiddenHead: 'Hidden Endings',
    godIslamHead: 'Islamic Sect Refinement / Sub-Quiz',
    godIslamBtn: 'Jump straight into the Islamic sub-quiz',
    scanTag: (mode: string) => mode === 'quick' ? 'RAPID SCAN' : mode === 'standard' ? 'STANDARD SCAN' : 'DEEP SCAN',
    godFoot: '[DATA_INJECTION_PROTOCOL]: SELECT AN IDEOLOGY TO OVERRIDE CALCULATED COORDINATES. SYSTEM WILL ADD ±5 JITTER FOR REALISM.',

    optStrongAgree: 'Strongly Agree', optAgree: 'Agree', optNeutral: 'Neutral / Bystander', optDisagree: 'Disagree', optStrongDisagree: 'Strongly Disagree',
    neutralHint: 'Neutral answers do not count toward your coordinates; picking it repeatedly triggers a warning.',
    lastChoice: '// last choice',
    back: '// back',
    neutralTaunts: [
      "Stop sitting on the fence — pick a side!",
      'Too much "neutral observer" and you get no verdict, you know~',
      'Neutral-streak warning: the archivist is doubting your sincerity.',
      'Straddle the fence too long and it starts to hurt.',
    ],

    reportTitle: 'Ideology Coordinate Assessment Report',
    reportTitleEn: '意识形态坐标鉴定报告',
    islamSubTag: 'Islamic Sect Refinement',
    islamSectHead: '派别细分',
    islamSectHeadEn: 'Sect Refinement',
    factionTag: (f: string) => `Faction · ${f}`,
    factionTagEn: '阵营',
    serial: 'Serial: ', generated: 'Generated: ', sample: 'Sample: ', qs: ' Qs', godInjected: 'External injection (GOD MODE)',
    noMatchTitle: 'All Coordinates Hit Veto Red Lines',
    noMatchBody: 'Your answers land in mutually exclusive extreme ranges across multiple axes, so the algorithm cannot converge on a nearest ideology. That is itself a stance — but this system issues no dossier for it.',
    retake: 'Retake', endOfReport: 'END OF REPORT',

    conclusion: 'Conclusion', conclusionEn: '判定结论',
    match: 'Match', wdist: 'W-Dist d', compared: 'Compared',
    hiddenAbort: '// Hidden ending triggered; regular matching aborted',
    hiddenCentristCond: (r: number) => `Trigger: neutral ratio ${(r * 100).toFixed(1)}% > threshold 33.3%`,
    hiddenManiacCond: (e: number, c: number) => `Trigger: extreme ratio ${(e * 100).toFixed(1)}% ≥ 80.0% AND coherence ${c.toFixed(1)} < 50.0`,
    hiddenNetworkCond: (name: string, s: number, thr: number) => `Trigger: online persona "${name}" strength ${s.toFixed(1)} ≥ ${thr.toFixed(1)} — appeared in its most direct form, overriding any specific ideology`,
    latentPersonaHead: 'Latent Online Persona',
    latentPersonaBody: (name: string) => `Your coordinates resolve to "${name}", but in Chinese online debate your expression is more likely to be tagged with the labels above first — these are network identities layered atop ideology, not rigorous schools.`,

    coords: 'Seven-Axis Coordinates', coordsEn: '七维坐标明细',
    coordsIntro: (hasBreak: boolean) => `Each axis ranges −100.0 to +100.0: negative leans left, positive leans right, 0 is neutral.${hasBreak ? ' Raw = Σ(answer × direction × polarity); coordinate = raw / max × 100.' : ''}`,
    reading: 'Reading: ', intensityWrap: (s: string) => `(${s})`,
    rawScore: 'raw', answered: 'answered',
    leaning: {
      economy: ['Planned-Public Dominant', 'Leans Redistribution', 'Mixed Economy', 'Leans Market', 'Market-Private Dominant'],
      power: ['Strong Authority', 'Leans Order', 'Authority / Liberty Balance', 'Leans Liberty', 'Strong Individual Liberty'],
      culture: ['Radical Progressive', 'Leans Progressive', 'Progress / Tradition Balance', 'Leans Traditional', 'Strong Traditionalist'],
      identity: ['Thorough Globalism', 'Leans Global', 'Global / National Balance', 'Leans National', 'Strong Nationalist'],
      ecology: ['Ecology Absolute', 'Leans Eco-Protection', 'Eco / Growth Balance', 'Leans Development', 'Development Absolute'],
      tech: ['Radical Tech Acceleration', 'Leans Tech-Optimist', 'Tech / Nature Balance', 'Leans Tech-Cautious', 'Back-to-Nature'],
      metaphysics: ['Thorough Materialist', 'Leans Rational', 'Between Material & Mystic', 'Leans Mystic', 'Mystic-Fatalist'],
    } as Record<Axis, string[]>,
    intensity: ['Near Neutral', 'Mild', 'Marked', 'Strong'] as string[],

    ranking: 'Match Ranking', rankingEn: '契合度排行',
    thNo: '#', thFaction: 'Faction', thIdeology: 'Ideology', thWdist: 'W-Dist d', thMatch: 'Match',
    rankingNote: (total: number, vetoed: number, gap?: number) =>
      `Note: ${total} ideologies matched${vetoed > 0 ? `, ${vetoed} excluded for hitting a veto red line` : ''}; top 10 shown.${gap !== undefined ? (gap < 3 ? ` Top and runner-up differ by only ${gap.toFixed(1)} pts — treat as indicative.` : ` Top leads runner-up by ~${gap.toFixed(1)} pts — fairly deterministic.`) : ''}`,

    profile: 'Response Profile', profileEn: '答题行为画像',
    prMetric: 'Metric', prValue: 'Value', prRule: 'Rule', prStatus: 'Status',
    prExtreme: 'Extreme ratio (±2)', prExtremeRule: '≥ 80% AND coherence < 50 → Maniac',
    prNeutral: 'Neutral ratio (0)', prNeutralRule: '> 33.3% → Fence-Sitter',
    prCoherence: 'Coherence', prCoherenceRule: 'Intra-axis consistency (0-100)',
    prTriggered: 'Triggered', prNotTriggered: 'Not triggered',
    prCoherent: 'Coherent', prCancelled: 'Intra-axis cancelled',
    profileNote: 'Note: coherence measures consistency within each axis — opposite extremes on the same axis cancel out, driving coherence toward 0; differences across axes (e.g. left on economy, right on culture) are real combinations, not contradictions. Mild but consistent answers still score near 100.',

    divergence: 'Maximum Divergence', divergenceEn: '最大分歧分析',
    divergenceBody: (name: string, nameEn: string, dist: number) =>
      `In the seven-axis space, the ideology farthest from you in Euclidean distance is ${name}, at distance ${dist.toFixed(1)} (theoretical max 529.2).`,
    divergenceAxis: (name: string) => `Gap on the ${name} Axis`,
    divergenceNote: 'Note: the three widest gaps above (absolute difference of the two coordinates, max 200).',

    archive: 'Ideology Profile', archiveEn: '思想档案',
    origin: 'Theoretical Origin', figures: 'Key Figures / Cases', keywords: 'Keywords', analysis: 'Analysis',

    appendix: 'Appendix: As Others See You', appendixEn: '附录：他者视角',
    appendixIntro: (name: string) => `Below are common labels other positions on the spectrum use for "${name}" — hostile in-group/out-group language, not the view of this report.`,
    attribTemplate: (from: string, label: string) => `May be called "${label}" by "${from}"`,

    save: 'Save Report', generating: 'Generating…', copy: 'Copy Summary', copied: 'Copied',

    sharePrefix: '[ARH · Ideology Coordinate Assessment]',
    shareHidden: 'Hidden ending triggered',
    shareCoord: (name: string, nameEn: string, pct: string, faction: string, coord: string) =>
      `${name} (${nameEn})\nMatch ${pct} · Faction ${faction}\nCoords: ${coord}\n—— Measured at the ARH Political Archive. What about you?`,

    faultTitle: 'SYSTEM FAULT',
    faultBody: 'An unexpected error occurred during assessment and the report could not be generated. This is usually transient — reloading should recover it.',
    reload: 'Reload',

    sealText: 'VERIFIED',

    // 方法论说明（Home 内联列表，含网络人格阈值插值）
    methodology: (dThr: number, aThr: number) => [
      { lead: 'Coordinate normalization: ', body: 'Each answer ranges −2 to +2; after multiplying by the question’s direction and polarity sign it is summed per axis. Axis coordinate = raw score / (question count × 2) × 100, ranging −100 to +100.' },
      { lead: 'Matching algorithm: ', body: `Weighted Euclidean distance d = √( Σ wᵢ·(uᵢ − cᵢ)² ), where wᵢ is that ideology’s attention weight on axis i, uᵢ your coordinate, cᵢ the ideology’s anchor coordinate. Match = (1 − d / d_max) × 100, with d_max the maximum possible distance under those weights.` },
      { lead: 'Veto red lines: ', body: 'Coordinate combinations that hit logical red lines are excluded outright. E.g. anyone with Power > +10 (liberty-leaning) can never match totalitarianism/fascism; Economy > +20 (market-leaning) can never match Marxism/Trotskyism; Identity < −30 (global-leaning) can never match ethno-nationalism.' },
      { lead: 'Hidden endings: ', body: 'A neutral ratio > 33.3% is flagged as “Professional Fence-Sitter”; an extreme ratio ≥ 80% with coherence < 50 (contradictory extremes) is flagged as “Ideology Overdose”. Firm, self-consistent extremes do not trigger a hidden ending and match normally.' },
      { lead: 'Network personas: ', body: `The system also reads composite coordinate strength to identify seven online-keyboard identities (Online Left, Online Right, Little Pink, the Base, the Non-Base, the Colonized Mind, plus the behavior-based For-the-Lulz): strength ≥ ${dThr} counts as the most direct form and is promoted to a hidden ending; strength between ${aThr} and ${dThr} attaches as a “latent online persona” beneath the main verdict.` },
      { lead: 'Limitations: ', body: 'This test is an ordinal self-report instrument; results depend on question sampling and personal interpretation, are for reference only, and make no political judgment about any individual.' },
    ],
  },
} as const;

export type UIDict = typeof UI.zh;
