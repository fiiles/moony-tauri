import {
    Dialog,
    DialogContent,
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
import { Trash } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { OtherAsset, OtherAssetTransaction } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { CURRENCIES } from "@shared/currencies";
import { otherAssetsApi } from "@/lib/tauri-api";
import { useTranslation } from "react-i18next";

function formatCurrency(value: number, currency: string) {
    const c = (CURRENCIES as any)[currency];
    if (!c) return `${value} ${currency}`;
    return new Intl.NumberFormat(c?.locale || 'en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

function formatDate(dateStr: string | Date | number) {
    const date = typeof dateStr === 'number' ? new Date(dateStr * 1000) : new Date(dateStr);
    return date.toLocaleDateString();
}

interface Props {
    asset: OtherAsset;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function OtherAssetTransactionsModal({ asset, open, onOpenChange }: Props) {
    const { t } = useTranslation('otherAssets');
    const { t: tc } = useTranslation('common');
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { data: transactions, isLoading } = useQuery<OtherAssetTransaction[]>({
        queryKey: ["other-asset-transactions", asset.id],
        queryFn: () => otherAssetsApi.getTransactions(asset.id),
        enabled: open,
    });

    const deleteMutation = useMutation({
        mutationFn: (txId: string) => otherAssetsApi.deleteTransaction(txId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["other-asset-transactions", asset.id] });
            queryClient.invalidateQueries({ queryKey: ["other-assets"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-history"] });
            toast({ title: t('toast.deleted') });
        },
        onError: () => toast({ title: tc('status.error'), variant: "destructive" })
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{t('modal.transactions.title')} - {asset.name}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{tc('labels.date')}</TableHead>
                                    <TableHead>{tc('labels.type')}</TableHead>
                                    <TableHead>{tc('labels.quantity')}</TableHead>
                                    <TableHead>{tc('labels.price')}</TableHead>
                                    <TableHead>{tc('labels.total')}</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6}>{tc('status.loading')}</TableCell></TableRow>
                                ) : transactions?.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t('modal.transactions.noTransactions')}</TableCell></TableRow>
                                ) : (
                                    transactions?.map(tx => (
                                        <TableRow key={tx.id}>
                                            <TableCell>{formatDate(tx.transactionDate)}</TableCell>
                                            <TableCell className={tx.type === 'buy' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                                {tx.type.toUpperCase()}
                                            </TableCell>
                                            <TableCell>{tx.quantity}</TableCell>
                                            <TableCell>{formatCurrency(parseFloat(tx.pricePerUnit), tx.currency)}</TableCell>
                                            <TableCell>{formatCurrency(parseFloat(tx.quantity) * parseFloat(tx.pricePerUnit), tx.currency)}</TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(tx.id)}>
                                                    <Trash className="h-4 w-4 text-muted-foreground hover:text-red-600" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
