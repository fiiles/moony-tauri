
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cryptoApi, priceApi, type CoinGeckoSearchResult } from "@/lib/tauri-api";
import { CURRENCIES, type CurrencyCode } from "@shared/currencies";
import { useState } from "react";
import { Plus, Search, Loader2 } from "lucide-react";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const formSchema = z.object({
    name: z.string().min(1, "Name is required"),
    ticker: z.string().min(1, "Ticker is required"),
    coingeckoId: z.string().optional(),
    quantity: z.coerce.number().positive("Quantity must be positive"),
    pricePerUnit: z.coerce.number().min(0, "Price must be non-negative"),
    currency: z.enum(["USD", "EUR", "CZK"]),
    date: z.string().optional(),
});

export function AddCryptoModal() {
    const { t } = useTranslation('crypto');
    const { t: tc } = useTranslation('common');
    const [open, setOpen] = useState(false);
    const [searchResults, setSearchResults] = useState<CoinGeckoSearchResult[]>([]);
    const [showResultsDialog, setShowResultsDialog] = useState(false);
    const [searching, setSearching] = useState(false);
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            ticker: "",
            coingeckoId: "",
            quantity: 0,
            pricePerUnit: 0,
            currency: "USD",
            date: new Date().toISOString().split("T")[0],
        },
    });

    const searchTicker = async () => {
        const query = form.getValues("name");
        if (!query) return;

        setSearching(true);
        try {
            const results = await priceApi.searchCrypto(query);
            if (results.length === 0) {
                toast({ title: t('toast.noResults'), description: t('modal.add.noResults') });
            } else if (results.length === 1) {
                // Auto-select if only one result
                selectTicker(results[0]);
            } else {
                setSearchResults(results);
                setShowResultsDialog(true);
            }
        } catch (error: any) {
            toast({ title: t('toast.searchFailed'), description: error.message, variant: "destructive" });
        } finally {
            setSearching(false);
        }
    };

    const selectTicker = (result: CoinGeckoSearchResult) => {

        form.setValue("ticker", result.symbol.toUpperCase());
        form.setValue("name", result.name);
        form.setValue("coingeckoId", result.id);
        setShowResultsDialog(false);
        setSearchResults([]);
    };

    const createInvestment = useMutation({
        mutationFn: async (values: z.infer<typeof formSchema>) => {
            const cryptoData = {
                ticker: values.ticker,
                name: values.name,
                coingeckoId: values.coingeckoId,
                quantity: values.quantity.toString(),
                averagePrice: values.pricePerUnit.toString(),
            };
            const initialTransaction = {
                type: "buy",
                ticker: values.ticker,
                name: values.name,
                quantity: values.quantity.toString(),
                pricePerUnit: values.pricePerUnit.toString(),
                currency: values.currency,
                transactionDate: values.date ? Math.floor(new Date(values.date).getTime() / 1000) : Math.floor(Date.now() / 1000),
            };
            return cryptoApi.create(cryptoData, initialTransaction);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["crypto"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            setOpen(false);
            form.reset();
            toast({ title: tc('status.success'), description: t('toast.cryptoAdded') });
        },
        onError: (error: Error) => {
            console.error("Failed to add crypto:", error);
            toast({
                title: tc('status.error'),
                description: t('toast.addFailed') + ": " + error.message,
                variant: "destructive"
            });
        },
    });

    function onSubmit(values: z.infer<typeof formSchema>) {
        createInvestment.mutate(values);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t('addCrypto')}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('modal.add.title')}</DialogTitle>
                    <DialogDescription>
                        {t('modal.add.description')}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 py-4">
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-foreground border-b pb-2">
                                {t('modal.add.cryptoDetails')}
                            </h3>
                            <div className="grid gap-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('modal.add.name')} *</FormLabel>
                                            <div className="flex gap-2">
                                                <FormControl>
                                                    <Input placeholder="Bitcoin" {...field} />
                                                </FormControl>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={searchTicker}
                                                    disabled={searching || !field.value}
                                                >
                                                    {searching ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Search className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="ticker"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('modal.add.ticker')} *</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="BTC" {...field} readOnly />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    {/* Coingecko ID is hidden */}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-foreground border-b pb-2">
                                {t('modal.add.purchaseDetails')}
                            </h3>
                            <div className="grid gap-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="pricePerUnit"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('modal.add.pricePerUnit')} *</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.00000001" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="currency"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{tc('labels.currency')}</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    defaultValue={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={tc('labels.selectCurrency')} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {Object.values(CURRENCIES).map((currency) => (
                                                            <SelectItem key={currency.code} value={currency.code}>
                                                                {currency.code}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="quantity"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('modal.add.quantity')} *</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.00000001" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="date"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{tc('labels.date')}</FormLabel>
                                                <FormControl>
                                                    <Input type="date" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        </div>

                        <Button type="submit" className="w-full" disabled={createInvestment.isPending}>
                            {createInvestment.isPending ? tc('status.adding') : t('addCrypto')}
                        </Button>
                    </form>
                </Form>
            </DialogContent>

            <AlertDialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('modal.add.selectCrypto')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('modal.add.multipleResults')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                        {searchResults.map((result) => (
                            <button
                                key={result.id}
                                onClick={() => selectTicker(result)}
                                className="w-full text-left p-2 rounded border hover:bg-accent transition-colors flex items-center gap-3"
                            >
                                {result.thumb ? (
                                    <img src={result.thumb} alt={result.symbol} className="w-6 h-6 rounded-full" />
                                ) : (
                                    <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center text-xs">
                                        {result.symbol[0]}
                                    </div>
                                )}
                                <div>
                                    <div className="font-semibold">{result.name} ({result.symbol})</div>
                                    <div className="text-xs text-muted-foreground">
                                        {tc('labels.rank')}: {result.market_cap_rank || "N/A"} • ID: {result.id}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tc('buttons.cancel')}</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    );
}
