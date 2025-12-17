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
import { CURRENCIES, convertToCzK, type CurrencyCode } from "@shared/currencies";
import type { InvestmentTransaction } from "@shared/schema";
import { useEffect } from "react";
import { investmentsApi } from "@/lib/tauri-api";

const formSchema = z.object({
    quantity: z.coerce.number().positive("Quantity must be positive"),
    pricePerUnit: z.coerce.number().positive("Price must be positive"),
    currency: z.enum(["USD", "EUR", "CZK"]),
    date: z.string(),
});

interface EditTransactionModalProps {
    transaction: InvestmentTransaction | null;
    investmentId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditTransactionModal({ transaction, investmentId, open, onOpenChange }: EditTransactionModalProps) {
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

    // Reset form when transaction changes
    useEffect(() => {
        if (transaction) {
            form.reset({
                quantity: parseFloat(transaction.quantity as any),
                pricePerUnit: parseFloat(transaction.pricePerUnit as any),
                currency: transaction.currency as any,
                date: new Date(transaction.transactionDate * 1000).toISOString().split("T")[0],
            });
        }
    }, [transaction, form]);

    const updateTransaction = useMutation({
        mutationFn: async (values: z.infer<typeof formSchema>) => {
            if (!transaction || !investmentId) return;

            const txData = {
                type: transaction.type, // Type is read-only
                quantity: values.quantity.toString(),
                pricePerUnit: values.pricePerUnit.toString(),
                currency: values.currency,
                transactionDate: values.date ? Math.floor(new Date(values.date).getTime() / 1000) : Math.floor(Date.now() / 1000),
            };

            return investmentsApi.updateTransaction(transaction.id, txData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["investments"] });
            queryClient.invalidateQueries({ queryKey: ["transactions", investmentId] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            onOpenChange(false);
        },
    });

    function onSubmit(values: z.infer<typeof formSchema>) {
        updateTransaction.mutate(values);
    }

    if (!transaction) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Transaction ({transaction.type.toUpperCase()})</DialogTitle>
                    <DialogDescription>
                        Modify the details of this transaction.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 py-4">
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-foreground border-b pb-2">
                                Transaction Details
                            </h3>
                            <div className="grid gap-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="pricePerUnit"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Price per Share *</FormLabel>
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
                                                <FormLabel>Currency</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select currency" />
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
                                                <FormLabel>Quantity *</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.0001" {...field} />
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
                                                <FormLabel>Date</FormLabel>
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

                        <Button type="submit" className="w-full" disabled={updateTransaction.isPending}>
                            {updateTransaction.isPending ? "Updating..." : "Update Transaction"}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
