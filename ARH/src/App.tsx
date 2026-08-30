import React, { useState } from 'react';
import { Home } from './components/Home';
import { Quiz } from './components/Quiz';
import { Result } from './components/Result';
import { Axis, QuizMode } from './data/questions';
import { calculateUserCoordinates, rankIdeologies } from './utils/algorithm';
import { ISLAM_SUB_QUESTIONS, ISLAM_TRIGGER_IDS } from './data/islam_subquiz';
import { LangProvider, useLang } from './i18n/LangContext';
import { LangToggle } from './i18n/LangToggle';
import { UI } from './i18n/ui';

type Step = 'home' | 'quiz' | 'islam_sub' | 'result';

function App() {
  const { lang } = useLang();
  const [step, setStep] = useState<Step>('home');
  const [mode, setMode] = useState<QuizMode>('deep');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [islamSubAnswers, setIslamSubAnswers] = useState<Record<number, number> | null>(null);
  const [overriddenCoords, setOverriddenCoords] = useState<Record<Axis, number> | null>(null);
  const [forcedHiddenKey, setForcedHiddenKey] = useState<string | null>(null);

  const handleStart = (selectedMode: QuizMode) => {
    setMode(selectedMode);
    setOverriddenCoords(null);
    setForcedHiddenKey(null);
    setStep('quiz');
  };
  
  const handleQuizComplete = (finalAnswers: Record<number, number>) => {
    setOverriddenCoords(null);
    setForcedHiddenKey(null);
    // 主测试结论落在伊斯兰方向 → 先进入派别细分（子试题），暂不展示结果
    const ranked = rankIdeologies(calculateUserCoordinates(finalAnswers));
    if (ranked[0] && ISLAM_TRIGGER_IDS.includes(ranked[0].id)) {
      setAnswers(finalAnswers);
      setIslamSubAnswers(null);
      setStep('islam_sub');
    } else {
      setAnswers(finalAnswers);
      setIslamSubAnswers(null);
      setStep('result');
    }
  };

  const handleIslamSubComplete = (subAnswers: Record<number, number>) => {
    setIslamSubAnswers(subAnswers);
    setStep('result');
  };

  const handleDevInject = (coords: Record<Axis, number>) => {
    setOverriddenCoords(coords);
    setForcedHiddenKey(null);
    setStep('result');
  };

  const handleDevInjectHidden = (key: string) => {
    setOverriddenCoords(null);
    setForcedHiddenKey(key);
    setStep('result');
  };

  // God Mode 直接入口：跳过主测试，直接进入伊斯兰派别细分（子试题），完成后展示子结论。
  // 注入一组伊斯兰倾向坐标，使主结论也落在伊斯兰方向，与子试题的派别细分形成连贯预览。
  const handleDevIslamSub = () => {
    setAnswers({});
    setIslamSubAnswers(null);
    setOverriddenCoords({ economy: 0, power: -10, culture: 40, identity: 30, ecology: 0, tech: 0, metaphysics: 85 });
    setForcedHiddenKey(null);
    setStep('islam_sub');
  };

  const handleReset = () => {
    setAnswers({});
    setIslamSubAnswers(null);
    setOverriddenCoords(null);
    setForcedHiddenKey(null);
    setStep('home');
  };

  return (
    <LangProvider>
      <LangToggle />
      <div className="min-h-screen bg-slate-50 selection:bg-red-100">
        {step === 'home' && <Home onStart={handleStart} onDevInject={handleDevInject} onDevInjectHidden={handleDevInjectHidden} onDevIslamSub={handleDevIslamSub} />}
        {step === 'quiz' && <Quiz mode={mode} storageKey={`arh_quiz_${mode}`} onComplete={handleQuizComplete} />}
        {step === 'islam_sub' && (
          <Quiz
            questions={ISLAM_SUB_QUESTIONS}
            storageKey="arh_islam_sub"
            scanTagLabel={UI[lang].islamSubTag}
            onComplete={handleIslamSubComplete}
          />
        )}
        {step === 'result' && <Result answers={answers} islamSubAnswers={islamSubAnswers} overriddenCoords={overriddenCoords} forcedHiddenKey={forcedHiddenKey} onReset={handleReset} />}
      </div>
    </LangProvider>
  );
}

export default App;
