import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AddInvestmentModal } from "@/components/stocks/AddInvestmentModal";
import { InvestmentsSummary } from "@/components/stocks/InvestmentsSummary";
import { InvestmentsTable } from "@/components/stocks/InvestmentsTable";
import { investmentsApi, priceApi, exportApi } from "@/lib/tauri-api";
import type { StockInvestmentWithPrice } from "@shared/types";
import type { InvestmentTransaction } from "@shared/schema";
import { mapInvestmentToHolding, calculateMetrics, type HoldingData } from "@/utils/stocks";
import PortfolioValueTrendChart, { type TransactionMarker } from "@/components/common/PortfolioValueTrendChart";
import { ExportButton } from "@/components/common/ExportButton";
import { ImportInvestmentsModal } from "@/components/stocks/ImportInvestmentsModal";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { useCurrency } from "@/lib/currency";
import type { CurrencyCode } from "@shared/currencies";

export default function Stocks() {
  const { t } = useTranslation('stocks');
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { convert } = useCurrency();

  const { data: investments, isLoading } = useQuery<StockInvestmentWithPrice[]>({
    queryKey: ["investments"],
    queryFn: () => investmentsApi.getAll(),
    refetchOnMount: true,
    staleTime: 60 * 1000,
  });

  // Fetch all stock transactions for chart markers
  const { data: allTransactions } = useQuery<InvestmentTransaction[]>({
    queryKey: ["all-stock-transactions"],
    queryFn: () => investmentsApi.getAllTransactions(),
    staleTime: 60 * 1000,
  });

  // Compute transaction markers grouped by date
  const transactionMarkers = useMemo((): TransactionMarker[] => {
    if (!allTransactions || allTransactions.length === 0) return [];

    // Group transactions by date (day granularity)
    const markersByDate = new Map<number, { buyAmount: number; sellAmount: number }>();

    for (const tx of allTransactions) {
      // Normalize to start of day (in user's timezone)
      const txDate = new Date(tx.transactionDate * 1000);
      const dayStart = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate()).getTime() / 1000;

      const existing = markersByDate.get(dayStart) || { buyAmount: 0, sellAmount: 0 };
      
      // Calculate total value in CZK (base currency)
      const quantity = parseFloat(tx.quantity) || 0;
      const pricePerUnit = parseFloat(tx.pricePerUnit) || 0;
      const txCurrency = (tx.currency || "CZK") as CurrencyCode;
      
      // Convert to CZK for consistency
      const totalInCzk = convert(quantity * pricePerUnit, txCurrency, "CZK");

      if (tx.type === "buy") {
        existing.buyAmount += totalInCzk;
      } else if (tx.type === "sell") {
        existing.sellAmount += totalInCzk;
      }

      markersByDate.set(dayStart, existing);
    }

    // Convert map to array of TransactionMarker
    return Array.from(markersByDate.entries()).map(([date, amounts]) => ({
      date,
      buyAmount: amounts.buyAmount,
      sellAmount: amounts.sellAmount,
    }));
  }, [allTransactions, convert]);

  // Refresh prices and dividends mutation - uses Yahoo Finance API
  const refreshPricesMutation = useMutation({
    mutationFn: async () => {
      // First refresh stock prices
      const pricesResult = await priceApi.refreshStockPrices();
      // Then refresh dividends (runs in background, doesn't block)
      priceApi.refreshDividends().catch(console.error);
      return pricesResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["dividend-summary"] });
      
      // Check if rate limit was hit (either from API or because there were more tickers than limit)
      if (result.rate_limit_hit) {
        toast({
          title: t('toast.rateLimitReached'),
          description: t('toast.rateLimitDescription', { 
            updated: result.updated.length, 
            remaining: result.remaining_tickers.length 
          }),
          variant: "default"
        });
      } else {
        toast({
          title: t('toast.pricesRefreshed', { count: result.updated.length }),
          description: t('toast.pricesRefreshedDescription', { count: result.updated.length })
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: t('toast.refreshFailed'),
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Map investments to holdings and sort by company name (case-insensitive)
  // No grouping needed since stock_investments is unique per user+ticker
  const holdings = (investments?.map(mapInvestmentToHolding) || []).sort((a, b) =>
    (a.companyName || "").localeCompare(b.companyName || "", undefined, { sensitivity: 'base' })
  );

  // Calculate total dividend yield from holdings
  const totalDividendYield = holdings.reduce((sum, holding) => {
    return sum + (holding.dividendYield || 0) * holding.quantity;
  }, 0);

  const metrics = calculateMetrics(holdings, totalDividendYield);

  const handleViewDetailClick = (holding: HoldingData) => {
    setLocation(`/stocks/${holding.id}`);
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="page-title">{t('title')}</h1>
          <p className="page-subtitle">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t('title')}</h1>
          <p className="page-subtitle">{t('subtitle')}</p>
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
          <ExportButton exportFn={exportApi.stockTransactions} />
          <ImportInvestmentsModal />
          <AddInvestmentModal />
        </div>
      </div>

      <InvestmentsSummary
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
        type="investments"
        currentValue={metrics.totalValue}
        isRefreshing={refreshPricesMutation.isPending}
        transactionMarkers={transactionMarkers}
      />

      <InvestmentsTable
        holdings={holdings}
        isLoading={refreshPricesMutation.isPending}
        onViewDetail={handleViewDetailClick}
      />
    </div>
  );
}

