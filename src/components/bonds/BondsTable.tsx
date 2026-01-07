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
import { Bond } from "@shared/schema";
import { useCurrency } from "@/lib/currency";
import { convertToCzK, type CurrencyCode } from "@shared/currencies";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/I18nProvider";

interface BondsTableProps {
  bonds: Bond[];
  onEdit: (bond: Bond) => void;
  onDelete: (bond: Bond) => void;
}

export function BondsTable({ bonds, onEdit, onDelete }: BondsTableProps) {
  const { t } = useTranslation('bonds');
  const { t: tc } = useTranslation('common');
  const { formatCurrency } = useCurrency();
  const { formatDate } = useLanguage();

  // Sorting state
  type SortColumn = 'name' | 'isin' | 'couponValue' | 'quantity' | 'totalValue' | 'interestRate' | 'maturityDate';
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

  const sortedBonds = useMemo(() => {
    return [...bonds].sort((a, b) => {
      let comparison = 0;
      const quantityA = Number(a.quantity || "1");
      const quantityB = Number(b.quantity || "1");
      const couponValueA = Number(a.couponValue);
      const couponValueB = Number(b.couponValue);

      switch (sortColumn) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'isin':
          comparison = (a.isin || '').localeCompare(b.isin || '');
          break;
        case 'couponValue':
          comparison = couponValueA - couponValueB;
          break;
        case 'quantity':
          comparison = quantityA - quantityB;
          break;
        case 'totalValue':
          comparison = (couponValueA * quantityA) - (couponValueB * quantityB);
          break;
        case 'interestRate':
          comparison = Number(a.interestRate) - Number(b.interestRate);
          break;
        case 'maturityDate':
          comparison = Number(a.maturityDate || 0) - Number(b.maturityDate || 0);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [bonds, sortColumn, sortDirection]);

  return (
    <Card className="border">
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-6">{t('table.title')}</h2>

        <div className="rounded-lg border">
          <Table>
            <TableHeader className="[&_th]:bg-muted/50">
              <TableRow>
                <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('name')}>
                  <span className="flex items-center">{t('table.bondName')}<SortIcon column="name" /></span>
                </TableHead>
                <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('isin')}>
                  <span className="flex items-center">{t('table.isin')}<SortIcon column="isin" /></span>
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('couponValue')}>
                  <span className="flex items-center justify-end">{t('table.couponValue')}<SortIcon column="couponValue" /></span>
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('quantity')}>
                  <span className="flex items-center justify-end">{t('table.quantity')}<SortIcon column="quantity" /></span>
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('totalValue')}>
                  <span className="flex items-center justify-end">{t('table.totalValue')}<SortIcon column="totalValue" /></span>
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('interestRate')}>
                  <span className="flex items-center justify-end">{t('table.interestRate')}<SortIcon column="interestRate" /></span>
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('maturityDate')}>
                  <span className="flex items-center justify-end">{t('table.maturityDate')}<SortIcon column="maturityDate" /></span>
                </TableHead>
                <TableHead className="w-[80px] text-right">{tc('labels.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedBonds.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground py-8"
                  >
                    {t('table.noBonds')}
                  </TableCell>
                </TableRow>
              ) : (
                sortedBonds.map((bond) => {
                  const quantity = Number(bond.quantity || "1");
                  const couponValue = Number(bond.couponValue);
                  const totalValue = couponValue * quantity;
                  return (
                  <TableRow key={bond.id}>
                    <TableCell className="font-medium">{bond.name}</TableCell>
                    <TableCell>{bond.isin}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(convertToCzK(couponValue, bond.currency as CurrencyCode))}
                    </TableCell>
                    <TableCell className="text-right">
                      {quantity}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(convertToCzK(totalValue, bond.currency as CurrencyCode))}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(bond.interestRate).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {bond.maturityDate ? formatDate(new Date(bond.maturityDate * 1000)) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(bond)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {tc('buttons.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDelete(bond)}
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
