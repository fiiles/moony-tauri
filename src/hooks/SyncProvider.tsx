import { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { portfolioApi } from '@/lib/tauri-api';
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

  // Auto-run backfill ONCE on mount (after login)
  useEffect(() => {
    if (hasRun.current) {
      console.log('[Sync] Already ran, skipping auto-backfill');
      return;
    }
    hasRun.current = true;

    console.log('[Sync] Scheduling auto-backfill in 15 seconds...');

    // Longer delay to ensure price refresh (which blocks the DB) completes first
    const timer = setTimeout(() => {
      startBackfill();
    }, 15000);

    return () => clearTimeout(timer);
  }, [startBackfill]);

  return (
    <SyncContext.Provider value={{ isSyncing, progress, lastResult, startBackfill }}>
      {children}
    </SyncContext.Provider>
  );
}
