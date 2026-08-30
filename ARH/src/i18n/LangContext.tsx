import React, { createContext, useContext, useEffect, useState } from 'react';

export type Lang = 'en' | 'zh';

const STORAGE_KEY = 'arh_lang';

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
}

const Ctx = createContext<LangCtx>({ lang: 'en', setLang: () => {}, toggle: () => {} });

// 网站默认英文（F 类需求）；用户点击切换按钮可回中文，选择持久化到 localStorage。
export const LangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'zh') return saved;
    } catch { /* ignore */ }
    return 'en'; // 默认英文
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  }, [lang]);

  const setLang = (l: Lang) => setLangState(l);
  const toggle = () => setLangState(p => (p === 'en' ? 'zh' : 'en'));

  return <Ctx.Provider value={{ lang, setLang, toggle }}>{children}</Ctx.Provider>;
};

export const useLang = () => useContext(Ctx);
