import { useState } from "react";
import { AlertTriangle, RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslation } from "react-i18next";
import { portfolioApi, priceApi } from "@/lib/tauri-api";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function StalePricesIndicator() {
    const { t } = useTranslation("common");
    const queryClient = useQueryClient();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const { data: priceStatus, refetch } = useQuery({
        queryKey: ["price-status"],
        queryFn: () => portfolioApi.getPriceStatus(),
        refetchInterval: 60000, // Check every minute
        staleTime: 30000,
    });

    // Check if anything is stale
    const isStale = priceStatus && (
        priceStatus.stocksStale || 
        priceStatus.cryptoStale || 
        priceStatus.exchangeRatesStale
    );

    // Handle refresh button click
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            // Refresh all prices in parallel
            await Promise.allSettled([
                portfolioApi.refreshExchangeRates(),
                priceApi.refreshStockPrices(),
                priceApi.refreshCryptoPrices(),
            ]);
            
            // Refetch status
            await refetch();
            
            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            queryClient.invalidateQueries({ queryKey: ["investments"] });
            queryClient.invalidateQueries({ queryKey: ["crypto"] });
        } catch (error) {
            console.error("Failed to refresh prices:", error);
        } finally {
            setIsRefreshing(false);
        }
    };

    // Format age for display
    const formatAge = (hours: number | null): string => {
        if (hours === null) return t("priceStatus.never");
        if (hours < 1) return t("priceStatus.lessThanHour");
        if (hours < 24) return t("priceStatus.hoursAgo", { count: hours });
        const days = Math.floor(hours / 24);
        return t("priceStatus.daysAgo", { count: days });
    };

    // Don't show anything if not stale
    if (!isStale) {
        return null;
    }

    return (
        <Popover>
            <Tooltip>
                <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="relative"
                            data-testid="stale-prices-indicator"
                        >
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            <span className="sr-only">{t("priceStatus.stale")}</span>
                        </Button>
                    </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{t("priceStatus.stale")}</p>
                </TooltipContent>
            </Tooltip>

            <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                    <div className="space-y-1">
                        <h4 className="font-medium text-sm">{t("priceStatus.title")}</h4>
                        <p className="text-xs text-muted-foreground">
                            {t("priceStatus.description")}
                        </p>
                    </div>

                    <div className="space-y-2 text-sm">
                        {/* Stock prices status */}
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t("priceStatus.stocks")}</span>
                            <span className={priceStatus?.stocksStale ? "text-amber-500" : "text-green-500"}>
                                {priceStatus?.stocksStale ? (
                                    <>
                                        {priceStatus.stocksMissingPrice > 0 && (
                                            <span className="mr-1">
                                                ({priceStatus.stocksMissingPrice} {t("priceStatus.missing")})
                                            </span>
                                        )}
                                        {formatAge(priceStatus?.oldestStockPriceAgeHours ?? null)}
                                    </>
                                ) : (
                                    <Check className="h-4 w-4 inline" />
                                )}
                            </span>
                        </div>

                        {/* Crypto prices status */}
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t("priceStatus.crypto")}</span>
                            <span className={priceStatus?.cryptoStale ? "text-amber-500" : "text-green-500"}>
                                {priceStatus?.cryptoStale ? (
                                    <>
                                        {priceStatus.cryptoMissingPrice > 0 && (
                                            <span className="mr-1">
                                                ({priceStatus.cryptoMissingPrice} {t("priceStatus.missing")})
                                            </span>
                                        )}
                                        {formatAge(priceStatus?.oldestCryptoPriceAgeHours ?? null)}
                                    </>
                                ) : (
                                    <Check className="h-4 w-4 inline" />
                                )}
                            </span>
                        </div>

                        {/* Exchange rates status */}
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t("priceStatus.exchangeRates")}</span>
                            <span className={priceStatus?.exchangeRatesStale ? "text-amber-500" : "text-green-500"}>
                                {priceStatus?.exchangeRatesStale ? (
                                    formatAge(priceStatus?.exchangeRatesAgeHours ?? null)
                                ) : (
                                    <Check className="h-4 w-4 inline" />
                                )}
                            </span>
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                        {isRefreshing ? t("priceStatus.refreshing") : t("priceStatus.refresh")}
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
