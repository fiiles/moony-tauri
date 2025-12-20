import { useTranslation } from 'react-i18next';
import { Download, RefreshCw, X, Check, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useUpdater } from '@/hooks/use-updater';

export function UpdateNotification() {
  const { t } = useTranslation();
  const {
    isDownloading,
    updateAvailable,
    progress,
    error,
    downloadAndInstall,
    dismissUpdate,
  } = useUpdater();

  if (!updateAvailable && !error) {
    return null;
  }

  return (
    <Dialog open={!!updateAvailable || !!error} onOpenChange={(open) => !open && dismissUpdate()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {error ? (
              <>
                <AlertCircle className="h-5 w-5 text-destructive" />
                {t('update.errorTitle', 'Update Error')}
              </>
            ) : (
              <>
                <Download className="h-5 w-5 text-primary" />
                {t('update.available', 'Update Available')}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {error ? (
              error
            ) : updateAvailable ? (
              t('update.newVersion', 'A new version {{version}} is available.', {
                version: updateAvailable.version,
              })
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {updateAvailable?.body && !isDownloading && (
          <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/50 p-3">
            <h4 className="mb-2 text-sm font-semibold">
              {t('update.releaseNotes', 'Release Notes')}
            </h4>
            <div className="prose prose-sm dark:prose-invert">
              <pre className="whitespace-pre-wrap text-xs">{updateAvailable.body}</pre>
            </div>
          </div>
        )}

        {isDownloading && progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{t('update.downloading', 'Downloading...')}</span>
              <span>{progress.percentage}%</span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
            {progress.contentLength && (
              <p className="text-xs text-muted-foreground">
                {formatBytes(progress.downloaded)} / {formatBytes(progress.contentLength)}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {error ? (
            <Button onClick={dismissUpdate} variant="outline" className="w-full">
              <X className="mr-2 h-4 w-4" />
              {t('common.close', 'Close')}
            </Button>
          ) : isDownloading ? (
            <div className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {t('update.installing', 'Installing update...')}
            </div>
          ) : (
            <>
              <Button onClick={dismissUpdate} variant="outline" className="flex-1">
                <X className="mr-2 h-4 w-4" />
                {t('update.later', 'Later')}
              </Button>
              <Button onClick={downloadAndInstall} className="flex-1">
                <Check className="mr-2 h-4 w-4" />
                {t('update.updateNow', 'Update Now')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
