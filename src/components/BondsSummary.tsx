import { SummaryCard } from "@/components/SummaryCard";
import type { BondsMetrics } from "@/hooks/useBonds";
import { useCurrency } from "@/lib/currency";
import { FileText, Percent, Coins } from "lucide-react";
import { useTranslation } from "react-i18next";

interface BondsSummaryProps {
  metrics: BondsMetrics;
}

export function BondsSummary({ metrics }: BondsSummaryProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation('bonds');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
      <SummaryCard
        title={t('summary.totalValue')}
        value={formatCurrency(metrics.totalCouponValue)}
        icon={<FileText className="h-4 w-4" />}
      />

      <SummaryCard
        title={t('summary.avgYield')}
        value={`${metrics.averageInterestRate.toFixed(2)}%`}
        icon={<Percent className="h-4 w-4" />}
      />

      <SummaryCard
        title={t('summary.totalInterest')}
        value={formatCurrency(metrics.projectedYearlyEarnings)}
        icon={<Coins className="h-4 w-4" />}
      />
    </div>
  );
}

