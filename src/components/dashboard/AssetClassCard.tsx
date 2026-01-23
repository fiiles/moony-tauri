import { Card } from "@/components/ui/card";
import { useCurrency } from "@/lib/currency";

interface AssetClassCardProps {
  title: string;
  value: number;
  percentage?: number;
  icon: React.ReactNode;
}

export default function AssetClassCard({ title, value, percentage, icon }: AssetClassCardProps) {
  const { formatCurrency } = useCurrency();

  return (
    <Card className="p-6 border shadow-sm card-lift">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="icon-container">
            {icon}
          </div>
        </div>
        <p className="text-2xl font-bold tracking-tight data-value">
          {formatCurrency(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </p>
        {percentage !== undefined && percentage > 0 && (
          <p className="text-xs text-muted-foreground">
            {percentage}% of total
          </p>
        )}
      </div>
    </Card>
  );
}
