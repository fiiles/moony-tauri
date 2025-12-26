import { Card } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";

interface TrendData {
    date: string;
    assets: number;
    liabilities: number;
}

interface AssetsLiabilitiesChartProps {
    data: TrendData[];
    totalAssets: number;
    totalLiabilities: number;
}

export default function AssetsLiabilitiesChart({
    data,
    totalAssets,
    totalLiabilities,
}: AssetsLiabilitiesChartProps) {
    const { formatCurrency } = useCurrency();
    const { t } = useTranslation('dashboard');

    // Calculate percentage of assets to liabilities
    const assetsToLiabilitiesRatio = useMemo(() => {
        if (totalLiabilities === 0) return totalAssets > 0 ? 100 : 0;
        return (totalAssets / totalLiabilities) * 100;
    }, [totalAssets, totalLiabilities]);

    const _isHealthy = assetsToLiabilitiesRatio >= 100;

    // Calculate dynamic Y-axis domain based on data range
    const yAxisDomain = useMemo((): [number, number] => {
        if (data.length === 0) return [0, 0];
        
        const allValues = data.flatMap(d => [d.assets, d.liabilities]);
        const minValue = Math.min(...allValues);
        const maxValue = Math.max(...allValues);
        const range = maxValue - minValue;
        
        // Add 10% padding on each side, but ensure we don't go below 0
        const padding = range > 0 ? range * 0.1 : maxValue * 0.05;
        const yMin = Math.max(0, minValue - padding);
        const yMax = maxValue + padding;
        
        return [yMin, yMax];
    }, [data]);

    return (
        <Card className="p-6 border h-full flex flex-col">
            <div className="flex flex-col gap-2 mb-4">
                <p className="text-lg font-medium">{t('charts.assetsVsLiabilities')}</p>
                <p className="text-4xl font-bold tracking-tight">
                    {assetsToLiabilitiesRatio.toFixed(0)}%
                </p>
                <p className="text-sm text-muted-foreground">{t('charts.assetsToLiabilitiesRatio')}</p>
            </div>

            {data.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">{t('charts.noHistoricalData')}</p>
                </div>
            ) : (
                <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 25 }}>
                            <defs>
                                <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorLiabilities" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="hsl(var(--muted-foreground))"
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 700 }}
                                tickLine={false}
                                axisLine={false}
                                interval="preserveStartEnd"
                                tickMargin={8}
                            />
                            <YAxis hide domain={yAxisDomain} />
                            <Tooltip
                                formatter={(value: number, name: string) => [
                                    formatCurrency(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
                                    name === 'assets' ? t('stats.totalAssets') : t('stats.totalLiabilities')
                                ]}
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--popover))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '6px',
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="assets"
                                stroke="hsl(var(--chart-1))"
                                strokeWidth={2}
                                fill="url(#colorAssets)"
                                name="assets"
                            />
                            <Area
                                type="monotone"
                                dataKey="liabilities"
                                stroke="hsl(var(--destructive))"
                                strokeWidth={2}
                                fill="url(#colorLiabilities)"
                                name="liabilities"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </Card>
    );
}

