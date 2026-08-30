'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AccessGate } from '@/components/AccessGate';
import { PriceHeader } from '@/components/PriceHeader';
import { GoldChart } from '@/components/GoldChart';
import { ChartControls } from '@/components/ChartControls';
import { SymbolSwitcher } from '@/components/SymbolSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MarketNotes } from '@/components/MarketNotes';
import { useHistory } from '@/hooks/useHistory';
import { useQuote } from '@/hooks/useQuote';
import { useTheme } from '@/hooks/useTheme';
import { Interval, MaConfig, Range, SymbolId } from '@/lib/types';
import { CROSS_PRESETS, DEFAULT_CROSS_PRESET, MA_PRESETS, BOLL_DEFAULT, RSI_DEFAULT } from '@/config/indicators';
import { DEFAULT_SYMBOL, SYMBOL_LIST, SYMBOLS } from '@/config/symbols';

export default function Page() {
  return (
    <AccessGate>
      <Dashboard />
    </AccessGate>
  );
}

function Dashboard() {
  const reduce = useReducedMotion();
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  const [symbolId, setSymbolId] = useState<SymbolId>(DEFAULT_SYMBOL);
  const symbol = SYMBOLS[symbolId];
  const [interval, setIntervalVal] = useState<Interval>('60m');
  const [range, setRange] = useState<Range>('5d');
  // 用户手动开关的 MA（与信号联动分离）
  const [userMas, setUserMas] = useState<MaConfig[]>(MA_PRESETS);
  const [crossEnabled, setCrossEnabled] = useState(false);
  const [crossPreset, setCrossPreset] = useState(DEFAULT_CROSS_PRESET);
  const [bollEnabled, setBollEnabled] = useState(false);
  const [rsiEnabled, setRsiEnabled] = useState(false);

  const handleSymbol = (id: SymbolId) => {
    const s = SYMBOLS[id];
    setSymbolId(id);
    setIntervalVal(s.intervals[0].value);
    setRange(s.ranges[0].value);
  };

  const toggleMa = (id: string, enabled: boolean) =>
    setUserMas((prev) => prev.map((m) => (m.id === id ? { ...m, enabled } : m)));

  // 信号联动：开启信号时只显示预设对应两条 MA，关闭时还原用户手动状态
  const preset = CROSS_PRESETS.find((p) => p.id === crossPreset) ?? CROSS_PRESETS[0];
  const mas = crossEnabled
    ? userMas.map((m) => ({
        ...m,
        enabled: m.id === preset.shortMa || m.id === preset.longMa,
      }))
    : userMas;

  // 预热根数：MA / 布林带 / RSI 的最大周期 - 1，保证指标在选中区间内可完整绘制
  const maMax = mas.reduce((mx, m) => (m.enabled && m.period > mx ? m.period : mx), 0);
  const indMax = Math.max(bollEnabled ? BOLL_DEFAULT.period : 0, rsiEnabled ? RSI_DEFAULT.period : 0);
  const preload = Math.max(0, Math.max(maMax, indMax) - 1);
  const { data: history, error, isLoading } = useHistory(symbolId, interval, range, preload);
  const candles = history?.candles ?? [];
  const fullCandles = history?.fullCandles ?? candles;
  const { data: quote } = useQuote(symbolId);

  // 交叉检测用实际显示 MA 的 kind/period，保证与图表同源
  const shortMaCfg = mas.find((m) => m.id === preset.shortMa);
  const longMaCfg = mas.find((m) => m.id === preset.longMa);
  const cross =
    crossEnabled && shortMaCfg && longMaCfg
      ? { enabled: true, shortMa: shortMaCfg, longMa: longMaCfg }
      : null;

  return (
    <motion.main
      className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-12"
      initial={reduce ? false : { opacity: 0, transform: 'translateY(8px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
    >
      {/* 顶栏：站名 / 品种切换 / 主题 */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl tracking-wide text-ink">金价观象台</h1>
            <p className="font-display text-[10px] uppercase tracking-[0.35em] text-subtle mt-1">
              Gold Observatory
            </p>
          </div>
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
        <div className="mt-6">
          <SymbolSwitcher symbols={SYMBOL_LIST} value={symbolId} onChange={handleSymbol} />
        </div>
      </header>

      <div className="space-y-4">
        <PriceHeader symbolId={symbolId} />
        <ChartControls
          intervals={symbol.intervals}
          ranges={symbol.ranges}
          interval={interval}
          range={range}
          onInterval={setIntervalVal}
          onRange={setRange}
          mas={mas}
          onMaToggle={toggleMa}
          crossEnabled={crossEnabled}
          onCrossToggle={setCrossEnabled}
          crossPreset={crossPreset}
          onCrossPreset={setCrossPreset}
          bollEnabled={bollEnabled}
          onBollToggle={setBollEnabled}
          rsiEnabled={rsiEnabled}
          onRsiToggle={setRsiEnabled}
        />
        <section className="card rounded-sm p-2">
          {error ? (
            <div className="h-[420px] md:h-[540px] flex items-center justify-center font-serif text-sm text-muted">
              数据加载失败，正在重试…
            </div>
          ) : isLoading ? (
            <div className="h-[420px] md:h-[540px] flex items-center justify-center font-serif text-sm text-muted">
              观象中…
            </div>
          ) : (
            <GoldChart
              candles={candles}
              fullCandles={fullCandles}
              mas={mas}
              cross={cross}
              boll={{ enabled: bollEnabled, period: BOLL_DEFAULT.period, multiplier: BOLL_DEFAULT.multiplier, color: isDark ? '#8a7d6a' : '#a8967a' }}
              rsi={{ enabled: rsiEnabled, period: RSI_DEFAULT.period, color: isDark ? '#9a8d76' : '#7c6f5c' }}
              isDark={isDark}
            />
          )}
        </section>
        <MarketNotes
          quote={quote}
          candles={candles}
          fullCandles={fullCandles}
          mas={mas}
          boll={{ enabled: bollEnabled, period: BOLL_DEFAULT.period, multiplier: BOLL_DEFAULT.multiplier, color: '' }}
          rsi={{ enabled: rsiEnabled, period: RSI_DEFAULT.period, color: '' }}
          cross={cross}
          symbol={symbol}
        />
      </div>

      <footer className="mt-8 text-center font-display text-[10px] uppercase tracking-[0.2em] text-subtle">
        XAU · 东方财富（伦敦金现货）　·　AU9999 · 东方财富（沪金9999）　·　仅供个人参考，不构成投资建议
      </footer>
    </motion.main>
  );
}
