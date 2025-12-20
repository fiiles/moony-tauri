import { useState, useCallback, useEffect } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export interface UpdateProgress {
  downloaded: number;
  contentLength: number | null;
  percentage: number;
}

export interface UpdateInfo {
  version: string;
  date: string | null;
  body: string | null;
}

export interface UseUpdaterReturn {
  // State
  isChecking: boolean;
  isDownloading: boolean;
  updateAvailable: UpdateInfo | null;
  progress: UpdateProgress | null;
  error: string | null;
  
  // Actions
  checkForUpdate: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  dismissUpdate: () => void;
}

export function useUpdater(): UseUpdaterReturn {
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [update, setUpdate] = useState<Update | null>(null);

  const checkForUpdate = useCallback(async () => {
    setIsChecking(true);
    setError(null);

    try {
      const updateResult = await check();
      
      if (updateResult) {
        setUpdate(updateResult);
        setUpdateAvailable({
          version: updateResult.version,
          date: updateResult.date ?? null,
          body: updateResult.body ?? null,
        });
      } else {
        setUpdateAvailable(null);
      }
    } catch (err) {
      // Silently log errors - don't show to user
      // This can fail if no releases exist yet, network issues, etc.
      console.warn('Update check failed (this is normal if no releases exist):', err);
      // Don't set error state - just continue silently
    } finally {
      setIsChecking(false);
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!update) {
      setError('No update available to download');
      return;
    }

    setIsDownloading(true);
    setError(null);
    setProgress({ downloaded: 0, contentLength: null, percentage: 0 });

    try {
      let downloaded = 0;
      let contentLength: number | null = null;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength ?? null;
            console.log(`Update download started: ${contentLength} bytes`);
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            const percentage = contentLength 
              ? Math.round((downloaded / contentLength) * 100) 
              : 0;
            setProgress({ downloaded, contentLength, percentage });
            break;
          case 'Finished':
            console.log('Update download finished');
            setProgress({ downloaded, contentLength, percentage: 100 });
            break;
        }
      });

      console.log('Update installed, relaunching...');
      await relaunch();
    } catch (err) {
      console.error('Failed to download/install update:', err);
      setError(err instanceof Error ? err.message : 'Failed to install update');
      setIsDownloading(false);
    }
  }, [update]);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(null);
    setUpdate(null);
    setProgress(null);
    setError(null);
  }, []);

  // Check for updates on mount (after a short delay to not block startup)
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdate();
    }, 5000); // Check 5 seconds after app start

    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  return {
    isChecking,
    isDownloading,
    updateAvailable,
    progress,
    error,
    checkForUpdate,
    downloadAndInstall,
    dismissUpdate,
  };
}
