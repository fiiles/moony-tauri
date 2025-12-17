
import { SummaryCard } from "@/components/SummaryCard";
import { useCurrency } from "@/lib/currency";
import { TrendingUp, TrendingDown, Activity, Award, Wallet, Bitcoin } from "lucide-react";

interface CryptoSummaryProps {
    metrics: {
        totalValue: number;
        totalCost: number;
        overallGainLoss: number;
        overallGainLossPercent: number;
        largestHolding: { ticker: string; value: number } | null;
    };
    latestFetchedAt?: Date;
}

export function CryptoSummary({ metrics, latestFetchedAt }: CryptoSummaryProps) {
    const { formatCurrency } = useCurrency();

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <SummaryCard
                title="Total Crypto"
                value={formatCurrency(metrics.totalValue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                icon={<Bitcoin className="h-4 w-4" />}
                subtitle={latestFetchedAt ? `Last updated: ${latestFetchedAt.toLocaleDateString()}` : undefined}
            />

            <SummaryCard
                title="Overall Gain/Loss"
                value={formatCurrency(Math.abs(metrics.overallGainLoss), { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                icon={metrics.overallGainLoss >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                subtitle={`${metrics.overallGainLoss >= 0 ? "+" : ""}${metrics.overallGainLossPercent.toFixed(2)}%`}
                valueClassName={metrics.overallGainLoss >= 0 ? "text-positive" : "text-negative"}
            />

            <SummaryCard
                title="Largest Holding"
                value={metrics.largestHolding?.ticker || "N/A"}
                icon={<Award className="h-4 w-4" />}
                subtitle={metrics.largestHolding ? formatCurrency(metrics.largestHolding.value, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : undefined}
                valueClassName="text-primary"
            />

            <SummaryCard
                title="Total Cost"
                value={formatCurrency(metrics.totalCost, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                icon={<Wallet className="h-4 w-4" />}
                subtitle="Invested Capital"
            />
        </div>
    );
}
