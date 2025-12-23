import { Card } from "@/components/ui/card";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "react-i18next";

interface SparklineData {
  value: number;
}

interface MiniAssetCardProps {
  title: string;
  value: number;
  sparklineData: SparklineData[];
  color: string;
  onViewDetails?: () => void;
  icon?: React.ReactNode;
}

export default function MiniAssetCard({
  title,
  value,
  sparklineData,
  color,
  onViewDetails,
  icon
}: MiniAssetCardProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation('common');

  const createSparklinePath = (data: SparklineData[]) => {
    if (data.length === 0) return '';

    const max = Math.max(...data.map(d => d.value));
    const min = Math.min(...data.map(d => d.value));
    const range = max - min || 1;

    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 30 - ((d.value - min) / range) * 25;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    return points;
  };

  return (
    <Card className="p-6 border shadow-sm card-hover">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon && (
              <div className="icon-container">
                {icon}
              </div>
            )}
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          </div>
          <button
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors duration-200"
            onClick={() => {
              onViewDetails?.();
            }}
            data-testid={`button-view-${title.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {t('buttons.viewDetails')}
          </button>
        </div>
        <p className="text-2xl font-bold tracking-tight data-value">
          {formatCurrency(value)}
        </p>
        <div className="flex-1 h-12">
          <svg height="48" preserveAspectRatio="none" viewBox="0 0 100 30" width="100%" className="overflow-visible">
            <path
              d={createSparklinePath(sparklineData)}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </Card>
  );
}


