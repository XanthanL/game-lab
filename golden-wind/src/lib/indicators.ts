import { Candle, CrossPoint, MaKind } from './types';

export function closes(candles: Candle[]): number[] {
  return candles.map((c) => c.close);
}

// 简单移动平均
export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

// 指数移动平均（以首个 period 的 SMA 作为种子）
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    if (prev === null) {
      let s = 0;
      for (let j = i - period + 1; j <= i; j++) s += values[j];
      prev = s / period;
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}

export function computeMa(values: number[], period: number, kind: MaKind): (number | null)[] {
  return kind === 'sma' ? sma(values, period) : ema(values, period);
}

// 布林带：中轨 = SMA(period)，上下轨 = 中轨 ± mult × 标准差
export function bollingerBands(
  values: number[],
  period: number,
  mult: number,
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const upper: (number | null)[] = [];
  const middle: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      middle.push(null);
      lower.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    const mean = sum / period;
    let sqSum = 0;
    for (let j = i - period + 1; j <= i; j++) sqSum += (values[j] - mean) ** 2;
    const std = Math.sqrt(sqSum / period);
    middle.push(mean);
    upper.push(mean + mult * std);
    lower.push(mean - mult * std);
  }
  return { upper, middle, lower };
}

// RSI（Wilder 平滑）：N 日内平均涨幅 / 平均跌幅 → 0~100
export function rsi(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const ch = values[i] - values[i - 1];
    if (ch >= 0) gainSum += ch;
    else lossSum -= ch;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const ch = values[i] - values[i - 1];
    const gain = ch >= 0 ? ch : 0;
    const loss = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

// 检测金叉/死叉：short 由下穿上 = 金叉，由上穿下 = 死叉
// 返回交叉点的时间与交叉价格（线性插值估算交叉发生位置）
export function detectCrosses(
  short: (number | null)[],
  long: (number | null)[],
  times: number[],
): CrossPoint[] {
  const points: CrossPoint[] = [];
  for (let i = 1; i < short.length; i++) {
    const s0 = short[i - 1];
    const s1 = short[i];
    const l0 = long[i - 1];
    const l1 = long[i];
    if (s0 == null || s1 == null || l0 == null || l1 == null) continue;
    // 交叉发生区间 [i-1, i]，用线性插值估算交叉位置 t∈(0,1]
    const d0 = s0 - l0;
    const d1 = s1 - l1;
    if (d0 <= 0 && d1 > 0) {
      // 金叉：t = d0/(d0-d1)
      const t = d0 === d1 ? 0.5 : d0 / (d0 - d1);
      const price = s0 + (s1 - s0) * t; // 交叉价格
      points.push({ time: times[i], type: 'golden', price, time0: times[i - 1], time1: times[i], t });
    } else if (d0 >= 0 && d1 < 0) {
      const t = d0 === d1 ? 0.5 : d0 / (d0 - d1);
      const price = s0 + (s1 - s0) * t;
      points.push({ time: times[i], type: 'death', price, time0: times[i - 1], time1: times[i], t });
    }
  }
  return points;
}
