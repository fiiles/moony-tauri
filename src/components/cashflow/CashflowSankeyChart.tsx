import { useMemo } from "react";
import { Sankey, Tooltip, Layer, Rectangle, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "react-i18next";
import type { CashflowReport } from "@shared/schema";

interface CashflowSankeyChartProps {
    report: CashflowReport;
}

// Color palette using theme tokens
const COLORS = {
    income: "hsl(var(--chart-6))",      // Green - matches savings
    totalIncome: "hsl(var(--chart-8))", // Blue - matches realEstate
    totalExpenses: "hsl(var(--chart-1))", // Violet - matches investments
    expenses: [
        "hsl(var(--chart-7))", // Amber/Orange - matches bonds
        "hsl(var(--chart-4))", // Pink - matches crypto
        "hsl(var(--chart-5))", // Red-ish - matches otherAssets
        "hsl(var(--destructive))", // Red
        "hsl(var(--chart-1))", // Violet
        "hsl(var(--chart-3))", // Teal
        "hsl(var(--chart-2))", // Orange-ish
        "hsl(var(--primary))", // Purple
    ]
};

interface SankeyNodeData {
    name: string;
    value: number;
    color: string;
    isLeft: boolean;
    percentage: string;
}

// Custom node component with labels and colors
const CustomNode = ({ 
    x, 
    y, 
    width, 
    height, 
    payload 
}: { 
    x: number; 
    y: number; 
    width: number; 
    height: number; 
    payload: SankeyNodeData; 
}) => {
    const { formatCurrency } = useCurrency();
    
    if (height < 1) return null;
    
    const textX = payload.isLeft ? x - 8 : x + width + 8;
    const textAnchor = payload.isLeft ? "end" : "start";
    
    return (
        <Layer>
            <Rectangle
                x={x}
                y={y}
                width={width}
                height={height}
                fill={payload.color}
                fillOpacity="1"
                radius={2}
            />
            {height >= 1 && (
                <g>
                    <text
                        x={textX}
                        y={y + height / 2 - 7}
                        textAnchor={textAnchor}
                        dominantBaseline="middle"
                        className="text-xs font-medium fill-foreground"
                    >
                        {payload.name}
                    </text>
                    <text
                        x={textX}
                        y={y + height / 2 + 7}
                        textAnchor={textAnchor}
                        dominantBaseline="middle"
                        className="text-[11px] fill-muted-foreground"
                    >
                        {formatCurrency(payload.value)} ({payload.percentage})
                    </text>
                </g>
            )}
        </Layer>
    );
};

export default function CashflowSankeyChart({ report }: CashflowSankeyChartProps) {
    const { formatCurrency } = useCurrency();
    const { t } = useTranslation('reports');

    const sankeyData = useMemo(() => {
        // Get all income categories with positive values
        const incomeCategories = [
            ...report.personal.income.filter(c => c.total > 0),
            ...report.investments.income.filter(c => c.total > 0)
        ];

        // Get all expense categories with positive values
        const expenseCategories = [
            ...report.personal.expenses.filter(c => c.total > 0),
            ...report.investments.expenses.filter(c => c.total > 0)
        ];

        if (incomeCategories.length === 0 && expenseCategories.length === 0) {
            return null;
        }

        // Calculate totals
        const totalIncome = incomeCategories.reduce((sum, cat) => sum + cat.total, 0);
        const totalExpenses = expenseCategories.reduce((sum, cat) => sum + cat.total, 0);

        const nodes: SankeyNodeData[] = [];
        const links = [];
        let nodeIndex = 0;

        // Income category nodes (left)
        incomeCategories.forEach(cat => {
            const percentage = totalIncome > 0 ? ((cat.total / totalIncome) * 100).toFixed(1) : "0";
            nodes.push({ 
                name: t(`categories.${cat.key}`, cat.name),
                value: cat.total,
                color: COLORS.income,
                isLeft: true,
                percentage: `${percentage}%`
            });
            nodeIndex++;
        });

        // Total Income node
        const totalIncomeIndex = nodeIndex;
        nodes.push({ 
            name: t('summary.totalIncome'),
            value: totalIncome,
            color: COLORS.totalIncome,
            isLeft: true,
            percentage: "100%"
        });
        nodeIndex++;

        // Total Expenses node
        const totalExpensesIndex = nodeIndex;
        const expensePercentage = totalIncome > 0 ? ((totalExpenses / totalIncome) * 100).toFixed(1) : "100";
        nodes.push({ 
            name: t('summary.totalExpenses'),
            value: totalExpenses,
            color: COLORS.totalExpenses,
            isLeft: false,
            percentage: `${expensePercentage}%`
        });
        nodeIndex++;

        // Expense category nodes (right)
        const expenseStartIndex = nodeIndex;
        expenseCategories.forEach(cat => {
            const percentage = totalExpenses > 0 ? ((cat.total / totalExpenses) * 100).toFixed(1) : "0";
            nodes.push({ 
                name: t(`categories.${cat.key}`, cat.name),
                value: cat.total,
                color: "#EF4444", // Red-500 - same for all expense categories
                isLeft: false,
                percentage: `${percentage}%`
            });
            nodeIndex++;
        });

        // Links: Income categories -> Total Income (green)
        incomeCategories.forEach((cat, idx) => {
            links.push({
                source: idx,
                target: totalIncomeIndex,
                value: cat.total,
                stroke: COLORS.income
            });
        });

        // Link: Total Income -> Total Expenses (blue)
        if (totalExpenses > 0 && totalIncome > 0) {
            links.push({
                source: totalIncomeIndex,
                target: totalExpensesIndex,
                value: Math.min(totalIncome, totalExpenses),
                stroke: COLORS.totalIncome
            });
        }

        // Links: Total Expenses -> Expense categories (each expense color)
        expenseCategories.forEach((cat, idx) => {
            links.push({
                source: totalExpensesIndex,
                target: expenseStartIndex + idx,
                value: cat.total,
                stroke: COLORS.expenses[idx % COLORS.expenses.length]
            });
        });

        return { nodes, links };
    }, [report, t]);

    // Custom tooltip
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
        if (active && payload && payload.length > 0) {
            const data = payload[0].payload;
            
            // Check if it's a link (has source/target as objects) or a node
            if (data.source && data.target && typeof data.source === 'object') {
                // It's a link
                const sourceName = data.source.name || 'Source';
                const targetName = data.target.name || 'Target';
                return (
                    <div className="bg-popover border rounded-lg shadow-lg p-3">
                        <div className="text-sm font-medium">
                            {sourceName} → {targetName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {formatCurrency(data.value)}
                        </div>
                    </div>
                );
            }
            
            // It's a node
            if (data.name) {
                return (
                    <div className="bg-popover border rounded-lg shadow-lg p-3">
                        <div className="text-sm font-medium">{data.name}</div>
                        <div className="text-sm text-muted-foreground">
                            {formatCurrency(data.value)}{data.percentage ? ` (${data.percentage})` : ''}
                        </div>
                    </div>
                );
            }
        }
        return null;
    };

    if (!sankeyData) {
        return null;
    }

    return (
        <Card className="overflow-hidden min-w-0">
            <CardHeader>
                <CardTitle className="text-xl">{t('summary.overallCashflow', 'Overall Cashflow')}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="w-full h-[400px] min-w-0 overflow-hidden" style={{ contain: 'strict' }}>
                    <ResponsiveContainer width="100%" height="100%" debounce={0}>
                        <Sankey
                            data={sankeyData}
                            nodeWidth={12}
                            nodePadding={20}
                            margin={{ top: 10, right: 170, bottom: 10, left: 120 }}
                            node={<CustomNode x={0} y={0} width={0} height={0} payload={{ name: '', value: 0, color: '', isLeft: true, percentage: '' }} />}
                            link={{ stroke: '#9ca3af' }}
                        >
                            <Tooltip content={<CustomTooltip />} />
                        </Sankey>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
