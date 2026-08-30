'use client';

import useSWR from 'swr';
import { fetchHistory } from '@/lib/api';
import { Interval, Range, SymbolId } from '@/lib/types';
import { useMarketStatus } from './useMarketStatus';

// 历史 OHLC，仅在交易时段每 45 秒轮询，休市时自动暂停
export function useHistory(symbolId: SymbolId, interval: Interval, range: Range, preload = 0) {
  const { isOpen } = useMarketStatus(symbolId);

  return useSWR(
    ['history', symbolId, interval, range, preload, isOpen ? 'live' : 'closed'],
    () => fetchHistory(symbolId, interval, range, preload),
    {
      refreshInterval: isOpen ? 45000 : 0,
      keepPreviousData: true,
      errorRetryCount: 5,
    },
  );
}