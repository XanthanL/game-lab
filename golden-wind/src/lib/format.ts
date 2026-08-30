// 价格 / 涨跌 / 时间格式化

export function formatPrice(v: number, decimals = 2): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatChange(v: number, decimals = 2): string {
  return (v >= 0 ? '+' : '') + v.toFixed(decimals);
}

export function formatPercent(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

export function formatTime(ms: number): string {
  try {
    return new Date(ms).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return String(ms);
  }
}
