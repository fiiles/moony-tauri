import { SummaryCard } from "@/components/common/SummaryCard";
import { useCurrency } from "@/lib/currency";
import { TrendingUp, TrendingDown, Award, Wallet, Coins } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface InvestmentsSummaryProps {
  metrics: {
    totalValue: number;
    totalCost: number;
    overallGainLoss: number;
    overallGainLossPercent: number;
    estimatedDividendYield: number;
    topPerformer: { ticker: string; gainLossPercent: number } | null;
  };
  realizedGain?: number;
  latestFetchedAt?: Date;
  isLoading?: boolean;
}

export function InvestmentsSummary({ metrics, realizedGain = 0, latestFetchedAt, isLoading }: InvestmentsSummaryProps) {
  const { formatCurrency, formatCurrencyRaw } = useCurrency();
  const { t } = useTranslation('stocks');

  const hasRealizedGain = realizedGain !== 0;

  const unrealizedTitle = metrics.overallGainLoss >= 0
    ? t('summary.unrealizedGain')
    : t('summary.unrealizedLoss');

  const realizedTitle = realizedGain >= 0
    ? t('summary.realizedGain')
    : t('summary.realizedLoss');

  const dividendCard = (
    <SummaryCard
      title={t('summary.estimatedDividend')}
      value={formatCurrency(metrics.estimatedDividendYield, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      icon={<Coins className="h-4 w-4" />}
      subtitle={t('summary.basedOnLastYear')}
      valueClassName="text-positive"
    />
  );

  return (
    <div className={cn(
      "grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8 transition-opacity duration-300",
      isLoading && "opacity-50 animate-pulse"
    )}>
      <SummaryCard
        title={t('summary.totalValue')}
        value={formatCurrencyRaw(metrics.totalValue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        icon={<Wallet className="h-4 w-4" />}
        subtitle={latestFetchedAt ? t('summary.lastUpdated', { date: latestFetchedAt.toLocaleDateString() }) : undefined}
      />

      <SummaryCard
        title={unrealizedTitle}
        value={formatCurrencyRaw(Math.abs(metrics.overallGainLoss), { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        icon={metrics.overallGainLoss >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        subtitle={`${metrics.overallGainLoss >= 0 ? "+" : ""}${metrics.overallGainLossPercent.toFixed(2)}%`}
        valueClassName={metrics.overallGainLoss >= 0 ? "text-positive" : "text-negative"}
      />

      {hasRealizedGain ? (
        <>
          <SummaryCard
            title={realizedTitle}
            value={formatCurrencyRaw(Math.abs(realizedGain), { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            icon={realizedGain >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            valueClassName={realizedGain >= 0 ? "text-positive" : "text-negative"}
          />
          {dividendCard}
        </>
      ) : (
        <>
          {dividendCard}
          <SummaryCard
            title={t('summary.topPerformer')}
            value={metrics.topPerformer?.ticker || "N/A"}
            icon={<Award className="h-4 w-4" />}
            subtitle={metrics.topPerformer ? `+${metrics.topPerformer.gainLossPercent.toFixed(2)}%` : undefined}
            valueClassName="text-positive"
          />
        </>
      )}
    </div>
  );
}
