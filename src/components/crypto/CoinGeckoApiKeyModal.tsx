/**
 * CoinGecko API Key Recommendation Modal
 *
 * Shown to first-time crypto users to recommend setting up a CoinGecko API key.
 * This enables cryptocurrency search and historical price data.
 */
import { useState, useEffect } from 'react';
import { Key, Search, TrendingUp, RefreshCw, ExternalLink, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { priceApi, authApi } from "@/lib/tauri-api";

export function CoinGeckoApiKeyModal() {
    const { t } = useTranslation("crypto");
    const [, setLocation] = useLocation();
    const [open, setOpen] = useState(false);

  useEffect(() => {
    const checkShouldShow = async () => {
      // Check if user has already dismissed the modal (stored in profile)
      try {
        const profile = await authApi.getProfile();
        if (profile?.coingeckoModalDismissed) {
          return;
        }
      } catch {
        // If we can't check profile, continue to check API key
      }

      // Check if CoinGecko API key is already set
      try {
        const keys = await priceApi.getApiKeys();
        if (keys.coingecko && keys.coingecko.trim() !== '') {
          return;
        }
      } catch {
        // If we can't check, show the modal to be safe
      }

      // Show the modal
      setOpen(true);
    };

    checkShouldShow();
  }, []);

  const handleDismiss = async () => {
    // Store dismissal in user profile
    try {
      await authApi.updateProfile({ coingeckoModalDismissed: true });
    } catch {
      // Continue even if save fails
    }
    setOpen(false);
  };

  const handleGoToSettings = async () => {
    // Store dismissal in user profile
    try {
      await authApi.updateProfile({ coingeckoModalDismissed: true });
    } catch {
      // Continue even if save fails
    }
    setOpen(false);
    setLocation('/settings');
  };

  const features = [
    { icon: Search, key: 'search' },
    { icon: TrendingUp, key: 'prices' },
    { icon: RefreshCw, key: 'refresh' },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg bg-background border-border">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex aspect-square size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <Key className="size-6 text-primary" />
            </div>
            <div className="grid flex-1 text-left leading-tight">
              <DialogTitle className="text-xl font-bold">{t('coingeckoModal.title')}</DialogTitle>
              <DialogDescription className="text-sm">
                {t('coingeckoModal.description')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Feature list */}
          <div className="rounded-lg border bg-card/50 p-4 space-y-3">
            <h3 className="font-semibold text-foreground text-sm">
              {t('coingeckoModal.withApiKey')}
            </h3>
            <ul className="space-y-2">
              {features.map(({ icon: Icon, key }) => (
                <li key={key} className="flex items-center gap-2 text-sm">
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">
                    {t(`coingeckoModal.features.${key}`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Get API Key link */}
          <a
            href="https://www.coingecko.com/en/api"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors"
          >
            {t('coingeckoModal.getApiKey')}
            <ExternalLink className="h-4 w-4" />
          </a>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleGoToSettings}>
              <Settings className="h-4 w-4 mr-2" />
              {t('coingeckoModal.goToSettings')}
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleDismiss}>
              {t('coingeckoModal.dismiss')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
