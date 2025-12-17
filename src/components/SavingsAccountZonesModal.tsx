import { useQuery } from "@tanstack/react-query";
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
import { useCurrency } from "@/lib/currency";
import { savingsApi } from "@/lib/tauri-api";
import type { SavingsAccountZone } from "@shared/schema";

interface SavingsAccountZonesModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    accountId: string;
    accountName: string;
}

export function SavingsAccountZonesModal({
    open,
    onOpenChange,
    accountId,
    accountName,
}: SavingsAccountZonesModalProps) {
    const { formatCurrency } = useCurrency();

    const { data: zones = [], isLoading, isError, error } = useQuery<SavingsAccountZone[]>({
        queryKey: ["savings-zones", accountId],
        queryFn: () => savingsApi.getZones(accountId),
        enabled: open && !!accountId,
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Interest Rate Zones</DialogTitle>
                    <DialogDescription>
                        Zone-based interest rates for {accountName}
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="py-8 text-center text-muted-foreground">
                        Loading zones...
                    </div>
                ) : isError ? (
                    <div className="py-8 text-center text-destructive">
                        <p>Failed to load zones.</p>
                        <p className="text-sm text-muted-foreground mt-1">{(error as Error)?.message}</p>
                    </div>
                ) : zones.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                        No zones configured for this account.
                    </div>
                ) : (
                    <div className="rounded-lg border">
                        <Table>
                            <TableHeader className="[&_th]:bg-muted/50">
                                <TableRow>
                                    <TableHead>From Amount</TableHead>
                                    <TableHead>To Amount</TableHead>
                                    <TableHead className="text-right">Interest Rate (APY)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {zones.map((zone) => (
                                    <TableRow key={zone.id}>
                                        <TableCell className="font-medium">
                                            {formatCurrency(parseFloat(zone.fromAmount))}
                                        </TableCell>
                                        <TableCell>
                                            {zone.toAmount
                                                ? formatCurrency(parseFloat(zone.toAmount))
                                                : "Unlimited"}
                                        </TableCell>
                                        <TableCell className="text-right text-positive">
                                            {parseFloat(zone.interestRate).toFixed(2)}%
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
