import { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { portfolioApi, priceApi } from '@/lib/tauri-api';
import { useQueryClient } from '@tanstack/react-query';
import { SyncContext } from './sync-context';

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [lastResult, setLastResult] = useState<Awaited<ReturnType<typeof portfolioApi.startBackfill>> | null>(null);
  const isSyncingRef = useRef(false);
  const hasRun = useRef(false);
  const queryClient = useQueryClient();

  const startBackfill = useCallback(async () => {
    // Use ref to prevent concurrent runs
    if (isSyncingRef.current) return;

    isSyncingRef.current = true;

    try {
      setIsSyncing(true);
      setProgress({ current: 0, total: 0 });

      const result = await portfolioApi.startBackfill();

      setProgress({
        current: result.days_processed,
        total: result.total_days,
      });
      setLastResult(result);

      // If we processed any days, invalidate portfolio queries to refresh dashboard
      if (result.days_processed > 0) {
        queryClient.invalidateQueries({ queryKey: ['portfolio-history'] });
        queryClient.invalidateQueries({ queryKey: ['portfolio-metrics'] });
      }
    } catch (error) {
      console.error('[Sync] Backfill failed:', error);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [queryClient]);

  // Auto-run on mount (after login): refresh stale prices then backfill history
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const runStartupSync = async () => {
      // Step 1: refresh any stale prices so charts and values are up to date
      try {
        const status = await portfolioApi.getPriceStatus();
        const needsRefresh = status.stocksStale || status.cryptoStale || status.exchangeRatesStale;

        if (needsRefresh) {
          await Promise.allSettled([
            status.exchangeRatesStale ? portfolioApi.refreshExchangeRates() : Promise.resolve(),
            status.stocksStale ? priceApi.refreshStockPrices() : Promise.resolve(),
            status.cryptoStale ? priceApi.refreshCryptoPrices() : Promise.resolve(),
          ]);
          queryClient.invalidateQueries({ queryKey: ['investments'] });
          queryClient.invalidateQueries({ queryKey: ['crypto'] });
          queryClient.invalidateQueries({ queryKey: ['portfolio-metrics'] });
          queryClient.invalidateQueries({ queryKey: ['price-status'] });
        }
      } catch (error) {
        console.error('[Sync] Auto price refresh failed:', error);
      }

      // Step 2: backfill missing historical snapshots (prices are now fresh)
      await startBackfill();
    };

    const timer = setTimeout(runStartupSync, 5000);

    return () => clearTimeout(timer);
  }, [startBackfill, queryClient]);

  // Record today's snapshot (called after asset changes)
  const recordTodaySnapshot = useCallback(async () => {
    try {
      await portfolioApi.recordSnapshot();
      queryClient.invalidateQueries({ queryKey: ['portfolio-history'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-metrics'] });
    } catch (error) {
      console.error('[Sync] Failed to record snapshot:', error);
    }
  }, [queryClient]);

  return (
    <SyncContext.Provider value={{ isSyncing, progress, lastResult, startBackfill, recordTodaySnapshot }}>
      {children}
    </SyncContext.Provider>
  );
}
