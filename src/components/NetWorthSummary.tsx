import { TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useCurrency } from "@/lib/currency";

interface NetWorthSummaryProps {
  totalNetWorth: number;
  percentChange: number;
  timePeriod?: string;
}

export default function NetWorthSummary({
  totalNetWorth,
  percentChange,
  timePeriod = "This Month"
}: NetWorthSummaryProps) {
  const isPositive = percentChange >= 0;
  const { formatCurrency } = useCurrency();
  
  return (
    <Card className="p-6">
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Total Net Worth</h2>
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-5xl font-bold tabular-nums">
            {formatCurrency(totalNetWorth)}
          </p>
          <div className={`flex items-center gap-1 text-sm font-medium ${
            isPositive ? 'text-chart-2' : 'text-destructive'
          }`}>
            {isPositive ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span className="tabular-nums">
              {isPositive ? '+' : ''}{percentChange.toFixed(2)}%
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{timePeriod}</p>
      </div>
    </Card>
  );
}
