
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
import { CURRENCIES } from "@shared/currencies";
import { cryptoApi } from "@/lib/tauri-api";
import { useEffect } from "react";
import { toast } from "sonner";
import type { CryptoHoldingData } from "@/components/crypto/CryptoTable";
import { useTranslation } from "react-i18next";

const formSchema = z.object({
    quantity: z.coerce.number().positive("Quantity must be positive"),
    pricePerUnit: z.coerce.number().min(0, "Price must be non-negative"),
    currency: z.enum(["USD", "EUR", "CZK", "GBP"]),
    date: z.string().optional(),
});

interface BuyCryptoModalProps {
    crypto: CryptoHoldingData | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function BuyCryptoModal({ crypto, open, onOpenChange }: BuyCryptoModalProps) {
    const { t } = useTranslation('crypto');
    const { t: tc } = useTranslation('common');
    const queryClient = useQueryClient();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            quantity: 0,
            pricePerUnit: 0,
            currency: "USD",
            date: new Date().toISOString().split("T")[0],
        },
    });

    // Update default currency and price when crypto changes
    useEffect(() => {
        if (crypto) {
            // Use original currency (usually USD for crypto) and originalPrice
            form.setValue("currency", (crypto.currency as "USD" | "EUR" | "CZK") || "USD");
            // Use originalPrice (in source currency) for prefill, not currentPrice (which is converted to CZK)
            const priceToShow = Number(crypto.originalPrice ?? crypto.currentPrice);
            form.setValue("pricePerUnit", priceToShow ? Number(priceToShow.toFixed(2)) : 0);
        }
    }, [crypto, form]);

    const buyMutation = useMutation({
        mutationFn: async (values: z.infer<typeof formSchema>) => {
            if (!crypto) return;

            const txData = {
                type: "buy",
                ticker: crypto.ticker,
                name: crypto.name,
                quantity: values.quantity.toString(),
                pricePerUnit: values.pricePerUnit.toString(),
                currency: values.currency,
                transactionDate: values.date ? Math.floor(new Date(values.date).getTime() / 1000) : Math.floor(Date.now() / 1000),
            };

            return cryptoApi.createTransaction(crypto.id, txData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["crypto"] });
            queryClient.invalidateQueries({ queryKey: ["crypto-detail", crypto?.id] });
            queryClient.invalidateQueries({ queryKey: ["crypto-transactions", crypto?.id] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            queryClient.invalidateQueries({ queryKey: ["all-crypto-transactions"] });
            onOpenChange(false);
            form.reset();
            toast(tc('status.success'));
        },
        onError: (error: Error) => {
            console.error("Failed to buy crypto:", error);
            toast.error(tc('status.error'), { description: t('toast.addFailed') + ": " + error.message });
        },
    });

    function onSubmit(values: z.infer<typeof formSchema>) {
        buyMutation.mutate(values);
    }

    if (!crypto) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('modal.buy.title')} {crypto.name}</DialogTitle>
                    <DialogDescription>
                        {t('modal.buy.description')} {crypto.ticker}.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form id="buy-crypto-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="quantity"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('modal.buy.quantity')} *</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="any" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="pricePerUnit"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('modal.buy.pricePerUnit')} *</FormLabel>
                                        <FormControl>
                                            <Input 
                                                type="number" 
                                                step="0.01" 
                                                {...field} 
                                                onBlur={(e) => {
                                                    const value = parseFloat(e.target.value);
                                                    if (!isNaN(value)) {
                                                        field.onChange(value.toFixed(2));
                                                    }
                                                    field.onBlur();
                                                }}
                                            />
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
                                            value={field.value}
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
                    </form>
                </Form>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        {tc('buttons.cancel')}
                    </Button>
                    <Button type="submit" form="buy-crypto-form" disabled={buyMutation.isPending}>
                        {buyMutation.isPending ? tc('status.adding') : t('modal.buy.addPurchase')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
