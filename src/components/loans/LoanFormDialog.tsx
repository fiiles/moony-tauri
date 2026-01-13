import { useForm, DefaultValues } from "react-hook-form";
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
import { useEffect } from "react";
import { format } from "date-fns";
import { useCurrency, currencies } from "@/lib/currency";
import { useTranslation } from "react-i18next";
import { FileText, Coins } from "lucide-react";

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
    const { currencyCode: userCurrency } = useCurrency();

    const form = useForm<InsertLoan>({
        resolver: zodResolver(insertLoanSchema),
        defaultValues: {
            name: "",
            principal: "0",
            currency: userCurrency,
            interestRate: "0",
            monthlyPayment: "0",
            interestRateValidityDate: undefined,
            startDate: new Date(),
            endDate: undefined,
        } as DefaultValues<InsertLoan>,
    });

    useEffect(() => {
        if (open) {
            if (loan) {
                // Display loan in its STORED currency (no conversion)
                const storedCurrency = loan.currency || "CZK";
                
                form.reset({
                    name: loan.name,
                    principal: loan.principal.toString(),
                    currency: storedCurrency,
                    interestRate: loan.interestRate.toString(),
                    monthlyPayment: loan.monthlyPayment?.toString() || "0",
                    interestRateValidityDate: loan.interestRateValidityDate ? new Date(loan.interestRateValidityDate * 1000) : undefined,
                    startDate: loan.startDate ? new Date(loan.startDate * 1000) : new Date(),
                    endDate: loan.endDate ? new Date(loan.endDate * 1000) : undefined,
                } as DefaultValues<InsertLoan>);
            } else {
                form.reset({
                    name: "",
                    principal: "0",
                    currency: userCurrency,
                    interestRate: "0",
                    monthlyPayment: "0",
                    interestRateValidityDate: undefined,
                    startDate: new Date(),
                    endDate: undefined,
                } as DefaultValues<InsertLoan>);
            }
        }
    }, [loan, form, open, userCurrency]);

    const handleSubmit = (data: InsertLoan) => {
        // Convert Date objects to Unix timestamps (seconds)
        const convertToTimestamp = (value: Date | number | string | undefined | null): number | undefined => {
            if (!value) return undefined;
            if (value instanceof Date) {
                return Math.floor(value.getTime() / 1000);
            }
            if (typeof value === 'number') {
                return value;
            }
            // Should not happen for validated form data but safe handling
            return undefined;
        };

        // Send amounts in ORIGINAL currency (no conversion to CZK)
        const submissionData = {
            ...data,
            // Currency is already in data from form
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
                        <div className="form-section-accent">
                            <h3 className="form-section-header-icon">
                                <FileText />
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

                        <div className="form-section-accent">
                            <h3 className="form-section-header-icon">
                                <Coins />
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
                                    <FormField
                                        control={form.control}
                                        name="currency"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{tc('labels.currency')}</FormLabel>
                                                <Select
                                                    value={field.value}
                                                    onValueChange={field.onChange}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {currencies.map((c) => (
                                                            <SelectItem key={c.code} value={c.code}>
                                                                {c.code} ({c.symbol})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />
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
