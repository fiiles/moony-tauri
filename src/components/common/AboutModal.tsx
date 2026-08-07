import { useState } from 'react';
import { Info, Heart, ExternalLink, CheckCircle, Download, Loader2 } from 'lucide-react';

// lucide-react v1 removed brand icons; inline GitHub mark instead
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useTranslation } from 'react-i18next';
import * as opener from '@tauri-apps/plugin-opener';
import { useUpdater } from '@/hooks/use-updater';

// App version from package.json
const APP_VERSION = '1.3.0';

// ⚠️ DEBUG: Set to true to simulate an update available (for testing only)
// Keep in sync with UpdateStatusBadge.tsx
const DEBUG_MOCK_UPDATE = false;
const MOCK_UPDATE_INFO = {
  version: '99.0.0',
  date: new Date().toISOString(),
  body: "## What's New\n\n- 🎉 New feature: Portfolio projection\n- 🐛 Bug fixes and improvements\n- 🚀 Performance optimizations",
};
import { toast } from 'sonner';

export function AboutModal() {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation('common');
  const {
    isChecking: realIsChecking,
    updateAvailable: realUpdateAvailable,
    downloadAndInstall,
  } = useUpdater();

  // Apply mock values if debugging
  const isChecking = DEBUG_MOCK_UPDATE ? false : realIsChecking;
  const updateAvailable = DEBUG_MOCK_UPDATE ? MOCK_UPDATE_INFO : realUpdateAvailable;

  const handleUpdate = () => {
    if (DEBUG_MOCK_UPDATE) {
      toast('Debug Mode', {
        description: 'This is a mock update. Set DEBUG_MOCK_UPDATE to false to test real updates.',
      });
      return;
    }
    downloadAndInstall();
    setIsOpen(false); // Close modal when starting update
  };

  const handleOpenLink = async (url: string) => {
    try {
      await opener.openUrl(url);
    } catch (error) {
      // Fallback to window.open if Tauri opener fails
      console.error('Failed to open link, using fallback:', error);
      window.open(url, '_blank');
    }
  };

  const renderUpdateStatus = () => {
    if (isChecking) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">{t('update.checking')}</span>
        </div>
      );
    }

    if (updateAvailable) {
      return (
        <button
          onClick={handleUpdate}
          className="flex items-center gap-2 w-full hover:opacity-80 transition-opacity cursor-pointer"
        >
          <Download className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">{t('update.available')}</span>
          <Badge variant="default" className="text-[10px]">
            v{updateAvailable.version}
          </Badge>
        </button>
      );
    }

    return (
      <div className="flex items-center gap-2 text-green-600 dark:text-green-500">
        <CheckCircle className="w-4 h-4" />
        <span className="text-sm font-medium">{t('update.upToDate')}</span>
      </div>
    );
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        data-testid="button-about"
        title={t('about.title')}
      >
        <Info className="w-5 h-5" />
        <span className="sr-only">{t('about.title')}</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md bg-background border-border/50">
          <DialogHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="flex aspect-square size-12 shrink-0 items-center justify-center rounded-lg overflow-hidden">
                <img src="/moony-icon.png" alt="Moony" className="size-12" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <DialogTitle className="text-xl font-bold">{t('app.name')}</DialogTitle>
                <DialogDescription className="text-sm">{t('app.tagline')}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Version and Update Status Card */}
            <div className="rounded-lg border bg-card/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('about.version')}</span>
                <span className="text-sm font-semibold">{APP_VERSION}</span>
              </div>
              <div className="border-t pt-3">{renderUpdateStatus()}</div>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground leading-relaxed px-1">
              {t('about.description')}
            </p>

            {/* GitHub Button */}
            <Button
              variant="outline"
              className="w-full justify-start gap-2 bg-card/50 hover:bg-card"
              onClick={() => handleOpenLink('https://github.com/fiiles/moony-tauri')}
            >
              <GithubIcon className="w-4 h-4" />
              {t('about.viewOnGithub')}
              <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
            </Button>

            {/* License notice — AGPL-3.0 §5(d) Appropriate Legal Notices */}
            <div className="rounded-lg border bg-card/50 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">{t('about.copyright')}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t('about.licenseNotice')}
              </p>
              <button
                onClick={() =>
                  handleOpenLink('https://github.com/fiiles/moony-tauri/blob/main/LICENSE')
                }
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {t('about.viewLicense')}
                <ExternalLink className="w-3 h-3 opacity-50" />
              </button>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-center gap-1 pt-2 text-xs text-muted-foreground">
              <span>{t('about.madeWith')}</span>
              <Heart className="w-3 h-3 text-red-500 fill-red-500 animate-pulse" />
              <span>{t('about.byAuthor')}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
