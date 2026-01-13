import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { insertRealEstateSchema, type InsertRealEstate, type Loan, type RealEstate, type InsurancePolicy } from "@shared/schema";
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
import { Plus, Trash2, Loader2, Home, Coins, Receipt, Landmark, Shield, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useCurrency } from "@/lib/currency";
import { currencies } from "@/lib/currency";
import { realEstateApi, loansApi, insuranceApi } from "@/lib/tauri-api";
import { useTranslation } from "react-i18next";

interface AddRealEstateModalProps {
    realEstate?: RealEstate;
    trigger?: React.ReactNode;
}

export function AddRealEstateModal({ realEstate, trigger }: AddRealEstateModalProps) {
    const { t } = useTranslation('realEstate');
    const { t: tc } = useTranslation('common');
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { currencyCode: userCurrency } = useCurrency();

    const form = useForm<InsertRealEstate>({
        resolver: zodResolver(insertRealEstateSchema),
        defaultValues: {
            name: realEstate?.name || "",
            address: realEstate?.address || "",
            type: realEstate?.type || "personal",
            purchasePrice: realEstate?.purchasePrice?.toString() || "0",
            purchasePriceCurrency: (realEstate as any)?.purchasePriceCurrency || userCurrency,
            marketPrice: realEstate?.marketPrice?.toString() || "0",
            marketPriceCurrency: (realEstate as any)?.marketPriceCurrency || userCurrency,
            monthlyRent: realEstate?.monthlyRent?.toString() || "0",
            monthlyRentCurrency: (realEstate as any)?.monthlyRentCurrency || userCurrency,
            recurringCosts: (realEstate?.recurringCosts as any)?.map((cost: any) => ({
                ...cost,
                currency: cost.currency || userCurrency,
            })) || [],
            photos: (realEstate?.photos as any) || [],
            notes: realEstate?.notes || "",
        },
    });

    // Reset form when realEstate changes or modal opens
    useEffect(() => {
        if (open && realEstate) {
            form.reset({
                name: realEstate.name,
                address: realEstate.address,
                type: realEstate.type,
                purchasePrice: realEstate.purchasePrice.toString(),
                purchasePriceCurrency: (realEstate as any).purchasePriceCurrency || userCurrency,
                marketPrice: realEstate.marketPrice.toString(),
                marketPriceCurrency: (realEstate as any).marketPriceCurrency || userCurrency,
                monthlyRent: realEstate.monthlyRent?.toString() || "0",
                monthlyRentCurrency: (realEstate as any).monthlyRentCurrency || userCurrency,
                recurringCosts: (realEstate.recurringCosts as any)?.map((cost: any) => ({
                    ...cost,
                    currency: cost.currency || userCurrency,
                })) || [],
                photos: (realEstate.photos as any) || [],
                notes: realEstate.notes || "",
            });
        } else if (open && !realEstate) {
            form.reset({
                name: "",
                address: "",
                type: "personal",
                purchasePrice: "0",
                purchasePriceCurrency: userCurrency,
                marketPrice: "0",
                marketPriceCurrency: userCurrency,
                monthlyRent: "0",
                monthlyRentCurrency: userCurrency,
                recurringCosts: [],
                photos: [],
                notes: "",
            });
        }
    }, [open, realEstate, form, userCurrency]);

    const { fields: costFields, append: appendCost, remove: removeCost } = useFieldArray({
        control: form.control,
        name: "recurringCosts" as any, // Type assertion due to schema complexity
    });

    // Fetch available loans (not linked to other real estate)
    const { data: availableLoans } = useQuery<Loan[]>({
        queryKey: ["available-loans"],
        queryFn: () => loansApi.getAvailable(),
        enabled: open,
    });

    // Fetch linked loans if editing
    const { data: linkedLoans } = useQuery<Loan[]>({
        queryKey: ["real-estate-loans", realEstate?.id],
        queryFn: () => realEstate?.id ? realEstateApi.getLoans(realEstate.id) : Promise.resolve([]),
        enabled: !!realEstate?.id && open,
    });

    const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);
    const [selectedInsuranceIds, setSelectedInsuranceIds] = useState<string[]>([]);

    // Update selectedLoanIds when linkedLoans are fetched
    useEffect(() => {
        if (linkedLoans) {
            setSelectedLoanIds(linkedLoans.map(l => l.id));
        } else {
            setSelectedLoanIds([]);
        }
    }, [linkedLoans]);

    // Fetch available insurances (not linked to any real estate)
    const { data: availableInsurances } = useQuery<InsurancePolicy[]>({
        queryKey: ["available-insurances"],
        queryFn: () => insuranceApi.getAvailable(),
        enabled: open,
    });

    // Fetch linked insurances if editing
    const { data: linkedInsurances } = useQuery<InsurancePolicy[]>({
        queryKey: ["real-estate-insurances", realEstate?.id],
        queryFn: () => realEstate?.id ? realEstateApi.getInsurances(realEstate.id) : Promise.resolve([]),
        enabled: !!realEstate?.id && open,
    });

    // Update selectedInsuranceIds when linkedInsurances are fetched
    useEffect(() => {
        if (linkedInsurances) {
            setSelectedInsuranceIds(linkedInsurances.map(i => i.id));
        } else {
            setSelectedInsuranceIds([]);
        }
    }, [linkedInsurances]);

    const mutation = useMutation({
        mutationFn: async (data: InsertRealEstate) => {
            let savedRealEstate;
            if (realEstate) {
                savedRealEstate = await realEstateApi.update(realEstate.id, data);
            } else {
                savedRealEstate = await realEstateApi.create(data);
            }

            // Handle loan linking
            if (realEstate) {
                // Get current links (linkedLoans) and compare with selectedLoanIds
                const currentIds = linkedLoans?.map(l => l.id) || [];
                const toAdd = selectedLoanIds.filter(id => !currentIds.includes(id));
                const toRemove = currentIds.filter(id => !selectedLoanIds.includes(id));

                await Promise.all([
                    ...toAdd.map(loanId => realEstateApi.linkLoan(savedRealEstate.id, loanId)),
                    ...toRemove.map(loanId => realEstateApi.unlinkLoan(savedRealEstate.id, loanId))
                ]);
            } else {
                // Create mode - just link selected
                if (selectedLoanIds.length > 0) {
                    await Promise.all(selectedLoanIds.map(loanId =>
                        realEstateApi.linkLoan(savedRealEstate.id, loanId)
                    ));
                }
            }

            // Handle insurance linking
            if (realEstate) {
                // Get current links (linkedInsurances) and compare with selectedInsuranceIds
                const currentInsuranceIds = linkedInsurances?.map(i => i.id) || [];
                const toAddInsurance = selectedInsuranceIds.filter(id => !currentInsuranceIds.includes(id));
                const toRemoveInsurance = currentInsuranceIds.filter(id => !selectedInsuranceIds.includes(id));

                await Promise.all([
                    ...toAddInsurance.map(insuranceId => realEstateApi.linkInsurance(savedRealEstate.id, insuranceId)),
                    ...toRemoveInsurance.map(insuranceId => realEstateApi.unlinkInsurance(savedRealEstate.id, insuranceId))
                ]);
            } else {
                // Create mode - just link selected insurances
                if (selectedInsuranceIds.length > 0) {
                    await Promise.all(selectedInsuranceIds.map(insuranceId =>
                        realEstateApi.linkInsurance(savedRealEstate.id, insuranceId)
                    ));
                }
            }

            return savedRealEstate;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["real-estate"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            if (realEstate) {
                queryClient.invalidateQueries({ queryKey: ["real-estate", realEstate.id] });
                queryClient.invalidateQueries({ queryKey: ["real-estate-loans", realEstate.id] });
                queryClient.invalidateQueries({ queryKey: ["real-estate-insurances", realEstate.id] });
            }
            queryClient.invalidateQueries({ queryKey: ["available-insurances"] });
            setOpen(false);
            if (!realEstate) {
                form.reset();
                setSelectedLoanIds([]);
                setSelectedInsuranceIds([]);
            }
            toast({
                title: tc('status.success'),
                description: realEstate ? t('toast.updated') : t('toast.added'),
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

    const onSubmit = (data: InsertRealEstate) => {
        const formattedData = {
            ...data,
            purchasePrice: (data.purchasePrice || "0").toString(),
            marketPrice: (data.marketPrice || "0").toString(),
            monthlyRent: data.monthlyRent?.toString() || null,
        };
        mutation.mutate(formattedData);
    };

    const watchType = form.watch("type");

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> {t('modal.add.addButton')}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{realEstate ? t('modal.add.editTitle') : t('modal.add.title')}</DialogTitle>
                    <DialogDescription>
                        {realEstate ? t('modal.add.editDescription') : t('modal.add.description')}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 py-4">
                        {/* Property Details Section */}
                        <div className="form-section-accent">
                            <h3 className="form-section-header-icon">
                                <Home />
                                {t('modal.add.propertyDetails')}
                            </h3>
                            <div className="grid gap-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('modal.add.name')}</FormLabel>
                                                <FormControl>
                                                    <Input placeholder={t('modal.add.namePlaceholder')} {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="type"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('modal.add.type')}</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={t('modal.add.selectType')} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="personal">{t('modal.add.personalUse')}</SelectItem>
                                                        <SelectItem value="investment">{t('modal.add.investment')}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="address"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('modal.add.address')}</FormLabel>
                                            <FormControl>
                                                <Input placeholder={t('modal.add.addressPlaceholder')} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Financial Details Section */}
                        <div className="form-section-accent">
                            <h3 className="form-section-header-icon">
                                <Coins />
                                {t('modal.add.financialDetails')}
                            </h3>
                            <div className="grid gap-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="purchasePrice"
                                        render={({ field }) => (
                                            <FormItem className="col-span-2">
                                                <FormLabel>{t('modal.add.purchasePrice')}</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="purchasePriceCurrency"
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
                                                        {currencies.map((c: { code: string }) => (
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

                                <div className="grid grid-cols-3 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="marketPrice"
                                        render={({ field }) => (
                                            <FormItem className="col-span-2">
                                                <FormLabel>{t('modal.add.marketPrice')}</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="marketPriceCurrency"
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
                                                        {currencies.map((c: { code: string }) => (
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

                                {watchType === "investment" && (
                                    <div className="grid grid-cols-3 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="monthlyRent"
                                            render={({ field }) => (
                                                <FormItem className="col-span-2">
                                                    <FormLabel>{t('modal.add.monthlyRent')}</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" step="0.01" {...field} value={field.value || ""} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="monthlyRentCurrency"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{tc('labels.currency')}</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {currencies.map((c: { code: string }) => (
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
                                )}
                            </div>
                        </div>

                        {/* Recurring Costs Section */}
                        <div className="form-section-accent">
                            <div className="form-section-header-icon flex items-center justify-between !border-b border-border/50 !pb-2 !mb-4">
                                <span className="flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" />{t('modal.add.recurringCosts')}</span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => appendCost({ name: "", amount: 0, frequency: "monthly", currency: userCurrency })}
                                >
                                    <Plus className="h-4 w-4 mr-1" />{t('modal.add.addCost')}
                                </Button>
                            </div>

                            <div className="space-y-2">
                                {costFields.map((field, index) => (
                                    <div key={field.id} className="flex gap-2 items-end">
                                        <FormField
                                            control={form.control}
                                            name={`recurringCosts.${index}.name` as any}
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormControl>
                                                        <Input placeholder={t('modal.add.costName')} {...field} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`recurringCosts.${index}.amount` as any}
                                            render={({ field }) => (
                                                <FormItem className="w-24">
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            {...field}
                                                            onChange={e => field.onChange(parseFloat(e.target.value))}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`recurringCosts.${index}.currency` as any}
                                            render={({ field }) => (
                                                <FormItem className="w-24">
                                                    <Select onValueChange={field.onChange} value={field.value || userCurrency}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {currencies.map((c: { code: string }) => (
                                                                <SelectItem key={c.code} value={c.code}>
                                                                    {c.code}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`recurringCosts.${index}.frequency` as any}
                                            render={({ field }) => (
                                                <FormItem className="w-32">
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="monthly">{t('modal.add.monthly')}</SelectItem>
                                                            <SelectItem value="quarterly">{t('modal.add.quarterly')}</SelectItem>
                                                            <SelectItem value="yearly">{t('modal.add.yearly')}</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeCost(index)}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                                {costFields.length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        {t('modal.add.noCosts')}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Financing Section */}
                        <div className="form-section-accent">
                            <h3 className="form-section-header-icon">
                                <Landmark />
                                {t('modal.add.financing')}
                            </h3>
                            <div className="space-y-2">
                                <FormLabel>{t('modal.add.associatedLoans')}</FormLabel>
                                <ScrollArea className="h-32 border rounded-md p-2">
                                    {/* Show available loans and currently linked ones */}
                                    {[...(availableLoans || []), ...(linkedLoans || [])].map((loan) => (
                                        <div key={loan.id} className="flex items-center space-x-2 py-1">
                                            <Checkbox
                                                id={`loan-${loan.id}`}
                                                checked={selectedLoanIds.includes(loan.id)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedLoanIds([...selectedLoanIds, loan.id]);
                                                    } else {
                                                        setSelectedLoanIds(selectedLoanIds.filter(id => id !== loan.id));
                                                    }
                                                }}
                                            />
                                            <label
                                                htmlFor={`loan-${loan.id}`}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                                {loan.name} ({Number(loan.principal).toLocaleString()} CZK)
                                            </label>
                                        </div>
                                    ))}
                                    {(!availableLoans || availableLoans.length === 0) && (!linkedLoans || linkedLoans.length === 0) && (
                                        <p className="text-sm text-muted-foreground text-center py-4">{t('modal.add.noLoans')}</p>
                                    )}
                                </ScrollArea>
                                <p className="text-xs text-muted-foreground">
                                    {t('modal.add.loanRemark')}
                                </p>
                            </div>
                        </div>

                        {/* Insurance Linking Section */}
                        <div className="form-section-accent">
                            <h3 className="form-section-header-icon">
                                <Shield />
                                {t('modal.add.linkInsurances')}
                            </h3>
                            <div className="space-y-2">
                                <ScrollArea className="h-32 border rounded-md p-2">
                                    {/* Show available insurances and currently linked ones */}
                                    {[...(availableInsurances || []), ...(linkedInsurances || [])].map((insurance) => (
                                        <div key={insurance.id} className="flex items-center space-x-2 py-1">
                                            <Checkbox
                                                id={`insurance-${insurance.id}`}
                                                checked={selectedInsuranceIds.includes(insurance.id)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedInsuranceIds([...selectedInsuranceIds, insurance.id]);
                                                    } else {
                                                        setSelectedInsuranceIds(selectedInsuranceIds.filter(id => id !== insurance.id));
                                                    }
                                                }}
                                            />
                                            <label
                                                htmlFor={`insurance-${insurance.id}`}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                                {insurance.policyName} ({insurance.provider})
                                            </label>
                                        </div>
                                    ))}
                                    {(!availableInsurances || availableInsurances.length === 0) && (!linkedInsurances || linkedInsurances.length === 0) && (
                                        <p className="text-sm text-muted-foreground text-center py-4">{t('modal.add.noAvailableInsurances')}</p>
                                    )}
                                </ScrollArea>
                                <p className="text-xs text-muted-foreground">
                                    {t('modal.add.insuranceRemark')}
                                </p>
                            </div>
                        </div>

                        {/* Additional Information Section */}
                        <div className="form-section-accent">
                            <h3 className="form-section-header-icon">
                                <Info />
                                {t('modal.add.additionalInfo')}
                            </h3>
                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('modal.add.notes')}</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder={tc('labels.notes')} {...field} value={field.value || ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Button type="submit" className="w-full" disabled={mutation.isPending}>
                            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {realEstate ? t('modal.add.updateProperty') : t('modal.add.createProperty')}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog >
    );
}

