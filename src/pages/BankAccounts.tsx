import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Landmark, TrendingUp, Percent, Eye, Check } from "lucide-react";
import { useBankAccounts, useInstitutions } from "@/hooks/use-bank-accounts";
import { useBankAccountMutations } from "@/hooks/use-bank-account-mutations";
import { Card, CardContent } from "@/components/ui/card";
import { SummaryCard } from "@/components/common/SummaryCard";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BankAccountFormDialog } from "@/components/bank-accounts/BankAccountFormDialog";
import { ZonesInfoModal, useZonedEffectiveRate } from "@/components/bank-accounts/ZonesInfoModal";
import type { InsertBankAccount, BankAccountWithInstitution } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/lib/currency";
import { convertToCzK, type CurrencyCode } from "@shared/currencies";

export default function BankAccounts() {
  const { t } = useTranslation("bank_accounts");
  const { t: tCommon } = useTranslation("common");
  const [, setLocation] = useLocation();
  const { accounts, metrics, isLoading } = useBankAccounts();
  const { institutions } = useInstitutions();
  const { createAccount } = useBankAccountMutations();
  const { formatCurrencyRaw, formatCurrency } = useCurrency();
  const queryClient = useQueryClient();

  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const handleViewDetail = (id: string) => {
    setLocation(`/bank-accounts/${id}`);
  };

  // Helper component for effective rate display
  const EffectiveRateCell = ({ item }: { item: BankAccountWithInstitution }) => {
    const balance = parseFloat(item.balance);
    const { effectiveRate } = useZonedEffectiveRate(item.id, balance, item.hasZoneDesignation || false);
    
    return (
      <span>
        {effectiveRate.toFixed(2)}%
        <span className="text-xs text-muted-foreground ml-1">
          ({t("zones.effective", "effective")})
        </span>
      </span>
    );
  };



  if (isLoading) {
    return (
      <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="page-title">{t("title")}</h1>
          <p className="page-subtitle">{tCommon("status.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t("title")}</h1>
          <p className="page-subtitle">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setAddDialogOpen(true)} className="transition-all duration-200">
            <Plus className="mr-2 h-4 w-4" />
            {t("addAccount")}
          </Button>
        </div>
      </div>

      {/* Metrics Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          title={t("metrics.totalBalance")}
          value={formatCurrencyRaw(metrics.totalBalance)}
          icon={<Landmark className="h-4 w-4" />}
        />
        <SummaryCard
          title={t("metrics.averageInterestRate")}
          value={`${metrics.averageInterestRate.toFixed(2)}%`}
          icon={<Percent className="h-4 w-4" />}
          subtitle={t("metrics.weightedAverage")}
          valueClassName="text-positive"
        />
        <SummaryCard
          title={t("metrics.expectedYearlyInterest")}
          value={formatCurrencyRaw(metrics.expectedYearlyInterest)}
          icon={<TrendingUp className="h-4 w-4" />}
          valueClassName="text-positive"
        />
      </div>

      {/* Accounts Table */}
      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Landmark className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">{t("empty.title")}</h3>
            <p className="text-muted-foreground text-center max-w-sm mt-2">
              {t("empty.description")}
            </p>
            <Button onClick={() => setAddDialogOpen(true)} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              {t("addAccount")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-6">{t("table.title")}</h2>
            <div className="rounded-lg border">
              <Table>
                <TableHeader className="[&_th]:bg-muted/50">
                  <TableRow>
                    <TableHead>{t("fields.name")}</TableHead>
                    <TableHead>{t("fields.accountType")}</TableHead>
                    <TableHead>{t("fields.institution")}</TableHead>
                    <TableHead className="text-right">{t("fields.balance")}</TableHead>
                    <TableHead className="text-right">{t("fields.interestRate")}</TableHead>
                    <TableHead className="text-center">{t("fields.interestType")}</TableHead>
                    <TableHead className="text-right w-[80px]">{tCommon("labels.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((item) => {
                    const interestRate = item.interestRate ? parseFloat(item.interestRate) : 0;
                    const hasZoneDesignation = item.hasZoneDesignation || false;
                    
                    return (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer row-interactive"
                        onClick={() => handleViewDetail(item.id)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {item.name}
                            {item.excludeFromBalance && (
                              <Badge variant="outline" className="text-xs">
                                {t("fields.excludeFromBalance")}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {t(`accountTypes.${item.accountType}`)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.institution?.name || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(convertToCzK(parseFloat(item.balance), (item.currency || "CZK") as CurrencyCode))}
                        </TableCell>
                        <TableCell className="text-right text-positive">
                          {hasZoneDesignation ? (
                            <EffectiveRateCell item={item} />
                          ) : interestRate > 0 ? (
                            `${interestRate.toFixed(2)}%`
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {hasZoneDesignation ? (
                            <div className="flex items-center justify-center gap-1">
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                                <Check className="h-3 w-3 mr-1" />
                                {t("interestType.zoned")}
                              </Badge>
                              <ZonesInfoModal
                                accountId={item.id}
                                accountName={item.name}
                                balance={parseFloat(item.balance)}
                                currency={item.currency || "CZK"}
                              />
                            </div>
                          ) : interestRate > 0 ? (
                            <Badge variant="outline" className="text-muted-foreground">
                              {t("interestType.simple")}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetail(item.id);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>
      )}

      {/* Add Account Dialog */}
      <BankAccountFormDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={(data) => {
          createAccount.mutate(data as InsertBankAccount, {
            onSuccess: () => {
              setAddDialogOpen(false);
              // Ensure portfolio metrics are recalculated
              queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            },
          });
        }}
        institutions={institutions}
        isLoading={createAccount.isPending}
      />
    </div>
  );
}
