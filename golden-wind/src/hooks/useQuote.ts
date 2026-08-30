'use client';

import useSWR from 'swr';
import { fetchQuote } from '@/lib/api';
import { SymbolId } from '@/lib/types';
import { useMarketStatus, type MarketStatus } from './useMarketStatus';

// 实时报价，仅在交易时段每 10 秒轮询，休市时自动暂停
export function useQuote(symbolId: SymbolId) {
  const marketStatus = useMarketStatus(symbolId);

  const { data, error, isLoading } = useSWR(
    ['quote', symbolId, marketStatus.isOpen ? 'live' : 'closed'],
    () => fetchQuote(symbolId),
    {
      refreshInterval: marketStatus.isOpen ? 10000 : 0,
      keepPreviousData: true,
      errorRetryCount: 5,
    },
  );

  return { data, error, isLoading, marketStatus };
}