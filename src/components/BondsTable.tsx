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
import { Bond } from "@shared/schema";
import { useCurrency } from "@/lib/currency";
import { convertToCzK, type CurrencyCode } from "@shared/currencies";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

interface BondsTableProps {
  bonds: Bond[];
  onEdit: (bond: Bond) => void;
  onDelete: (bond: Bond) => void;
}

export function BondsTable({ bonds, onEdit, onDelete }: BondsTableProps) {
  const { t } = useTranslation('bonds');
  const { t: tc } = useTranslation('common');
  const { formatCurrency } = useCurrency();

  return (
    <Card className="border">
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-6">{t('table.title')}</h2>

        <div className="rounded-lg border">
          <Table>
            <TableHeader className="[&_th]:bg-muted/50">
              <TableRow>
                <TableHead>{t('table.bondName')}</TableHead>
                <TableHead>{t('table.isin')}</TableHead>
                <TableHead className="text-right">{t('table.couponValue')}</TableHead>
                <TableHead className="text-right">{t('table.interestRate')}</TableHead>
                <TableHead className="text-right">{t('table.maturityDate')}</TableHead>
                <TableHead className="w-[80px] text-right">{tc('labels.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bonds.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-8"
                  >
                    {t('table.noBonds')}
                  </TableCell>
                </TableRow>
              ) : (
                bonds.map((bond) => (
                  <TableRow key={bond.id}>
                    <TableCell className="font-medium">{bond.name}</TableCell>
                    <TableCell>{bond.isin}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(convertToCzK(Number(bond.couponValue), bond.currency as CurrencyCode))}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(bond.interestRate).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {bond.maturityDate ? format(new Date(bond.maturityDate * 1000), "MMM d, yyyy") : "-"}
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
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  );
}
