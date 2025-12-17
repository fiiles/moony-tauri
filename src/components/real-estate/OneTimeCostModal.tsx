import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { insertRealEstateOneTimeCostSchema, type InsertRealEstateOneTimeCost, type RealEstateOneTimeCost } from "@shared/schema";
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
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useCurrency, currencies } from "@/lib/currency";
import { CurrencyCode } from "@shared/currencies";
import { realEstateApi } from "@/lib/tauri-api";
import { useTranslation } from "react-i18next";

interface OneTimeCostModalProps {
    realEstateId: string;
    cost?: RealEstateOneTimeCost;
    trigger?: React.ReactNode;
}

export function OneTimeCostModal({ realEstateId, cost, trigger }: OneTimeCostModalProps) {
    const { t } = useTranslation('realEstate');
    const { t: tc } = useTranslation('common');
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { currencyCode: userCurrency } = useCurrency();
    const isEditMode = !!cost;

    const form = useForm<InsertRealEstateOneTimeCost>({
        resolver: zodResolver(insertRealEstateOneTimeCostSchema),
        defaultValues: {
            name: cost?.name || "",
            description: cost?.description || "",
            amount: cost?.amount?.toString() || "0",
            currency: (cost as any)?.currency || userCurrency,
            date: cost?.date ? new Date(cost.date * 1000) : new Date(),
            realEstateId,
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: InsertRealEstateOneTimeCost) => {
            const costData = {
                ...data,
                realEstateId,
                date: data.date ? Math.floor(new Date(data.date).getTime() / 1000) : Math.floor(Date.now() / 1000),
            };

            if (isEditMode) {
                return realEstateApi.updateCost(cost!.id, costData);
            } else {
                return realEstateApi.createCost(costData);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["real-estate-costs", realEstateId] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            setOpen(false);
            if (!isEditMode) {
                form.reset({
                    name: "",
                    description: "",
                    amount: "0",
                    currency: userCurrency,
                    date: new Date(),
                    realEstateId,
                });
            }
            toast({
                title: tc('status.success'),
                description: isEditMode ? t('toast.costUpdated') : t('toast.costAdded'),
            });
        },
        onError: (error) => {
            toast({
                title: tc('status.error'),
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const onSubmit = (data: InsertRealEstateOneTimeCost) => {
        createMutation.mutate({
            ...data,
            amount: data.amount.toString(),
            realEstateId,
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger ? (
                <DialogTrigger asChild>
                    {trigger}
                </DialogTrigger>
            ) : (
                <DialogTrigger asChild>
                    <Button size="sm">
                        <Plus className="mr-2 h-4 w-4" /> {t('modal.cost.addCost')}
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? t('modal.cost.editTitle') : t('modal.cost.title')}</DialogTitle>
                    <DialogDescription>
                        {isEditMode ? t('modal.cost.editDescription') : t('modal.cost.description')}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 py-4">
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-foreground border-b pb-2">
                                {t('modal.cost.costDetails')}
                            </h3>
                            <div className="grid gap-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('modal.cost.name')}</FormLabel>
                                            <FormControl>
                                                <Input placeholder={t('modal.cost.namePlaceholder')} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-3 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="amount"
                                        render={({ field }) => (
                                            <FormItem className="col-span-2">
                                                <FormLabel>{t('modal.cost.amount')}</FormLabel>
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
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {currencies.map((c) => (
                                                            <SelectItem key={c.code} value={c.code}>
                                                                {c.code}
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
                                            <FormLabel>{t('modal.cost.date')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="date"
                                                    value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                                                    onChange={(e) => field.onChange(e.target.valueAsDate)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('modal.cost.descriptionLabel')}</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder={t('modal.cost.descriptionPlaceholder')} {...field} value={field.value || ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isEditMode ? t('modal.cost.updateCost') : t('modal.cost.addCost')}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog >
    );
}
