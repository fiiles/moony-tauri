import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { otherAssetsApi } from "@/lib/tauri-api";
import { insertOtherAssetSchema } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { EXCHANGE_RATES } from "@shared/currencies";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Package, TrendingUp } from "lucide-react";

// Combined schema for form
const formSchema = insertOtherAssetSchema.extend({
    // Optional initial transaction fields
    initialQuantity: z.string().optional(),
    initialPrice: z.string().optional(),
    initialDate: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddOtherAssetModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddOtherAssetModal({ open, onOpenChange }: AddOtherAssetModalProps) {
    const { t } = useTranslation('otherAssets');
    const { t: tc } = useTranslation('common');
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            marketPrice: "0",
            quantity: "0", // Default 0 if no initial tx
            currency: "CZK",
            yieldType: "none",
            yieldValue: "0",
            initialQuantity: "",
            initialPrice: "",
            initialDate: new Date().toISOString().split("T")[0],
        },
    });

    const mutation = useMutation({
        mutationFn: async (data: FormData) => {
            let initialTransaction = undefined;
            let quantity = data.quantity ? data.quantity.toString() : "0";
            let averagePurchasePrice = "0";

            if (data.initialQuantity && data.initialPrice && data.initialDate) {
                initialTransaction = {
                    type: 'buy',
                    quantity: data.initialQuantity,
                    pricePerUnit: data.initialPrice,
                    currency: data.currency || 'CZK',
                    transactionDate: Math.floor(new Date(data.initialDate).getTime() / 1000),
                };
                quantity = data.initialQuantity;
                averagePurchasePrice = data.initialPrice;
            }

            // Construct payload
            const assetData = {
                name: data.name,
                marketPrice: data.marketPrice ? data.marketPrice.toString() : "0",
                currency: data.currency,
                yieldType: data.yieldType,
                yieldValue: (data.yieldType === 'none' || !data.yieldValue) ? undefined : data.yieldValue.toString(),
                quantity: quantity,
                averagePurchasePrice: averagePurchasePrice,
            };

            return otherAssetsApi.create(assetData, initialTransaction);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["other-assets"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-history"] });
            toast({ title: t('toast.added') });
            onOpenChange(false);
            form.reset();
        },
        onError: (err) => {
            console.error(err);
            toast({ title: tc('status.error'), description: err.message, variant: "destructive" });
        }
    });

    const onSubmit = (data: FormData) => {
        mutation.mutate(data);
    };

    const yieldType = form.watch("yieldType");

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{t('modal.add.title')}</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 py-4">
                    <div className="form-section-accent">
                        <h3 className="form-section-header-icon">
                            <Package />
                            {t('modal.add.basicInfo')}
                        </h3>
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">{t('modal.add.assetName')}</Label>
                                <Input id="name" {...form.register("name")} placeholder={t('modal.add.assetNamePlaceholder')} />
                                {form.formState.errors.name && <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="currency">{tc('labels.currency')}</Label>
                                    <Select
                                        value={form.watch("currency")}
                                        onValueChange={(val) => form.setValue("currency", val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={tc('labels.selectCurrency')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.keys(EXCHANGE_RATES).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="marketPrice">{t('modal.add.marketPrice')}</Label>
                                    <Input id="marketPrice" type="number" step="0.01" {...form.register("marketPrice")} />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="i-qty">{tc('labels.quantity')}</Label>
                                    <Input id="i-qty" type="number" step="0.0001" {...form.register("initialQuantity")} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="i-price">{t('modal.add.pricePerUnit')}</Label>
                                    <Input id="i-price" type="number" step="0.01" {...form.register("initialPrice")} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="i-date">{tc('labels.date')}</Label>
                                    <Input id="i-date" type="date" {...form.register("initialDate")} />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{t('modal.add.initialPurchaseHint')}</p>
                        </div>
                    </div>

                    <div className="form-section-accent">
                        <h3 className="form-section-header-icon">
                            <TrendingUp />
                            {t('modal.add.yieldConfig')}
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="yieldType">Type</Label>
                                <Select
                                    value={yieldType}
                                    onValueChange={(val) => form.setValue("yieldType", val as any)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        <SelectItem value="fixed">Fixed Amount (Yearly)</SelectItem>
                                        <SelectItem value="percent_purchase">% of Purchase Price</SelectItem>
                                        <SelectItem value="percent_market">% of Market Price</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {yieldType !== 'none' && (
                                <div className="grid gap-2">
                                    <Label htmlFor="yieldValue">Value</Label>
                                    <Input id="yieldValue" type="number" step="any" {...form.register("yieldValue")} />
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={mutation.isPending}>
                            {mutation.isPending ? tc('status.adding') : t('modal.add.submit')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
