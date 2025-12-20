import { SummaryCard } from "@/components/common/SummaryCard";
import type { SavingsAccountsMetrics } from "@/hooks/use-savings-accounts";
import { useCurrency } from "@/lib/currency";
import { TrendingUp, Percent, Banknote } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SavingsAccountsSummaryProps {
  metrics: SavingsAccountsMetrics;
}

export function SavingsAccountsSummary({
  metrics,
}: SavingsAccountsSummaryProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation('savings');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
      <SummaryCard
        title={t('summary.totalBalance')}
        value={formatCurrency(metrics.totalBalance)}
        icon={<TrendingUp className="h-4 w-4" />}
      />

      <SummaryCard
        title={t('summary.avgInterestRate')}
        value={`${metrics.averageInterestRate.toFixed(2)}%`}
        icon={<Percent className="h-4 w-4" />}
      />

      <SummaryCard
        title={t('summary.totalInterest')}
        value={formatCurrency(metrics.projectedYearlyEarnings)}
        icon={<Banknote className="h-4 w-4" />}
      />
    </div>
  );
}


