import StatCard from "@/components/common/StatCard";
import TimePeriodSelector, { type Period } from "@/components/cashflow/TimePeriodSelector";
import NetWorthTrendChart from "@/components/dashboard/NetWorthTrendChart";
import AssetsLiabilitiesChart from "@/components/dashboard/AssetsLiabilitiesChart";
import AssetAllocationDonut from "@/components/dashboard/AssetAllocationDonut";
import { useAuth } from "@/hooks/use-auth";
import { subDays, startOfYear } from "date-fns";
import { TrendingUp, Wallet, CreditCard } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { portfolioApi } from "@/lib/tauri-api";
import type { PortfolioMetricsHistory } from "@shared/schema";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/I18nProvider";

export default function Dashboard() {
  const { t } = useTranslation('dashboard');
  const { user } = useAuth();
  const { formatDate } = useLanguage();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('30D');

  // Calculate date range based on selected period
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (selectedPeriod) {
      case '7D':
        return { start: subDays(now, 7), end: now };
      case '30D':
        return { start: subDays(now, 30), end: now };
      case '90D':
        return { start: subDays(now, 90), end: now };
      case 'YTD':
        return { start: startOfYear(now), end: now };
      case 'All':
        return { start: undefined, end: now };
      default:
        return { start: subDays(now, 30), end: now };
    }
  }, [selectedPeriod]);

  // Fetch portfolio history using Tauri API
  const { data: portfolioHistory } = useQuery<PortfolioMetricsHistory[]>({
    queryKey: ["portfolio-history", dateRange.start?.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const startDate = dateRange.start ? Math.floor(dateRange.start.getTime() / 1000) : undefined;
      const endDate = Math.floor(dateRange.end.getTime() / 1000);
      return portfolioApi.getHistory(startDate, endDate);
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Fetch portfolio metrics using Tauri API
  const { data: portfolioMetrics } = useQuery({
    queryKey: ["portfolio-metrics"],
    queryFn: async () => {
      return portfolioApi.getMetrics(user?.excludePersonalRealEstate || false);
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });


  // Use metrics from API (with fallbacks for loading state)
  const totalSavings = portfolioMetrics?.totalSavings || 0;
  const totalInvestments = portfolioMetrics?.totalInvestments || 0;
  const totalBonds = portfolioMetrics?.totalBonds || 0;
  const totalRealEstate = portfolioMetrics?.totalRealEstate || 0;
  const totalCrypto = portfolioMetrics?.totalCrypto || 0;
  const totalOtherAssets = portfolioMetrics?.totalOtherAssets || 0;
  const totalAssets = portfolioMetrics?.totalAssets || 0; // Backend is updated to include all
  const totalLiabilities = portfolioMetrics?.totalLiabilities || 0;
  const netWorth = portfolioMetrics?.netWorth || 0;

  // Calculate changes from historical data
  // History is returned in descending order (Newest -> Oldest)
  const oldestSnapshot = portfolioHistory?.[portfolioHistory.length - 1];

  const netWorthChange = useMemo(() => {
    if (!oldestSnapshot) return 0;

    // Calculate oldest snapshot's net worth
    const oldAssets = Number(oldestSnapshot.totalSavings) + Number(oldestSnapshot.totalInvestments) +
      Number(oldestSnapshot.totalBonds) +
      (user?.excludePersonalRealEstate ? 0 : Number(oldestSnapshot.totalRealEstatePersonal)) +
      Number(oldestSnapshot.totalRealEstateInvestment) +
      Number(oldestSnapshot.totalCrypto || 0) +
      Number(oldestSnapshot.totalOtherAssets || 0);
    const oldLiabilities = Number(oldestSnapshot.totalLoansPrincipal);
    const oldNetWorth = oldAssets - oldLiabilities;

    // Compare with current net worth
    if (oldNetWorth === 0) return 0;
    const change = ((netWorth - oldNetWorth) / Math.abs(oldNetWorth)) * 100;
    return change;
  }, [oldestSnapshot, netWorth, user?.excludePersonalRealEstate]);

  const assetsChange = useMemo(() => {
    if (!oldestSnapshot) return 0;

    const oldAssets = Number(oldestSnapshot.totalSavings) + Number(oldestSnapshot.totalInvestments) +
      Number(oldestSnapshot.totalBonds) +
      (user?.excludePersonalRealEstate ? 0 : Number(oldestSnapshot.totalRealEstatePersonal)) +
      Number(oldestSnapshot.totalRealEstateInvestment) +
      Number(oldestSnapshot.totalCrypto || 0) +
      Number(oldestSnapshot.totalOtherAssets || 0);

    if (oldAssets === 0) return 0;
    const change = ((totalAssets - oldAssets) / Math.abs(oldAssets)) * 100;
    return change;
  }, [oldestSnapshot, totalAssets, user?.excludePersonalRealEstate]);

  const liabilitiesChange = useMemo(() => {
    if (!oldestSnapshot) return 0;

    const oldLiabilities = Number(oldestSnapshot.totalLoansPrincipal);
    if (oldLiabilities === 0) return 0;
    const change = ((totalLiabilities - oldLiabilities) / Math.abs(oldLiabilities)) * 100;
    return change;
  }, [oldestSnapshot, totalLiabilities]);

  // Distinct colors for asset allocation chart (high contrast palette)
  const allocationColors = {
    investments: '#8B5CF6', // Violet
    savings: '#10B981',     // Emerald/Green
    bonds: '#F59E0B',       // Amber/Orange
    realEstate: '#3B82F6',  // Blue
    crypto: '#EC4899',      // Pink
    otherAssets: '#6366F1', // Indigo
  };

  const allocationData = [
    { name: t('cards.investments'), value: totalInvestments, percentage: totalAssets ? Math.round((totalInvestments / totalAssets) * 100) : 0, color: allocationColors.investments },
    { name: t('cards.savings'), value: totalSavings, percentage: totalAssets ? Math.round((totalSavings / totalAssets) * 100) : 0, color: allocationColors.savings },
    { name: t('cards.bonds'), value: totalBonds, percentage: totalAssets ? Math.round((totalBonds / totalAssets) * 100) : 0, color: allocationColors.bonds },
    { name: t('cards.realEstate'), value: totalRealEstate, percentage: totalAssets ? Math.round((totalRealEstate / totalAssets) * 100) : 0, color: allocationColors.realEstate },
    { name: t('cards.crypto'), value: totalCrypto, percentage: totalAssets ? Math.round((totalCrypto / totalAssets) * 100) : 0, color: allocationColors.crypto },
    { name: t('cards.otherAssets'), value: totalOtherAssets, percentage: totalAssets ? Math.round((totalOtherAssets / totalAssets) * 100) : 0, color: allocationColors.otherAssets },
  ].filter(item => item.value > 0); // Only show assets with value


  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="page-title">{t('welcome', { name: user?.name })}</h1>
          <p className="page-subtitle">{t('overview')}</p>
        </div>
        <TimePeriodSelector value={selectedPeriod} onChange={setSelectedPeriod} />
      </div>

      {/* Net Worth Trend - Full Width */}
      <NetWorthTrendChart
        data={(() => {
          // Reverse history to get chronological order (Oldest -> Newest)
          // portfolioHistory is DESC (Newest -> Oldest)
          const historyData = [...(portfolioHistory || [])].reverse().map(h => {
            const assets = Number(h.totalSavings) + Number(h.totalInvestments) + Number(h.totalBonds) +
              (user?.excludePersonalRealEstate ? 0 : Number(h.totalRealEstatePersonal)) +
              Number(h.totalRealEstateInvestment) +
              Number(h.totalCrypto || 0) +
              Number(h.totalOtherAssets || 0);
            const liabilities = Number(h.totalLoansPrincipal);
            return {
              date: formatDate(new Date(h.recordedAt * 1000), { month: 'short', day: 'numeric' }),
              value: assets - liabilities
            };
          });

          // Append or update with current live net worth
          // This ensures the chart ends with the exact value shown in the summary
          const todayStr = formatDate(new Date(), { month: 'short', day: 'numeric' });
          const lastPoint = historyData[historyData.length - 1];

          if (lastPoint && lastPoint.date === todayStr) {
            lastPoint.value = netWorth;
          } else {
            historyData.push({
              date: todayStr,
              value: netWorth
            });
          }

          return historyData;
        })()}
        currentValue={netWorth}
        change={netWorthChange}
        period={selectedPeriod}
      />

      {/* Stat Cards - Net Worth, Total Assets, Total Liabilities */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard title={t('stats.netWorth')} value={netWorth} change={netWorthChange} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard title={t('stats.totalAssets')} value={totalAssets} change={assetsChange} icon={<Wallet className="h-4 w-4" />} />
        <StatCard title={t('stats.totalLiabilities')} value={totalLiabilities} change={liabilitiesChange} icon={<CreditCard className="h-4 w-4" />} />
      </div>

      {/* Assets vs Liabilities (2/3 width) + Asset Allocation (1/3 width) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-stretch">
        <div className="lg:col-span-2 min-h-[450px]">
          <AssetsLiabilitiesChart
            data={(() => {
              // Reverse history to get chronological order (Oldest -> Newest)
              // portfolioHistory is DESC (Newest -> Oldest)
              const chartData = [...(portfolioHistory || [])].reverse().map(h => {
                const assets = Number(h.totalSavings) + Number(h.totalInvestments) + Number(h.totalBonds) +
                  (user?.excludePersonalRealEstate ? 0 : Number(h.totalRealEstatePersonal)) +
                  Number(h.totalRealEstateInvestment) +
                  Number(h.totalCrypto || 0) +
                  Number(h.totalOtherAssets || 0);
                const liabilities = Number(h.totalLoansPrincipal);
                return {
                  date: formatDate(new Date(h.recordedAt * 1000), { month: 'short', day: 'numeric' }),
                  assets,
                  liabilities
                };
              });

              // Append or update with current live values
              const todayStr = formatDate(new Date(), { month: 'short', day: 'numeric' });
              const lastPoint = chartData[chartData.length - 1];

              if (lastPoint && lastPoint.date === todayStr) {
                lastPoint.assets = totalAssets;
                lastPoint.liabilities = totalLiabilities;
              } else {
                chartData.push({
                  date: todayStr,
                  assets: totalAssets,
                  liabilities: totalLiabilities
                });
              }

              return chartData;
            })()}
            totalAssets={totalAssets}
            totalLiabilities={totalLiabilities}
          />
        </div>
        <AssetAllocationDonut data={allocationData} />
      </div>
    </div>
  );
}

