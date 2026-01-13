
import { SummaryCard } from "@/components/common/SummaryCard";
import { useCurrency } from "@/lib/currency";
import { TrendingUp, TrendingDown, Award, Wallet, Bitcoin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface CryptoSummaryProps {
    metrics: {
        totalValue: number;
        totalCost: number;
        overallGainLoss: number;
        overallGainLossPercent: number;
        largestHolding: { ticker: string; value: number } | null;
    };
    latestFetchedAt?: Date;
    isLoading?: boolean;
}

export function CryptoSummary({ metrics, latestFetchedAt, isLoading }: CryptoSummaryProps) {
    const { formatCurrencyRaw } = useCurrency();
    const { t } = useTranslation('crypto');

    return (
        <div className={cn(
            "grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8 transition-opacity duration-300",
            isLoading && "opacity-50 animate-pulse"
        )}>
            <SummaryCard
                title={t('summary.totalCrypto')}
                value={formatCurrencyRaw(metrics.totalValue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                icon={<Bitcoin className="h-4 w-4" />}
                subtitle={latestFetchedAt ? t('summary.lastUpdated', { date: latestFetchedAt.toLocaleDateString() }) : undefined}
            />

            <SummaryCard
                title={t('summary.totalGainLoss')}
                value={formatCurrencyRaw(Math.abs(metrics.overallGainLoss), { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                icon={metrics.overallGainLoss >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                subtitle={`${metrics.overallGainLoss >= 0 ? "+" : ""}${metrics.overallGainLossPercent.toFixed(2)}%`}
                valueClassName={metrics.overallGainLoss >= 0 ? "text-positive" : "text-negative"}
            />

            <SummaryCard
                title={t('summary.largestHolding')}
                value={metrics.largestHolding?.ticker || "N/A"}
                icon={<Award className="h-4 w-4" />}
                subtitle={metrics.largestHolding ? formatCurrencyRaw(metrics.largestHolding.value, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : undefined}
            />

            <SummaryCard
                title={t('summary.totalCost')}
                value={formatCurrencyRaw(metrics.totalCost, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                icon={<Wallet className="h-4 w-4" />}
                subtitle={t('summary.investedCapital')}
            />
        </div>
    );
}
