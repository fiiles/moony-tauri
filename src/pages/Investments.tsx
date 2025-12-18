import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AddInvestmentModal } from "@/components/AddInvestmentModal";
import { SellInvestmentModal } from "@/components/SellInvestmentModal";
import { ViewTransactionsModal } from "@/components/ViewTransactionsModal";
import { DeleteInvestmentDialog } from "@/components/DeleteInvestmentDialog";
import { InvestmentsSummary } from "@/components/InvestmentsSummary";
import { InvestmentsTable } from "@/components/InvestmentsTable";
import { investmentsApi, priceApi } from "@/lib/tauri-api";
import type { StockInvestmentWithPrice } from "@shared/types";
import { mapInvestmentToHolding, calculateMetrics, type HoldingData } from "@/utils/investments";

import { BuyInvestmentModal } from "@/components/BuyInvestmentModal";
import { ManualPriceModal } from "@/components/ManualPriceModal";
import { ManualDividendModal } from "@/components/ManualDividendModal";
import { ImportInvestmentsModal } from "@/components/ImportInvestmentsModal";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export default function Investments() {
  const { t } = useTranslation('investments');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedInvestment, setSelectedInvestment] = useState<HoldingData | null>(null);
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [viewTransactionsModalOpen, setViewTransactionsModalOpen] = useState(false);
  const [manualPriceModalOpen, setManualPriceModalOpen] = useState(false);
  const [manualDividendModalOpen, setManualDividendModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: investments, isLoading } = useQuery<StockInvestmentWithPrice[]>({
    queryKey: ["investments"],
    queryFn: () => investmentsApi.getAll(),
    refetchOnMount: true,
    staleTime: 60 * 1000,
  });

  // Refresh prices mutation - uses MarketStack API
  const refreshPricesMutation = useMutation({
    mutationFn: async () => {
      return priceApi.refreshStockPrices();
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await investmentsApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      setDeleteDialogOpen(false);
      setSelectedInvestment(null);
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

  const handleBuyClick = (holding: HoldingData) => {
    setSelectedInvestment(holding);
    setBuyModalOpen(true);
  };

  const handleSellClick = (holding: HoldingData) => {
    setSelectedInvestment(holding);
    setSellModalOpen(true);
  };

  const handleViewTransactionsClick = (holding: HoldingData) => {
    setSelectedInvestment(holding);
    setViewTransactionsModalOpen(true);
  };

  const handleUpdatePriceClick = (holding: HoldingData) => {
    setSelectedInvestment(holding);
    setManualPriceModalOpen(true);
  };

  const handleUpdateDividendClick = (holding: HoldingData) => {
    setSelectedInvestment(holding);
    setManualDividendModalOpen(true);
  };

  const handleDeleteClick = (holding: HoldingData) => {
    setSelectedInvestment(holding);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedInvestment) return;
    deleteMutation.mutate(selectedInvestment.ticker);
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
            onClick={() => refreshPricesMutation.mutate()}
            disabled={refreshPricesMutation.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshPricesMutation.isPending ? 'animate-spin' : ''}`} />
            {refreshPricesMutation.isPending ? t('refreshing') : t('refreshPrices')}
          </Button>
          <ImportInvestmentsModal />
          <AddInvestmentModal />
        </div>
      </div>

      <InvestmentsSummary
        metrics={metrics}
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

      <InvestmentsTable
        holdings={holdings}
        onBuy={handleBuyClick}
        onSell={handleSellClick}

        onViewTransactions={handleViewTransactionsClick}
        onUpdatePrice={handleUpdatePriceClick}
        onUpdateDividend={handleUpdateDividendClick}
        onDelete={handleDeleteClick}
      />


      <SellInvestmentModal
        open={sellModalOpen}
        onOpenChange={setSellModalOpen}
        investment={selectedInvestment}
      />

      <ViewTransactionsModal
        open={viewTransactionsModalOpen}
        onOpenChange={setViewTransactionsModalOpen}
        investment={selectedInvestment}
      />

      <ManualPriceModal
        open={manualPriceModalOpen}
        onOpenChange={setManualPriceModalOpen}
        investment={selectedInvestment}
      />

      <ManualDividendModal
        open={manualDividendModalOpen}
        onOpenChange={setManualDividendModalOpen}
        investment={selectedInvestment}
      />

      <BuyInvestmentModal
        open={buyModalOpen}
        onOpenChange={setBuyModalOpen}
        investment={selectedInvestment}
      />

      <DeleteInvestmentDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        investment={selectedInvestment}
        onConfirm={handleDeleteConfirm}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

