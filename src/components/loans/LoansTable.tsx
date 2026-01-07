import { useState, useMemo } from "react";
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
import { MoreVertical, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Loan } from "@shared/schema";
import { isAfter } from "date-fns";
import { useCurrency } from "@/lib/currency";
import { convertToCzK, type CurrencyCode } from "@shared/currencies";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/I18nProvider";

interface LoansTableProps {
    loans: Loan[];
    onEdit: (loan: Loan) => void;
    onDelete: (loan: Loan) => void;
}

export function LoansTable({ loans, onEdit, onDelete }: LoansTableProps) {
    const { t } = useTranslation('loans');
    const { t: tc } = useTranslation('common');
    const { formatCurrency } = useCurrency();
    const { formatDate } = useLanguage();
    const today = new Date();

    // Sorting state
    type SortColumn = 'name' | 'principal' | 'interestRate' | 'monthlyPayment' | 'rateValidity' | 'endDate';
    const [sortColumn, setSortColumn] = useState<SortColumn>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const handleSort = (column: SortColumn) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const SortIcon = ({ column }: { column: SortColumn }) => {
        if (sortColumn !== column) {
            return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
        }
        return sortDirection === 'asc'
            ? <ArrowUp className="h-3 w-3 ml-1" />
            : <ArrowDown className="h-3 w-3 ml-1" />;
    };

    const sortedLoans = useMemo(() => {
        return [...loans].sort((a, b) => {
            let comparison = 0;
            switch (sortColumn) {
                case 'name':
                    comparison = (a.name || '').localeCompare(b.name || '');
                    break;
                case 'principal':
                    comparison = Number(a.principal) - Number(b.principal);
                    break;
                case 'interestRate':
                    comparison = Number(a.interestRate) - Number(b.interestRate);
                    break;
                case 'monthlyPayment':
                    comparison = Number((a as any).monthlyPayment || 0) - Number((b as any).monthlyPayment || 0);
                    break;
                case 'rateValidity':
                    comparison = Number((a as any).interestRateValidityDate || 0) - Number((b as any).interestRateValidityDate || 0);
                    break;
                case 'endDate':
                    comparison = Number(a.endDate || 0) - Number(b.endDate || 0);
                    break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [loans, sortColumn, sortDirection]);


    return (
        <Card className="border">
            <div className="p-6">
                <h2 className="text-xl font-semibold mb-6">{t('table.title')}</h2>

                <div className="rounded-lg border">
                    <Table>
                        <TableHeader className="[&_th]:bg-muted/50">
                            <TableRow>
                                <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('name')}>
                                    <span className="flex items-center">{tc('labels.name')}<SortIcon column="name" /></span>
                                </TableHead>
                                <TableHead className="text-right cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('principal')}>
                                    <span className="flex items-center justify-end">{t('table.principal')}<SortIcon column="principal" /></span>
                                </TableHead>
                                <TableHead className="text-right cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('interestRate')}>
                                    <span className="flex items-center justify-end">{t('table.interestRate')}<SortIcon column="interestRate" /></span>
                                </TableHead>
                                <TableHead className="text-right cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('monthlyPayment')}>
                                    <span className="flex items-center justify-end">{t('table.monthlyPayment')}<SortIcon column="monthlyPayment" /></span>
                                </TableHead>
                                <TableHead className="text-right cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('rateValidity')}>
                                    <span className="flex items-center justify-end">{t('table.rateValidity')}<SortIcon column="rateValidity" /></span>
                                </TableHead>
                                <TableHead className="text-right cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('endDate')}>
                                    <span className="flex items-center justify-end">{t('table.endDate')}<SortIcon column="endDate" /></span>
                                </TableHead>
                                <TableHead className="w-[80px] text-right">{tc('labels.actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedLoans.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={7}
                                        className="text-center text-muted-foreground py-8"
                                    >
                                        {t('table.noLoans')}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedLoans.map((loan) => {
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
                                                    ? formatDate(new Date((loan as any).interestRateValidityDate * 1000))
                                                    : "—"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {loan.endDate
                                                    ? formatDate(new Date((loan.endDate as any) * 1000))
                                                    : "—"}
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
