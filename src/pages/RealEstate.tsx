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
import { realEstateApi, exportApi } from "@/lib/tauri-api";
import type { RealEstate } from "@shared/schema";
import { SummaryCard } from "@/components/common/SummaryCard";

import { useCurrency } from "@/lib/currency";
import { convertToCzK, convertFromCzK, type CurrencyCode } from "@shared/currencies";
import { useTranslation } from "react-i18next";
import { ExportButton } from "@/components/common/ExportButton";

export default function RealEstatePage() {
  const { t } = useTranslation('realEstate');
  const [, setLocation] = useLocation();
  const { formatCurrency, formatCurrencyRaw, currencyCode: userCurrency } = useCurrency();

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
    const currency = re.marketPriceCurrency || "CZK";
    const inCzk = convertToCzK(marketPrice, currency as CurrencyCode);
    const converted = convertFromCzK(inCzk, userCurrency as CurrencyCode);
    return sum + converted;
  }, 0) || 0;

  const totalPurchasePrice = realEstates?.reduce((sum, re) => {
    const purchasePrice = Number(re.purchasePrice);
    const currency = re.purchasePriceCurrency || "CZK";
    const inCzk = convertToCzK(purchasePrice, currency as CurrencyCode);
    const converted = convertFromCzK(inCzk, userCurrency as CurrencyCode);
    return sum + converted;
  }, 0) || 0;

  const totalProperties = realEstates?.length || 0;

  // Calculate gross monthly rental income (sum of all monthly rents)
  const totalMonthlyRent = realEstates?.reduce((sum, re) => {
      const monthlyRent = re.monthlyRent ? Number(re.monthlyRent) : 0;
      const rentCurrency = re.monthlyRentCurrency || "CZK";
      const rentInCzk = convertToCzK(monthlyRent, rentCurrency as CurrencyCode);
      const converted = convertFromCzK(rentInCzk, userCurrency as CurrencyCode);
      return sum + converted;
    }, 0) || 0;

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t('title')}</h1>
          <p className="page-subtitle">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <ExportButton exportFn={exportApi.realEstate} />
          <AddRealEstateModal />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title={t('summary.totalValue')}
          value={formatCurrencyRaw(totalMarketValue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          icon={<TrendingUp className="h-4 w-4" />}
          subtitle={`${t('table.purchasePrice')}: ${formatCurrencyRaw(totalPurchasePrice, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
        />
        <SummaryCard
          title={t('summary.propertyCount')}
          value={totalProperties}
          icon={<Building2 className="h-4 w-4" />}
        />
        <SummaryCard
          title={t('summary.rentalIncome')}
          value={formatCurrencyRaw(totalMonthlyRent, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          icon={<Home className="h-4 w-4" />}
          subtitle={t('summary.grossRentalIncome')}
        />
      </div>

      <Card className="border shadow-sm card-hover">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold mb-6">{t('table.title')}</h2>
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
                    <TableCell className="capitalize">{t(`types.${re.type}`)}</TableCell>
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
