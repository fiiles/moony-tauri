import { SummaryCard } from "@/components/SummaryCard";
import { useCurrency } from "@/lib/currency";
import { Banknote, Percent, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";

interface LoansSummaryProps {
  metrics: {
    totalPrincipal: number;
    totalMonthlyPayment: number;
    averageInterestRate: number;
  };
}

export function LoansSummary({ metrics }: LoansSummaryProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation('loans');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
      <SummaryCard
        title={t('summary.totalOutstanding')}
        value={formatCurrency(metrics.totalPrincipal)}
        icon={<Banknote className="h-4 w-4" />}
      />

      <SummaryCard
        title={t('summary.avgInterestRate')}
        value={`${metrics.averageInterestRate.toFixed(2)}%`}
        icon={<Percent className="h-4 w-4" />}
      />

      <SummaryCard
        title={t('summary.monthlyPayments')}
        value={formatCurrency(metrics.totalMonthlyPayment)}
        icon={<Calendar className="h-4 w-4" />}
      />
    </div>
  );
}

