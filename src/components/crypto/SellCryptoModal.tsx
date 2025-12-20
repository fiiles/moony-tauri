
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
import type { CryptoHoldingData } from "@/components/crypto/CryptoTable";
import { cryptoApi } from "@/lib/tauri-api";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const formSchema = z.object({
    quantity: z.coerce.number().positive("Quantity must be positive"),
    pricePerUnit: z.coerce.number().positive("Price must be positive"),
    currency: z.enum(["USD", "EUR", "CZK"]),
    date: z.string().optional(),
});

interface SellCryptoModalProps {
    investment: CryptoHoldingData | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SellCryptoModal({ investment, open, onOpenChange }: SellCryptoModalProps) {
    const { t } = useTranslation('crypto');
    const { t: tc } = useTranslation('common');
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            quantity: 0,
            pricePerUnit: 0,
            currency: "USD",
            date: new Date().toISOString().split("T")[0],
        },
    });

    const sellInvestment = useMutation({
        mutationFn: async (values: z.infer<typeof formSchema>) => {
            if (!investment) return;

            const txData = {
                type: "sell",
                ticker: investment.ticker,
                name: investment.name,
                quantity: values.quantity.toString(),
                pricePerUnit: values.pricePerUnit.toString(),
                currency: values.currency,
                transactionDate: values.date ? Math.floor(new Date(values.date).getTime() / 1000) : Math.floor(Date.now() / 1000),
            };

            return cryptoApi.createTransaction(investment.id, txData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["crypto"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            onOpenChange(false);
            form.reset();
            toast({ title: tc('status.success'), description: t('toast.deleted') });
        },
        onError: (error: Error) => {
            console.error("Failed to sell crypto:", error);
            toast({
                title: tc('status.error'),
                description: error.message,
                variant: "destructive"
            });
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
                                                <FormLabel>{t('modal.sell.pricePerUnit')} *</FormLabel>
                                                <FormControl>
                                                    <Input 
                                                        type="number" 
                                                        step="any" 
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
                                                <FormLabel>{t('modal.sell.quantity')} * ({tc('labels.max')}: {investment.quantity.toFixed(8)})</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.00000001" max={investment.quantity} {...field} />
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
                            {sellInvestment.isPending ? tc('status.selling') : t('modal.sell.sellCrypto')}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
