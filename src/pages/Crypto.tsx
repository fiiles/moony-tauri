
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AddCryptoModal } from "@/components/AddCryptoModal";
import { CryptoSummary } from "@/components/CryptoSummary";
import { CryptoTable, type CryptoHoldingData } from "@/components/CryptoTable";
import { SellCryptoModal } from "@/components/SellCryptoModal";
import { CryptoTransactionsModal } from "@/components/CryptoTransactionsModal";
import { UpdateCryptoPriceModal } from "@/components/UpdateCryptoPriceModal";
import { cryptoApi, priceApi } from "@/lib/tauri-api";
import {
    calculateCryptoPortfolioMetrics,
    mapCryptoInvestmentToHolding,
} from "@shared/calculations";
import type { CryptoInvestmentWithPrice } from "@shared/types";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export default function Crypto() {
    const { t } = useTranslation('crypto');
    const { t: tc } = useTranslation('common');
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [selectedHolding, setSelectedHolding] = useState<CryptoHoldingData | null>(null);
    const [sellModalOpen, setSellModalOpen] = useState(false);
    const [viewTransactionsModalOpen, setViewTransactionsModalOpen] = useState(false);
    const [updatePriceModalOpen, setUpdatePriceModalOpen] = useState(false);
    const [buyModalOpen, setBuyModalOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [holdingToDelete, setHoldingToDelete] = useState<CryptoHoldingData | null>(null);

    const { data: cryptoInvestments, isLoading } = useQuery<CryptoInvestmentWithPrice[]>({
        queryKey: ["crypto"],
        queryFn: () => cryptoApi.getAll(),
        refetchOnMount: true,
        staleTime: 60 * 1000,
    });

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

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await cryptoApi.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["crypto"] });
            toast({ title: "Success", description: "Crypto asset deleted successfully" });
        },
        onError: (error: Error) => {
            console.error("Failed to delete crypto:", error);
            toast({
                title: "Error",
                description: "Failed to delete crypto: " + error.message,
                variant: "destructive"
            });
        }
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
            inv.isManualPrice
        );
    });

    const metrics = calculateCryptoPortfolioMetrics(holdings);

    const handleSellClick = (holding: CryptoHoldingData) => {
        setSelectedHolding(holding);
        setSellModalOpen(true);
    };

    const handleViewTransactionsClick = (holding: CryptoHoldingData) => {
        setSelectedHolding(holding);
        setViewTransactionsModalOpen(true);
    };

    const handleUpdatePriceClick = (holding: CryptoHoldingData) => {
        setSelectedHolding(holding);
        setUpdatePriceModalOpen(true);
    };

    const handleDeleteClick = (holding: CryptoHoldingData) => {
        setHoldingToDelete(holding);
        setDeleteDialogOpen(true);
    };

    const handleBuyClick = (holding: CryptoHoldingData) => {
        setSelectedHolding(holding);
        setBuyModalOpen(true);
    };

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
                    <AddCryptoModal />
                </div>
            </div>

            <CryptoSummary
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

            <CryptoTable
                holdings={holdings}
                onSell={handleSellClick}
                onViewTransactions={handleViewTransactionsClick}
                onUpdatePrice={handleUpdatePriceClick}
                onDelete={handleDeleteClick}
                onBuy={handleBuyClick}
            />

            <div className="flex justify-end">
                <Button
                    variant="outline"
                    onClick={() => refreshPricesMutation.mutate()}
                    disabled={refreshPricesMutation.isPending}
                    className="transition-all duration-200"
                >
                    <RefreshCw className={`mr-2 h-4 w-4 ${refreshPricesMutation.isPending ? 'animate-spin' : ''}`} />
                    {refreshPricesMutation.isPending ? t('refreshing') : t('refreshPrices')}
                </Button>
            </div>

            <SellCryptoModal
                investment={selectedHolding}
                open={sellModalOpen}
                onOpenChange={setSellModalOpen}
            />

            <CryptoTransactionsModal
                investment={selectedHolding}
                open={viewTransactionsModalOpen}
                onOpenChange={setViewTransactionsModalOpen}
            />

            <UpdateCryptoPriceModal
                investment={selectedHolding}
                open={updatePriceModalOpen}
                onOpenChange={setUpdatePriceModalOpen}
            />

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('confirmDelete.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('confirmDelete.description', { name: holdingToDelete?.name })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setHoldingToDelete(null)}>{tc('buttons.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                if (holdingToDelete) {
                                    deleteMutation.mutate(holdingToDelete.id);
                                    setDeleteDialogOpen(false);
                                }
                            }}
                        >
                            {tc('buttons.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}
