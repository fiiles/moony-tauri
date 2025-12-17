import { Card } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "react-i18next";

interface TrendData {
    date: string;
    assets: number;
    liabilities: number;
}

interface AssetsLiabilitiesChartProps {
    data: TrendData[];
    period?: string;
}

export default function AssetsLiabilitiesChart({
    data,
    period = "Last 90 Days"
}: AssetsLiabilitiesChartProps) {
    const { formatCurrency } = useCurrency();
    const { t } = useTranslation('dashboard');

    return (
        <Card className="p-6 border h-full flex flex-col">
            <div className="flex flex-col gap-2 mb-4">
                <p className="text-lg font-medium">{t('charts.assetsVsLiabilities')}</p>
                <p className="text-sm text-muted-foreground">{period}</p>
            </div>

            {data.length === 0 ? (
                <div className="flex-1 min-h-[300px] flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">{t('charts.noHistoricalData')}</p>
                </div>
            ) : (
                <div className="flex-1 min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
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
                            />
                            <YAxis hide />
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

