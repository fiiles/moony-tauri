import { Card } from "@/components/ui/card";
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Scatter, Cell } from "recharts";
import { useCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { portfolioApi } from "@/lib/tauri-api";
import { subDays, startOfYear, format } from "date-fns";
import TimePeriodSelector, { type Period } from "@/components/cashflow/TimePeriodSelector";
import type { PortfolioMetricsHistory } from "@shared/schema";
import { useLanguage } from "@/i18n/I18nProvider";
import { useSyncStatus } from "@/hooks/sync-context";
import { listen } from "@tauri-apps/api/event";

interface TrendData {
  date: string;
  dateTimestamp: number;
  value: number;
  // Transaction marker data (optional)
  hasBuy?: boolean;
  hasSell?: boolean;
  buyAmount?: number;
  sellAmount?: number;
}

// Transaction marker data passed from parent
export interface TransactionMarker {
  date: number; // Unix timestamp
  buyAmount: number; // Total bought in user currency
  sellAmount: number; // Total sold in user currency
}

interface PortfolioValueTrendChartProps {
  type: 'investments' | 'crypto';
  currentValue: number;
  isRefreshing?: boolean;
  transactionMarkers?: TransactionMarker[];
}

// Custom tooltip content component
const CustomTooltip = ({ 
  active, 
  payload, 
  formatCurrency, 
  t 
}: { 
  active?: boolean; 
  payload?: { payload: TrendData }[]; 
  formatCurrency: (value: number) => string;
  t: (key: string) => string;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  
  const data = payload[0].payload;
  
  return (
    <div 
      className="rounded-lg border bg-popover p-3 text-popover-foreground shadow-md"
      style={{ minWidth: '150px' }}
    >
      <div className="font-medium">{data.date}</div>
      <div className="text-sm text-muted-foreground mt-1">
        {t('summary.totalValue')}: {formatCurrency(data.value)}
      </div>
      {(data.hasBuy || data.hasSell) && (
        <div className="mt-2 pt-2 border-t border-border space-y-1">
          {data.hasBuy && data.buyAmount !== undefined && data.buyAmount > 0 && (
            <div className="text-sm text-green-600 dark:text-green-400 font-medium">
              {t('chart.bought')}: {formatCurrency(data.buyAmount)}
            </div>
          )}
          {data.hasSell && data.sellAmount !== undefined && data.sellAmount > 0 && (
            <div className="text-sm text-red-600 dark:text-red-400 font-medium">
              {t('chart.sold')}: {formatCurrency(data.sellAmount)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Custom dot component for transaction markers
const TransactionDot = (props: {
  cx?: number;
  cy?: number;
  payload?: TrendData;
}) => {
  const { cx, cy, payload } = props;
  
  if (!payload || (!payload.hasBuy && !payload.hasSell)) return null;
  if (cx === undefined || cy === undefined) return null;
  
  // Determine dot color based on transaction type
  let fill: string;
  if (payload.hasBuy && payload.hasSell) {
    fill = '#f97316'; // Orange for both
  } else if (payload.hasBuy) {
    fill = '#22c55e'; // Green for buy
  } else {
    fill = '#ef4444'; // Red for sell
  }
  
  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill={fill}
      stroke="white"
      strokeWidth={2}
      style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))' }}
    />
  );
};

export default function PortfolioValueTrendChart({
  type,
  currentValue,
  isRefreshing = false,
  transactionMarkers = [],
}: PortfolioValueTrendChartProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation(type === 'investments' ? 'stocks' : 'crypto');
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

  // Listen for backend recalculation events
  useEffect(() => {
    const unlisten = listen('recalculation-complete', () => {
      console.log('Recalculation complete, refreshing chart...');
      queryClient.invalidateQueries({ queryKey: ['portfolio-history'] });
    });

    return () => {
      unlisten.then(f => f());
    };
  }, [queryClient]);

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

  // Create a map of transaction markers by date string for quick lookup
  const markerMap = useMemo(() => {
    const map = new Map<string, TransactionMarker>();
    for (const marker of transactionMarkers) {
      // Convert timestamp to date string (using format to match chart dates)
      const dateStr = format(new Date(marker.date * 1000), 'MMM d');
      const existing = map.get(dateStr);
      if (existing) {
        // Aggregate amounts for same date
        existing.buyAmount += marker.buyAmount;
        existing.sellAmount += marker.sellAmount;
      } else {
        map.set(dateStr, { ...marker });
      }
    }
    return map;
  }, [transactionMarkers]);

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
      
      const dateStr = formatDate(new Date(h.recordedAt * 1000), { month: 'short', day: 'numeric' });
      const marker = markerMap.get(dateStr);
      
      return {
        date: dateStr,
        dateTimestamp: h.recordedAt,
        value,
        hasBuy: marker ? marker.buyAmount > 0 : false,
        hasSell: marker ? marker.sellAmount > 0 : false,
        buyAmount: marker?.buyAmount,
        sellAmount: marker?.sellAmount,
      };
    });

    // Append or update with current live value
    const todayStr = formatDate(new Date(), { month: 'short', day: 'numeric' });
    const lastPoint = historyData[historyData.length - 1];
    const todayMarker = markerMap.get(todayStr);

    if (lastPoint && lastPoint.date === todayStr) {
      lastPoint.value = currentValue;
      if (todayMarker) {
        lastPoint.hasBuy = todayMarker.buyAmount > 0;
        lastPoint.hasSell = todayMarker.sellAmount > 0;
        lastPoint.buyAmount = todayMarker.buyAmount;
        lastPoint.sellAmount = todayMarker.sellAmount;
      }
    } else {
      historyData.push({
        date: todayStr,
        dateTimestamp: Math.floor(Date.now() / 1000),
        value: currentValue,
        hasBuy: todayMarker ? todayMarker.buyAmount > 0 : false,
        hasSell: todayMarker ? todayMarker.sellAmount > 0 : false,
        buyAmount: todayMarker?.buyAmount,
        sellAmount: todayMarker?.sellAmount,
      });
    }

    // Calculate change from oldest to newest
    const oldestValue = historyData.length > 0 ? historyData[0].value : 0;
    const changePercent = oldestValue !== 0
      ? ((currentValue - oldestValue) / Math.abs(oldestValue)) * 100
      : 0;

    return { data: historyData, change: changePercent };
  }, [portfolioHistory, currentValue, type, formatDate, markerMap]);

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

  // Filter data points that have transactions for scatter plot
  const transactionPoints = useMemo(() => {
    return data.filter(d => d.hasBuy || d.hasSell);
  }, [data]);

  return (
    <Card className={cn(
      "p-6 border h-full flex flex-col transition-opacity duration-300",
      isRefreshing && "opacity-50 animate-pulse"
    )}>
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
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
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
              content={<CustomTooltip formatCurrency={formatCurrency} t={t} />}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill={`url(#colorValue-${type})`}
              dot={<TransactionDot />}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
