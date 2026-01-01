
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AddCryptoModal } from "@/components/crypto/AddCryptoModal";
import { CryptoSummary } from "@/components/crypto/CryptoSummary";
import { CryptoTable, type CryptoHoldingData } from "@/components/crypto/CryptoTable";
import { cryptoApi, priceApi, exportApi } from "@/lib/tauri-api";
import {
    calculateCryptoPortfolioMetrics,
    mapCryptoInvestmentToHolding,
} from "@shared/calculations";
import type { CryptoInvestmentWithPrice } from "@shared/types";
import type { CryptoTransaction } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import PortfolioValueTrendChart, { type TransactionMarker } from "@/components/common/PortfolioValueTrendChart";
import { ExportButton } from "@/components/common/ExportButton";
import { useCurrency } from "@/lib/currency";
import type { CurrencyCode } from "@shared/currencies";

export default function Crypto() {
    const { t } = useTranslation('crypto');
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { convert } = useCurrency();

    const { data: cryptoInvestments, isLoading } = useQuery<CryptoInvestmentWithPrice[]>({
        queryKey: ["crypto"],
        queryFn: () => cryptoApi.getAll(),
        refetchOnMount: true,
        staleTime: 60 * 1000,
    });

    // Fetch all crypto transactions for chart markers
    const { data: allTransactions } = useQuery<CryptoTransaction[]>({
        queryKey: ["all-crypto-transactions"],
        queryFn: () => cryptoApi.getAllTransactions(),
        staleTime: 60 * 1000,
    });

    // Compute transaction markers grouped by date
    const transactionMarkers = useMemo((): TransactionMarker[] => {
        if (!allTransactions || allTransactions.length === 0) return [];

        // Group transactions by date (day granularity)
        const markersByDate = new Map<number, { buyAmount: number; sellAmount: number; buyTickers: string[]; sellTickers: string[] }>();

        for (const tx of allTransactions) {
            // Normalize to start of day (in user's timezone)
            const txDate = new Date(tx.transactionDate * 1000);
            const dayStart = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate()).getTime() / 1000;

            const existing = markersByDate.get(dayStart) || { buyAmount: 0, sellAmount: 0, buyTickers: [], sellTickers: [] };
            
            // Calculate total value in CZK (base currency)
            const quantity = parseFloat(tx.quantity) || 0;
            const pricePerUnit = parseFloat(tx.pricePerUnit) || 0;
            const txCurrency = (tx.currency || "CZK") as CurrencyCode;
            
            // Convert to CZK for consistency
            const totalInCzk = convert(quantity * pricePerUnit, txCurrency, "CZK");

            if (tx.type === "buy") {
                existing.buyAmount += totalInCzk;
                if (!existing.buyTickers.includes(tx.ticker)) {
                    existing.buyTickers.push(tx.ticker);
                }
            } else if (tx.type === "sell") {
                existing.sellAmount += totalInCzk;
                if (!existing.sellTickers.includes(tx.ticker)) {
                    existing.sellTickers.push(tx.ticker);
                }
            }

            markersByDate.set(dayStart, existing);
        }

        // Convert map to array of TransactionMarker
        return Array.from(markersByDate.entries()).map(([date, amounts]) => ({
            date,
            buyAmount: amounts.buyAmount,
            sellAmount: amounts.sellAmount,
            buyTickers: amounts.buyTickers,
            sellTickers: amounts.sellTickers,
        }));
    }, [allTransactions, convert]);

    // Refresh prices mutation - uses CoinGecko API
    const refreshPricesMutation = useMutation({
        mutationFn: async () => {
            return priceApi.refreshCryptoPrices();
        },
        onSuccess: (results) => {
            queryClient.invalidateQueries({ queryKey: ["crypto"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            toast({
                title: t('toast.pricesRefreshed', { count: results.length }),
                description: t('toast.pricesRefreshed', { count: results.length })
            });
        },
        onError: (error: Error) => {
            toast({
                title: t('toast.refreshFailed'),
                description: error.message,
                variant: "destructive"
            });
        },
    });






    // Transform data using shared calculation module
    const holdings: CryptoHoldingData[] = (cryptoInvestments || []).map((inv) => {
        const quantity = parseFloat(String(inv.quantity));
        const averagePrice = parseFloat(String(inv.averagePrice));
        const currentPrice = inv.currentPrice ?? 0;

        return mapCryptoInvestmentToHolding(
            inv.id,
            inv.ticker,
            inv.name || inv.ticker,
            quantity,
            averagePrice,
            currentPrice,
            inv.fetchedAt,
            inv.isManualPrice,
            inv.coingeckoId,
            inv.originalPrice,
            inv.currency
        );
    });

    const metrics = calculateCryptoPortfolioMetrics(holdings);

    if (isLoading) {
        return (
            <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-3xl font-black tracking-tight mb-2">
                        {t('title')}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t('loading')}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="page-title">
                        {t('title')}
                    </h1>
                    <p className="page-subtitle">
                        {t('subtitle')}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => refreshPricesMutation.mutate()}
                        disabled={refreshPricesMutation.isPending}
                        title={t('refreshPrices')}
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshPricesMutation.isPending ? 'animate-spin' : ''}`} />
                    </Button>
                    <ExportButton exportFn={exportApi.cryptoTransactions} />
                    <AddCryptoModal />
                </div>
            </div>

            <CryptoSummary
                metrics={metrics}
                isLoading={refreshPricesMutation.isPending}
                latestFetchedAt={holdings.reduce((latest, h) => {
                    if (!h.fetchedAt) return latest;
                    // Handle both seconds (Unix timestamp) and ISO strings/Dates
                    // If it's a number and small (less than year 1973 in ms), assume seconds
                    const value = h.fetchedAt;
                    const date = new Date(
                        typeof value === 'number' && value < 100000000000
                            ? value * 1000
                            : value
                    );
                    return !latest || date > latest ? date : latest;
                }, undefined as Date | undefined)}
            />

            <PortfolioValueTrendChart
                type="crypto"
                currentValue={metrics.totalValue}
                isRefreshing={refreshPricesMutation.isPending}
                transactionMarkers={transactionMarkers}
            />

            <CryptoTable
                holdings={holdings}
                isLoading={refreshPricesMutation.isPending}
            />

        </div>
    );
}
