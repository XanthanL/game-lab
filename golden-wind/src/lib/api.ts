import { Candle, HistoryResult, Interval, Quote, Range, SymbolId } from './types';

const EM_REALTIME = 'https://push2.eastmoney.com/api/qt/stock/get';
const EM_KLINE = 'https://push2his.eastmoney.com/api/qt/stock/kline/get';

// 东方财富 secid：122.XAU 为伦敦金（黄金/美元）现货，118.AU9999 为沪金 9999
const EM_SECID: Record<SymbolId, string> = {
  XAU: '122.XAU',
  AU9999: '118.AU9999',
};

// ---------- 实时报价 ----------

export async function fetchQuote(symbolId: SymbolId): Promise<Quote> {
  const secid = EM_SECID[symbolId];
  const url = `${EM_REALTIME}?secid=${secid}&fields=f43,f57,f58,f60,f169,f170`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`东方财富请求失败: ${res.status}`);
  const d = (await res.json()).data;
  if (!d) throw new Error(`无 ${symbolId} 行情`);
  // 东方财富的价格/涨跌额/涨跌幅均相对昨收 f60，非交易时段亦为最后收盘的真实涨跌
  const price = d.f43 / 100;
  const prevClose = d.f60 / 100;
  const change = d.f169 / 100;
  const changePct = d.f170 / 100;
  return {
    symbolId,
    name: d.f58 ?? (symbolId === 'XAU' ? '伦敦金' : '黄金9999'),
    price,
    prevClose,
    change,
    changePct,
    changeMode: 'session',
    updatedAt: Date.now(),
  };
}

// ---------- 历史 K 线 ----------

// 取 K 线：lmt = 显示根数 + 预热根数（preload 供大周期 MA 计算预热）
// 返回 { candles: 显示区间, fullCandles: 含前置预热 }
export async function fetchHistory(
  symbolId: SymbolId,
  interval: Interval,
  range: Range,
  preload = 0,
): Promise<HistoryResult> {
  const secid = EM_SECID[symbolId];
  const displayCount = EM_LMT[range];
  const total = displayCount + preload;
  const url =
    `${EM_KLINE}?secid=${secid}` +
    `&fields1=f1,f2,f3,f4,f5,f6` +
    `&fields2=f51,f52,f53,f54,f55,f56,f57,f58` +
    `&klt=${EM_KLT[interval]}&fqt=0&end=20500101&lmt=${total}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`东方财富K线请求失败: ${res.status}`);
  const data = (await res.json()).data;
  const lines: string[] = data?.klines ?? [];
  if (lines.length === 0) throw new Error('无历史数据');

  const fullCandles: Candle[] = [];
  const today = new Date().toISOString().slice(0, 10); // "2026-08-08"
  for (const line of lines) {
    const [t, open, close, high, low, vol] = line.split(',');
    if (t.slice(0, 10) > today) continue; // 过滤未来日期（集合竞价预数据）
    fullCandles.push({
      time: parseEmTime(t),
      open: Number(open),
      close: Number(close),
      high: Number(high),
      low: Number(low),
      volume: Number(vol),
    });
  }
  if (fullCandles.length === 0) throw new Error('无历史数据');
  // 显示区间为末尾 displayCount 根；不足时全部显示
  const candles = fullCandles.slice(-displayCount);
  return { candles, fullCandles };
}

// 东方财富 klt 周期与 lmt 根数映射
const EM_KLT: Record<Interval, number> = { '5m': 5, '15m': 15, '30m': 30, '60m': 60, '1d': 101 };
const EM_LMT: Record<Range, number> = {
  '1d': 48,
  '5d': 240,
  '1mo': 22,
  '3mo': 66,
  '1y': 250,
  '5y': 1250,
  max: 8000,
};

// 东方财富时间字符串 → UTC 秒。日线 "2026-08-10"；分钟线 "2026-08-10 14:00"（北京时间）
function parseEmTime(s: string): number {
  const [date, time] = s.split(' ');
  const [y, m, d] = date.split('-').map(Number);
  if (!time) return Math.floor(Date.UTC(y, m - 1, d) / 1000);
  const [hh, mm] = time.split(':').map(Number);
  // 北京时间(UTC+8) → UTC
  return Math.floor(Date.UTC(y, m - 1, d, hh, mm) / 1000) - 8 * 3600;
}
