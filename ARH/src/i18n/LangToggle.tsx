import React from 'react';
import { Languages } from 'lucide-react';
import { useLang } from './LangContext';

// 浮动语言切换：默认英文，点击切换回中文（F 类需求）。
// 固定右上角，z-[60] 高于 CRT(40) 与 God Mode/控制中心(50)，不遮挡正文。
export const LangToggle: React.FC = () => {
  const { lang, toggle } = useLang();
  return (
    <button
      onClick={toggle}
      aria-label="Switch language / 切换语言"
      className="fixed top-3 right-3 z-[60] flex items-center gap-1.5 bg-white/90 backdrop-blur border border-slate-300 text-slate-700 hover:text-slate-900 hover:border-slate-900 px-3 py-1.5 rounded-full text-xs font-bold font-mono tracking-wide transition-all shadow-sm active:scale-[0.97]"
    >
      <Languages size={14} />
      <span>{lang === 'en' ? 'EN' : '中'}</span>
      <span className="text-slate-300">/</span>
      <span className="text-slate-400">{lang === 'en' ? '中' : 'EN'}</span>
    </button>
  );
};
