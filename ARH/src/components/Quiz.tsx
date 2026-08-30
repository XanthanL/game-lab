import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { getQuizQuestions, QuizMode } from '../data/questions';
import { CrtOverlay } from './CrtOverlay';
import { useLang } from '../i18n/LangContext';
import { UI } from '../i18n/ui';
import { QUESTION_EN } from '../i18n/questions.en';

interface QuizQuestion {
  id: number;
  text: string;
  textEn?: string;
}

interface QuizProps {
  mode?: QuizMode;
  questions?: QuizQuestion[];
  onComplete: (answers: Record<number, number>) => void;
  storageKey?: string;
  scanTagLabel?: string;
}

// 按 frame.md 设计：颜色情绪暗示（狂热支持→深绿，强烈排斥→深红），中立灰色不鼓励
// 中立选项刻意弱化：虚线边 + 低透明度，hover 也不给强填充，强化"不鼓励骑墙"的视觉信号
const OPTIONS = [
  { value: 2, className: 'border-l-emerald-700 hover:bg-emerald-700 hover:border-emerald-700', activeText: 'text-emerald-800' },
  { value: 1, className: 'border-l-emerald-400 hover:bg-emerald-500 hover:border-emerald-500', activeText: 'text-emerald-600' },
  { value: 0, className: 'border-l-slate-200 border-dashed opacity-60 hover:opacity-100 hover:bg-slate-100 hover:border-slate-300', activeText: 'text-slate-500' },
  { value: -1, className: 'border-l-orange-400 hover:bg-orange-500 hover:border-orange-500', activeText: 'text-orange-600' },
  { value: -2, className: 'border-l-red-800 hover:bg-red-800 hover:border-red-800', activeText: 'text-red-800' },
];

// 防刷中立的嘲讽文案池（按语言取用）

const DEFAULT_STORAGE_KEY = 'arh_quiz_progress';

// 进度 schema 版本：题目或坐标模型改版后，旧档的 questionId→方向映射可能错位，
// 必须丢弃重建而非沿用，否则会算出错误坐标。改版时将此常量 +1 即可使旧档自动失效。
const PROGRESS_VERSION = 1;

interface SavedProgress {
  version: number;
  storageKey: string;
  currentIdx: number;
  answers: Record<number, number>;
}

const loadProgress = (storageKey: string): SavedProgress | null => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedProgress;
    // 版本不符（含旧档无 version 字段）→ 视为过期，丢弃不沿用
    if (saved.version !== PROGRESS_VERSION) return null;
    return saved.storageKey === storageKey ? saved : null;
  } catch {
    return null;
  }
};

export const Quiz: React.FC<QuizProps> = ({ mode, questions: injected, onComplete, storageKey: propKey, scanTagLabel }) => {
  const storageKey = propKey ?? DEFAULT_STORAGE_KEY;
  const questions = useMemo(() => (injected ?? getQuizQuestions(mode ?? 'deep')) as QuizQuestion[], [injected, mode]);
  const saved = useMemo(() => loadProgress(storageKey), [storageKey]);
  const reduce = useReducedMotion();
  const { lang } = useLang();
  const T = UI[lang];
  // 选项文案按当前语言取用（与 OPTIONS 顺序一致：2,1,0,-1,-2）
  const OPT_LABELS = [T.optStrongAgree, T.optAgree, T.optNeutral, T.optDisagree, T.optStrongDisagree];
  const [currentIdx, setCurrentIdx] = useState(saved?.currentIdx ?? 0);
  const [answers, setAnswers] = useState<Record<number, number>>(saved?.answers ?? {});
  const [neutralStreak, setNeutralStreak] = useState(0);
  const [taunt, setTaunt] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  // 进度自动保存：刷新/误关不丢档
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: PROGRESS_VERSION, storageKey, currentIdx, answers }));
    } catch { /* 隐私模式下静默失败 */ }
  }, [mode, currentIdx, answers]);

  const handleSelect = (val: number) => {
    // 防刷中立机制：连续 3 次中立触发嘲讽 + 抖动
    if (val === 0) {
      const streak = neutralStreak + 1;
      setNeutralStreak(streak);
      if (streak >= 3) {
        setTaunt(T.neutralTaunts[Math.floor(Math.random() * T.neutralTaunts.length)]);
        setShake(s => s + 1);
      }
    } else {
      setNeutralStreak(0);
      setTaunt(null);
    }

    const currentQuestion = questions[currentIdx];
    const newAnswers = { ...answers, [currentQuestion.id]: val };
    setAnswers(newAnswers);

    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
      onComplete(newAnswers);
    }
  };

  const currentAnswer = answers[questions[currentIdx].id];

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50 text-slate-900">
      <CrtOverlay />
      <div className="w-full max-w-xl">
        <div className="mb-12 flex justify-between items-center">
          <span className="font-mono text-xs text-slate-400 uppercase tracking-widest">
            {String(currentIdx + 1).padStart(2, '0')} / {String(questions.length).padStart(2, '0')}
            <span className="ml-3 text-slate-300">{scanTagLabel ?? (mode ? T.scanTag(mode) : '')}</span>
          </span>
          <div className="w-48 h-1 bg-slate-200 relative overflow-hidden">
            <motion.div 
              className="absolute left-0 top-0 h-full bg-slate-900"
              initial={{ width: 0 }}
              animate={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentIdx}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
          >
            <div className="border-l-4 border-slate-900 pl-8 mb-16">
              <h2 className="text-2xl font-serif leading-relaxed text-justify">
                {lang === 'en' ? (questions[currentIdx].textEn ?? QUESTION_EN[questions[currentIdx].id] ?? questions[currentIdx].text) : questions[currentIdx].text}
              </h2>
            </div>

            <motion.div
              key={shake}
              animate={shake > 0 ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : {}}
              transition={{ duration: 0.45 }}
              className="flex flex-col gap-3"
            >
              {OPTIONS.map((opt, i) => (
                <button
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full text-left py-4 pl-4 border-b border-slate-200 border-l-4 ${opt.className} hover:text-white transition-all font-medium tracking-wide ${currentAnswer === opt.value ? `${opt.activeText} font-bold` : 'text-slate-600'}`}
                >
                  {OPT_LABELS[i]}
                  {currentAnswer === opt.value && <span className="ml-2 text-xs opacity-60">{T.lastChoice}</span>}
                </button>
              ))}
              <p className="mt-3 font-mono text-[10px] text-slate-300 select-none">{T.neutralHint}</p>
            </motion.div>

            <AnimatePresence>
              {taunt && (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-6 text-sm text-red-600 font-bold font-serif"
                >
                  ⚠ {taunt}
                </motion.p>
              )}
            </AnimatePresence>
            
            <div className="mt-12">
                <button 
                onClick={() => currentIdx > 0 && setCurrentIdx(currentIdx - 1)}
                className="text-[10px] text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors"
              >
                {T.back}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
