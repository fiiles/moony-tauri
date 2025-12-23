import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
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
import { useToast } from "@/hooks/use-toast";
import { HoldingData } from "@/utils/investments";
import { useCurrency } from "@/lib/currency";
import { CurrencyCode } from "@shared/currencies";
import { investmentsApi } from "@/lib/tauri-api";
import { useTranslation } from "react-i18next";

const manualDividendSchema = z.object({
    amount: z.string().min(1, "Amount is required"),
    currency: z.string(),
});

type FormData = z.infer<typeof manualDividendSchema>;

interface ManualDividendModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    investment: HoldingData | null;
}

export function ManualDividendModal({
    open,
    onOpenChange,
    investment,
}: ManualDividendModalProps) {
    const { t } = useTranslation('investments');
    const { t: tc } = useTranslation('common');
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { currencyCode: userCurrency, convert } = useCurrency();
    const form = useForm<FormData>({
        resolver: zodResolver(manualDividendSchema),
        defaultValues: {
            amount: "",
            currency: "CZK",
        },
    });

    // Reset form when investment changes
    useEffect(() => {
        if (investment && open) {
            form.reset({
                amount: investment.dividendYield?.toString() || "",
                currency: investment.dividendCurrency || "CZK",
            });
        }
    }, [investment, open, form]);

    const mutation = useMutation({
        mutationFn: async (data: FormData) => {
            if (!investment) return;
            return investmentsApi.setManualDividend(investment.ticker, data.amount, data.currency);
        },

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["investments"] });
            queryClient.invalidateQueries({ queryKey: ["dividend-summary"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            toast({
                title: tc('status.success'),
                description: t('toast.updated'),
            });
            onOpenChange(false);
        },
        onError: (error) => {
            toast({
                title: tc('status.error'),
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (!investment) return;
            return investmentsApi.deleteManualDividend(investment.ticker);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["investments"] });
            queryClient.invalidateQueries({ queryKey: ["dividend-summary"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            toast({
                title: tc('status.success'),
                description: t('toast.manualDividendDeleted', { defaultValue: 'Manual dividend override removed' }),
            });
            onOpenChange(false);
        },
        onError: (error: Error) => {
            toast({
                title: tc('status.error'),
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const onSubmit = (data: FormData) => {
        mutation.mutate(data);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('modals.updateDividend.title')}</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('modals.updateDividend.annualDividend')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
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
                                                <SelectItem value="CZK">CZK</SelectItem>
                                                <SelectItem value="USD">USD</SelectItem>
                                                <SelectItem value="EUR">EUR</SelectItem>
                                                <SelectItem value="GBP">GBP</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="rounded-lg bg-muted p-3 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">{tc('labels.estimatedTotal')}</span>
                                <span className="font-medium">
                                    {(() => {
                                        const amount = parseFloat(form.watch("amount") || "0");
                                        const quantity = investment?.quantity || 0;
                                        const total = amount * quantity;
                                        const formCurrency = form.watch("currency") as CurrencyCode;

                                        const formattedTotal = total.toFixed(2);

                                        if (formCurrency !== userCurrency) {
                                            const convertedTotal = convert(total, formCurrency, userCurrency);
                                            return `${formattedTotal} ${formCurrency} / ${convertedTotal.toFixed(2)} ${userCurrency}`;
                                        }

                                        return `${formattedTotal} ${formCurrency}`;
                                    })()}
                                </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 text-right">
                                Formula: {form.watch("amount") || "0"} × {investment?.quantity?.toFixed(4) || "0"} shares
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                type="submit"
                                className="flex-1"
                                disabled={mutation.isPending}
                            >
                                {mutation.isPending ? tc('status.updating') : t('actions.updateDividend')}
                            </Button>
                            {investment?.isManualDividend && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={() => deleteMutation.mutate()}
                                    disabled={deleteMutation.isPending}
                                >
                                    {deleteMutation.isPending ? tc('status.deleting', { defaultValue: 'Deleting...' }) : tc('actions.delete', { defaultValue: 'Delete' })}
                                </Button>
                            )}
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
