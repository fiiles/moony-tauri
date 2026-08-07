import StatCard from '@/components/common/StatCard';
import TimePeriodSelector, { type Period } from '@/components/cashflow/TimePeriodSelector';
import NetWorthTrendChart from '@/components/dashboard/NetWorthTrendChart';
import AssetsLiabilitiesChart from '@/components/dashboard/AssetsLiabilitiesChart';
import AssetAllocationDonut from '@/components/dashboard/AssetAllocationDonut';
import AssetClassTrendChart from '@/components/dashboard/AssetClassTrendChart';
import AssetClassCard from '@/components/dashboard/AssetClassCard';
import { useAuth } from '@/hooks/use-auth';
import { subDays, startOfYear } from 'date-fns';
import {
  TrendingUp,
  Wallet,
  CreditCard,
  Landmark,
  Bitcoin,
  FileText,
  Home,
  Gem,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { portfolioApi } from '@/lib/tauri-api';
import type { PortfolioMetricsHistory } from '@shared/schema';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/I18nProvider';
import { useCurrency } from '@/lib/currency';
import { useHistoricalDisplayValues } from '@/hooks/use-historical-display-values';

export default function Dashboard() {
  const { t } = useTranslation('dashboard');
  const { user } = useAuth();
  const { formatDate } = useLanguage();
  const { ratesTimestamp } = useCurrency();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('30D');

  // Calculate date range based on selected period
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (selectedPeriod) {
      case '30D':
        return { start: subDays(now, 30), end: now };
      case '90D':
        return { start: subDays(now, 90), end: now };
      case 'YTD':
        return { start: startOfYear(now), end: now };
      case '1Y':
        return { start: subDays(now, 365), end: now };
      case '5Y':
        return { start: subDays(now, 365 * 5), end: now };
      case 'All':
        return { start: undefined, end: now };
      default:
        return { start: subDays(now, 30), end: now };
    }
  }, [selectedPeriod]);

  // Fetch portfolio history using Tauri API
  const { data: portfolioHistory } = useQuery<PortfolioMetricsHistory[]>({
    queryKey: ['portfolio-history', dateRange.start?.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const startDate = dateRange.start ? Math.floor(dateRange.start.getTime() / 1000) : undefined;
      const endDate = Math.floor(dateRange.end.getTime() / 1000);
      return portfolioApi.getHistory(startDate, endDate);
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Fetch portfolio metrics using Tauri API
  // ratesTimestamp is included in the queryKey so this re-fetches whenever ECB exchange rates
  // are refreshed. This ensures the dashboard uses the same rates as the stocks/crypto pages,
  // which compute values directly in the frontend from originalPrice + frontend rates.
  const { data: portfolioMetrics } = useQuery({
    queryKey: ['portfolio-metrics', ratesTimestamp],
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

  // Per-day display-currency conversion shared by all history-fed charts
  const { convertPoint, convertCzkPoint, convertCzkToday } =
    useHistoricalDisplayValues(portfolioHistory);

  // History rows converted to the display currency using each day's rates,
  // in chronological order (Oldest -> Newest; the query returns DESC).
  //
  // Real-estate caveat: history rows only store a COMBINED realEstateByCurrency
  // breakdown, while the CZK totals split personal vs investment. When personal
  // real estate is excluded, the breakdown does not match the wanted total (it
  // still includes the personal part), so that portion converts via the CZK
  // total instead: investment-only CZK total at the day's display rate,
  // falling back to today's rate.
  const convertedHistory = useMemo(() => {
    const excludePersonal = user?.excludePersonalRealEstate || false;
    return [...(portfolioHistory || [])].reverse().map((h) => {
      const savings = convertPoint(h.recordedAt, h.savingsByCurrency, Number(h.totalSavings));
      const investments = convertPoint(
        h.recordedAt,
        h.investmentsByCurrency,
        Number(h.totalInvestments)
      );
      const bonds = convertPoint(h.recordedAt, h.bondsByCurrency, Number(h.totalBonds));
      const crypto = convertPoint(h.recordedAt, h.cryptoByCurrency, Number(h.totalCrypto || 0));
      const otherAssets = convertPoint(
        h.recordedAt,
        h.otherAssetsByCurrency,
        Number(h.totalOtherAssets || 0)
      );
      const realEstate = excludePersonal
        ? convertCzkPoint(h.recordedAt, Number(h.totalRealEstateInvestment))
        : convertPoint(
            h.recordedAt,
            h.realEstateByCurrency,
            Number(h.totalRealEstatePersonal) + Number(h.totalRealEstateInvestment)
          );
      const liabilities = convertPoint(
        h.recordedAt,
        h.loansByCurrency,
        Number(h.totalLoansPrincipal)
      );
      const assets = savings + investments + bonds + realEstate + crypto + otherAssets;
      return {
        recordedAt: h.recordedAt,
        savings,
        investments,
        bonds,
        crypto,
        otherAssets,
        realEstate,
        assets,
        liabilities,
        netWorth: assets - liabilities,
      };
    });
  }, [portfolioHistory, convertPoint, convertCzkPoint, user?.excludePersonalRealEstate]);

  // Live "today" values converted at today's rates. These match what the stat
  // cards show via formatCurrency for the same CZK inputs, so the last chart
  // point always equals the summary values.
  const displayNetWorth = convertCzkToday(netWorth);
  const displayTotalAssets = convertCzkToday(totalAssets);
  const displayTotalLiabilities = convertCzkToday(totalLiabilities);
  const displayTotalSavings = convertCzkToday(totalSavings);
  const displayTotalInvestments = convertCzkToday(totalInvestments);
  const displayTotalBonds = convertCzkToday(totalBonds);
  const displayTotalRealEstate = convertCzkToday(totalRealEstate);
  const displayTotalCrypto = convertCzkToday(totalCrypto);
  const displayTotalOtherAssets = convertCzkToday(totalOtherAssets);

  // Calculate changes from historical data: oldest converted point vs today's
  // converted live value, both in display currency (identical to the previous
  // CZK-based numbers when the display currency is CZK)
  const oldestConverted = convertedHistory[0];

  const netWorthChange = useMemo(() => {
    if (!oldestConverted || oldestConverted.netWorth === 0) return 0;
    return (
      ((displayNetWorth - oldestConverted.netWorth) / Math.abs(oldestConverted.netWorth)) * 100
    );
  }, [oldestConverted, displayNetWorth]);

  const assetsChange = useMemo(() => {
    if (!oldestConverted || oldestConverted.assets === 0) return 0;
    return ((displayTotalAssets - oldestConverted.assets) / Math.abs(oldestConverted.assets)) * 100;
  }, [oldestConverted, displayTotalAssets]);

  const liabilitiesChange = useMemo(() => {
    if (!oldestConverted || oldestConverted.liabilities === 0) return 0;
    return (
      ((displayTotalLiabilities - oldestConverted.liabilities) /
        Math.abs(oldestConverted.liabilities)) *
      100
    );
  }, [oldestConverted, displayTotalLiabilities]);

  // Using shadcn chart tokens for consistent theming
  const allocationColors = {
    investments: 'hsl(var(--chart-1))', // Primary violet
    savings: 'hsl(var(--chart-6))', // Green
    bonds: 'hsl(var(--chart-7))', // Amber
    realEstate: 'hsl(var(--chart-8))', // Blue
    crypto: 'hsl(var(--chart-4))', // Pink
    otherAssets: 'hsl(var(--chart-5))', // Red-ish
  };

  const allocationData = [
    {
      name: t('cards.investments'),
      value: totalInvestments,
      percentage: totalAssets ? Math.round((totalInvestments / totalAssets) * 100) : 0,
      color: allocationColors.investments,
    },
    {
      name: t('cards.savings'),
      value: totalSavings,
      percentage: totalAssets ? Math.round((totalSavings / totalAssets) * 100) : 0,
      color: allocationColors.savings,
    },
    {
      name: t('cards.bonds'),
      value: totalBonds,
      percentage: totalAssets ? Math.round((totalBonds / totalAssets) * 100) : 0,
      color: allocationColors.bonds,
    },
    {
      name: t('cards.realEstate'),
      value: totalRealEstate,
      percentage: totalAssets ? Math.round((totalRealEstate / totalAssets) * 100) : 0,
      color: allocationColors.realEstate,
    },
    {
      name: t('cards.crypto'),
      value: totalCrypto,
      percentage: totalAssets ? Math.round((totalCrypto / totalAssets) * 100) : 0,
      color: allocationColors.crypto,
    },
    {
      name: t('cards.otherAssets'),
      value: totalOtherAssets,
      percentage: totalAssets ? Math.round((totalOtherAssets / totalAssets) * 100) : 0,
      color: allocationColors.otherAssets,
    },
  ].filter((item) => item.value > 0); // Only show assets with value

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
          // Include year in date format for multi-year periods
          const includeYear =
            selectedPeriod === '1Y' || selectedPeriod === '5Y' || selectedPeriod === 'All';
          const dateOptions = includeYear
            ? { month: 'short' as const, day: 'numeric' as const, year: '2-digit' as const }
            : { month: 'short' as const, day: 'numeric' as const };

          const historyData = convertedHistory.map((h) => ({
            date: formatDate(new Date(h.recordedAt * 1000), dateOptions),
            value: h.netWorth,
          }));

          // Append or update with current live net worth
          // This ensures the chart ends with the exact value shown in the summary
          const todayStr = formatDate(new Date(), dateOptions);
          const lastPoint = historyData[historyData.length - 1];

          if (lastPoint && lastPoint.date === todayStr) {
            lastPoint.value = displayNetWorth;
          } else {
            historyData.push({
              date: todayStr,
              value: displayNetWorth,
            });
          }

          return historyData;
        })()}
        currentValue={displayNetWorth}
        change={netWorthChange}
        period={selectedPeriod}
      />

      {/* Stat Cards - Net Worth, Total Assets, Total Liabilities */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title={t('stats.netWorth')}
          value={netWorth}
          change={netWorthChange}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          title={t('stats.totalAssets')}
          value={totalAssets}
          change={assetsChange}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          title={t('stats.totalLiabilities')}
          value={totalLiabilities}
          change={liabilitiesChange}
          icon={<CreditCard className="h-4 w-4" />}
        />
      </div>

      {/* Assets vs Liabilities (2/3 width) + Asset Allocation (1/3 width) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-stretch">
        <div className="lg:col-span-2 min-h-[450px]">
          <AssetsLiabilitiesChart
            data={(() => {
              // Include year in date format for multi-year periods
              const includeYear =
                selectedPeriod === '1Y' || selectedPeriod === '5Y' || selectedPeriod === 'All';
              const dateOptions = includeYear
                ? { month: 'short' as const, day: 'numeric' as const, year: '2-digit' as const }
                : { month: 'short' as const, day: 'numeric' as const };

              const chartData = convertedHistory.map((h) => ({
                date: formatDate(new Date(h.recordedAt * 1000), dateOptions),
                assets: h.assets,
                liabilities: h.liabilities,
              }));

              // Append or update with current live values
              const todayStr = formatDate(new Date(), dateOptions);
              const lastPoint = chartData[chartData.length - 1];

              if (lastPoint && lastPoint.date === todayStr) {
                lastPoint.assets = displayTotalAssets;
                lastPoint.liabilities = displayTotalLiabilities;
              } else {
                chartData.push({
                  date: todayStr,
                  assets: displayTotalAssets,
                  liabilities: displayTotalLiabilities,
                });
              }

              return chartData;
            })()}
            totalAssets={displayTotalAssets}
            totalLiabilities={displayTotalLiabilities}
          />
        </div>
        <AssetAllocationDonut data={allocationData} />
      </div>

      {/* Asset Class Cards - 3x2 Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <AssetClassCard
          title={t('cards.savings')}
          value={totalSavings}
          percentage={totalAssets ? Math.round((totalSavings / totalAssets) * 100) : 0}
          icon={<Landmark className="h-4 w-4" />}
        />
        <AssetClassCard
          title={t('cards.investments')}
          value={totalInvestments}
          percentage={totalAssets ? Math.round((totalInvestments / totalAssets) * 100) : 0}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <AssetClassCard
          title={t('cards.crypto')}
          value={totalCrypto}
          percentage={totalAssets ? Math.round((totalCrypto / totalAssets) * 100) : 0}
          icon={<Bitcoin className="h-4 w-4" />}
        />
        <AssetClassCard
          title={t('cards.bonds')}
          value={totalBonds}
          percentage={totalAssets ? Math.round((totalBonds / totalAssets) * 100) : 0}
          icon={<FileText className="h-4 w-4" />}
        />
        <AssetClassCard
          title={t('cards.realEstate')}
          value={totalRealEstate}
          percentage={totalAssets ? Math.round((totalRealEstate / totalAssets) * 100) : 0}
          icon={<Home className="h-4 w-4" />}
        />
        <AssetClassCard
          title={t('cards.otherAssets')}
          value={totalOtherAssets}
          percentage={totalAssets ? Math.round((totalOtherAssets / totalAssets) * 100) : 0}
          icon={<Gem className="h-4 w-4" />}
        />
      </div>

      {/* Asset Class Trend Chart - Full Width */}
      <AssetClassTrendChart
        data={(() => {
          // Include year in date format for multi-year periods
          const includeYear =
            selectedPeriod === '1Y' || selectedPeriod === '5Y' || selectedPeriod === 'All';
          const dateOptions = includeYear
            ? { month: 'short' as const, day: 'numeric' as const, year: '2-digit' as const }
            : { month: 'short' as const, day: 'numeric' as const };

          const chartData = convertedHistory.map((h) => ({
            date: formatDate(new Date(h.recordedAt * 1000), dateOptions),
            investments: h.investments,
            savings: h.savings,
            bonds: h.bonds,
            realEstate: h.realEstate,
            crypto: h.crypto,
            otherAssets: h.otherAssets,
          }));

          // Append or update with current live values
          const todayStr = formatDate(new Date(), dateOptions);
          const lastPoint = chartData[chartData.length - 1];

          if (lastPoint && lastPoint.date === todayStr) {
            lastPoint.investments = displayTotalInvestments;
            lastPoint.savings = displayTotalSavings;
            lastPoint.bonds = displayTotalBonds;
            lastPoint.realEstate = displayTotalRealEstate;
            lastPoint.crypto = displayTotalCrypto;
            lastPoint.otherAssets = displayTotalOtherAssets;
          } else {
            chartData.push({
              date: todayStr,
              investments: displayTotalInvestments,
              savings: displayTotalSavings,
              bonds: displayTotalBonds,
              realEstate: displayTotalRealEstate,
              crypto: displayTotalCrypto,
              otherAssets: displayTotalOtherAssets,
            });
          }

          return chartData;
        })()}
      />
    </div>
  );
}
