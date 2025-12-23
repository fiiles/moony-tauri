import { Card } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "react-i18next";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { portfolioApi } from "@/lib/tauri-api";
import { subDays, startOfYear } from "date-fns";
import TimePeriodSelector, { type Period } from "@/components/cashflow/TimePeriodSelector";
import type { PortfolioMetricsHistory } from "@shared/schema";
import { useLanguage } from "@/i18n/I18nProvider";
import { useSyncStatus } from "@/hooks/sync-context";

interface TrendData {
  date: string;
  value: number;
}

interface PortfolioValueTrendChartProps {
  type: 'investments' | 'crypto';
  currentValue: number;
}

export default function PortfolioValueTrendChart({
  type,
  currentValue,
}: PortfolioValueTrendChartProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation(type === 'investments' ? 'investments' : 'crypto');
  const { formatDate } = useLanguage();
  const queryClient = useQueryClient();
  const { lastResult } = useSyncStatus();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('30D');

  // Invalidate portfolio-history when backfill completes
  useEffect(() => {
    if (lastResult && lastResult.days_processed > 0) {
      queryClient.invalidateQueries({ queryKey: ['portfolio-history'] });
    }
  }, [lastResult, queryClient]);

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

  // Fetch portfolio history
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

  // Extract value based on type and calculate chart data
  const { data, change } = useMemo(() => {
    // Reverse history to get chronological order (Oldest -> Newest)
    // portfolioHistory is DESC (Newest -> Oldest)
    const historyData: TrendData[] = [...(portfolioHistory || [])].reverse().map(h => {
      let value: number;
      if (type === 'investments') {
        value = Number(h.totalInvestments);
      } else {
        value = Number(h.totalCrypto || 0);
      }
      return {
        date: formatDate(new Date(h.recordedAt * 1000), { month: 'short', day: 'numeric' }),
        value
      };
    });

    // Append or update with current live value
    const todayStr = formatDate(new Date(), { month: 'short', day: 'numeric' });
    const lastPoint = historyData[historyData.length - 1];

    if (lastPoint && lastPoint.date === todayStr) {
      lastPoint.value = currentValue;
    } else {
      historyData.push({
        date: todayStr,
        value: currentValue
      });
    }

    // Calculate change from oldest to newest
    const oldestValue = historyData.length > 0 ? historyData[0].value : 0;
    const changePercent = oldestValue !== 0
      ? ((currentValue - oldestValue) / Math.abs(oldestValue)) * 100
      : 0;

    return { data: historyData, change: changePercent };
  }, [portfolioHistory, currentValue, type, formatDate]);

  const isPositive = change >= 0;

  // Calculate dynamic Y-axis domain based on data range
  const yAxisDomain = useMemo((): [number, number] => {
    if (data.length === 0) return [0, 0];

    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;

    // Add 10% padding on each side, but ensure we don't go below 0
    const padding = range > 0 ? range * 0.1 : maxValue * 0.05;
    const yMin = Math.max(0, minValue - padding);
    const yMax = maxValue + padding;

    return [yMin, yMax];
  }, [data]);

  return (
    <Card className="p-6 border h-full flex flex-col">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
        <div className="flex flex-col gap-2">
          <p className="text-lg font-medium">{t('chart.title')}</p>
          <p className="text-4xl font-bold tracking-tight">
            {formatCurrency(currentValue)}
          </p>
          <div className="flex gap-2 items-center">
            <p className={`text-sm font-medium ${isPositive ? 'text-positive' : 'text-negative'}`}>
              {isPositive ? '+' : ''}{change.toFixed(2)}%
            </p>
          </div>
        </div>
        <TimePeriodSelector value={selectedPeriod} onChange={setSelectedPeriod} />
      </div>

      <div className="min-h-[300px]">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
            <defs>
              <linearGradient id={`colorValue-${type}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 700 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              tickMargin={8}
            />
            <YAxis hide domain={yAxisDomain} />
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), t('summary.totalValue')]}
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill={`url(#colorValue-${type})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
