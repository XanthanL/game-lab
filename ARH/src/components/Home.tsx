import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { IDEOLOGIES, HIDDEN_RESULTS } from '../data/ideologies';
import { Axis, QuizMode } from '../data/questions';
import { NETWORK_DIRECT_THRESHOLD, NETWORK_ATTACH_THRESHOLD } from '../utils/algorithm';
import { CrtOverlay } from './CrtOverlay';
import { useLang } from '../i18n/LangContext';
import { UI } from '../i18n/ui';

interface HomeProps {
  onStart: (mode: QuizMode) => void;
  onDevInject: (coords: Record<Axis, number>) => void;
  onDevInjectHidden: (key: string) => void;
  onDevIslamSub: () => void;
}

export const Home: React.FC<HomeProps> = ({ onStart, onDevInject, onDevInjectHidden, onDevIslamSub }) => {
  const [devMode, setDevMode] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const reduce = useReducedMotion();
  const { lang } = useLang();
  const T = UI[lang];

  // GOD MODE 常驻可用：连点标题 5 次进入坐标注入面板（彩蛋式调试入口，#29 应需求恢复，移除生产环境 DEV 闸门）。
  const handleTitleClick = () => {
    const nextCount = clickCount + 1;
    if (nextCount >= 5) {
      setDevMode(true);
      setClickCount(0);
    } else {
      setClickCount(nextCount);
    }
  };

  const handleInject = (ideology: typeof IDEOLOGIES[0]) => {
    const jitter = () => (Math.random() * 10 - 5); // ±5 扰动
    const coords: Record<Axis, number> = {} as any;
    (Object.keys(ideology.coordinates) as Axis[]).forEach(axis => {
      coords[axis] = ideology.coordinates[axis] + jitter();
    });
    onDevInject(coords);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-50 text-slate-900 overflow-hidden relative">
      <CrtOverlay />
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
        className="max-w-xl w-full"
      >
        <div className="mb-16">
          {/* 主 Logo 标记：坐标准星 + 定位点 */}
          <svg width="56" height="56" viewBox="0 0 64 64" fill="none" className="mb-6" aria-label="ARH Logo">
            <rect x="1" y="1" width="62" height="62" rx="13" fill="#0f172a" />
            <line x1="8" y1="32" x2="56" y2="32" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 4" />
            <line x1="32" y1="8" x2="32" y2="56" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 4" />
            <circle cx="43" cy="21" r="9" fill="none" stroke="#f8fafc" strokeWidth="2" />
            <circle cx="43" cy="21" r="4" fill="#f8fafc" className="arh-pulse-dot" />
            <path d="M10 16 V10 H16" stroke="#475569" strokeWidth="1.5" fill="none" />
            <path d="M54 48 V54 H48" stroke="#475569" strokeWidth="1.5" fill="none" />
          </svg>
          <h2 
            onClick={handleTitleClick}
            className="text-slate-400 font-medium tracking-[0.2em] uppercase text-xs mb-4 cursor-default select-none"
          >
            ARH POLITICAL ARCHIVE {clickCount > 0 && `(${clickCount})`}
          </h2>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-8 leading-tight">{lang === 'en' ? 'Ideology Coordinate Test' : <>意识形态<br />坐标测试</>}</h1>
          <p className="text-lg text-slate-600 leading-relaxed font-serif text-justify border-l-4 border-slate-900 pl-6">
            {T.homeIntro}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => onStart('deep')}
            className="w-full bg-slate-900 text-white py-4 font-bold tracking-widest hover:bg-black hover:-translate-y-0.5 active:scale-[0.98] transition-all text-lg"
          >
            {T.deepBtn}
            <span className="ml-3 text-xs font-mono text-white/50">{T.deepSub}</span>
          </button>
          <button
            onClick={() => onStart('standard')}
            className="w-full border-2 border-slate-900 bg-white text-slate-900 py-4 font-bold tracking-widest hover:bg-slate-900 hover:text-white hover:-translate-y-0.5 active:scale-[0.98] transition-all text-lg"
          >
            {T.standardBtn}
            <span className="ml-3 text-xs font-mono opacity-50">{T.standardSub}</span>
          </button>
          <button
            onClick={() => onStart('quick')}
            className="w-full border-2 border-slate-900 text-slate-900 py-4 font-bold tracking-widest hover:bg-slate-900 hover:text-white hover:-translate-y-0.5 active:scale-[0.98] transition-all text-lg"
          >
            {T.quickBtn}
            <span className="ml-3 text-xs font-mono opacity-50">{T.quickSub}</span>
          </button>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-200 text-slate-400 text-[10px] font-mono flex justify-between uppercase">
          <span>v1.5.0 // 2026</span>
          <span>Anonymous System</span>
        </div>

        {/* 方法论说明：从鉴定报告移至首页介绍 */}
        <div className="mt-10 pt-6 border-t-2 border-slate-900">
          <div className="flex items-baseline gap-3 mb-5">
            <h4 className="font-black text-slate-900 text-sm tracking-wide">{T.methodologyHead}</h4>
            <span className="font-mono text-[9px] text-slate-400 uppercase tracking-widest">{T.methodologyEn}</span>
          </div>
          <ol className="space-y-3 text-xs text-slate-500 leading-relaxed list-decimal list-inside">
            {T.methodology(NETWORK_DIRECT_THRESHOLD, NETWORK_ATTACH_THRESHOLD).map((item, i) => (
              <li key={i}>
                <span className="font-bold text-slate-700">{item.lead}</span>
                {item.body}
              </li>
            ))}
          </ol>
        </div>
      </motion.div>

      {/* Developer God Mode Panel */}
      <AnimatePresence>
        {devMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-slate-900/95 backdrop-blur-md"
          >
            <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl shadow-2xl border border-white/20">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="font-black text-2xl tracking-tighter text-slate-900">{T.godPanelTitle}</h3>
                  <p className="text-xs text-slate-400 font-mono mt-1 uppercase tracking-widest">{T.godPanelSub}</p>
                </div>
                <button onClick={() => setDevMode(false)} className="bg-slate-900 text-white px-6 py-2 rounded-full text-xs font-bold uppercase hover:bg-black transition-all">{T.godClose}</button>
              </div>

              <div className="p-8 overflow-y-auto flex-grow space-y-10">
                {(['左', '兔', '右', '神', '中'] as const).map(f => (
                  <div key={f} className="space-y-4">
                    <div className="flex items-center gap-4">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm ${
                        f === '左' ? 'bg-red-500' : f === '兔' ? 'bg-rose-700' : f === '右' ? 'bg-blue-500' : f === '神' ? 'bg-purple-500' : 'bg-slate-500'
                      }`}>{f}</span>
                      <h4 className="font-bold text-slate-400 text-xs uppercase tracking-[0.3em]">{T.godFactions[f]} 阵营</h4>
                      <div className="h-[1px] flex-grow bg-slate-100"></div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {IDEOLOGIES.filter(i => i.faction === f).map(ideology => (
                        <button
                          key={ideology.id}
                          onClick={() => handleInject(ideology)}
                          className="group text-left p-4 bg-slate-50 hover:bg-slate-900 transition-all rounded-xl border border-slate-100 hover:border-slate-900 relative overflow-hidden"
                        >
                          <div className="relative z-10">
                            <p className="text-[10px] font-mono text-slate-400 group-hover:text-white/50 mb-1">ID: {ideology.id.toUpperCase()}</p>
                            <p className="font-bold text-slate-900 group-hover:text-white transition-colors">{lang === 'en' ? ideology.nameEn : ideology.name}</p>
                          </div>
                          <div className={`absolute bottom-0 left-0 h-1 transition-all duration-300 w-0 group-hover:w-full ${ideology.factionColor}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* 隐藏结局：正常由答题行为触发，此处可直接预览 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm bg-black">秘</span>
                    <h4 className="font-bold text-slate-400 text-xs uppercase tracking-[0.3em]">{T.godHiddenHead}</h4>
                    <div className="h-[1px] flex-grow bg-slate-100"></div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(HIDDEN_RESULTS).map(([key, ideology]) => (
                      <button
                        key={key}
                        onClick={() => onDevInjectHidden(key)}
                        className="group text-left p-4 bg-slate-50 hover:bg-black transition-all rounded-xl border border-dashed border-slate-300 hover:border-black relative overflow-hidden"
                      >
                        <div className="relative z-10">
                          <p className="text-[10px] font-mono text-slate-400 group-hover:text-white/50 mb-1">HIDDEN: {key.toUpperCase()}</p>
                          <p className="font-bold text-slate-900 group-hover:text-white transition-colors">{lang === 'en' ? ideology.nameEn : ideology.name}</p>
                        </div>
                        <div className="absolute bottom-0 left-0 h-1 transition-all duration-300 w-0 group-hover:w-full bg-black" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* 伊斯兰派别细分（子试题）：直接跳过主测试进入派别细分，便于单独验收（#41） */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm bg-teal-700">伊</span>
                    <h4 className="font-bold text-slate-400 text-xs uppercase tracking-[0.3em]">{T.godIslamHead}</h4>
                    <div className="h-[1px] flex-grow bg-slate-100"></div>
                  </div>
                  <button
                    onClick={onDevIslamSub}
                    className="group w-full text-left p-4 bg-slate-50 hover:bg-teal-700 transition-all rounded-xl border border-slate-100 hover:border-teal-700 relative overflow-hidden"
                  >
                    <div className="relative z-10">
                      <p className="text-[10px] font-mono text-slate-400 group-hover:text-white/50 mb-1">ISLAM_SUB_QUIZ</p>
                      <p className="font-bold text-slate-900 group-hover:text-white transition-colors">{T.godIslamBtn}</p>
                    </div>
                    <div className="absolute bottom-0 left-0 h-1 transition-all duration-300 w-0 group-hover:w-full bg-teal-700" />
                  </button>
                </div>
              </div>

              <div className="p-6 bg-slate-900 text-slate-500 border-t border-white/5">
                <p className="text-[10px] font-mono leading-relaxed text-center">
                  {T.godFoot}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
