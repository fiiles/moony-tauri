import { Card } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "react-i18next";
import { useState } from "react";

interface AssetClassData {
  date: string;
  investments: number;
  savings: number;
  bonds: number;
  realEstate: number;
  crypto: number;
  otherAssets: number;
}

interface AssetClassTrendChartProps {
  data: AssetClassData[];
}

// Asset class colors using theme tokens
const ASSET_COLORS = {
  investments: 'hsl(var(--chart-1))', // Violet (primary)
  savings: 'hsl(var(--chart-6))',     // Green
  bonds: 'hsl(var(--chart-7))',       // Amber/Orange
  realEstate: 'hsl(var(--chart-8))',  // Blue
  crypto: 'hsl(var(--chart-4))',      // Pink
  otherAssets: 'hsl(var(--chart-5))', // Red-ish
} as const;

type AssetKey = keyof typeof ASSET_COLORS;

export default function AssetClassTrendChart({ data }: AssetClassTrendChartProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation('dashboard');

  // Track which series are visible (all visible by default)
  const [visibleSeries, setVisibleSeries] = useState<Record<AssetKey, boolean>>({
    investments: true,
    savings: true,
    bonds: true,
    realEstate: true,
    crypto: true,
    otherAssets: true,
  });

  // Toggle series visibility
  const toggleSeries = (key: AssetKey) => {
    setVisibleSeries(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };


  // Clickable legend
  const renderLegend = () => {
    const items: { key: AssetKey; color: string; label: string }[] = [
      { key: 'investments', color: ASSET_COLORS.investments, label: t('cards.investments') },
      { key: 'savings', color: ASSET_COLORS.savings, label: t('cards.savings') },
      { key: 'bonds', color: ASSET_COLORS.bonds, label: t('cards.bonds') },
      { key: 'realEstate', color: ASSET_COLORS.realEstate, label: t('cards.realEstate') },
      { key: 'crypto', color: ASSET_COLORS.crypto, label: t('cards.crypto') },
      { key: 'otherAssets', color: ASSET_COLORS.otherAssets, label: t('cards.otherAssets') },
    ];

    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => toggleSeries(item.key)}
            className={`flex items-center gap-2 px-2 py-1 rounded-md transition-all hover:bg-muted ${
              visibleSeries[item.key] ? 'opacity-100' : 'opacity-40'
            }`}
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-sm text-muted-foreground">{item.label}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <Card className="p-6 border h-full flex flex-col">
      <div className="flex flex-col gap-2 mb-4">
        <p className="text-lg font-medium">{t('charts.assetClassTrend')}</p>
      </div>

      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">{t('charts.noHistoricalData')}</p>
        </div>
      ) : (
        <>
          <div className="min-h-[350px]">
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 25 }}>

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
                <YAxis hide />
                <Tooltip
                  formatter={(value, name) => [
                    formatCurrency(value as number ?? 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
                    t(`cards.${name}`)
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                {visibleSeries.savings && (
                  <Area
                    type="monotone"
                    dataKey="savings"
                    name="savings"
                    stackId="1"
                    stroke={ASSET_COLORS.savings}
                    fill={ASSET_COLORS.savings}
                    fillOpacity={0.6}
                  />
                )}
                {visibleSeries.investments && (
                  <Area
                    type="monotone"
                    dataKey="investments"
                    name="investments"
                    stackId="1"
                    stroke={ASSET_COLORS.investments}
                    fill={ASSET_COLORS.investments}
                    fillOpacity={0.6}
                  />
                )}
                {visibleSeries.crypto && (
                  <Area
                    type="monotone"
                    dataKey="crypto"
                    name="crypto"
                    stackId="1"
                    stroke={ASSET_COLORS.crypto}
                    fill={ASSET_COLORS.crypto}
                    fillOpacity={0.6}
                  />
                )}
                {visibleSeries.bonds && (
                  <Area
                    type="monotone"
                    dataKey="bonds"
                    name="bonds"
                    stackId="1"
                    stroke={ASSET_COLORS.bonds}
                    fill={ASSET_COLORS.bonds}
                    fillOpacity={0.6}
                  />
                )}
                {visibleSeries.realEstate && (
                  <Area
                    type="monotone"
                    dataKey="realEstate"
                    name="realEstate"
                    stackId="1"
                    stroke={ASSET_COLORS.realEstate}
                    fill={ASSET_COLORS.realEstate}
                    fillOpacity={0.6}
                  />
                )}
                {visibleSeries.otherAssets && (
                  <Area
                    type="monotone"
                    dataKey="otherAssets"
                    name="otherAssets"
                    stackId="1"
                    stroke={ASSET_COLORS.otherAssets}
                    fill={ASSET_COLORS.otherAssets}
                    fillOpacity={0.6}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {renderLegend()}
        </>
      )}
    </Card>
  );
}
