
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
import type { OtherAsset } from "@shared/schema";
import { useEffect } from "react";
import { otherAssetsApi } from "@/lib/tauri-api";
import { useTranslation } from "react-i18next";

const formSchema = z.object({
    quantity: z.coerce.number().positive("Quantity must be positive"),
    pricePerUnit: z.coerce.number().min(0, "Price must be non-negative"),
    currency: z.enum(["USD", "EUR", "CZK"]),
    date: z.string().optional(),
});

interface SellOtherAssetModalProps {
    asset: OtherAsset | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SellOtherAssetModal({ asset, open, onOpenChange }: SellOtherAssetModalProps) {
    const { t } = useTranslation('otherAssets');
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

    useEffect(() => {
        if (asset) {
            form.setValue("currency", asset.currency as any);
        }
    }, [asset, form]);

    const sellMutation = useMutation({
        mutationFn: async (values: z.infer<typeof formSchema>) => {
            if (!asset) return;

            const txData = {
                type: "sell",
                quantity: values.quantity.toString(),
                pricePerUnit: values.pricePerUnit.toString(),
                currency: values.currency,
                transactionDate: values.date ? Math.floor(new Date(values.date).getTime() / 1000) : Math.floor(Date.now() / 1000),
            };

            return otherAssetsApi.createTransaction(asset.id, txData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["other-assets"] });
            queryClient.invalidateQueries({ queryKey: ["other-asset-transactions", asset?.id] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-history"] });
            onOpenChange(false);
            form.reset();
        },
    });

    function onSubmit(values: z.infer<typeof formSchema>) {
        sellMutation.mutate(values);
    }

    if (!asset) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('modal.sell.title')} {asset.name}</DialogTitle>
                    <DialogDescription>
                        {t('modal.sell.description')}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="quantity"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{tc('labels.quantity')} * ({tc('labels.max')}: {asset.quantity})</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="any" max={asset.quantity} {...field} />
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
                                        <FormLabel>{t('modal.sell.pricePerUnit')} *</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="any" {...field} />
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
                        <Button type="submit" className="w-full" disabled={sellMutation.isPending}>
                            {sellMutation.isPending ? tc('status.selling') : t('modal.sell.submit')}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
