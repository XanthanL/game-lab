import React, { useRef, useMemo, useState, useEffect } from 'react';
import { motion, useReducedMotion, useMotionValue, animate } from 'framer-motion';
import {
  calculateUserCoordinates, rankIdeologies, findNemesis,
  analyzeAnswerProfile, detectHiddenResult, getAxisBreakdown, plainDistance,
  scoreNetworkPersonas, NETWORK_DIRECT_THRESHOLD, NETWORK_ATTACH_THRESHOLD, stableHash,
} from '../utils/algorithm';
import { IDEOLOGIES, HIDDEN_RESULTS, FACTION_THEMES } from '../data/ideologies';
import { IDEOLOGY_DETAILS } from '../data/ideology_details';
import { HAT_ATTRIBUTIONS } from '../data/hat_attributions';
import { Download, RotateCcw, Loader2, Copy, Check } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Axis } from '../data/questions';
import { scoreIslamSub } from '../data/islam_subquiz';
import { useLang } from '../i18n/LangContext';
import { UI } from '../i18n/ui';
import { FACTION_EN } from '../i18n/factions';
import { DETAIL_EN } from '../i18n/details.en';
import { IDEOLOGY_EN } from '../i18n/ideologies.en';
import { ATTRIB_EN } from '../i18n/attrib.en';

interface ResultProps {
  answers: Record<number, number>;
  islamSubAnswers?: Record<number, number> | null;
  overriddenCoords?: Record<Axis, number> | null;
  forcedHiddenKey?: string | null;
  onReset: () => void;
}

const AXIS_CONFIG: { key: Axis; zh: string; en: string; left: string; right: string; leftEn: string; rightEn: string; gloss: string }[] = [
  { key: 'economy', zh: '经济', en: 'ECONOMY', left: '平等公有', right: '自由市场', leftEn: 'Equal & Public', rightEn: 'Free Market', gloss: '资源归社会公有、国家再分配 ↔ 自由市场、私有产权' },
  { key: 'power', zh: '权力', en: 'POWER', left: '权威治理', right: '个人自由', leftEn: 'Authority', rightEn: 'Liberty', gloss: '集中权威、强管制 ↔ 分散权力、个人自由' },
  { key: 'culture', zh: '文化', en: 'CULTURE', left: '现代进步', right: '传统守护', leftEn: 'Progress', rightEn: 'Tradition', gloss: '进步平权、解构传统 ↔ 守护传统秩序与习俗' },
  { key: 'identity', zh: '认同', en: 'IDENTITY', left: '全球认同', right: '民族立场', leftEn: 'Global', rightEn: 'Nation', gloss: '超越国界、全球开放 ↔ 民族本位、本国优先' },
  { key: 'ecology', zh: '生态', en: 'ECOLOGY', left: '生态优先', right: '工业生产', leftEn: 'Ecology', rightEn: 'Industry', gloss: '生态约束、减量 ↔ 工业增长、开发' },
  { key: 'tech', zh: '科技', en: 'TECH', left: '加速前进', right: '回归自然', leftEn: 'Accelerate', rightEn: 'Nature', gloss: '拥抱技术加速 ↔ 审慎/回归自然' },
  { key: 'metaphysics', zh: '玄学', en: 'METAPHYSICS', left: '唯物辩证', right: '唯心神秘', leftEn: 'Materialist', rightEn: 'Mystic', gloss: '本轴测「超验信仰强度」：唯物实证、理性能动 ↔ 神秘玄想、宿命论（非哲学流派纯度）' },
];

// 轴注释英文版（与 AXIS_CONFIG.gloss 一一对应，英文模式取用）
const AXIS_GLOSS_EN: Record<Axis, string> = {
  economy: 'Resources owned by society and redistributed by the state ↔ free market and private property.',
  power: 'Centralized authority and strong control ↔ dispersed power and individual liberty.',
  culture: 'Progressive equality and deconstruction of tradition ↔ guarding traditional order and custom.',
  identity: 'Beyond borders, global openness ↔ national-first, our-country-first.',
  ecology: 'Ecological constraint and degrowth ↔ industrial growth and development.',
  tech: 'Embrace technological acceleration ↔ caution / return to nature.',
  metaphysics: 'This axis measures "strength of transcendental belief": materialist-empirical, agentic ↔ mystical-fatalist (not philosophical-purity).',
};

// 每轴主题色：用于 §03 坐标条填充、轴名圆点与数值着色，扫描时一眼区分维度
const AXIS_COLORS: Record<Axis, string> = {
  economy: '#ea580c',
  power: '#dc2626',
  culture: '#db2777',
  identity: '#9333ea',
  ecology: '#16a34a',
  tech: '#2563eb',
  metaphysics: '#0d9488',
};

// 鉴定印章：阵营色圆环，强化"档案证书"质感（旋转交给外层 motion 处理，避免与截图克隆冲突）
const AssessmentSeal: React.FC<{ color: string }> = ({ color }) => {
  const { lang } = useLang();
  const seal = UI[lang].sealText;
  return (
  <svg width="84" height="84" viewBox="0 0 100 100" className="opacity-90 shrink-0" aria-hidden>
    <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="3" />
    <circle cx="50" cy="50" r="37" fill="none" stroke={color} strokeWidth="1" strokeDasharray="2 3" />
    <text x="50" y="46" textAnchor="middle" fontSize="15" fontWeight="bold" fill={color} fontFamily="monospace" letterSpacing="1">ARH</text>
    <text x="50" y="62" textAnchor="middle" fontSize="9" fill={color} fontFamily="'PingFang SC', sans-serif">{seal}</text>
  </svg>
  );
};

// 倾向判读（-100 → 左极，+100 → 右极），措辞保持中性描述
const LEANING_LABELS: Record<Axis, string[]> = {
  economy: ['计划公有主导', '倾向再分配与干预', '混合经济居中', '倾向市场竞争', '市场私有主导'],
  power: ['强权威集中', '倾向秩序与管制', '权威与自由平衡', '倾向个人自由', '强个人自由'],
  culture: ['激进进步立场', '倾向进步开放', '进步与传统平衡', '倾向传统保守', '强传统保守'],
  identity: ['彻底全球主义', '倾向全球开放', '全球与民族平衡', '倾向民族本位', '强民族本位'],
  ecology: ['生态绝对优先', '倾向生态保护', '生态与发展平衡', '倾向发展优先', '发展绝对优先'],
  tech: ['激进技术加速', '倾向技术乐观', '技术与自然平衡', '倾向技术审慎', '主张回归自然'],
  metaphysics: ['彻底唯物无神', '倾向理性务实', '唯物唯心之间', '倾向神秘玄想', '沉迷神秘宿命'],
};

const getLeaning = (axis: Axis, score: number) => {
  const labels = LEANING_LABELS[axis];
  if (score < -60) return labels[0];
  if (score < -20) return labels[1];
  if (score <= 20) return labels[2];
  if (score <= 60) return labels[3];
  return labels[4];
};

// 强度分级：仅依据坐标绝对值
const getIntensity = (score: number) => {
  const a = Math.abs(score);
  if (a < 15) return '接近中立';
  if (a < 40) return '温和';
  if (a < 70) return '明显';
  return '强烈';
};

const fmt = (n: number, digits = 1) => {
  const v = n.toFixed(digits);
  return n > 0 ? `+${v}` : v;
};

// 章节标题：编号 + 当前语言题名 + 分隔线（随语言切换，不再中英混排）
const SectionHead: React.FC<{ no: string; zh: string; en: string }> = ({ no, zh, en }) => {
  const { lang } = useLang();
  const title = lang === 'en' ? en : zh;
  return (
  <div className="flex items-baseline gap-3 mb-5 border-b-2 border-slate-900 pb-2">
    <span className="font-mono text-xs text-slate-400">§{no}</span>
    <h4 className="font-black text-slate-900 text-base tracking-wide">{title}</h4>
  </div>
  );
};

// 章节逐节揭示：滚动进入视口时 stagger 进入（避免内容一次性全涌入）
// 强 ease-out 曲线 + 0.5s，符合「进入/退出用 ease-out」原则；reduce 时直接呈现无位移
const containerV = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const itemV = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } },
};

// 数字滚动：契合度从 0 滚到目标值（首见频次 → 允许「delight」）；reduce 时直接定格终值
const CountUp: React.FC<{ value: number; decimals?: number; suffix?: string }> = ({ value, decimals = 0, suffix = '' }) => {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const [display, setDisplay] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) { setDisplay(value); return; }
    const controls = animate(mv, value, {
      duration: 1.1,
      ease: [0.23, 1, 0.32, 1],
      onUpdate: (latest) => setDisplay(latest),
    });
    return () => controls.stop();
  }, [value, reduce, mv]);
  return <span>{display.toFixed(decimals)}{suffix}</span>;
};

export const Result: React.FC<ResultProps> = ({ answers, islamSubAnswers, overriddenCoords, forcedHiddenKey, onReset }) => {
  const resultRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const { lang } = useLang();
  const T = UI[lang];

  // God Mode 可直接预览隐藏结局（正常测试时为 null）
  const forcedHidden = forcedHiddenKey ? HIDDEN_RESULTS[forcedHiddenKey] : null;

  // 档案编号：由答案（God Mode 下由坐标）哈希生成，同输入同编号、刷新可复现（#44）
  const serialSeed = overriddenCoords ? JSON.stringify(overriddenCoords) : JSON.stringify(answers);
  const serialNumber = useMemo(() => `ARH-ARCHIVE-${stableHash(serialSeed)}`, [serialSeed]);

  const timeStamp = useMemo(() => {
    return new Date().toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN', { hour12: false });
  }, [lang]);

  const userCoords = useMemo(() => {
    if (overriddenCoords) return overriddenCoords;
    if (forcedHidden) return forcedHidden.coordinates;
    return calculateUserCoordinates(answers);
  }, [answers, overriddenCoords, forcedHidden]);

  const ranked = useMemo(() => rankIdeologies(userCoords), [userCoords]);
  const profile = useMemo(() => analyzeAnswerProfile(overriddenCoords ? {} : answers), [answers, overriddenCoords]);
  // 行为型隐藏结局（理中客/魔怔人）优先级最高
  const behaviorHidden = useMemo(() => forcedHidden || detectHiddenResult(profile), [profile, forcedHidden]);
  // 网络人格：基于坐标内容与答题行为的隐藏网络意识形态
  const networkPersonas = useMemo(() => scoreNetworkPersonas(userCoords, profile), [userCoords, profile]);
  // 最直接的形式 → 升格为隐藏结局（不覆盖行为型结局，God Mode 注入坐标时不触发）
  const networkDirectKey = useMemo(() => {
    if (behaviorHidden || overriddenCoords) return null;
    const top = networkPersonas[0];
    return top && top.strength >= NETWORK_DIRECT_THRESHOLD ? top.key : null;
  }, [behaviorHidden, overriddenCoords, networkPersonas]);
  const hiddenResult = behaviorHidden || (networkDirectKey ? HIDDEN_RESULTS[networkDirectKey] : null);
  // 未升格时，达到附着线的网络人格挂在常规结论下方
  const attachedPersonas = useMemo(
    () => (hiddenResult ? [] : networkPersonas.filter(p => p.strength >= NETWORK_ATTACH_THRESHOLD).slice(0, 3)),
    [hiddenResult, networkPersonas]
  );
  const nemesis = useMemo(() => findNemesis(userCoords), [userCoords]);

  // 伊斯兰派别细分（子试题结果）：仅在主结论为伊斯兰方向、且进入过子试题时出现
  const islamSect = useMemo(
    () => (islamSubAnswers ? scoreIslamSub(islamSubAnswers) : null),
    [islamSubAnswers]
  );

  // 每轴作答明细（仅在有真实答题数据时可用）
  const breakdown = useMemo(
    () => (profile.total > 0 ? getAxisBreakdown(answers) : null),
    [answers, profile.total]
  );

  const match = hiddenResult
    ? { ...hiddenResult, matchPercentage: 100, distance: 0 }
    : ranked[0];

  // 全否决兜底：极端作答若触发所有一票否决红线，ranked 为空、ranked[0] 为 undefined，
  // 继续访问 match.faction 会崩溃（#39）。此处提前渲染降级面板，而非白屏/报错。
  if (!match) {
    return (
      <div className="min-h-screen p-4 md:p-8 flex flex-col items-center bg-slate-50 relative pb-20">
          <div className="w-full max-w-3xl shadow-xl border border-slate-200 bg-white p-6 md:p-12">
          <div className="border-b-4 border-slate-900 pb-6 mb-10 flex justify-between items-start gap-3">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{T.reportTitle}</h2>
            </div>
            <span className="h2c-chip px-2.5 py-1 text-[10px] font-black text-white bg-slate-900 shrink-0">{T.factionTag(lang === 'en' ? 'Undetermined' : '未定')}</span>
          </div>
          <div className="flex flex-col items-center text-center py-12">
            <svg width="56" height="56" viewBox="0 0 64 64" fill="none" className="mb-6" aria-hidden>
              <rect x="1" y="1" width="62" height="62" rx="13" fill="#0f172a" />
              <line x1="8" y1="32" x2="56" y2="32" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 4" />
              <line x1="32" y1="8" x2="32" y2="56" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 4" />
            </svg>
            <h1 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">{T.noMatchTitle}</h1>
            <p className="text-slate-600 mb-8 text-sm leading-relaxed max-w-md">
              {T.noMatchBody}
            </p>
            <button onClick={onReset} className="bg-slate-900 text-white px-8 py-3 rounded-full font-bold hover:bg-black transition-all active:scale-[0.97]">
              {T.retake}
            </button>
          </div>
          <div className="mt-16 pt-6 border-t-2 border-slate-900 flex justify-between items-center font-mono text-[8px] text-slate-400">
            <span>© ARH SYSTEM 2026 // {serialNumber}</span>
            <span>NO MATCH</span>
          </div>
        </div>
      </div>
    );
  }

  const vetoedCount = IDEOLOGIES.length - ranked.length;
  const detail = IDEOLOGY_DETAILS[match.id];
  const detailEn = DETAIL_EN[match.id];
  const ideoEn = IDEOLOGY_EN[match.id];

  // 与宿敌的精确分歧数据：总距离 + 分歧最大的三个维度
  const nemesisDist = plainDistance(userCoords, nemesis.coordinates);
  const nemesisGaps = AXIS_CONFIG
    .map(({ key, zh, en }) => ({ zh, en, gap: Math.abs(userCoords[key] - nemesis.coordinates[key]) }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);

  // 帽子间：无专属数据时回退到"宿敌 + 自身帽子"这一条（按语言取用）
  const attribsZh = HAT_ATTRIBUTIONS[match.id] || [{ from: nemesis.name, label: match.hat }];
  const attribsEn = ATTRIB_EN[match.id] || [{ from: nemesis.nameEn, label: (IDEOLOGY_EN[match.id]?.hat) ?? match.hat }];
  const attributions = lang === 'en' ? attribsEn : attribsZh;

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      if (resultRef.current) {
        const canvas = await html2canvas(resultRef.current, {
          backgroundColor: '#ffffff',
          scale: 3,
          useCORS: true,
          allowTaint: true,
          scrollY: -window.scrollY,
          scrollX: -window.scrollX,
          windowWidth: document.documentElement.offsetWidth,
          windowHeight: document.documentElement.offsetHeight,
          onclone: (clonedDoc) => {
            // 移除 motion 产生的 transform 偏移，避免截图错位
            const motionElements = clonedDoc.querySelectorAll('[style*="transform"]');
            motionElements.forEach((el) => {
              (el as HTMLElement).style.transform = 'none';
              (el as HTMLElement).style.transition = 'none';
            });
            // html2canvas 对 CJK 行内盒的基线计算偏低，带内边距的 chip 文字会下沉；
            // 在克隆中改为 inline-flex 垂直居中，实测可与浏览器渲染对齐且盒高不变
            clonedDoc.querySelectorAll('.h2c-chip').forEach((el) => {
              const s = (el as HTMLElement).style;
              s.display = 'inline-flex';
              s.alignItems = 'center';
            });
          },
        });
        const link = document.createElement('a');
        link.download = `ARH-Result-${lang === 'en' ? match.nameEn : match.name}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // 复制文字结论，便于微信/小红书等直接粘贴分享（frame.md 强调的裂变钩子，#41）
  const handleCopy = async () => {
    const coordLine = AXIS_CONFIG.map(({ key, zh, en }) => `${lang === 'en' ? en : zh}${fmt(userCoords[key])}`).join('  ');
    const text = [
      T.sharePrefix,
      lang === 'en' ? `${match.nameEn} (${match.name})` : `${match.name}（${match.nameEn}）`,
      hiddenResult
        ? T.shareHidden
        : (lang === 'en'
          ? `Match ${match.matchPercentage.toFixed(1)}% · Faction ${FACTION_EN[match.faction]}`
          : `契合度 ${match.matchPercentage.toFixed(1)}% · 阵营 ${match.faction}`),
      lang === 'en' ? `Coords: ${coordLine}` : `坐标：${coordLine}`,
      lang === 'en' ? '—— Measured at the ARH Political Archive. What about you?' : '—— 在 ARH 政治档案馆测出来的，你呢？',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板不可用时静默失败（如非安全上下文）；下载 PNG 仍可用
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center bg-slate-50 relative pb-20">
      <div className="w-full max-w-3xl shadow-xl border border-slate-200">
        <motion.div
          ref={resultRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full bg-white p-6 md:p-12"
        >
          {/* 报告头：档案元数据 */}
          <div className="border-b-4 pb-6 mb-10" style={{ borderColor: FACTION_THEMES[match.faction].primary }}>
            <div className="flex justify-between items-start mb-4 gap-3">
              <div className="flex items-start gap-3">
                <svg width="40" height="40" viewBox="0 0 64 64" fill="none" className="mt-1 shrink-0" aria-label="ARH Logo">
                  <rect x="1" y="1" width="62" height="62" rx="13" fill={FACTION_THEMES[match.faction].primary} />
                  <line x1="8" y1="32" x2="56" y2="32" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="3 4" />
                  <line x1="32" y1="8" x2="32" y2="56" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="3 4" />
                  <circle cx="43" cy="21" r="9" fill="none" stroke="#ffffff" strokeWidth="2" />
                  <circle cx="43" cy="21" r="4" fill="#ffffff" />
                </svg>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{T.reportTitle}</h2>
                </div>
              </div>
              <span
                className="h2c-chip px-2.5 py-1 text-[10px] font-black text-white shrink-0"
                style={{ background: `linear-gradient(135deg, ${FACTION_THEMES[match.faction].gradientFrom}, ${FACTION_THEMES[match.faction].gradientTo})` }}
              >
                {T.factionTag(lang === 'en' ? FACTION_EN[match.faction] : match.faction)}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-1 font-mono text-[10px] text-slate-500">
              <p>{T.serial}{serialNumber}</p>
              <p>{T.generated}{timeStamp}</p>
              <p>{profile.total > 0 ? `${profile.total} ${T.qs}` : T.godInjected}</p>
            </div>
          </div>

          {/* 报告正文：章节逐节 stagger 揭示 */}
          <motion.div variants={containerV} initial={reduce ? false : 'hidden'} whileInView="show" viewport={{ once: true, margin: '-10% 0px' }}>
          {/* §01 判定结论 */}
          <motion.div variants={itemV} className="mb-12">
            <SectionHead no="01" zh={T.conclusion} en={T.conclusionEn} />
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <div className="h-1 w-16 mb-3 rounded-full" style={{ background: `linear-gradient(90deg, ${FACTION_THEMES[match.faction].gradientFrom}, ${FACTION_THEMES[match.faction].gradientTo})` }} />
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h1 className="text-4xl font-black text-slate-900 tracking-tight">{lang === 'en' ? match.nameEn : match.name}</h1>
                </div>
              </div>
              <motion.div
                initial={reduce ? false : { scale: 2.2, opacity: 0, rotate: -28 }}
                animate={{ scale: 1, opacity: 0.9, rotate: -10 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.45 }}
                style={{ transformOrigin: 'center' }}
              >
                <AssessmentSeal color={FACTION_THEMES[match.faction].primary} />
              </motion.div>
            </div>
            {!hiddenResult && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
                <div className="border border-slate-200 p-3">
                  <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-1">{T.match}</p>
                  <p className="font-mono text-xl font-black text-slate-900"><CountUp value={match.matchPercentage} decimals={1} suffix="%" /></p>
                </div>
                <div className="border border-slate-200 p-3">
                  <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-1">{T.wdist}</p>
                  <p className="font-mono text-xl font-black text-slate-900">{match.distance.toFixed(1)}</p>
                </div>
                <div className="border border-slate-200 p-3">
                  <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-1">{T.compared}</p>
                  <p className="font-mono text-xl font-black text-slate-900">{ranked.length}<span className="text-sm text-slate-400"> / {IDEOLOGIES.length}</span></p>
                </div>
              </div>
            )}
            {hiddenResult && profile.total > 0 && (
              <div className="border border-slate-300 bg-slate-50 p-4 mb-5 font-mono text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-900">{T.hiddenAbort}</p>
                {hiddenResult.id === 'hidden_centrist' && (
                  <p>{T.hiddenCentristCond(profile.neutralRatio)}</p>
                )}
                {hiddenResult.id === 'hidden_maniac' && (
                  <p>{T.hiddenManiacCond(profile.extremeRatio, profile.coherence)}</p>
                )}
                {networkDirectKey && (
                  <p>{T.hiddenNetworkCond(lang === 'en' ? HIDDEN_RESULTS[networkDirectKey].nameEn : HIDDEN_RESULTS[networkDirectKey].name, networkPersonas[0].strength, NETWORK_DIRECT_THRESHOLD)}</p>
                )}
              </div>
            )}
            <p className="text-slate-700 leading-relaxed border-l-4 pl-4" style={{ borderColor: FACTION_THEMES[match.faction].primary }}>
              {lang === 'en'
                ? (detailEn ? detailEn.coreIdea : ideoEn.serious_analysis)
                : (detail ? detail.coreIdea : match.serious_analysis)}
            </p>
            {/* 隐藏网络人格：未以最直接形式出现时，附着在常规结论下方 */}
            {attachedPersonas.length > 0 && (
              <div className="mt-6 border border-dashed border-slate-400 bg-slate-50 p-4">
                <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-2">{T.latentPersonaHead}</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {attachedPersonas.map(p => (
                    <span key={p.key} className="h2c-chip inline-flex items-baseline gap-1.5 px-3 py-1 text-xs font-bold bg-slate-900 text-white">
                      {lang === 'en' ? HIDDEN_RESULTS[p.key].nameEn : HIDDEN_RESULTS[p.key].name}
                      <span className="font-mono text-[9px] text-white/50">{lang === 'en' ? 'Str ' : '强度 '}{p.strength.toFixed(0)}</span>
                    </span>
                  ))}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {T.latentPersonaBody(lang === 'en' ? match.nameEn : match.name)}
                </p>
              </div>
            )}
          </motion.div>

          {/* 伊斯兰派别细分（子试题结果） */}
          {islamSect && (
            <motion.div variants={itemV} className="mb-12">
              <SectionHead no="01·B" zh={T.islamSectHead} en={T.islamSectHeadEn} />
              <div className="border border-slate-200 p-5 bg-slate-50/70">
                <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{lang === 'en' ? islamSect.ideology.nameEn : islamSect.ideology.name}</h2>
                  <span className="h2c-chip px-2.5 py-1 text-[10px] font-black text-white bg-teal-700 shrink-0">{lang === 'en' ? `Match ${islamSect.matchPercentage.toFixed(1)}%` : `契合度 ${islamSect.matchPercentage.toFixed(1)}%`}</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{lang === 'en' ? islamSect.ideology.descEn : islamSect.ideology.desc}</p>
                <p className="mt-3 text-[10px] text-slate-400">
                  {lang === 'en'
                    ? 'Refined via the Islamic sub-quiz — your specific sect / ideological direction within Islam.'
                    : '由「伊斯兰派别细分」子试题进一步划清：你在伊斯兰光谱内的具体派别 / 意识形态方向。'}
                </p>
              </div>
            </motion.div>
          )}

          {/* §02 契合度排行 */}
          {!hiddenResult && (
            <motion.div variants={itemV} className="mb-12">
              <SectionHead no="02" zh={T.ranking} en={T.rankingEn} />
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-300 font-mono text-[9px] uppercase tracking-widest text-slate-400">
                    <th className="py-2 pr-2 font-bold">{T.thNo}</th>
                    <th className="py-2 pr-2 font-bold">{T.thFaction}</th>
                    <th className="py-2 pr-2 font-bold">{T.thIdeology}</th>
                    <th className="py-2 pr-2 font-bold text-right">{T.thWdist}</th>
                    <th className="py-2 font-bold text-right">{T.thMatch}</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.slice(0, 10).map((r, i) => (
                    <tr key={r.id} className={`border-b border-slate-100 ${i === 0 ? 'bg-slate-50' : ''}`}>
                      <td className="py-2 pr-2 font-mono text-xs text-slate-400">{String(i + 1).padStart(2, '0')}</td>
                      <td className="py-2 pr-2">
                        <span className={`inline-flex w-5 h-5 items-center justify-center text-white text-[10px] font-black ${r.factionColor}`}>{lang === 'en' ? FACTION_EN[r.faction] : r.faction}</span>
                      </td>
                      <td className={`py-2 pr-2 text-sm ${i === 0 ? 'font-black text-slate-900' : 'text-slate-600'}`}>
                        {lang === 'en' ? r.nameEn : r.name}
                      </td>
                      <td className="py-2 pr-2 font-mono text-xs text-slate-500 text-right">{r.distance.toFixed(1)}</td>
                      <td className={`py-2 font-mono text-xs text-right ${i === 0 ? 'font-black text-slate-900' : 'text-slate-500'}`}>{r.matchPercentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="font-mono text-[10px] text-slate-400 mt-3">
                {T.rankingNote(IDEOLOGIES.length, vetoedCount, ranked[0].gapToSecond)}
              </p>
            </motion.div>
          )}

          {/* §03 七维坐标明细 */}
          <motion.div variants={itemV} className="mb-12">
            <SectionHead no="03" zh={T.coords} en={T.coordsEn} />
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              {T.coordsIntro(!!breakdown)}
            </p>
            <div className="space-y-7">
              {AXIS_CONFIG.map(({ key, zh, en, left, right, leftEn, rightEn, gloss }) => {
                const score = userCoords[key];
                const bd = breakdown?.[key];
                const leaningIdx = score < -60 ? 0 : score < -20 ? 1 : score <= 20 ? 2 : score <= 60 ? 3 : 4;
                const leaningLabel = lang === 'en' ? T.leaning[key][leaningIdx] : LEANING_LABELS[key][leaningIdx];
                const intensityIdx = Math.abs(score) < 15 ? 0 : Math.abs(score) < 40 ? 1 : Math.abs(score) < 70 ? 2 : 3;
                const intensityLabel = lang === 'en' ? T.intensity[intensityIdx] : getIntensity(score);
                return (
                  <div key={key}>
                    <div className="flex justify-between items-baseline mb-2">
                      <div className="flex items-baseline gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: AXIS_COLORS[key] }} />
                        <span className="font-black text-sm text-slate-900">{lang === 'en' ? en : zh}</span>
                      </div>
                      <span className="font-mono text-lg font-black" style={{ color: AXIS_COLORS[key] }}>{fmt(score)}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 -mt-1 mb-2 leading-snug">{lang === 'en' ? AXIS_GLOSS_EN[key] : gloss}</p>
                    {/* 双极条：中点为 0，向左右延伸，按轴着色 */}
                    <div className="relative h-4 bg-slate-100 border border-slate-200">
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-400 z-10" />
                      {/* 注：故意用 width 动画而非 transform:scaleX——因 html2canvas 截图会剥离 transform，
                          用真实 width 才能被截图正确捕获最终长度；bar 为挂载时一次性填充，性能无虞 */}
                      <motion.div
                        className="absolute top-0.5 bottom-0.5"
                        style={{ backgroundColor: AXIS_COLORS[key], left: score >= 0 ? '50%' : `${50 + score / 2}%` }}
                        initial={reduce ? false : { width: '0%' }}
                        animate={{ width: score >= 0 ? `${score / 2}%` : `${-score / 2}%` }}
                        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1], delay: 0.15 }}
                      />
                    </div>
                    <div className="flex justify-between font-mono text-[9px] text-slate-400 mt-1">
                      <span>{lang === 'en' ? leftEn : left} −100</span>
                      <span>0</span>
                      <span>+100 {lang === 'en' ? rightEn : right}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5">
                      {T.reading}<span className="font-bold text-slate-900">{leaningLabel}</span>
                      <span className="text-slate-400">{T.intensityWrap(intensityLabel)}</span>
                      {bd && (
                        <span className="font-mono text-slate-400 ml-2">
                          {T.rawScore} {fmt(bd.raw, 0)} / ±{bd.max} · {T.answered} {bd.answered} {T.qs}
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* §04 答题行为画像 */}
          {profile.total > 0 && (
            <motion.div variants={itemV} className="mb-12">
              <SectionHead no="04" zh={T.profile} en={T.profileEn} />
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-300 font-mono text-[9px] uppercase tracking-widest text-slate-400">
                    <th className="py-2 pr-2 font-bold">{T.prMetric}</th>
                    <th className="py-2 pr-2 font-bold text-right">{T.prValue}</th>
                    <th className="py-2 pr-2 font-bold">{T.prRule}</th>
                    <th className="py-2 font-bold text-right">{T.prStatus}</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="border-b border-slate-100">
                    <td className="py-2.5 pr-2 text-slate-700">{T.prExtreme}</td>
                    <td className="py-2.5 pr-2 font-mono font-bold text-slate-900 text-right">{(profile.extremeRatio * 100).toFixed(1)}%</td>
                    <td className="py-2.5 pr-2 font-mono text-[10px] text-slate-400">{T.prExtremeRule}</td>
                    <td className="py-2.5 font-mono text-[10px] text-right">{profile.extremeRatio >= 0.8 && profile.coherence < 50 ? <span className="text-red-600 font-bold">{T.prTriggered}</span> : <span className="text-slate-400">{T.prNotTriggered}</span>}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2.5 pr-2 text-slate-700">{T.prNeutral}</td>
                    <td className="py-2.5 pr-2 font-mono font-bold text-slate-900 text-right">{(profile.neutralRatio * 100).toFixed(1)}%</td>
                    <td className="py-2.5 pr-2 font-mono text-[10px] text-slate-400">{T.prNeutralRule}</td>
                    <td className="py-2.5 font-mono text-[10px] text-right">{profile.neutralRatio > 1 / 3 ? <span className="text-red-600 font-bold">{T.prTriggered}</span> : <span className="text-slate-400">{T.prNotTriggered}</span>}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2.5 pr-2 text-slate-700">{T.prCoherence}</td>
                    <td className="py-2.5 pr-2 font-mono font-bold text-slate-900 text-right">{profile.coherence.toFixed(1)}</td>
                    <td className="py-2.5 pr-2 font-mono text-[10px] text-slate-400">{T.prCoherenceRule}</td>
                    <td className="py-2.5 font-mono text-[10px] text-slate-400 text-right">{profile.coherence >= 50 ? T.prCoherent : T.prCancelled}</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                {T.profileNote}
              </p>
            </motion.div>
          )}

          {/* §05 最大分歧分析 */}
          {!hiddenResult && (
            <motion.div variants={itemV} className="mb-12">
              <SectionHead no="05" zh={T.divergence} en={T.divergenceEn} />
              <p className="text-slate-700 text-sm leading-relaxed mb-4">
                {T.divergenceBody(lang === 'en' ? nemesis.nameEn : nemesis.name, nemesis.nameEn, nemesisDist)}
              </p>
              <div className="grid grid-cols-3 gap-4">
                {nemesisGaps.map(g => (
                  <div key={g.zh} className="border border-slate-200 p-3">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-1">{T.divergenceAxis(lang === 'en' ? g.en : g.zh)}</p>
                    <p className="font-mono text-lg font-black text-slate-900">{g.gap.toFixed(1)}</p>
                  </div>
                ))}
              </div>
                <p className="font-mono text-[10px] text-slate-400 mt-3">{T.divergenceNote}</p>
            </motion.div>
          )}

          {/* §06 思想档案 */}
          <motion.div variants={itemV} className="mb-12">
            <SectionHead no="06" zh={T.archive} en={T.archiveEn} />
            {lang === 'en' ? (
              detailEn ? (
              <div className="space-y-6">
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-2">{T.origin}</p>
                  <p className="text-slate-700 text-sm leading-relaxed">{detailEn.origin}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-2">{T.figures}</p>
                  <div className="flex flex-wrap gap-2">
                    {detailEn.figures.map(f => (
                      <span key={f} className="h2c-chip px-3 py-1 text-xs font-bold border border-slate-300 text-slate-700">{f}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-2">{T.keywords}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {detailEn.keywords.map(k => (
                      <span key={k} className="font-mono text-[10px] text-slate-500">#{k}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-2">{T.analysis}</p>
                  <div className="space-y-4">
                    {detailEn.deepAnalysis.split('\n\n').map((para, i) => (
                      <p key={i} className="text-slate-700 leading-relaxed text-justify">{para}</p>
                    ))}
                  </div>
                </div>
              </div>
              ) : (
              <div className="space-y-4">
                {ideoEn.serious_analysis.split('\n\n').map((para, i) => (
                  <p key={i} className="text-slate-700 leading-relaxed text-justify">{para}</p>
                ))}
              </div>
              )
            ) : (
              detail ? (
              <div className="space-y-6">
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-2">{T.origin}</p>
                  <p className="text-slate-700 text-sm leading-relaxed">{detail.origin}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-2">{T.figures}</p>
                  <div className="flex flex-wrap gap-2">
                    {detail.figures.map(f => (
                      <span key={f} className="h2c-chip px-3 py-1 text-xs font-bold border border-slate-300 text-slate-700">{f}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-2">{T.keywords}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {detail.keywords.map(k => (
                      <span key={k} className="font-mono text-[10px] text-slate-500">#{k}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-2">{T.analysis}</p>
                  <div className="space-y-4">
                    {detail.deepAnalysis.split('\n\n').map((para, i) => (
                      <p key={i} className="text-slate-700 leading-relaxed text-justify">{para}</p>
                    ))}
                  </div>
                </div>
              </div>
              ) : (
              <div className="space-y-4">
                {match.serious_analysis.split('\n\n').map((para, i) => (
                  <p key={i} className="text-slate-700 leading-relaxed text-justify">{para}</p>
                ))}
              </div>
              )
            )}
          </motion.div>

          {/* 附录A 他者视角（帽子间） */}
          <motion.div variants={itemV} className="mb-8">
            <SectionHead no="A" zh={T.appendix} en={T.appendixEn} />
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              {T.appendixIntro(lang === 'en' ? match.nameEn : match.name)}
            </p>
            <ul className="space-y-2 border border-slate-200 p-5">
              {attributions.map((a, i) => (
                <li key={i} className="text-sm text-slate-700 leading-relaxed">
                  <span className="font-mono text-slate-400 mr-2">{String(i + 1).padStart(2, '0')}</span>
                  {T.attribTemplate(a.from, a.label)}
                </li>
              ))}
            </ul>
          </motion.div>

          </motion.div>

          {/* 页脚 */}
          <div className="mt-16 pt-6 border-t-2 flex justify-between items-center font-mono text-[8px] text-slate-400" style={{ borderColor: FACTION_THEMES[match.faction].primary }}>
            <span>© ARH SYSTEM 2026 // {serialNumber}</span>
            <span>END OF REPORT</span>
          </div>
        </motion.div>
      </div>

      {/* 控制中心 */}
      <div className="mt-12 flex gap-4 relative z-50">
        <button
          onClick={handleDownload}
          disabled={isGenerating}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-full font-bold hover:bg-black transition-all shadow-xl disabled:opacity-70 disabled:cursor-wait active:scale-[0.97]"
        >
          {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
          {isGenerating ? T.generating : T.save}
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 border-2 border-slate-900 text-slate-900 px-6 py-3 rounded-full font-bold hover:bg-slate-900 hover:text-white transition-all active:scale-[0.97]"
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
          {copied ? T.copied : T.copy}
        </button>
        <button onClick={onReset} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 px-6 py-3 font-bold transition-colors active:scale-[0.97]">
          <RotateCcw size={18} /> {T.retake}
        </button>
      </div>
    </div>
  );
};
