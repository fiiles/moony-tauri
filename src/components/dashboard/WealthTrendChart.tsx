import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useCurrency } from "@/lib/currency";

interface TrendData {
  date: string;
  value: number;
}

interface WealthTrendChartProps {
  data: TrendData[];
}

export default function WealthTrendChart({ data }: WealthTrendChartProps) {
  const { formatCurrencyShort, formatCurrency } = useCurrency();

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Net Worth Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="date" 
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(value) => formatCurrencyShort(value)}
          />
          <Tooltip 
            formatter={(value) => [formatCurrency(value as number ?? 0), 'Net Worth']}
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="hsl(var(--chart-1))" 
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--chart-1))' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
