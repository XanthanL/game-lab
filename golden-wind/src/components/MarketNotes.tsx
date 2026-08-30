'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BollConfig, Candle, MaConfig, Quote, RsiConfig, SymbolConfig } from '@/lib/types';
import { bollingerBands, closes, computeMa, detectCrosses, rsi } from '@/lib/indicators';

interface CrossOption {
  enabled: boolean;
  shortMa: MaConfig;
  longMa: MaConfig;
}

interface NoteItem {
  text: string;
  tone: 'up' | 'down' | 'warn' | 'info';
}
interface NoteBatch {
  time: number;
  items: NoteItem[];
}

interface Props {
  quote: Quote | undefined;
  candles: Candle[];
  fullCandles: Candle[];
  mas: MaConfig[];
  boll: BollConfig;
  rsi: RsiConfig;
  cross: CrossOption | null;
  symbol: SymbolConfig;
}

export function MarketNotes({ quote, candles, fullCandles, mas, boll, rsi: rsiCfg, cross, symbol }: Props) {
  const reduce = useReducedMotion();
  const [batches, setBatches] = useState<NoteBatch[]>([]);
  const lastKeyRef = useRef<string>('');

  // 当前快照分析（基于纯数字）
  const items = useMemo<NoteItem[]>(() => {
    if (candles.length === 0) return [];
    const out: NoteItem[] = [];
    const fmt = (n: number) => n.toFixed(symbol.decimals);
    const cur = symbol.currency;
    const unit = symbol.unit;
    const lastClose = candles[candles.length - 1].close;
    const fullValues = closes(fullCandles);
    const fullTimes = fullCandles.map((c) => c.time);

    // 1. 价格现状
    if (quote && quote.symbolId === symbol.id) {
      const dir = quote.change >= 0 ? '涨' : '跌';
      out.push({
        text: `现价 ${cur}${fmt(quote.price)}${unit}，日内${dir} ${fmt(Math.abs(quote.change))}（${quote.changePct.toFixed(2)}%）`,
        tone: quote.change >= 0 ? 'up' : 'down',
      });
    }

    // 2. 均线位置
    const enabledMas = mas.filter((m) => m.enabled);
    const maLastVals = enabledMas.map((m) => ({
      m,
      val: computeMa(fullValues, m.period, m.kind).at(-1),
    }));
    for (const { m, val } of maLastVals) {
      if (val == null) continue;
      const diff = ((lastClose - val) / val) * 100;
      out.push({
        text: `现价较 ${m.kind.toUpperCase()}${m.period} ${diff >= 0 ? '高' : '低'} ${Math.abs(diff).toFixed(2)}%`,
        tone: diff >= 0 ? 'up' : 'down',
      });
    }

    // 3. 均线排列
    if (enabledMas.length >= 2) {
      const vals = maLastVals.map((x) => x.val).filter((v): v is number => v != null);
      if (vals.length >= 2) {
        const ascending = vals.every((v, i) => i === 0 || v <= vals[i - 1]); // 短>中>长
        const descending = vals.every((v, i) => i === 0 || v >= vals[i - 1]); // 短<中<长
        if (ascending) out.push({ text: '均线多头排列（短>中>长）', tone: 'up' });
        else if (descending) out.push({ text: '均线空头排列（短<中<长）', tone: 'down' });
        else out.push({ text: '均线纠缠，方向不明', tone: 'info' });
      }
    }

    // 4. 布林带
    if (boll.enabled) {
      const bb = bollingerBands(fullValues, boll.period, boll.multiplier);
      const up = bb.upper.at(-1);
      const mid = bb.middle.at(-1);
      const lo = bb.lower.at(-1);
      if (up != null && mid != null && lo != null) {
        const range = up - lo;
        const pos = range > 0 ? (lastClose - lo) / range : 0.5; // 0~1
        let posText: string;
        if (pos > 1) posText = '突破上轨';
        else if (pos > 0.8) posText = '逼近上轨';
        else if (pos > 0.5) posText = '中轨偏上';
        else if (pos > 0.2) posText = '中轨偏下';
        else if (pos > 0) posText = '逼近下轨';
        else posText = '跌破下轨';
        // 带宽分位（对比预热区间均值）
        const widths = bb.upper
          .map((u, i) => (u != null && bb.lower[i] != null ? u - bb.lower[i]! : null))
          .filter((x): x is number => x != null);
        const avgWidth = widths.length > 0 ? widths.reduce((a, b) => a + b, 0) / widths.length : range;
        const widthState =
          range > avgWidth * 1.2 ? '带宽扩张' : range < avgWidth * 0.8 ? '带宽收窄' : '带宽平稳';
        out.push({
          text: `布林带 ${posText}，${widthState}（上 ${fmt(up)} / 下 ${fmt(lo)}）`,
          tone: pos > 0.8 || pos < 0 ? 'warn' : pos < 0.2 ? 'info' : 'info',
        });
      }
    }

    // 5. RSI
    if (rsiCfg.enabled) {
      const r = rsi(fullValues, rsiCfg.period).at(-1);
      if (r != null) {
        let state: string;
        let tone: NoteItem['tone'] = 'info';
        if (r >= 70) {
          state = '超买';
          tone = 'down';
        } else if (r <= 30) {
          state = '超卖';
          tone = 'up';
        } else if (r >= 50) state = '偏强';
        else state = '偏弱';
        out.push({ text: `RSI${rsiCfg.period} 为 ${r.toFixed(1)}，${state}`, tone });
      }
    }

    // 6. 金叉死叉
    if (cross && cross.enabled) {
      const points = detectCrosses(
        computeMa(fullValues, cross.shortMa.period, cross.shortMa.kind),
        computeMa(fullValues, cross.longMa.period, cross.longMa.kind),
        fullTimes,
      );
      if (points.length > 0) {
        const last = points[points.length - 1];
        const barsAgo = candles.filter((c) => c.time > last.time).length;
        out.push({
          text: `最近信号：${last.type === 'golden' ? '金叉' : '死叉'}（${cross.shortMa.kind.toUpperCase()}${cross.shortMa.period}/${cross.longMa.kind.toUpperCase()}${cross.longMa.period}），距今 ${barsAgo} 根`,
          tone: last.type === 'golden' ? 'up' : 'down',
        });
      } else {
        out.push({
          text: `暂无 ${cross.shortMa.period}/${cross.longMa.period} 交叉信号`,
          tone: 'info',
        });
      }
    }

    // 7. 区间高低点
    if (candles.length > 0) {
      let hi = -Infinity;
      let lo = Infinity;
      let hiT = 0;
      let loT = 0;
      for (const c of candles) {
        if (c.high > hi) {
          hi = c.high;
          hiT = c.time;
        }
        if (c.low < lo) {
          lo = c.low;
          loT = c.time;
        }
      }
      const fromHi = ((lastClose - hi) / hi) * 100;
      const fromLo = ((lastClose - lo) / lo) * 100;
      const hiBars = candles.filter((c) => c.time > hiT).length;
      const loBars = candles.filter((c) => c.time > loT).length;
      out.push({
        text: `区间最高 ${fmt(hi)}（${hiBars} 根前），最低 ${fmt(lo)}（${loBars} 根前）；现价距高点 ${fromHi.toFixed(1)}%，距低点 +${fromLo.toFixed(1)}%`,
        tone: 'info',
      });
    }

    // 8. 短期动量
    if (candles.length >= 6) {
      const recent = candles.slice(-6);
      const ch = ((recent[recent.length - 1].close - recent[0].close) / recent[0].close) * 100;
      out.push({
        text: `近 5 根 ${ch >= 0 ? '上涨' : '下跌'} ${Math.abs(ch).toFixed(2)}%`,
        tone: ch >= 0 ? 'up' : 'down',
      });
    }

    return out;
  }, [quote, candles, fullCandles, mas, boll, rsiCfg, cross, symbol]);

  // 累积批次（内容变化才新增，去重）
  useEffect(() => {
    if (items.length === 0) return;
    const key = items.map((i) => i.text).join('|');
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    setBatches((prev) => [{ time: Date.now(), items }, ...prev].slice(0, 30));
  }, [items]);

  return (
    <section className="card rounded-sm px-6 py-5 md:px-10">
      <div className="flex items-baseline justify-between border-b border-line pb-3">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-base tracking-wide text-ink">市场观察</span>
          <span className="font-display text-[10px] uppercase tracking-[0.3em] text-subtle">Notes</span>
        </div>
        <span className="font-display text-[10px] uppercase tracking-[0.2em] text-subtle">
          基于纯数字 · 仅供参照
        </span>
      </div>
      <div className="mt-3 max-h-[300px] overflow-y-auto pr-2 space-y-4">
        {batches.length === 0 ? (
          <div className="font-serif text-sm text-muted">观象中…</div>
        ) : (
          batches.map((batch) => (
            <motion.div
              key={batch.time}
              initial={reduce ? false : { opacity: 0, transform: 'translateY(6px)' }}
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="space-y-1.5"
            >
              <div className="font-display text-[10px] uppercase tracking-[0.2em] text-subtle">
                {new Date(batch.time).toLocaleTimeString('zh-CN', { hour12: false })}
              </div>
              <ul className="space-y-1">
                {batch.items.map((it, ii) => (
                  <li key={ii} className="flex gap-2 font-serif text-sm leading-relaxed">
                    <span className={`mt-2 h-px w-3 shrink-0 ${toneBar(it.tone)}`} />
                    <span className={toneText(it.tone)}>{it.text}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))
        )}
      </div>
    </section>
  );
}

function toneBar(tone: NoteItem['tone']) {
  switch (tone) {
    case 'up':
      return 'bg-up';
    case 'down':
      return 'bg-down';
    case 'warn':
      return 'bg-accent';
    default:
      return 'bg-line';
  }
}
function toneText(tone: NoteItem['tone']) {
  switch (tone) {
    case 'up':
      return 'text-up';
    case 'down':
      return 'text-down';
    case 'warn':
      return 'text-accent';
    default:
      return 'text-muted';
  }
}
