
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useBankTransactionMutations } from "@/hooks/use-bank-account-mutations";
import { useState, useEffect } from "react";
import { Plus, Loader2, Banknote, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CategorySelector } from "./CategorySelector";
import { useQuery } from "@tanstack/react-query";
import { bankAccountsApi } from "@/lib/tauri-api";
import { CURRENCIES } from "@shared/currencies";

const formSchema = z.object({
    type: z.enum(["credit", "debit"]),
    amount: z.coerce.number().positive("validation.amountRequired"),
    currency: z.string().min(1, "validation.currencyRequired"),
    date: z.string().min(1, "validation.dateRequired"),
    description: z.string().optional(),
    counterpartyName: z.string().optional(),
    counterpartyIban: z.string().optional(),
    variableSymbol: z.string().optional(),
    categoryId: z.string().nullable().optional(),
});


interface AddTransactionModalProps {
    accountId: string;
    accountCurrency: string;
}

export function AddTransactionModal({ accountId, accountCurrency }: AddTransactionModalProps) {
    const { t } = useTranslation('bank_accounts');
    const { t: tc } = useTranslation('common');
    const [open, setOpen] = useState(false);
    const { createTransaction } = useBankTransactionMutations(accountId);

    // Fetch transaction categories
    const { data: categories = [] } = useQuery({
        queryKey: ["transaction-categories"],
        queryFn: () => bankAccountsApi.getCategories(),
    });

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            type: "debit",
            amount: undefined,
            currency: accountCurrency,
            date: new Date().toISOString().split("T")[0],
            description: "",
            counterpartyName: "",
            counterpartyIban: "",
            variableSymbol: "",
            categoryId: null,
        },
    });

    // Reset currency when accountCurrency changes
    useEffect(() => {
        if (open) {
             form.reset({
                type: "debit",
                amount: undefined,
                currency: accountCurrency,
                date: new Date().toISOString().split("T")[0],
                description: "",
                counterpartyName: "",
                counterpartyIban: "",
                variableSymbol: "",
                categoryId: null,
            });
        }
    }, [open, accountCurrency, form]);


    function onSubmit(values: z.infer<typeof formSchema>) {
        createTransaction.mutate({
            bankAccountId: accountId,
            type: values.type,
            amount: values.amount.toString(),
            currency: values.currency,
            bookingDate: Math.floor(new Date(values.date).getTime() / 1000),
            description: values.description || null,
            counterpartyName: values.counterpartyName || null,
            counterpartyIban: values.counterpartyIban || null,
            variableSymbol: values.variableSymbol || null,
            categoryId: values.categoryId || null,
            status: "booked", // Default status
        }, {
            onSuccess: () => {
                setOpen(false);
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t('transaction.add')}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('transaction.add')}</DialogTitle>
                    <DialogDescription>
                        {t('transaction.addDescription', 'Add a new transaction manually.')}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 py-4">
                        
                        {/* Transaction Details Section */}
                        <div className="form-section-accent">
                            <h3 className="form-section-header-icon">
                                <Banknote className="h-4 w-4" />
                                {t('transaction.details', 'Transaction Details')}
                            </h3>
                            <div className="grid gap-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="type"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('transaction.type')}</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="bg-card">
                                                            <SelectValue placeholder="Select type" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="credit">{t('transaction.credit')}</SelectItem>
                                                        <SelectItem value="debit">{t('transaction.debit')}</SelectItem>
                                                    </SelectContent>
                                                </Select>
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
                                                    <Input type="date" className="bg-card" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="amount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('transaction.amount')} *</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" className="bg-card" {...field} />
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
                                                 <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="bg-card">
                                                            <SelectValue placeholder={tc('labels.selectCurrency')} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {Object.values(CURRENCIES).map((c) => (
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
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('transaction.description')}</FormLabel>
                                            <FormControl>
                                                <Input className="bg-card" placeholder="e.g. Grocery shopping" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                
                                <FormField
                                    control={form.control}
                                    name="categoryId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('categorization.category')}</FormLabel>
                                            <FormControl>
                                                <CategorySelector
                                                    currentCategoryId={field.value}
                                                    categories={categories}
                                                    onCategoryChange={field.onChange}
                                                    compact={false}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Counterparty Section */}
                        <div className="form-section-accent">
                            <h3 className="form-section-header-icon">
                                <User className="h-4 w-4" />
                                {t('transaction.counterpartyInfo', 'Counterparty Info')}
                            </h3>
                            <div className="grid gap-4">
                                <FormField
                                    control={form.control}
                                    name="counterpartyName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('transaction.counterparty')}</FormLabel>
                                            <FormControl>
                                                <Input className="bg-card" placeholder="e.g. Tesco" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="counterpartyIban"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('transaction.counterpartyIban', 'Counterparty IBAN')}</FormLabel>
                                                <FormControl>
                                                    <Input className="bg-card" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="variableSymbol"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('transaction.variableSymbol', 'Variable Symbol')}</FormLabel>
                                                <FormControl>
                                                    <Input className="bg-card" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        </div>

                        <Button type="submit" className="w-full" disabled={createTransaction.isPending}>
                            {createTransaction.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Plus className="mr-2 h-4 w-4" />
                            )}
                            {createTransaction.isPending ? tc('status.adding') : t('transaction.add')}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
