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
import { investmentsApi, priceApi } from "@/lib/tauri-api";
import { CURRENCIES, convertToCzK, type CurrencyCode } from "@shared/currencies";
import { useState } from "react";
import { Plus, Search, Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const formSchema = z.object({
    companyName: z.string().min(1, "Company name is required"),
    ticker: z.string().min(1, "Ticker is required"),
    quantity: z.coerce.number().positive("Quantity must be positive"),
    pricePerUnit: z.coerce.number().positive("Price must be positive"),
    currency: z.enum(["USD", "EUR", "CZK"]),
    date: z.string().optional(), // Input type="date" returns string
});

export function AddInvestmentModal() {
    const { t } = useTranslation('investments');
    const { t: tc } = useTranslation('common');
    const [open, setOpen] = useState(false);
    const [searchResults, setSearchResults] = useState<Array<{ symbol: string; shortname: string; exchange: string }>>([]);
    const [showResultsDialog, setShowResultsDialog] = useState(false);
    const [searching, setSearching] = useState(false);
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            companyName: "",
            ticker: "",
            quantity: 0,
            pricePerUnit: 0,
            currency: "USD",
            date: new Date().toISOString().split("T")[0],
        },
    });

    const searchTicker = async () => {
        const companyName = form.getValues("companyName");
        if (!companyName) {
            return;
        }

        setSearching(true);
        try {
            const results = await priceApi.searchStockTickers(companyName);

            if (results.length === 0) {
                toast({
                    title: t('toast.noResults'),
                    description: t('modal.add.noTickerFound'),
                    variant: "destructive"
                });
            } else if (results.length === 1) {
                // Auto-select single result
                form.setValue("ticker", results[0].symbol);
                form.setValue("companyName", results[0].shortname || companyName);
                toast({
                    title: t('toast.tickerFound'),
                    description: `${t('modal.add.selected')} ${results[0].symbol}`
                });
            } else {
                // Show selection dialog for multiple results
                setSearchResults(results);
                setShowResultsDialog(true);
            }
        } catch (error: any) {
            console.error("Ticker search error:", error);
            toast({
                title: t('toast.searchFailed'),
                description: error.message || t('modal.add.searchError'),
                variant: "destructive"
            });
        } finally {
            setSearching(false);
        }
    };

    const selectTicker = (result: { symbol: string; shortname: string }) => {
        form.setValue("ticker", result.symbol);
        form.setValue("companyName", result.shortname);
        setShowResultsDialog(false);
        setSearchResults([]);
    };

    const createInvestment = useMutation({
        mutationFn: async (values: z.infer<typeof formSchema>) => {
            const investmentData = {
                ticker: values.ticker,
                companyName: values.companyName,
            };
            const initialTransaction = {
                type: "buy",
                ticker: values.ticker,
                companyName: values.companyName,
                quantity: values.quantity.toString(),
                pricePerUnit: values.pricePerUnit.toString(),
                currency: values.currency,
                transactionDate: values.date ? Math.floor(new Date(values.date).getTime() / 1000) : Math.floor(Date.now() / 1000),
            };
            return investmentsApi.create(investmentData, initialTransaction);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["investments"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            setOpen(false);
            form.reset();
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
                    {t('addInvestment')}
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
                        <div className="form-section">
                            <h3 className="form-section-header">
                                {t('modal.add.companyDetails')}
                            </h3>
                            <div className="grid gap-4">
                                <FormField
                                    control={form.control}
                                    name="companyName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('modal.add.companyName')} *</FormLabel>
                                            <div className="flex gap-2">
                                                <FormControl>
                                                    <Input placeholder="Apple Inc." {...field} />
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
                                <FormField
                                    control={form.control}
                                    name="ticker"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('modal.add.ticker')} *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="AAPL" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <div className="form-section">
                            <h3 className="form-section-header">
                                {t('modal.add.financialDetails')}
                            </h3>
                            <div className="grid gap-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="pricePerUnit"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('modal.add.pricePerShare')} *</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} />
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
                                                    <Input type="number" step="0.0001" {...field} />
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
                            {createInvestment.isPending ? tc('status.adding') : t('addInvestment')}
                        </Button>
                    </form>
                </Form>
            </DialogContent>

            <AlertDialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('modal.add.selectTicker')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('modal.add.multipleResults')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                        {searchResults.map((result) => (
                            <button
                                key={result.symbol}
                                onClick={() => selectTicker(result)}
                                className="w-full text-left p-3 rounded border hover:bg-accent transition-colors"
                            >
                                <div className="font-semibold">{result.symbol}</div>
                                <div className="text-sm text-muted-foreground">
                                    {result.shortname} • {result.exchange}
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
