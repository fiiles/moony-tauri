
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, TrendingUp, Folder, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SummaryCard } from "@/components/common/SummaryCard";
import { OtherAssetsTable } from "@/components/other-assets/OtherAssetsTable";
import { AddOtherAssetModal } from "@/components/other-assets/AddOtherAssetModal";
import { BuyOtherAssetModal } from "@/components/other-assets/BuyOtherAssetModal";
import { SellOtherAssetModal } from "@/components/other-assets/SellOtherAssetModal";
import { OtherAssetTransactionsModal } from "@/components/other-assets/OtherAssetTransactionsModal";
import { DeleteOtherAssetDialog } from "@/components/other-assets/DeleteOtherAssetDialog";
import { otherAssetsApi } from "@/lib/tauri-api";
import type { OtherAsset } from "@shared/schema";
import { convertToCzK, type CurrencyCode } from "@shared/currencies";
import { calculateMarketValue, calculateTotalCost, calculateAnnualYield, type YieldType } from "@shared/calculations";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "react-i18next";

export default function OtherAssets() {
    const { t } = useTranslation('otherAssets');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<OtherAsset | null>(null);
    const [buyModalOpen, setBuyModalOpen] = useState(false);
    const [sellModalOpen, setSellModalOpen] = useState(false);
    const [transactionsModalOpen, setTransactionsModalOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { formatCurrency } = useCurrency();

    const { data: assets, isLoading } = useQuery<OtherAsset[]>({
        queryKey: ["other-assets"],
        queryFn: () => otherAssetsApi.getAll(),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            console.log("[DELETE ASSET] Attempting to delete asset:", id);
            await otherAssetsApi.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["other-assets"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-history"] });
            toast({ title: "Asset deleted" });
            setDeleteDialogOpen(false);
            setSelectedAsset(null);
        },
        onError: (err) => {
            console.error("[DELETE ASSET] Error:", err);
            toast({ title: "Error deleting asset", variant: "destructive" });
        }
    });

    const items = assets || [];

    // Metrics Calculation using shared functions
    const totalValue = items.reduce((sum, asset) => {
        const quantity = parseFloat(asset.quantity);
        const marketPrice = parseFloat(asset.marketPrice);
        const value = calculateMarketValue(quantity, marketPrice);
        return sum + convertToCzK(value, asset.currency as CurrencyCode);
    }, 0);

    const totalCost = items.reduce((sum, asset) => {
        const quantity = parseFloat(asset.quantity);
        const avgPrice = parseFloat(asset.averagePurchasePrice);
        const cost = calculateTotalCost(quantity, avgPrice);
        return sum + convertToCzK(cost, asset.currency as CurrencyCode);
    }, 0);

    // Use shared yield calculation function
    const totalYield = items.reduce((sum, asset) => {
        const yieldAmount = calculateAnnualYield({
            yieldType: asset.yieldType as YieldType,
            yieldValue: parseFloat(asset.yieldValue || "0"),
            quantity: parseFloat(asset.quantity),
            averagePurchasePrice: parseFloat(asset.averagePurchasePrice),
            marketPrice: parseFloat(asset.marketPrice),
        });
        return sum + convertToCzK(yieldAmount, asset.currency as CurrencyCode);
    }, 0);


    const handleBuy = (asset: OtherAsset) => {
        setSelectedAsset(asset);
        setBuyModalOpen(true);
    };

    const handleSell = (asset: OtherAsset) => {
        setSelectedAsset(asset);
        setSellModalOpen(true);
    };

    const handleViewTransactions = (asset: OtherAsset) => {
        setSelectedAsset(asset);
        setTransactionsModalOpen(true);
    };

    const handleDelete = (asset: OtherAsset) => {
        setSelectedAsset(asset);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = () => {
        if (!selectedAsset) return;
        deleteMutation.mutate(selectedAsset.id);
    };

    if (isLoading) return <div className="p-10">{t('loading')}</div>;

    return (
        <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="page-title">{t('title')}</h1>
                    <p className="page-subtitle">{t('subtitle')}</p>
                </div>
                <Button onClick={() => setIsAddModalOpen(true)} className="transition-all duration-200">
                    <Plus className="mr-2 h-4 w-4" /> {t('addAsset')}
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SummaryCard
                    title={t('summary.totalValue')}
                    value={formatCurrency(totalValue)}
                    icon={<TrendingUp className="h-4 w-4" />}
                />
                <SummaryCard
                    title={t('table.purchasePrice')}
                    value={formatCurrency(totalCost)}
                    icon={<Folder className="h-4 w-4" />}
                />
                <SummaryCard
                    title={t('summary.totalGainLoss')}
                    value={`+${formatCurrency(totalYield)}`}
                    icon={<Archive className="h-4 w-4" />}
                    className="text-green-600"
                />
            </div>

            <Card className="border shadow-sm card-hover">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold tracking-tight">{t('table.title')}</h2>
                    </div>
                    <div className="rounded-lg border">
                        <OtherAssetsTable
                            assets={items}
                            onBuy={handleBuy}
                            onSell={handleSell}
                            onViewTransactions={handleViewTransactions}
                            onDelete={handleDelete}
                        />
                    </div>
                </div>
            </Card>

            <AddOtherAssetModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />

            <BuyOtherAssetModal
                asset={selectedAsset}
                open={buyModalOpen}
                onOpenChange={setBuyModalOpen}
            />

            <SellOtherAssetModal
                asset={selectedAsset}
                open={sellModalOpen}
                onOpenChange={setSellModalOpen}
            />

            {selectedAsset && (
                <OtherAssetTransactionsModal
                    asset={selectedAsset}
                    open={transactionsModalOpen}
                    onOpenChange={setTransactionsModalOpen}
                />
            )}

            <DeleteOtherAssetDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                asset={selectedAsset}
                onConfirm={handleConfirmDelete}
                isLoading={deleteMutation.isPending}
            />
        </div>
    );
}
