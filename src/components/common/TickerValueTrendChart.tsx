import { Card } from "@/components/ui/card";
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { investmentsApi, cryptoApi, type TickerValueHistory } from "@/lib/tauri-api";
import { subDays, startOfYear } from "date-fns";
import TimePeriodSelector, { type Period } from "@/components/cashflow/TimePeriodSelector";
import { useLanguage } from "@/i18n/I18nProvider";
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

interface TickerValueTrendChartProps {
  type: 'stock' | 'crypto';
  ticker: string;
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

export default function TickerValueTrendChart({
  type,
  ticker,
  currentValue,
  isRefreshing = false,
  transactionMarkers = [],
}: TickerValueTrendChartProps) {
  const { formatCurrencyRaw, convert, currencyCode } = useCurrency();
  const { t } = useTranslation(type === 'stock' ? 'stocks' : 'crypto');
  const { formatDate } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('30D');

  // Listen for backend recalculation events
  useEffect(() => {
    const unlisten = listen('recalculation-complete', () => {
      console.log('Recalculation complete, refreshing ticker chart...');
      queryClient.invalidateQueries({ queryKey: ['ticker-history', type, ticker] });
    });

    return () => {
      unlisten.then(f => f());
    };
  }, [queryClient, type, ticker]);

  // Trigger on-demand backfill when chart mounts to ensure we have historical data
  useEffect(() => {
    const runBackfill = async () => {
      try {
        if (type === 'stock') {
          console.log(`[Chart] Triggering on-demand backfill for stock ${ticker}...`);
          const result = await investmentsApi.backfillHistory(ticker);
          console.log(`[Chart] Backfill result for ${ticker}:`, result);
          if (result.days_processed > 0) {
            queryClient.invalidateQueries({ queryKey: ['ticker-history', type, ticker] });
          }
        } else {
          console.log(`[Chart] Triggering on-demand backfill for crypto ${ticker}...`);
          const result = await cryptoApi.backfillHistory(ticker);
          console.log(`[Chart] Backfill result for ${ticker}:`, result);
          if (result.days_processed > 0) {
            queryClient.invalidateQueries({ queryKey: ['ticker-history', type, ticker] });
          }
        }
      } catch (error) {
        console.error(`[Chart] Backfill failed for ${ticker}:`, error);
      }
    };

    runBackfill();
  }, [type, ticker, queryClient]);

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

  // Fetch ticker history
  const { data: tickerHistory } = useQuery<TickerValueHistory[]>({
    queryKey: ["ticker-history", type, ticker, dateRange.start?.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const startDate = dateRange.start ? Math.floor(dateRange.start.getTime() / 1000) : undefined;
      const endDate = Math.floor(dateRange.end.getTime() / 1000);
      
      if (type === 'stock') {
        return investmentsApi.getHistory(ticker, startDate, endDate);
      } else {
        return cryptoApi.getHistory(ticker, startDate, endDate);
      }
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Create a map of transaction markers by day-start timestamp for quick lookup
  const markerMap = useMemo(() => {
    const map = new Map<number, TransactionMarker>();
    for (const marker of transactionMarkers) {
      const existing = map.get(marker.date);
      if (existing) {
        existing.buyAmount += marker.buyAmount;
        existing.sellAmount += marker.sellAmount;
      } else {
        map.set(marker.date, { ...marker });
      }
    }
    return map;
  }, [transactionMarkers]);

  // Extract value and calculate chart data
  const { data, change } = useMemo(() => {
    // Reverse history to get chronological order (Oldest -> Newest)
    // tickerHistory is DESC (Newest -> Oldest)
    const historyData: TrendData[] = [...(tickerHistory || [])].reverse().map(h => {
      const valueInCzk = Number(h.valueCzk) || 0;
      // Convert to preferred currency
      const value = convert(valueInCzk, "CZK", currencyCode);
      
      // Include year in date format for multi-year periods
      const includeYear = selectedPeriod === '1Y' || selectedPeriod === '5Y' || selectedPeriod === 'All';
      const dateStr = includeYear
        ? formatDate(new Date(h.recordedAt * 1000), { month: 'short', day: 'numeric', year: '2-digit' })
        : formatDate(new Date(h.recordedAt * 1000), { month: 'short', day: 'numeric' });
      
      // Normalize recordedAt to day-start for marker lookup
      const recordedDate = new Date(h.recordedAt * 1000);
      const dayStart = new Date(recordedDate.getFullYear(), recordedDate.getMonth(), recordedDate.getDate()).getTime() / 1000;
      const marker = markerMap.get(dayStart);

      // Convert marker amounts
      const buyAmount = marker ? convert(marker.buyAmount, "CZK", currencyCode) : undefined;
      const sellAmount = marker ? convert(marker.sellAmount, "CZK", currencyCode) : undefined;
      
      return {
        date: dateStr,
        dateTimestamp: h.recordedAt,
        value,
        hasBuy: marker ? marker.buyAmount > 0 : false,
        hasSell: marker ? marker.sellAmount > 0 : false,
        buyAmount,
        sellAmount,
      };
    });

    // Append or update with current live value
    const includeYearToday = selectedPeriod === '1Y' || selectedPeriod === '5Y' || selectedPeriod === 'All';
    const todayStr = includeYearToday
      ? formatDate(new Date(), { month: 'short', day: 'numeric', year: '2-digit' })
      : formatDate(new Date(), { month: 'short', day: 'numeric' });
    const lastPoint = historyData[historyData.length - 1];
    const today = new Date();
    const todayDayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() / 1000;
    const todayMarker = markerMap.get(todayDayStart);

    // Prepare today's marker values
    let todayBuyAmount: number | undefined;
    let todaySellAmount: number | undefined;
    if (todayMarker) {
      todayBuyAmount = convert(todayMarker.buyAmount, "CZK", currencyCode);
      todaySellAmount = convert(todayMarker.sellAmount, "CZK", currencyCode);
    }

    if (lastPoint && lastPoint.date === todayStr) {
      lastPoint.value = currentValue;
      if (todayMarker) {
        lastPoint.hasBuy = todayMarker.buyAmount > 0;
        lastPoint.hasSell = todayMarker.sellAmount > 0;
        lastPoint.buyAmount = todayBuyAmount;
        lastPoint.sellAmount = todaySellAmount;
      }
    } else {
      historyData.push({
        date: todayStr,
        dateTimestamp: Math.floor(Date.now() / 1000),
        value: currentValue,
        hasBuy: todayMarker ? todayMarker.buyAmount > 0 : false,
        hasSell: todayMarker ? todayMarker.sellAmount > 0 : false,
        buyAmount: todayBuyAmount,
        sellAmount: todaySellAmount,
      });
    }

    // Calculate change from oldest to newest
    const oldestValue = historyData.length > 0 ? historyData[0].value : 0;
    const changePercent = oldestValue !== 0
      ? ((currentValue - oldestValue) / Math.abs(oldestValue)) * 100
      : 0;

    return { data: historyData, change: changePercent };
  }, [tickerHistory, currentValue, formatDate, markerMap, selectedPeriod, convert, currencyCode]);

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

  // Calculate smart tick interval based on period and data length
  const tickInterval = useMemo(() => {
    const dataLength = data.length;
    if (dataLength === 0) return 0;
    
    // Target approximately 6-10 visible ticks on the X-axis
    const targetTicks = 8;
    const interval = Math.ceil(dataLength / targetTicks);
    
    // Ensure minimum interval based on period
    switch (selectedPeriod) {
      case '30D':
        return Math.max(interval, 4);
      case '90D':
        return Math.max(interval, 10);
      case 'YTD':
      case '1Y':
        return Math.max(interval, 30);
      case '5Y':
        return Math.max(interval, 90);
      case 'All':
        return Math.max(interval, 120);
      default:
        return interval;
    }
  }, [data.length, selectedPeriod]);

  return (
    <Card className={cn(
      "p-6 border h-full flex flex-col transition-opacity duration-300",
      isRefreshing && "opacity-50 animate-pulse"
    )}>
      <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
        <div className="flex flex-col gap-2">
          <p className="text-lg font-medium">{t('chart.positionTitle')}</p>
          <p className="text-4xl font-bold tracking-tight">
            {formatCurrencyRaw(currentValue)}
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
              <linearGradient id={`colorValue-ticker-${type}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              interval={tickInterval}
              tickMargin={8}
            />
            <YAxis hide domain={yAxisDomain} />
            <Tooltip 
              content={<CustomTooltip formatCurrency={formatCurrencyRaw} t={t} />}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill={`url(#colorValue-ticker-${type})`}
              dot={<TransactionDot />}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
