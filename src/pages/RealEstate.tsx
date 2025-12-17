import { useQuery } from "@tanstack/react-query";
import { AddRealEstateModal } from "@/components/real-estate/AddRealEstateModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eye, Building2, Home, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { realEstateApi } from "@/lib/tauri-api";
import type { RealEstate } from "@shared/schema";
import { SummaryCard } from "@/components/SummaryCard";

import { useCurrency } from "@/lib/currency";
import { convertToCzK, convertFromCzK, type CurrencyCode } from "@shared/currencies";
import { useTranslation } from "react-i18next";

export default function RealEstatePage() {
  const { t } = useTranslation('realEstate');
  const [, setLocation] = useLocation();
  const { formatCurrency, currencyCode: userCurrency } = useCurrency();

  const { data: realEstates, isLoading } = useQuery<RealEstate[]>({
    queryKey: ["real-estate"],
    queryFn: () => realEstateApi.getAll(),
  });

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="page-title">{t('title')}</h1>
          <p className="page-subtitle">{t('loading')}</p>
        </div>
      </div>
    );
  }

  const totalMarketValue = realEstates?.reduce((sum, re) => {
    const marketPrice = Number(re.marketPrice);
    const currency = (re as any).marketPriceCurrency || "CZK";
    const inCzk = convertToCzK(marketPrice, currency as CurrencyCode);
    const converted = convertFromCzK(inCzk, userCurrency as CurrencyCode);
    return sum + converted;
  }, 0) || 0;

  const totalPurchasePrice = realEstates?.reduce((sum, re) => {
    const purchasePrice = Number(re.purchasePrice);
    const currency = (re as any).purchasePriceCurrency || "CZK";
    const inCzk = convertToCzK(purchasePrice, currency as CurrencyCode);
    const converted = convertFromCzK(inCzk, userCurrency as CurrencyCode);
    return sum + converted;
  }, 0) || 0;

  const totalProperties = realEstates?.length || 0;

  // Calculate net cashflow for investment properties only
  const investmentCashflow = realEstates
    ?.filter(re => re.type === 'investment')
    .reduce((sum, re) => {
      const monthlyRent = re.monthlyRent ? Number(re.monthlyRent) : 0;
      const rentCurrency = (re as any).monthlyRentCurrency || "CZK";
      const yearlyRentInCzk = convertToCzK(monthlyRent * 12, rentCurrency as CurrencyCode);
      const yearlyRent = convertFromCzK(yearlyRentInCzk, userCurrency as CurrencyCode);

      const yearlyRecurringCosts = (re.recurringCosts as any[])?.reduce((costSum, cost) => {
        let yearlyAmount = Number(cost.amount);
        if (cost.frequency === 'monthly') yearlyAmount *= 12;
        if (cost.frequency === 'quarterly') yearlyAmount *= 4;
        const costCurrency = cost.currency || "CZK";
        const costInCzk = convertToCzK(yearlyAmount, costCurrency as CurrencyCode);
        const convertedCost = convertFromCzK(costInCzk, userCurrency as CurrencyCode);
        return costSum + convertedCost;
      }, 0) || 0;

      // Note: We're not including loan payments here since we'd need to fetch linked loans
      // This is a simplified calculation
      return sum + (yearlyRent - yearlyRecurringCosts);
    }, 0) || 0;

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t('title')}</h1>
          <p className="page-subtitle">{t('subtitle')}</p>
        </div>
        <AddRealEstateModal />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title={t('summary.totalValue')}
          value={formatCurrency(totalMarketValue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          icon={<TrendingUp className="h-4 w-4" />}
          subtitle={`${t('table.purchasePrice')}: ${formatCurrency(totalPurchasePrice, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
        />
        <SummaryCard
          title={t('summary.propertyCount')}
          value={totalProperties}
          icon={<Building2 className="h-4 w-4" />}
        />
        <SummaryCard
          title={t('summary.rentalIncome')}
          value={formatCurrency(investmentCashflow, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          icon={<Home className="h-4 w-4" />}
          valueClassName={investmentCashflow >= 0 ? 'text-green-600' : 'text-red-600'}
          subtitle={t('detail.netIncome')}
        />
      </div>

      <Card className="border shadow-sm card-hover">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold tracking-tight">{t('table.title')}</h2>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader className="[&_th]:bg-muted/50">
                <TableRow>
                  <TableHead className="text-xs font-medium uppercase text-muted-foreground">{t('table.name')}</TableHead>
                  <TableHead className="text-xs font-medium uppercase text-muted-foreground">{t('table.address')}</TableHead>
                  <TableHead className="text-xs font-medium uppercase text-muted-foreground">{t('table.type')}</TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase text-muted-foreground">{t('table.purchasePrice')}</TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase text-muted-foreground">{t('table.value')}</TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase text-muted-foreground">{t('table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {realEstates?.map((re) => (
                  <TableRow
                    key={re.id}
                    className="cursor-pointer row-interactive"
                    onClick={() => setLocation(`/real-estate/${re.id}`)}
                  >
                    <TableCell className="font-medium">{re.name}</TableCell>
                    <TableCell>{re.address}</TableCell>
                    <TableCell className="capitalize">{re.type}</TableCell>
                    <TableCell className="text-right data-value">
                      {formatCurrency(convertToCzK(Number(re.purchasePrice), re.purchasePriceCurrency as CurrencyCode))}
                    </TableCell>
                    <TableCell className="text-right data-value">
                      {formatCurrency(convertToCzK(Number(re.marketPrice), re.marketPriceCurrency as CurrencyCode))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/real-estate/${re.id}`);
                      }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!realEstates || realEstates.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      {t('table.noProperties')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>
    </div>
  );
}
