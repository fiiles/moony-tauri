import { SummaryCard } from "@/components/SummaryCard";
import { useCurrency } from "@/lib/currency";
import { TrendingUp, TrendingDown, Activity, Award, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";

interface InvestmentsSummaryProps {
  metrics: {
    totalValue: number;
    totalCost: number;
    overallGainLoss: number;
    overallGainLossPercent: number;
    estimatedDividendYield: number;
    topPerformer: { ticker: string; gainLossPercent: number } | null;
  };
  latestFetchedAt?: Date;
}

export function InvestmentsSummary({ metrics, latestFetchedAt }: InvestmentsSummaryProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation('investments');

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
      <SummaryCard
        title={t('summary.totalValue')}
        value={formatCurrency(metrics.totalValue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        icon={<Wallet className="h-4 w-4" />}
        subtitle={latestFetchedAt ? t('summary.lastUpdated', { date: latestFetchedAt.toLocaleDateString() }) : undefined}
      />

      <SummaryCard
        title={t('summary.totalGainLoss')}
        value={formatCurrency(Math.abs(metrics.overallGainLoss), { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        icon={metrics.overallGainLoss >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        subtitle={`${metrics.overallGainLoss >= 0 ? "+" : ""}${metrics.overallGainLossPercent.toFixed(2)}%`}
        valueClassName={metrics.overallGainLoss >= 0 ? "text-positive" : "text-negative"}
      />

      <SummaryCard
        title={t('summary.estimatedDividend')}
        value={formatCurrency(metrics.estimatedDividendYield, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        icon={<TrendingUp className="h-4 w-4" />}
        subtitle={t('summary.basedOnLastYear')}
        valueClassName="text-positive"
      />

      <SummaryCard
        title={t('summary.topPerformer')}
        value={metrics.topPerformer?.ticker || "N/A"}
        icon={<Award className="h-4 w-4" />}
        subtitle={metrics.topPerformer ? `+${metrics.topPerformer.gainLossPercent.toFixed(2)}%` : undefined}
        valueClassName="text-positive"
      />
    </div>
  );
}


