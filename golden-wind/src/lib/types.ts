// 金价相关类型定义

export type SymbolId = 'XAU' | 'AU9999';

export interface SymbolConfig {
  id: SymbolId;
  name: string; // 中文名
  nameEn: string; // 英文/代号
  source: string; // 数据来源说明
  currency: string; // 货币符号 $ ¥
  unit: string; // 单位 /oz /g
  decimals: number; // 小数位
  intervals: { value: Interval; label: string }[];
  ranges: { value: Range; label: string }[];
}

export type ChangeMode = 'session' | 'tick'; // 日内涨跌 / 较上次刷新

export interface Quote {
  symbolId: SymbolId;
  name: string;
  price: number;
  prevClose: number; // 昨收
  change: number; // 涨跌额
  changePct: number; // 涨跌幅 %
  changeMode: ChangeMode;
  updatedAt: number; // 时间戳 ms
}

export interface Candle {
  time: number; // unix 秒
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type Interval = '5m' | '15m' | '30m' | '60m' | '1d';
export type Range = '1d' | '5d' | '1mo' | '3mo' | '1y' | '5y' | 'max';

export type MaKind = 'sma' | 'ema';

export interface MaConfig {
  id: string;
  kind: MaKind;
  period: number;
  color: string;
  enabled: boolean;
}

export type CrossType = 'golden' | 'death';

export interface CrossPoint {
  time: number;
  type: CrossType;
  price: number; // 交叉价格（线性插值估算）
  time0: number; // 交叉区间起始时间 times[i-1]
  time1: number; // 交叉区间结束时间 times[i]
  t: number; // 交叉位置比例 ∈ (0,1]
}

export interface HistoryResult {
  candles: Candle[]; // 显示用（选中区间）
  fullCandles: Candle[]; // 含前置预热，供 MA 计算用
}

export interface BollConfig {
  enabled: boolean;
  period: number;
  multiplier: number;
  color: string;
}

export interface RsiConfig {
  enabled: boolean;
  period: number;
  color: string;
}
