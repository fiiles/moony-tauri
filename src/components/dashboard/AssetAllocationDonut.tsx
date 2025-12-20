import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "react-i18next";

interface AllocationData {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

interface AssetAllocationDonutProps {
  data: AllocationData[];
  valueKey?: string;
}

export default function AssetAllocationDonut({ data, valueKey = 'value' }: AssetAllocationDonutProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation('dashboard');

  return (
    <Card className="p-6 border h-full">
      <h3 className="text-lg font-medium mb-4">{t('charts.assetAllocation')}</h3>

      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            outerRadius={80}
            innerRadius={50}
            paddingAngle={2}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-6 space-y-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm">{item.name}</span>
            </div>
            <span className="text-sm font-semibold">{Math.round(item.percentage)}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

