import { SummaryCard } from "@/components/common/SummaryCard";
import { useCurrency } from "@/lib/currency";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface BudgetingSummaryProps {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  isLoading?: boolean;
}

/**
 * Summary cards for budgeting page - matches Stocks overview design pattern
 */
export function BudgetingSummary({
  totalIncome,
  totalExpenses,
  netBalance,
  isLoading = false,
}: BudgetingSummaryProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation('budgeting');

  return (
    <div className={cn(
      "grid gap-4 md:grid-cols-3 transition-opacity duration-300",
      isLoading && "opacity-50 animate-pulse"
    )}>
      <SummaryCard
        title={t('totalIncome')}
        value={formatCurrency(totalIncome, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        icon={<TrendingUp className="h-4 w-4" />}
        valueClassName="text-positive"
      />

      <SummaryCard
        title={t('totalExpenses')}
        value={formatCurrency(totalExpenses, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        icon={<TrendingDown className="h-4 w-4" />}
        valueClassName="text-negative"
      />

      <SummaryCard
        title={t('netBalance')}
        value={formatCurrency(Math.abs(netBalance), { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        icon={<Wallet className="h-4 w-4" />}
        subtitle={netBalance >= 0 ? t('surplus') : t('deficit')}
        valueClassName={netBalance >= 0 ? "text-positive" : "text-negative"}
      />
    </div>
  );
}
