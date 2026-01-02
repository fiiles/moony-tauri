import { useEffect } from "react";
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
import type { HoldingData } from "@/utils/stocks";
import { investmentsApi } from "@/lib/tauri-api";
import { useTranslation } from "react-i18next";

const formSchema = z.object({
    quantity: z.coerce.number().positive("Quantity must be positive"),
    pricePerUnit: z.coerce.number().positive("Price must be positive"),
    currency: z.enum(["USD", "EUR", "CZK"]),
    date: z.string().optional(),
});

interface SellInvestmentModalProps {
    investment: HoldingData | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SellInvestmentModal({ investment, open, onOpenChange }: SellInvestmentModalProps) {
    const { t } = useTranslation('stocks');
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

    // Lock currency to the investment's base currency (set by first transaction)
    useEffect(() => {
        if (investment) {
            const investmentCurrency = (investment.avgCostCurrency || investment.currency || "USD") as "USD" | "EUR" | "CZK";
            form.setValue("currency", investmentCurrency);
        }
    }, [investment, form]);

    const sellInvestment = useMutation({
        mutationFn: async (values: z.infer<typeof formSchema>) => {
            if (!investment) return;

            const txData = {
                type: "sell",
                ticker: investment.ticker,
                companyName: investment.companyName,
                quantity: values.quantity.toString(),
                pricePerUnit: values.pricePerUnit.toString(),
                currency: values.currency,
                transactionDate: values.date ? Math.floor(new Date(values.date).getTime() / 1000) : Math.floor(Date.now() / 1000),
            };

            return investmentsApi.createTransaction(investment.id, txData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["investments"] });
            queryClient.invalidateQueries({ queryKey: ["investment", investment?.id] });
            queryClient.invalidateQueries({ queryKey: ["investment-transactions", investment?.id] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            onOpenChange(false);
            form.reset();
        },
    });

    function onSubmit(values: z.infer<typeof formSchema>) {
        sellInvestment.mutate(values);
    }

    if (!investment) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('modal.sell.title')} {investment.ticker}</DialogTitle>
                    <DialogDescription>
                        {t('modal.sell.description')}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 py-4">
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-foreground border-b pb-2">
                                {t('modal.sell.transactionDetails')}
                            </h3>
                            <div className="grid gap-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="pricePerUnit"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('modal.sell.pricePerShare')} *</FormLabel>
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
                                                    disabled={true}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger className="bg-muted">
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
                                                <FormLabel>{t('modal.sell.quantity')} * ({tc('labels.max')}: {investment.quantity})</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.0001" max={investment.quantity} {...field} />
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

                        <Button type="submit" className="w-full" disabled={sellInvestment.isPending}>
                            {sellInvestment.isPending ? tc('status.selling') : t('modal.sell.sellInvestment')}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
