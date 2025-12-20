import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLoanSchema, InsertLoan, Loan } from "@shared/schema";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useCurrency, currencies } from "@/lib/currency";
import { CurrencyCode } from "@shared/currencies";
import { useTranslation } from "react-i18next";

interface LoanFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: InsertLoan | (Partial<Loan> & { id: string })) => void;
    loan?: Loan | null;
    isLoading?: boolean;
}

export function LoanFormDialog({
    open,
    onOpenChange,
    onSubmit,
    loan,
    isLoading,
}: LoanFormDialogProps) {
    const { t } = useTranslation('loans');
    const { t: tc } = useTranslation('common');
    const { convert, currencyCode: userCurrency } = useCurrency();
    const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(userCurrency);

    const form = useForm<InsertLoan>({
        resolver: zodResolver(insertLoanSchema),
        defaultValues: {
            name: "",
            principal: "0",
            interestRate: "0",
            monthlyPayment: "0",
            interestRateValidityDate: undefined,
            startDate: new Date(),
            endDate: undefined,
        } as any,
    });

    useEffect(() => {
        if (open) {
            if (loan) {
                // Display loan in its STORED currency (no conversion)
                const storedCurrency = (loan as any).currency || "CZK";

                form.reset({
                    name: loan.name,
                    principal: loan.principal.toString(),
                    interestRate: loan.interestRate.toString(),
                    monthlyPayment: (loan as any).monthlyPayment?.toString() || "0",
                    interestRateValidityDate: (loan as any).interestRateValidityDate ? new Date((loan as any).interestRateValidityDate * 1000) : undefined,
                    startDate: (loan as any).startDate ? new Date((loan as any).startDate * 1000) : new Date(),
                    endDate: (loan as any).endDate ? new Date((loan as any).endDate * 1000) : undefined,
                } as any);
                setSelectedCurrency(storedCurrency as CurrencyCode);
            } else {
                form.reset({
                    name: "",
                    principal: "0",
                    interestRate: "0",
                    monthlyPayment: "0",
                    interestRateValidityDate: undefined,
                    startDate: new Date(),
                    endDate: undefined,
                } as any);
                setSelectedCurrency(userCurrency);
            }
        }
    }, [loan, form, open, userCurrency]);

    const handleSubmit = (data: InsertLoan) => {
        // Convert Date objects to Unix timestamps (seconds)
        const convertToTimestamp = (value: any): number | undefined => {
            if (!value) return undefined;
            if (value instanceof Date) {
                return Math.floor(value.getTime() / 1000);
            }
            if (typeof value === 'number') {
                return value;
            }
            return undefined;
        };

        // Send amounts in ORIGINAL currency (no conversion to CZK)
        const submissionData = {
            ...data,
            currency: selectedCurrency,
            principal: data.principal,
            monthlyPayment: data.monthlyPayment,
            startDate: convertToTimestamp(data.startDate),
            endDate: convertToTimestamp(data.endDate),
            interestRateValidityDate: convertToTimestamp(data.interestRateValidityDate),
        };

        if (loan) {
            onSubmit({ ...submissionData, id: loan.id });
        } else {
            onSubmit(submissionData as InsertLoan);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{loan ? t('form.editTitle') : t('form.addTitle')}</DialogTitle>
                    <DialogDescription>
                        {loan ? t('modal.editDescription') : t('modal.addDescription')}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="grid gap-6 py-4"
                    >
                        <div className="form-section">
                            <h3 className="form-section-header">
                                {t('modal.basicInfo')}
                            </h3>
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('form.name')} *</FormLabel>
                                        <FormControl>
                                            <Input placeholder={t('form.namePlaceholder')} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="form-section">
                            <h3 className="form-section-header">
                                {t('modal.financialDetails')}
                            </h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="principal"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('form.originalAmount')} *</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="0.00"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormItem>
                                        <FormLabel>{tc('labels.currency')}</FormLabel>
                                        <Select
                                            value={selectedCurrency}
                                            onValueChange={(v) => setSelectedCurrency(v as CurrencyCode)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {currencies.map((c) => (
                                                    <SelectItem key={c.code} value={c.code}>
                                                        {c.code} ({c.symbol})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="interestRate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('form.interestRate')} *</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="0.00"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="monthlyPayment"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('form.monthlyPayment')} *</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="0.00"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="endDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('form.endDate')}</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="date"
                                                        value={
                                                            field.value
                                                                ? format(new Date(field.value), "yyyy-MM-dd")
                                                                : ""
                                                        }
                                                        onChange={(e) =>
                                                            field.onChange(
                                                                e.target.value ? new Date(e.target.value) : undefined
                                                            )
                                                        }
                                                    />
                                                </FormControl>
                                                <p className="text-xs text-muted-foreground">
                                                    {t('modal.endDateHelp')}
                                                </p>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="interestRateValidityDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('modal.rateValidity')}</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="date"
                                                        value={
                                                            field.value
                                                                ? format(new Date(field.value), "yyyy-MM-dd")
                                                                : ""
                                                        }
                                                        onChange={(e) =>
                                                            field.onChange(
                                                                e.target.value ? new Date(e.target.value) : null
                                                            )
                                                        }
                                                    />
                                                </FormControl>
                                                <p className="text-xs text-muted-foreground">
                                                    {t('modal.rateValidityHelp')}
                                                </p>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />


                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                                {tc('buttons.cancel')}
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? tc('status.saving') : loan ? tc('buttons.saveChanges') : t('addLoan')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
