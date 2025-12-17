import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Loan } from "@shared/schema";
import { format, isAfter } from "date-fns";
import { useCurrency } from "@/lib/currency";
import { convertToCzK, type CurrencyCode } from "@shared/currencies";
import { useTranslation } from "react-i18next";

interface LoansTableProps {
    loans: Loan[];
    onEdit: (loan: Loan) => void;
    onDelete: (loan: Loan) => void;
}

export function LoansTable({ loans, onEdit, onDelete }: LoansTableProps) {
    const { t } = useTranslation('loans');
    const { t: tc } = useTranslation('common');
    const { formatCurrency } = useCurrency();
    const today = new Date();

    return (
        <Card className="border">
            <div className="p-6">
                <h2 className="text-xl font-semibold mb-6">{t('table.title')}</h2>

                <div className="rounded-lg border">
                    <Table>
                        <TableHeader className="[&_th]:bg-muted/50">
                            <TableRow>
                                <TableHead>{tc('labels.name')}</TableHead>
                                <TableHead className="text-right">{t('table.principal')}</TableHead>
                                <TableHead className="text-right">{t('table.interestRate')}</TableHead>
                                <TableHead className="text-right">{t('table.monthlyPayment')}</TableHead>
                                <TableHead className="text-right">{t('table.rateValidity')}</TableHead>
                                <TableHead className="text-right">{t('table.endDate')}</TableHead>
                                <TableHead className="w-[80px] text-right">{tc('labels.actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loans.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={7}
                                        className="text-center text-muted-foreground py-8"
                                    >
                                        {t('table.noLoans')}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                loans.map((loan) => {
                                    const isMatured = loan.endDate ? isAfter(today, new Date(Number(loan.endDate) * 1000)) : false;
                                    return (
                                        <TableRow
                                            key={loan.id}
                                            className={isMatured ? "opacity-50 bg-muted/50" : ""}
                                        >
                                            <TableCell className="font-medium">{loan.name}</TableCell>
                                            <TableCell className="text-right">
                                                {formatCurrency(convertToCzK(Number(loan.principal), loan.currency as CurrencyCode))}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {Number(loan.interestRate).toFixed(2)}%
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {formatCurrency(convertToCzK(Number((loan as any).monthlyPayment || 0), loan.currency as CurrencyCode))}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {(loan as any).interestRateValidityDate
                                                    ? format(new Date((loan as any).interestRateValidityDate * 1000), "MMM d, yyyy")
                                                    : "-"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {loan.endDate
                                                    ? format(new Date((loan.endDate as any) * 1000), "MMM d, yyyy")
                                                    : "-"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => onEdit(loan)}>
                                                            <Pencil className="mr-2 h-4 w-4" />
                                                            {tc('buttons.edit')}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => onDelete(loan)}
                                                            className="text-destructive focus:text-destructive"
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            {tc('buttons.delete')}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </Card>
    );
}
