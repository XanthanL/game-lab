'use client';

import { motion } from 'framer-motion';
import { useQuote } from '@/hooks/useQuote';
import { formatChange, formatPercent, formatPrice, formatTime } from '@/lib/format';
import { formatNextEvent } from '@/lib/marketHours';
import { SymbolId } from '@/lib/types';
import { SYMBOLS } from '@/config/symbols';

export function PriceHeader({ symbolId }: { symbolId: SymbolId }) {
  const symbol = SYMBOLS[symbolId];
  const { data: quoteData, marketStatus } = useQuote(symbolId);

  const dataOk = !!quoteData && quoteData.symbolId === symbolId;
  const price = quoteData?.price ?? 0;
  const change = quoteData?.change ?? 0;
  const changePct = quoteData?.changePct ?? 0;
  const up = change >= 0;
  const changeLabel = quoteData?.changeMode === 'session' ? '日内涨跌' : '较上次更新';

  return (
    <section className="card rounded-sm px-6 py-7 md:px-10 md:py-9">
      {/* 品种行 */}
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-lg tracking-wide text-ink">{symbol.name}</span>
          <span className="font-display text-[11px] uppercase tracking-[0.3em] text-subtle">
            {symbol.nameEn}
          </span>
          <MarketStatusBadge isOpen={marketStatus.isOpen} symbolId={symbolId} />
        </div>
        <span className="font-display text-[10px] uppercase tracking-[0.2em] text-subtle">
          {symbol.source}
        </span>
      </div>

      {/* 价格主体 */}
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl text-accent">{symbol.currency}</span>
            <motion.span
              key={dataOk ? Math.round(price * 100) : 'empty'}
              initial={{ opacity: 0.5, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="font-display text-5xl md:text-6xl font-medium leading-none tracking-tight tabular-nums text-ink"
            >
              {dataOk ? formatPrice(price, symbol.decimals) : '——'}
            </motion.span>
            <span className="font-display text-sm tracking-wide text-subtle">{symbol.unit}</span>
          </div>

          {dataOk && (
            <div className={`mt-3 flex items-baseline gap-3 font-display tabular-nums ${up ? 'text-up' : 'text-down'}`}>
              <span className="text-lg">{formatChange(change, symbol.decimals)}</span>
              <span className="text-sm">{formatPercent(changePct)}</span>
              <span className="font-sans text-[11px] tracking-wide text-subtle">{changeLabel}</span>
            </div>
          )}
        </div>

        <div className="text-right">
          {dataOk && (
            <div className="font-sans text-[11px] text-subtle">
              <div>更新于 {formatTime(quoteData!.updatedAt)}</div>
              <div className="mt-1">
                {marketStatus.isOpen ? '交易中 · 每 10 秒刷新' : '休市中 · 暂停更新'}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function MarketStatusBadge({ isOpen, symbolId }: { isOpen: boolean; symbolId: SymbolId }) {
  const next = formatNextEvent(symbolId);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 font-display text-[10px] uppercase tracking-[0.15em]"
      style={{
        backgroundColor: isOpen ? 'var(--status-open-bg)' : 'var(--status-closed-bg)',
        color: isOpen ? 'var(--down)' : 'var(--fg-muted)',
      }}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          isOpen ? 'animate-pulse' : ''
        }`}
        style={{ backgroundColor: isOpen ? 'var(--down)' : 'var(--fg-muted)' }}
      />
      {isOpen ? '交易中' : '休市'}
      <span className="normal-case tracking-normal opacity-70">{next.replace('交易中', '').replace('休市中', '').trim()}</span>
    </span>
  );
}