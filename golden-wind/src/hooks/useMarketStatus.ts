'use client';

import { useEffect, useState } from 'react';
import { isMarketOpen, getNextEvent } from '@/lib/marketHours';
import type { SymbolId } from '@/lib/types';

export interface MarketStatus {
  isOpen: boolean;
  nextEvent: { type: 'open' | 'close'; time: Date } | null;
}

export function useMarketStatus(symbolId: SymbolId): MarketStatus {
  const [status, setStatus] = useState<MarketStatus>(() => ({
    isOpen: isMarketOpen(symbolId),
    nextEvent: getNextEvent(symbolId),
  }));

  useEffect(() => {
    const update = () => {
      setStatus({
        isOpen: isMarketOpen(symbolId),
        nextEvent: getNextEvent(symbolId),
      });
    };

    update();

    const interval = setInterval(update, 10_000);
    return () => clearInterval(interval);
  }, [symbolId]);

  return status;
}