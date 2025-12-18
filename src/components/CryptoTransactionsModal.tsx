
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import type { CryptoTransaction } from "@shared/schema";
import type { CryptoHoldingData } from "@/components/CryptoTable";
import { useCurrency } from "@/lib/currency";
import { convertToCzK } from "@shared/currencies";
import { cryptoApi } from "@/lib/tauri-api";
import { useTranslation } from "react-i18next";

interface CryptoTransactionsModalProps {
    investment: CryptoHoldingData | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CryptoTransactionsModal({ investment, open, onOpenChange }: CryptoTransactionsModalProps) {
    const { t } = useTranslation('crypto');
    const { t: tc } = useTranslation('common');
    const queryClient = useQueryClient();
    const { formatCurrency } = useCurrency();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<CryptoTransaction | null>(null);

    const { data: transactions, isLoading } = useQuery<CryptoTransaction[]>({
        queryKey: ["crypto-transactions", investment?.id],
        queryFn: () => investment ? cryptoApi.getTransactions(investment.id) : Promise.resolve([]),
        enabled: !!investment && open,
        staleTime: 0,
        refetchOnMount: 'always',
    });

    const deleteMutation = useMutation({
        mutationFn: (txId: string) => cryptoApi.deleteTransaction(txId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["crypto"] });
            queryClient.invalidateQueries({ queryKey: ["crypto-transactions", investment?.id] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            setDeleteDialogOpen(false);
            setSelectedTransaction(null);
        },
    });

    const handleDelete = (transaction: CryptoTransaction) => {
        setSelectedTransaction(transaction);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = () => {
        if (!selectedTransaction) return;
        deleteMutation.mutate(selectedTransaction.id.toString());
    };

    if (!investment) return null;

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                        <DialogTitle>{t('modals.transactions.title')} - {investment.ticker}</DialogTitle>
                        <DialogDescription>
                            {t('actions.viewTransactions')}
                        </DialogDescription>
                    </DialogHeader>

                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">{tc('status.loading')}</div>
                    ) : !transactions || transactions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">{t('modals.transactions.noTransactions')}</div>
                    ) : (
                        <div className="rounded-lg border max-h-[500px] overflow-y-auto">
                            <Table>
                                <TableHeader className="[&_th]:bg-muted/50 sticky top-0 bg-background">
                                    <TableRow>
                                        <TableHead>{tc('labels.date')}</TableHead>
                                        <TableHead>{tc('labels.type')}</TableHead>
                                        <TableHead className="text-right">{tc('labels.quantity')}</TableHead>
                                        <TableHead className="text-right">{tc('labels.price')}</TableHead>
                                        <TableHead>{tc('labels.currency')}</TableHead>
                                        <TableHead className="text-right">{tc('labels.total')}</TableHead>
                                        <TableHead className="text-right">{tc('labels.actions')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.map((tx) => (
                                        <TableRow key={tx.id}>
                                            <TableCell>{new Date(tx.transactionDate * 1000).toLocaleDateString()}</TableCell>
                                            <TableCell>
                                                <span className={tx.type === 'buy' ? 'text-positive' : 'text-negative'}>
                                                    {tx.type.toUpperCase()}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">{parseFloat(tx.quantity as any).toFixed(8)}</TableCell>
                                            <TableCell className="text-right">{parseFloat(tx.pricePerUnit as any).toFixed(2)} {tx.currency}</TableCell>
                                            <TableCell>{tx.currency}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(convertToCzK(parseFloat(tx.pricePerUnit as any) * parseFloat(tx.quantity as any), tx.currency as any))}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(tx)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{tc('confirm.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {tc('confirm.deleteDescription')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tc('buttons.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            disabled={deleteMutation.isPending}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleteMutation.isPending ? tc('status.deleting') : tc('buttons.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
