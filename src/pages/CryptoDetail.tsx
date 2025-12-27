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
} from "lucide-react";
import type { CryptoTransaction } from "@shared/schema";
import type { CryptoInvestmentWithPrice } from "@shared/types/extended-types";
import { useToast } from "@/hooks/use-toast";
import { cryptoApi, priceApi } from "@/lib/tauri-api";
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
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/I18nProvider";
import { useState } from "react";
import { BuyCryptoModal } from "@/components/crypto/BuyCryptoModal";
import { SellCryptoModal } from "@/components/crypto/SellCryptoModal";
import { UpdateCryptoPriceModal } from "@/components/crypto/UpdateCryptoPriceModal";
import { mapCryptoInvestmentToHolding } from "@shared/calculations";

export default function CryptoDetail() {
    const [, params] = useRoute("/crypto/:id");
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const id = params?.id;
    const { formatCurrency, currencyCode, convert } = useCurrency();
    const { t } = useTranslation('crypto');
    const { t: tc } = useTranslation('common');
    const { formatDate } = useLanguage();

    // Modal states
    const [showBuyModal, setShowBuyModal] = useState(false);
    const [showSellModal, setShowSellModal] = useState(false);
    const [showPriceModal, setShowPriceModal] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Fetch crypto data - get from list and filter
    const { data: crypto, isLoading } = useQuery<CryptoInvestmentWithPrice | null>({
        queryKey: ["crypto-detail", id],
        queryFn: async () => {
            const all = await cryptoApi.getAll();
            return all.find(c => c.id === id) || null;
        },
        enabled: !!id,
    });

    // Fetch transactions
    const { data: transactions } = useQuery<CryptoTransaction[]>({
        queryKey: ["crypto-transactions", id],
        queryFn: () => cryptoApi.getTransactions(id!),
        enabled: !!id,
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: () => cryptoApi.delete(id!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["crypto"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            toast({
                title: tc('status.success'),
                description: t('detail.deleted'),
            });
            setLocation("/crypto");
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
        mutationFn: (txId: string) => cryptoApi.deleteTransaction(txId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["crypto-detail", id] });
            queryClient.invalidateQueries({ queryKey: ["crypto-transactions", id] });
            queryClient.invalidateQueries({ queryKey: ["crypto"] });
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
            await priceApi.refreshCryptoPrices();
            await queryClient.invalidateQueries({ queryKey: ["crypto-detail", id] });
            await queryClient.invalidateQueries({ queryKey: ["crypto"] });
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

    if (!crypto) {
        return (
            <div className="p-6">
                <Button variant="ghost" onClick={() => setLocation("/crypto")}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {t('detail.backToList')}
                </Button>
                <div className="mt-8 text-center text-muted-foreground">
                    {t('detail.notFound')}
                </div>
            </div>
        );
    }

    // Map crypto investment to holding data for modals
    const quantity = parseFloat(String(crypto.quantity)) || 0;
    const averagePrice = parseFloat(String(crypto.averagePrice)) || 0;
    const currentPrice = crypto.currentPrice ?? 0;

    const holdingData = mapCryptoInvestmentToHolding(
        crypto.id,
        crypto.ticker,
        crypto.name || crypto.ticker,
        quantity,
        averagePrice,
        currentPrice,
        crypto.fetchedAt,
        crypto.isManualPrice,
        crypto.coingeckoId,
        crypto.originalPrice,
        crypto.currency
    );

    // Calculate values
    const totalInvested = holdingData.totalCost;
    const currentValue = holdingData.marketValue;
    const unrealizedPnL = holdingData.gainLoss;
    const unrealizedPnLPercent = holdingData.gainLossPercent;

    return (
        <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                    <Button variant="ghost" size="sm" onClick={() => setLocation("/crypto")} className="mb-2">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        {t('detail.backToList')}
                    </Button>
                    <h1 className="text-2xl font-bold">
                        {crypto.ticker} - {crypto.name}
                    </h1>
                    {crypto.isManualPrice && (
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
                                        name: crypto.name,
                                        ticker: crypto.ticker
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{t('detail.currentValue')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(currentValue)}</div>
                        <div className="text-sm text-muted-foreground">
                            {quantity.toFixed(8)} {t('detail.units')}
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
                            @ {formatCurrency(holdingData.avgCost)} {t('detail.avgPrice')}
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
            </div>

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
                            <div className="text-lg font-medium">{quantity.toFixed(8)}</div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground">{t('detail.position.avgPrice')}</div>
                            <div className="text-lg font-medium">{formatCurrency(holdingData.avgCost)}</div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground">{t('detail.position.currentPrice')}</div>
                            <div className="text-lg font-medium">
                                {formatCurrency(holdingData.currentPrice)}
                                {crypto.isManualPrice && (
                                    <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                                        ({t('detail.manual')})
                                    </span>
                                )}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground">{t('detail.position.priceUpdated')}</div>
                            <div className="text-lg font-medium">
                                {crypto.fetchedAt ? formatDate(new Date(Number(crypto.fetchedAt) * 1000)) : '-'}
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
                                                // Display quantity with 8 decimal places for crypto
                                                const displayQty = txQty.toFixed(8);
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
            <BuyCryptoModal
                crypto={holdingData}
                open={showBuyModal}
                onOpenChange={setShowBuyModal}
            />
            <SellCryptoModal
                investment={holdingData}
                open={showSellModal}
                onOpenChange={setShowSellModal}
            />
            <UpdateCryptoPriceModal
                open={showPriceModal}
                onOpenChange={setShowPriceModal}
                investment={holdingData}
            />
        </div>
    );
}
