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
    if (isSyncingRef.current) {
      console.log('[Sync] Already syncing, skipping');
      return;
    }

    console.log('[Sync] Starting backfill...');
    isSyncingRef.current = true;

    try {
      setIsSyncing(true);
      setProgress({ current: 0, total: 0 });

      const result = await portfolioApi.startBackfill();

      console.log('[Sync] Backfill result:', result);

      setProgress({
        current: result.days_processed,
        total: result.total_days,
      });
      setLastResult(result);

      console.log('[Sync] Backfill complete:', result.message);

      // If we processed any days, invalidate portfolio queries to refresh dashboard
      if (result.days_processed > 0) {
        console.log('[Sync] Invalidating portfolio queries to refresh dashboard...');
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
    if (hasRun.current) {
      console.log('[Sync] Already ran, skipping auto-sync');
      return;
    }
    hasRun.current = true;

    const runStartupSync = async () => {
      // Step 1: refresh any stale prices so charts and values are up to date
      try {
        console.log('[Sync] Checking price status...');
        const status = await portfolioApi.getPriceStatus();
        const needsRefresh = status.stocksStale || status.cryptoStale || status.exchangeRatesStale;

        if (needsRefresh) {
          console.log('[Sync] Stale prices detected, auto-refreshing...');
          await Promise.allSettled([
            status.exchangeRatesStale ? portfolioApi.refreshExchangeRates() : Promise.resolve(),
            status.stocksStale ? priceApi.refreshStockPrices() : Promise.resolve(),
            status.cryptoStale ? priceApi.refreshCryptoPrices() : Promise.resolve(),
          ]);
          queryClient.invalidateQueries({ queryKey: ['investments'] });
          queryClient.invalidateQueries({ queryKey: ['crypto'] });
          queryClient.invalidateQueries({ queryKey: ['portfolio-metrics'] });
          queryClient.invalidateQueries({ queryKey: ['price-status'] });
          console.log('[Sync] Auto price refresh complete');
        } else {
          console.log('[Sync] Prices are fresh, skipping auto-refresh');
        }
      } catch (error) {
        console.error('[Sync] Auto price refresh failed:', error);
      }

      // Step 2: backfill missing historical snapshots (prices are now fresh)
      await startBackfill();
    };

    console.log('[Sync] Scheduling startup sync in 5 seconds...');
    const timer = setTimeout(runStartupSync, 5000);

    return () => clearTimeout(timer);
  }, [startBackfill, queryClient]);

  // Record today's snapshot (called after asset changes)
  const recordTodaySnapshot = useCallback(async () => {
    console.log('[Sync] Recording today snapshot...');
    try {
      await portfolioApi.recordSnapshot();
      console.log('[Sync] Snapshot recorded, invalidating queries...');
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
