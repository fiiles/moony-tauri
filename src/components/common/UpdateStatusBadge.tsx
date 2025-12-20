import { useTranslation } from 'react-i18next';
import { Download, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useUpdater } from '@/hooks/use-updater';
import { useState } from 'react';
import { RefreshCw, X, Check } from 'lucide-react';

// ⚠️ DEBUG: Set to true to simulate an update available (for testing only)
const DEBUG_MOCK_UPDATE = false;
const MOCK_UPDATE_INFO = {
    version: '99.0.0',
    date: new Date().toISOString(),
    body: '## What\'s New\n\n- 🎉 New feature: Portfolio projection\n- 🐛 Bug fixes and improvements\n- 🚀 Performance optimizations',
};

export function UpdateStatusBadge() {
    const { t } = useTranslation('common');
    const {
        isChecking: realIsChecking,
        isDownloading,
        updateAvailable: realUpdateAvailable,
        progress,
        downloadAndInstall,
        dismissUpdate,
    } = useUpdater();

    // Apply mock values if debugging
    const isChecking = DEBUG_MOCK_UPDATE ? false : realIsChecking;
    const updateAvailable = DEBUG_MOCK_UPDATE ? MOCK_UPDATE_INFO : realUpdateAvailable;

    const [showUpdateDialog, setShowUpdateDialog] = useState(false);

    const handleBadgeClick = () => {
        if (updateAvailable) {
            setShowUpdateDialog(true);
        }
    };

    const handleUpdateNow = () => {
        downloadAndInstall();
        setShowUpdateDialog(false);
    };

    const handleDismiss = () => {
        dismissUpdate();
        setShowUpdateDialog(false);
    };

    // Show loading state while checking
    if (isChecking) {
        return (
            <Badge variant="secondary" className="gap-1.5 cursor-default">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="hidden sm:inline">{t('update.checking')}</span>
            </Badge>
        );
    }

    // Show update available
    if (updateAvailable) {
        return (
            <>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBadgeClick}
                    className="gap-1.5 h-8 px-2 text-primary hover:text-primary"
                >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('update.available')}</span>
                    <Badge variant="default" className="ml-1 px-1.5 py-0 text-[10px]">
                        {updateAvailable.version}
                    </Badge>
                </Button>

                <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Download className="h-5 w-5 text-primary" />
                                {t('update.available')}
                            </DialogTitle>
                            <DialogDescription>
                                {t('update.newVersion', { version: updateAvailable.version })}
                            </DialogDescription>
                        </DialogHeader>

                        {updateAvailable?.body && !isDownloading && (
                            <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/50 p-3">
                                <h4 className="mb-2 text-sm font-semibold">
                                    {t('update.releaseNotes')}
                                </h4>
                                <div className="prose prose-sm dark:prose-invert">
                                    <pre className="whitespace-pre-wrap text-xs">{updateAvailable.body}</pre>
                                </div>
                            </div>
                        )}

                        {isDownloading && progress && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span>{t('update.downloading')}</span>
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
                            {isDownloading ? (
                                <div className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground">
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                    {t('update.installing')}
                                </div>
                            ) : (
                                <>
                                    <Button onClick={handleDismiss} variant="outline" className="flex-1">
                                        <X className="mr-2 h-4 w-4" />
                                        {t('update.later')}
                                    </Button>
                                    <Button onClick={handleUpdateNow} className="flex-1">
                                        <Check className="mr-2 h-4 w-4" />
                                        {t('update.updateNow')}
                                    </Button>
                                </>
                            )}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </>
        );
    }
    // No update available - don't show anything
    return null;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
