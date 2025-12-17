import { Card } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "react-i18next";

interface TrendData {
  date: string;
  value: number;
}

interface NetWorthTrendChartProps {
  data: TrendData[];
  currentValue: number;
  change: number;
  period?: string;
}

export default function NetWorthTrendChart({
  data,
  currentValue,
  change,
  period = "Last 90 Days"
}: NetWorthTrendChartProps) {
  const isPositive = change >= 0;
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation('dashboard');

  return (
    <Card className="p-6 border h-full flex flex-col">
      <div className="flex flex-col gap-2 mb-4">
        <p className="text-lg font-medium">{t('charts.netWorthTrend')}</p>
        <p className="text-4xl font-bold tracking-tight">
          {formatCurrency(currentValue)}
        </p>
        <div className="flex gap-2 items-center">
          <p className="text-sm text-muted-foreground">{period}</p>
          <p className={`text-sm font-medium ${isPositive ? 'text-positive' : 'text-negative'}`}>
            {isPositive ? '+' : ''}{Math.abs(change).toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
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
            />
            <YAxis hide />
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), t('stats.netWorth')]}
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
              fill="url(#colorValue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

