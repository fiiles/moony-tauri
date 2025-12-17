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
import { Pencil, Trash2 } from "lucide-react";
import type { InvestmentTransaction } from "@shared/schema";
import type { HoldingData } from "@/utils/investments";
import { EditTransactionModal } from "./EditTransactionModal";
import { useCurrency } from "@/lib/currency";
import { convertToCzK } from "@shared/currencies";
import { investmentsApi } from "@/lib/tauri-api";
import { useTranslation } from "react-i18next";

interface ViewTransactionsModalProps {
    investment: HoldingData | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ViewTransactionsModal({ investment, open, onOpenChange }: ViewTransactionsModalProps) {
    const { t } = useTranslation('investments');
    const { t: tc } = useTranslation('common');
    const queryClient = useQueryClient();
    const { formatCurrency } = useCurrency();
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<InvestmentTransaction | null>(null);

    const { data: transactions, isLoading } = useQuery<InvestmentTransaction[]>({
        queryKey: ["transactions", investment?.id],
        queryFn: () => investment ? investmentsApi.getTransactions(investment.id) : Promise.resolve([]),
        enabled: !!investment && open,
    });

    const deleteMutation = useMutation({
        mutationFn: (txId: string) => investmentsApi.deleteTransaction(txId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["investments"] });
            queryClient.invalidateQueries({ queryKey: ["transactions", investment?.id] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            setDeleteDialogOpen(false);
            setSelectedTransaction(null);
        },
    });

    const handleEdit = (transaction: InvestmentTransaction) => {
        setSelectedTransaction(transaction);
        setEditModalOpen(true);
    };

    const handleDelete = (transaction: InvestmentTransaction) => {
        setSelectedTransaction(transaction);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = () => {
        if (!selectedTransaction) return;
        deleteMutation.mutate(selectedTransaction.id);
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
                                            <TableCell className="text-right">{parseFloat(tx.quantity as any).toFixed(4)}</TableCell>
                                            <TableCell className="text-right">{parseFloat(tx.pricePerUnit as any).toFixed(2)} {tx.currency}</TableCell>
                                            <TableCell>{tx.currency}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(convertToCzK(parseFloat(tx.pricePerUnit as any) * parseFloat(tx.quantity as any), tx.currency as any))}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleEdit(tx)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
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

            <EditTransactionModal
                transaction={selectedTransaction}
                investmentId={investment.id}
                open={editModalOpen}
                onOpenChange={setEditModalOpen}
            />

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
