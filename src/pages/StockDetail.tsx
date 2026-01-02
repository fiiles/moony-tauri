import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    Trash2,
    Plus,
    Minus,
    RefreshCw,
    DollarSign,
    BarChart2,
    Pencil,
} from "lucide-react";
import type { InvestmentTransaction } from "@shared/schema";
import type { StockInvestmentWithPrice } from "@shared/types/extended-types";
import { useToast } from "@/hooks/use-toast";
import { investmentsApi, priceApi } from "@/lib/tauri-api";
import { useCurrency } from "@/lib/currency";
import { CurrencyCode, DisplayCurrencyCode, CURRENCIES } from "@shared/currencies";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/I18nProvider";
import { useState, useMemo } from "react";
import { BuyInvestmentModal } from "@/components/stocks/BuyInvestmentModal";
import { SellInvestmentModal } from "@/components/stocks/SellInvestmentModal";
import { ManualPriceModal } from "@/components/stocks/ManualPriceModal";
import { ManualDividendModal } from "@/components/stocks/ManualDividendModal";
import { mapInvestmentToHolding } from "@/utils/stocks";
import TickerValueTrendChart, { type TransactionMarker } from "@/components/common/TickerValueTrendChart";

export default function StockDetail() {
    const [, params] = useRoute("/stocks/:id");
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const id = params?.id;
    const { formatCurrency, formatCurrencyRaw, currencyCode, convert } = useCurrency();
    const { t } = useTranslation('stocks');
    const { t: tc } = useTranslation('common');
    const { formatDate } = useLanguage();

    // Modal states
    const [showBuyModal, setShowBuyModal] = useState(false);
    const [showSellModal, setShowSellModal] = useState(false);
    const [showPriceModal, setShowPriceModal] = useState(false);
    const [showDividendModal, setShowDividendModal] = useState(false);
    const [showEditNameModal, setShowEditNameModal] = useState(false);
    const [editableName, setEditableName] = useState("");
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Fetch investment data
    const { data: investment, isLoading } = useQuery<StockInvestmentWithPrice | null>({
        queryKey: ["investment", id],
        queryFn: () => investmentsApi.get(id!),
        enabled: !!id,
    });

    // Fetch transactions
    const { data: transactions } = useQuery<InvestmentTransaction[]>({
        queryKey: ["investment-transactions", id],
        queryFn: () => investmentsApi.getTransactions(id!),
        enabled: !!id,
    });

    // Compute transaction markers for this stock only
    const transactionMarkers = useMemo((): TransactionMarker[] => {
        if (!transactions || transactions.length === 0) return [];

        const markersByDate = new Map<number, { buyAmount: number; sellAmount: number }>();

        for (const tx of transactions) {
            const txDate = new Date(tx.transactionDate * 1000);
            const dayStart = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate()).getTime() / 1000;

            const existing = markersByDate.get(dayStart) || { buyAmount: 0, sellAmount: 0 };
            
            const quantity = parseFloat(tx.quantity) || 0;
            const pricePerUnit = parseFloat(tx.pricePerUnit) || 0;
            const txCurrency = (tx.currency || "CZK") as CurrencyCode;
            const totalInCzk = convert(quantity * pricePerUnit, txCurrency, "CZK");

            if (tx.type === "buy") {
                existing.buyAmount += totalInCzk;
            } else if (tx.type === "sell") {
                existing.sellAmount += totalInCzk;
            }

            markersByDate.set(dayStart, existing);
        }

        return Array.from(markersByDate.entries()).map(([date, amounts]) => ({
            date,
            buyAmount: amounts.buyAmount,
            sellAmount: amounts.sellAmount,
        }));
    }, [transactions, convert]);

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: () => investmentsApi.delete(id!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["investments"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            toast({
                title: tc('status.success'),
                description: t('detail.deleted'),
            });
            setLocation("/stocks");
        },
        onError: (error) => {
            toast({
                title: tc('status.error'),
                description: String(error),
                variant: "destructive",
            });
        },
    });

    // Update name mutation
    const updateNameMutation = useMutation({
        mutationFn: (newName: string) => investmentsApi.updateName(id!, newName),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["investment", id] });
            queryClient.invalidateQueries({ queryKey: ["investments"] });
            setShowEditNameModal(false);
            toast({
                title: tc('status.success'),
                description: t('detail.nameUpdated'),
            });
        },
        onError: (error) => {
            toast({
                title: tc('status.error'),
                description: String(error),
                variant: "destructive",
            });
        },
    });

    // Delete transaction mutation
    const deleteTransactionMutation = useMutation({
        mutationFn: (txId: string) => investmentsApi.deleteTransaction(txId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["investment", id] });
            queryClient.invalidateQueries({ queryKey: ["investment-transactions", id] });
            queryClient.invalidateQueries({ queryKey: ["investments"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            toast({
                title: tc('status.success'),
                description: t('detail.transactionDeleted'),
            });
        },
    });

    // Refresh prices
    const handleRefreshPrices = async () => {
        setIsRefreshing(true);
        try {
            await priceApi.refreshStockPrices();
            await queryClient.invalidateQueries({ queryKey: ["investment", id] });
            await queryClient.invalidateQueries({ queryKey: ["investments"] });
            toast({
                title: tc('status.success'),
                description: t('detail.pricesRefreshed'),
            });
        } catch (error) {
            toast({
                title: tc('status.error'),
                description: String(error),
                variant: "destructive",
            });
        } finally {
            setIsRefreshing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-pulse text-muted-foreground">
                    {tc('status.loading')}
                </div>
            </div>
        );
    }

    if (!investment) {
        return (
            <div className="p-6">
                <Button variant="ghost" onClick={() => setLocation("/stocks")}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {t('detail.backToList')}
                </Button>
                <div className="mt-8 text-center text-muted-foreground">
                    {t('detail.notFound')}
                </div>
            </div>
        );
    }

    // Map investment to HoldingData for modals
    const holdingData = mapInvestmentToHolding(investment);

    // Get currency info
    const preferredCurrency = currencyCode as CurrencyCode;
    const _marketPriceCurrency = (investment.currency || "USD") as CurrencyCode;
    const avgCostCurrency = (investment.averagePriceCurrency || "USD") as CurrencyCode;

    // Calculate values with currency conversion
    const quantity = holdingData.quantity;
    
    // Average price is stored in its original currency, convert to preferred
    const avgPriceOriginal = holdingData.avgCost; // Original avg price in avgCostCurrency
    const avgPrice = convert(avgPriceOriginal, avgCostCurrency, preferredCurrency);
    
    // currentPrice from backend is ALREADY in CZK (converted by Rust backend)
    // We need to convert from CZK to preferred currency
    const currentPriceInCzk = holdingData.currentPrice;
    const currentPrice = convert(currentPriceInCzk, "CZK", preferredCurrency);
    // Original price for display (in its source currency)
    const _currentPriceOriginal = parseFloat(String(investment.originalPrice)) || 0;
    
    // Calculate metrics in preferred currency
    const totalInvested = quantity * avgPrice;
    const currentValue = quantity * currentPrice;
    const unrealizedPnL = currentValue - totalInvested;
    const unrealizedPnLPercent = totalInvested > 0 ? (unrealizedPnL / totalInvested) * 100 : 0;
    
    const dividendYield = investment.dividendYield || 0;
    const yearlyDividend = quantity * dividendYield;
    const dividendYieldPercent = currentValue > 0 ? (yearlyDividend / currentValue) * 100 : 0;

    return (
        <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                    <Button variant="ghost" size="sm" onClick={() => setLocation("/stocks")} className="mb-2">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        {t('detail.backToList')}
                    </Button>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        {investment.ticker} - {investment.companyName}
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7"
                            onClick={() => {
                                setEditableName(investment.companyName);
                                setShowEditNameModal(true);
                            }}
                            title={tc('buttons.edit')}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                    </h1>
                    {investment.isManualPrice && (
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                            {t('detail.manualPrice')}
                        </span>
                    )}
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="icon" onClick={handleRefreshPrices} disabled={isRefreshing} title={tc('buttons.refresh')}>
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button variant="outline" onClick={() => setShowPriceModal(true)}>
                        <DollarSign className="h-4 w-4 mr-2" />
                        {t('detail.updatePrice')}
                    </Button>
                    <Button variant="outline" onClick={() => setShowDividendModal(true)}>
                        <BarChart2 className="h-4 w-4 mr-2" />
                        {t('detail.updateDividend')}
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" title={tc('buttons.delete')}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{t('detail.confirmDelete.title')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {t('detail.confirmDelete.description', {
                                        name: investment.companyName,
                                        ticker: investment.ticker
                                    })}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>{tc('buttons.cancel')}</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => deleteMutation.mutate()}
                                    className="bg-destructive text-destructive-foreground"
                                >
                                    {tc('buttons.delete')}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{t('detail.currentValue')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(currentValue)}</div>
                        <div className="text-sm text-muted-foreground">
                            {quantity.toFixed(0)} {t('detail.shares')}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{t('detail.totalInvested')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalInvested)}</div>
                        <div className="text-sm text-muted-foreground">
                            <span className="flex items-center gap-1 flex-wrap">
                                @ {(avgPriceOriginal).toLocaleString(undefined, {
                                    style: 'currency',
                                    currency: avgCostCurrency,
                                    minimumFractionDigits: avgPriceOriginal >= 1000 ? 0 : 2,
                                    maximumFractionDigits: avgPriceOriginal >= 1000 ? 0 : 2
                                })}
                                {avgCostCurrency !== currencyCode && (
                                    <span className="text-xs">
                                        (≈ {formatCurrencyRaw(avgPrice, { minimumFractionDigits: avgPrice >= 1000 ? 0 : 2, maximumFractionDigits: avgPrice >= 1000 ? 0 : 2 })})
                                    </span>
                                )}
                                <span>{t('detail.avgPrice')}</span>
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{t('detail.unrealizedPnL')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold flex items-center gap-1 ${unrealizedPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {unrealizedPnL >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                            {formatCurrency(Math.abs(unrealizedPnL))}
                        </div>
                        <div className={`text-sm ${unrealizedPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnLPercent.toFixed(2)}%
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{t('detail.dividendYield')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {dividendYieldPercent > 0 ? `${dividendYieldPercent.toFixed(2)}%` : '-'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {yearlyDividend > 0 ? `${formatCurrency(yearlyDividend)} / ${t('detail.year')}` : t('detail.noDividend')}
                            {investment.isManualDividend && (
                                <span className="ml-1 text-amber-600 dark:text-amber-400">({t('detail.manual')})</span>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Value Chart */}
            <TickerValueTrendChart
                type="stock"
                ticker={investment.ticker}
                currentValue={currentValue}
                isRefreshing={isRefreshing}
                transactionMarkers={transactionMarkers}
            />

            {/* Position & Transactions Section (merged) */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>{t('detail.position.title')}</CardTitle>
                        <div className="flex gap-2">
                            <Button variant="default" size="sm" onClick={() => setShowBuyModal(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                {tc('buttons.buy')}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setShowSellModal(true)}>
                                <Minus className="h-4 w-4 mr-2" />
                                {tc('buttons.sell')}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Position Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <div className="text-sm text-muted-foreground">{t('detail.position.quantity')}</div>
                            <div className="text-lg font-medium">{quantity.toFixed(0)}</div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground">{t('detail.position.avgPrice')}</div>
                            <div className="text-lg font-medium">{formatCurrency(avgPrice)}</div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground">{t('detail.position.currentPrice')}</div>
                            <div className="text-lg font-medium">
                                {formatCurrency(currentPrice)}
                                {investment.isManualPrice && (
                                    <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                                        ({t('detail.manual')})
                                    </span>
                                )}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground">{t('detail.position.priceUpdated')}</div>
                            <div className="text-lg font-medium">
                                {investment.fetchedAt ? formatDate(new Date(Number(investment.fetchedAt) * 1000)) : '-'}
                            </div>
                        </div>
                    </div>

                    {/* Transaction History */}
                    <div className="pt-4 border-t">
                        <h4 className="font-medium mb-4">{t('detail.transactions.title')}</h4>
                        {transactions && transactions.length > 0 ? (
                            (() => {
                                // Check if any transaction has a different currency than user's default
                                const hasMixedCurrencies = transactions.some(
                                    (tx) => tx.currency && tx.currency !== currencyCode
                                );
                                
                                return (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>{t('detail.transactions.date')}</TableHead>
                                                <TableHead>{t('detail.transactions.type')}</TableHead>
                                                <TableHead className="text-right">{t('detail.transactions.quantity')}</TableHead>
                                                {hasMixedCurrencies && (
                                                    <TableHead className="text-right">{t('detail.transactions.originalPrice')}</TableHead>
                                                )}
                                                <TableHead className="text-right">{t('detail.transactions.price')}</TableHead>
                                                <TableHead className="text-right">{t('detail.transactions.total')}</TableHead>
                                                <TableHead></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {transactions.map((tx) => {
                                                const txQty = parseFloat(tx.quantity) || 0;
                                                const txPrice = parseFloat(tx.pricePerUnit) || 0;
                                                const txCurrency = (tx.currency || currencyCode) as CurrencyCode;
                                                // Convert price to CZK (base currency) then format will convert to user's display currency
                                                const txPriceInBase = convert(txPrice, txCurrency, "CZK");
                                                const txTotal = txQty * txPriceInBase;
                                                // Format original price with its original currency symbol
                                                const originalCurrencyDef = CURRENCIES[txCurrency as DisplayCurrencyCode] || CURRENCIES.CZK;
                                                const formattedOriginalPrice = originalCurrencyDef.position === "before" 
                                                    ? `${originalCurrencyDef.symbol}${txPrice.toLocaleString(originalCurrencyDef.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                    : `${txPrice.toLocaleString(originalCurrencyDef.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${originalCurrencyDef.symbol}`;
                                                // Round quantity if it's a whole number (no decimals)
                                                const displayQty = Number.isInteger(txQty) ? txQty.toFixed(0) : txQty.toFixed(4);
                                                return (
                                                    <TableRow key={tx.id}>
                                                        <TableCell>{formatDate(new Date(tx.transactionDate * 1000))}</TableCell>
                                                        <TableCell>
                                                            <span className={`px-2 py-1 rounded text-xs font-medium ${tx.type === 'buy' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                                                                {tx.type === 'buy' ? tc('buttons.buy') : tc('buttons.sell')}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right">{displayQty}</TableCell>
                                                        {hasMixedCurrencies && (
                                                            <TableCell className="text-right">{formattedOriginalPrice}</TableCell>
                                                        )}
                                                        <TableCell className="text-right">{formatCurrency(txPriceInBase)}</TableCell>
                                                        <TableCell className="text-right font-medium">{formatCurrency(txTotal)}</TableCell>
                                                        <TableCell>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => deleteTransactionMutation.mutate(tx.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                );
                            })()
                        ) : (
                            <div className="text-center text-muted-foreground py-8">
                                {t('detail.transactions.empty')}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Modals */}
            <BuyInvestmentModal
                open={showBuyModal}
                onOpenChange={setShowBuyModal}
                investment={holdingData}
            />
            <SellInvestmentModal
                open={showSellModal}
                onOpenChange={setShowSellModal}
                investment={holdingData}
            />
            <ManualPriceModal
                open={showPriceModal}
                onOpenChange={setShowPriceModal}
                investment={holdingData}
            />
            <ManualDividendModal
                open={showDividendModal}
                onOpenChange={setShowDividendModal}
                investment={holdingData}
            />
            
            {/* Edit Name Modal */}
            <Dialog open={showEditNameModal} onOpenChange={setShowEditNameModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('detail.editName.title')}</DialogTitle>
                        <DialogDescription>{t('detail.editName.description')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="companyName">{t('detail.editName.label')}</Label>
                            <Input
                                id="companyName"
                                value={editableName}
                                onChange={(e) => setEditableName(e.target.value)}
                                placeholder={investment.companyName}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEditNameModal(false)}>
                            {tc('buttons.cancel')}
                        </Button>
                        <Button 
                            onClick={() => updateNameMutation.mutate(editableName)}
                            disabled={!editableName.trim() || updateNameMutation.isPending}
                        >
                            {updateNameMutation.isPending ? tc('buttons.saving') : tc('buttons.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
