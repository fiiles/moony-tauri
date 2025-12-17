import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { InsurancePolicy } from "@shared/schema";
import {
    Dialog,
    DialogContent,
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useCurrency, currencies } from "@/lib/currency";
import { insuranceApi } from "@/lib/tauri-api";
import { useTranslation } from "react-i18next";

// Form-specific schema with Date objects
const insuranceFormSchema = z.object({
    type: z.string().min(1),
    provider: z.string().min(1),
    policyName: z.string().min(1),
    policyNumber: z.string().optional(),
    startDate: z.date(),
    endDate: z.date().optional().nullable(),
    paymentFrequency: z.string(),
    oneTimePayment: z.string().optional(),
    oneTimePaymentCurrency: z.string().optional(),
    regularPayment: z.string().optional(),
    regularPaymentCurrency: z.string().optional(),
    limits: z.array(z.object({
        title: z.string(),
        amount: z.number(),
        currency: z.string(),
    })).optional(),
    notes: z.string().optional(),
    status: z.string().optional(),
});

type InsuranceFormData = z.infer<typeof insuranceFormSchema>;

interface InsuranceFormDialogProps {
    policy?: InsurancePolicy;
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function InsuranceFormDialog({ policy, trigger, open, onOpenChange }: InsuranceFormDialogProps) {
    const { t } = useTranslation('insurance');
    const { t: tc } = useTranslation('common');
    const [internalOpen, setInternalOpen] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { currencyCode: userCurrency } = useCurrency();

    const isControlled = open !== undefined;
    const isOpen = isControlled ? open : internalOpen;
    const setIsOpen = isControlled ? onOpenChange : setInternalOpen;

    const form = useForm<InsuranceFormData>({
        resolver: zodResolver(insuranceFormSchema),
        defaultValues: {
            type: policy?.type || "life",
            provider: policy?.provider || "",
            policyName: policy?.policyName || "",
            policyNumber: policy?.policyNumber || "",
            startDate: policy?.startDate ? new Date(policy.startDate * 1000) : new Date(),
            endDate: policy?.endDate ? new Date(policy.endDate * 1000) : undefined,
            paymentFrequency: policy?.paymentFrequency || "monthly",
            oneTimePayment: policy?.oneTimePayment?.toString() || undefined,
            oneTimePaymentCurrency: (policy as any)?.oneTimePaymentCurrency || userCurrency,
            regularPayment: policy?.regularPayment?.toString() || "0",
            regularPaymentCurrency: (policy as any)?.regularPaymentCurrency || userCurrency,
            limits: policy?.limits || [],
            notes: policy?.notes || "",
            status: policy?.status || "active",
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "limits" as any,
    });

    // Reset form when policy changes or dialog opens
    useEffect(() => {
        if (isOpen) {
            form.reset({
                type: policy?.type || "life",
                provider: policy?.provider || "",
                policyName: policy?.policyName || "",
                policyNumber: policy?.policyNumber || "",
                startDate: policy?.startDate ? new Date(policy.startDate * 1000) : new Date(),
                endDate: policy?.endDate ? new Date(policy.endDate * 1000) : undefined,
                paymentFrequency: policy?.paymentFrequency || "monthly",
                oneTimePayment: policy?.oneTimePayment?.toString() || undefined,
                oneTimePaymentCurrency: (policy as any)?.oneTimePaymentCurrency || userCurrency,
                regularPayment: policy?.regularPayment?.toString() || "0",
                regularPaymentCurrency: (policy as any)?.regularPaymentCurrency || userCurrency,
                limits: policy?.limits || [],
                notes: policy?.notes || "",
                status: policy?.status || "active",
            });
        }
    }, [isOpen, policy, form, userCurrency]);

    const createMutation = useMutation({
        mutationFn: async (data: InsuranceFormData) => {
            // Convert Date to timestamp
            const payload = {
                ...data,
                startDate: Math.floor(data.startDate.getTime() / 1000),
                endDate: data.endDate ? Math.floor(data.endDate.getTime() / 1000) : undefined,
            };
            return insuranceApi.create(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["insurance"] });
            setIsOpen?.(false);
            toast({ title: tc('status.success'), description: t('toast.added') });
        },
        onError: (error: Error) => {
            toast({ title: tc('status.error'), description: error.message, variant: "destructive" });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async (data: InsuranceFormData) => {
            const payload = {
                ...data,
                startDate: Math.floor(data.startDate.getTime() / 1000),
                endDate: data.endDate ? Math.floor(data.endDate.getTime() / 1000) : undefined,
            };
            return insuranceApi.update(policy!.id, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["insurance"] });
            setIsOpen?.(false);
            toast({ title: tc('status.success'), description: t('toast.updated') });
        },
        onError: (error: Error) => {
            toast({ title: tc('status.error'), description: error.message, variant: "destructive" });
        },
    });

    const onSubmit = (data: InsuranceFormData) => {
        if (policy) {
            updateMutation.mutate(data);
        } else {
            createMutation.mutate(data);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{policy ? t('form.editTitle') : t('form.addTitle')}</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('form.type')}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('modal.selectType')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="life">{t('types.life')}</SelectItem>
                                                <SelectItem value="travel">{t('types.travel')}</SelectItem>
                                                <SelectItem value="accident">{t('types.accident')}</SelectItem>
                                                <SelectItem value="property">{t('types.property')}</SelectItem>
                                                <SelectItem value="liability">{t('types.liability')}</SelectItem>
                                                <SelectItem value="other">{t('types.other')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{tc('labels.status')}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('modal.selectStatus')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="active">{t('modal.status.active')}</SelectItem>
                                                <SelectItem value="inactive">{t('modal.status.inactive')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="policyName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Policy Name</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="e.g. Home Insurance 2024" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="provider"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Provider</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="e.g. Allianz" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="policyNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Policy Number</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="Contract number" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="paymentFrequency"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('modal.paymentFrequency')}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('modal.selectFrequency')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="monthly">{t('modal.frequency.monthly')}</SelectItem>
                                                <SelectItem value="quarterly">{t('modal.frequency.quarterly')}</SelectItem>
                                                <SelectItem value="yearly">{t('modal.frequency.yearly')}</SelectItem>
                                                <SelectItem value="one_time">{t('modal.frequency.oneTime')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="col-span-2">
                                <FormLabel>One-Time Payment (Optional)</FormLabel>
                                <div className="grid grid-cols-3 gap-2">
                                    <FormField
                                        control={form.control}
                                        name="oneTimePayment"
                                        render={({ field }) => (
                                            <FormItem className="col-span-2">
                                                <FormControl>
                                                    <Input {...field} value={field.value ?? ""} type="number" step="0.01" placeholder="0.00" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="oneTimePaymentCurrency"
                                        render={({ field }) => (
                                            <FormItem>
                                                <Select onValueChange={field.onChange} value={field.value ?? undefined}>
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
                            </div>

                            <div className="col-span-2">
                                <FormLabel>Regular Payment *</FormLabel>
                                <div className="grid grid-cols-3 gap-2">
                                    <FormField
                                        control={form.control}
                                        name="regularPayment"
                                        render={({ field }) => (
                                            <FormItem className="col-span-2">
                                                <FormControl>
                                                    <Input {...field} type="number" step="0.01" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="regularPaymentCurrency"
                                        render={({ field }) => (
                                            <FormItem>
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
                            </div>

                            <FormField
                                control={form.control}
                                name="startDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Start Date</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                                                onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="endDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>End Date (Optional)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                                                onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>


                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <FormLabel>Coverage Limits</FormLabel>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({ title: "", amount: 0, currency: userCurrency as string })}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Limit
                                </Button>
                            </div>
                            {fields.map((field, index) => (
                                <div key={field.id} className="flex gap-2 items-end">
                                    <FormField
                                        control={form.control}
                                        name={`limits.${index}.title` as any}
                                        render={({ field }) => (
                                            <FormItem className="flex-1">
                                                <FormControl>
                                                    <Input {...field} placeholder="Limit Title" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`limits.${index}.amount` as any}
                                        render={({ field }) => (
                                            <FormItem className="w-32">
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        type="number"
                                                        onChange={e => field.onChange(parseFloat(e.target.value))}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`limits.${index}.currency` as any}
                                        render={({ field }) => (
                                            <FormItem className="w-24">
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
                                            </FormItem>
                                        )}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => remove(index)}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes</FormLabel>
                                    <FormControl>
                                        <Textarea {...field} value={field.value ?? ""} placeholder="Special conditions, contacts..." />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsOpen?.(false)}>
                                {tc('buttons.cancel')}
                            </Button>
                            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                                {policy ? t('modal.updatePolicy') : t('modal.createPolicy')}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
