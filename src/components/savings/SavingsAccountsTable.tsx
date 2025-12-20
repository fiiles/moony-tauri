import { useState } from "react";
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
import { MoreVertical, Pencil, Trash2, Check, Info } from "lucide-react";
import type { SavingsAccount } from "@shared/schema";
import { useCurrency } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { SavingsAccountZonesModal } from "./SavingsAccountZonesModal";
import { convertToCzK } from "@shared/currencies";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/I18nProvider";

interface SavingsAccountsTableProps {
  accounts: SavingsAccount[];
  onEdit: (account: SavingsAccount) => void;
  onDelete: (account: SavingsAccount) => void;
}

export function SavingsAccountsTable({
  accounts,
  onEdit,
  onDelete,
}: SavingsAccountsTableProps) {
  const { t } = useTranslation('savings');
  const { t: tc } = useTranslation('common');
  const { formatCurrency } = useCurrency();
  const { formatDate } = useLanguage();
  const [selectedAccountForZones, setSelectedAccountForZones] = useState<SavingsAccount | null>(null);

  return (
    <Card className="border">
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-6">{t('table.title')}</h2>

        <div className="rounded-lg border">
          <Table>
            <TableHeader className="[&_th]:bg-muted/50">
              <TableRow>
                <TableHead>{t('table.accountName')}</TableHead>
                <TableHead className="text-right">{t('table.balance')}</TableHead>
                <TableHead className="text-right">{t('table.interestRate')}</TableHead>
                <TableHead className="text-center">{t('table.interestType')}</TableHead>
                <TableHead className="text-right">{t('table.terminationDate')}</TableHead>
                <TableHead className="text-right w-[80px]">{tc('labels.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-8"
                  >
                    {t('table.noAccounts')}
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => {
                  const accountCurrency = (account as any).currency || "CZK";
                  const balanceInUserCurrency = convertToCzK(parseFloat(account.balance), accountCurrency as any);

                  return (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.name}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(balanceInUserCurrency)}
                      </TableCell>
                      <TableCell className="text-right text-positive">
                        {account.effectiveInterestRate !== undefined
                          ? `${account.effectiveInterestRate.toFixed(2)}%`
                          : `${parseFloat(account.interestRate).toFixed(2)}%`}
                        {account.hasZoneDesignation && (
                          <span className="text-xs text-muted-foreground ml-1">({t('table.effective')})</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {account.hasZoneDesignation ? (
                          <div className="flex items-center justify-center gap-1">
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                              <Check className="h-3 w-3 mr-1" />
                              {t('table.zoned')}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setSelectedAccountForZones(account)}
                            >
                              <Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            {t('table.simple')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {account.terminationDate
                          ? formatDate(new Date(account.terminationDate * 1000))
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(account)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              {tc('buttons.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onDelete(account)}
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

      <SavingsAccountZonesModal
        open={!!selectedAccountForZones}
        onOpenChange={(open) => !open && setSelectedAccountForZones(null)}
        accountId={selectedAccountForZones?.id || ""}
        accountName={selectedAccountForZones?.name || ""}
      />
    </Card>
  );
}

