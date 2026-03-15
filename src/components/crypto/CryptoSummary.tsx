
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
    realizedGain?: number;
    latestFetchedAt?: Date;
    isLoading?: boolean;
}

export function CryptoSummary({ metrics, realizedGain = 0, latestFetchedAt, isLoading }: CryptoSummaryProps) {
    const { formatCurrencyRaw } = useCurrency();
    const { t } = useTranslation('crypto');

    const hasRealizedGain = realizedGain !== 0;

    const unrealizedTitle = metrics.overallGainLoss >= 0
        ? t('summary.unrealizedGain')
        : t('summary.unrealizedLoss');

    const realizedTitle = realizedGain >= 0
        ? t('summary.realizedGain')
        : t('summary.realizedLoss');

    const largestHoldingCard = (
        <SummaryCard
            title={t('summary.largestHolding')}
            value={metrics.largestHolding?.ticker || "N/A"}
            icon={<Award className="h-4 w-4" />}
            subtitle={metrics.largestHolding ? formatCurrencyRaw(metrics.largestHolding.value, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : undefined}
        />
    );

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
                    {largestHoldingCard}
                </>
            ) : (
                <>
                    {largestHoldingCard}
                    <SummaryCard
                        title={t('summary.totalCost')}
                        value={formatCurrencyRaw(metrics.totalCost, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        icon={<Wallet className="h-4 w-4" />}
                        subtitle={t('summary.investedCapital')}
                    />
                </>
            )}
        </div>
    );
}
