import { SymbolConfig, SymbolId } from '@/lib/types';

// XAU：伦敦金（黄金/美元）现货。东方财富 122.XAU，实时与历史同源
const XAU: SymbolConfig = {
  id: 'XAU',
  name: '伦敦金',
  nameEn: 'XAU',
  source: '东方财富 · 伦敦金现货',
  currency: '$',
  unit: '/oz',
  decimals: 2,
  intervals: [
    { value: '5m', label: '5分' },
    { value: '15m', label: '15分' },
    { value: '60m', label: '1时' },
    { value: '1d', label: '日线' },
  ],
  ranges: [
    { value: '1d', label: '1天' },
    { value: '5d', label: '5天' },
    { value: '1mo', label: '1月' },
    { value: '3mo', label: '3月' },
    { value: '1y', label: '1年' },
    { value: '5y', label: '5年' },
    { value: 'max', label: '最大' },
  ],
};

// AU9999：上海黄金交易所黄金9999现货。东方财富 push2/push2his，CORS 友好
const AU9999: SymbolConfig = {
  id: 'AU9999',
  name: '沪金9999',
  nameEn: 'AU9999',
  source: '东方财富 · 上海黄金交易所',
  currency: '¥',
  unit: '/g',
  decimals: 2,
  intervals: [
    { value: '5m', label: '5分' },
    { value: '15m', label: '15分' },
    { value: '30m', label: '30分' },
    { value: '60m', label: '1时' },
    { value: '1d', label: '日线' },
  ],
  ranges: [
    { value: '1d', label: '1天' },
    { value: '5d', label: '5天' },
    { value: '1mo', label: '1月' },
    { value: '3mo', label: '3月' },
    { value: '1y', label: '1年' },
    { value: 'max', label: '最大' },
  ],
};

export const SYMBOLS: Record<SymbolId, SymbolConfig> = { XAU, AU9999 };
export const SYMBOL_LIST: SymbolConfig[] = [XAU, AU9999];
export const DEFAULT_SYMBOL: SymbolId = 'XAU';
