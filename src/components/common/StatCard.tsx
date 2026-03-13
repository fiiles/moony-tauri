import { Card } from "@/components/ui/card";
import { useCurrency } from "@/lib/currency";

interface StatCardProps {
  title: string;
  value: number;
  change: number;
  format?: 'currency' | 'number';
  icon?: React.ReactNode;
}

export default function StatCard({ title, value, change, format = 'currency', icon }: StatCardProps) {
  const { formatCurrency } = useCurrency();
  const isPositive = change >= 0;
  const changeColor = title.includes('Liabilities') ? (change < 0 ? 'text-positive' : 'text-negative') : (isPositive ? 'text-positive' : 'text-negative');
  const changeBgColor = title.includes('Liabilities') ? (change < 0 ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950') : (isPositive ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950');

  const formattedValue = format === 'currency'
    ? formatCurrency(value)
    : value.toLocaleString('en-US');

  return (
    <Card className="p-6 border shadow-sm card-hover">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {icon && (
            <div className="icon-container">
              {icon}
            </div>
          )}
        </div>
        <p className="text-2xl font-bold tracking-tight data-value">{formattedValue}</p>
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md w-fit text-xs font-medium ${changeColor} ${changeBgColor}`}>
          {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
        </div>
      </div>
    </Card>
  );
}

