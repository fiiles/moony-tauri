import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AddInvestmentModal } from "@/components/stocks/AddInvestmentModal";
import { InvestmentsSummary } from "@/components/stocks/InvestmentsSummary";
import { InvestmentsTable } from "@/components/stocks/InvestmentsTable";
import { investmentsApi, priceApi, exportApi } from "@/lib/tauri-api";
import type { StockInvestmentWithPrice } from "@shared/types";
import { mapInvestmentToHolding, calculateMetrics, type HoldingData } from "@/utils/stocks";
import PortfolioValueTrendChart from "@/components/common/PortfolioValueTrendChart";
import { ExportButton } from "@/components/common/ExportButton";
import { ImportInvestmentsModal } from "@/components/stocks/ImportInvestmentsModal";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export default function Stocks() {
  const { t } = useTranslation('stocks');
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: investments, isLoading } = useQuery<StockInvestmentWithPrice[]>({
    queryKey: ["investments"],
    queryFn: () => investmentsApi.getAll(),
    refetchOnMount: true,
    staleTime: 60 * 1000,
  });

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
      />

      <InvestmentsTable
        holdings={holdings}
        isLoading={refreshPricesMutation.isPending}
        onViewDetail={handleViewDetailClick}
      />
    </div>
  );
}

