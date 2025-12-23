import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useSyncStatus } from '@/hooks/sync-context';

export function SyncStatusBadge() {
  const { t } = useTranslation('common');
  const { isSyncing } = useSyncStatus();

  // Don't show anything when not syncing
  if (!isSyncing) {
    return null;
  }

  // Show syncing indicator with progress
  return (
    <Badge variant="secondary" className="gap-1.5 cursor-default">
      <Loader2 className="w-3 h-3 animate-spin" />
      <span className="hidden sm:inline">
        {t('sync.loadingHistorical')}
      </span>
    </Badge>
  );
}
