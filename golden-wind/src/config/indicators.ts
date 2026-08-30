import { MaConfig } from '@/lib/types';

// 均线预设：默认仅开启 MA20，其余按需开关
export const MA_PRESETS: MaConfig[] = [
  { id: 'ma5', kind: 'sma', period: 5, color: '#f59e0b', enabled: false },
  { id: 'ma10', kind: 'sma', period: 10, color: '#3b82f6', enabled: false },
  { id: 'ma20', kind: 'sma', period: 20, color: '#a855f7', enabled: true },
  { id: 'ma50', kind: 'sma', period: 50, color: '#ec4899', enabled: false },
  { id: 'ma60', kind: 'ema', period: 60, color: '#14b8a6', enabled: false },
  { id: 'ma120', kind: 'ema', period: 120, color: '#ef4444', enabled: false },
  { id: 'ma200', kind: 'sma', period: 200, color: '#eab308', enabled: false },
];

export interface CrossPreset {
  id: string;
  label: string;
  shortMa: string; // 对应 MA_PRESETS 中的 id
  longMa: string;
}

// 金叉/死叉预设，引用具体 MA id，检测与显示同源
export const CROSS_PRESETS: CrossPreset[] = [
  { id: 'ultra', label: '超短 5/10', shortMa: 'ma5', longMa: 'ma10' },
  { id: 'short', label: '短线 5/20', shortMa: 'ma5', longMa: 'ma20' },
  { id: 'mid', label: '中短线 10/60', shortMa: 'ma10', longMa: 'ma60' },
  { id: 'classic', label: '经典 50/200', shortMa: 'ma50', longMa: 'ma200' },
];

export const DEFAULT_CROSS_PRESET = 'classic';

// 布林带：中轨 MA20 ± 2σ，主图叠加
export const BOLL_DEFAULT = { period: 20, multiplier: 2, color: '#a8967a' };
export const BOLL_DEFAULT_DARK = { period: 20, multiplier: 2, color: '#8a7d6a' };

// RSI：14 日相对强弱，副图 0~100
export const RSI_DEFAULT = { period: 14, color: '#7c6f5c' };
export const RSI_DEFAULT_DARK = { period: 14, color: '#9a8d76' };
