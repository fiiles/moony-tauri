import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/lib/currency";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import type { CategorySpendingSummary } from "@/lib/tauri-api";
import { budgetingApi } from "@/lib/tauri-api";
import { useQuery } from "@tanstack/react-query";

interface BudgetCategoryChartProps {
  categories: CategorySpendingSummary[];
  uncategorizedAmount?: number;
  uncategorizedCount?: number;
  startDate: number;
  endDate: number;
  isLoading?: boolean;
}

// Curated color palette - modern, vibrant
const CATEGORY_COLORS: Record<string, string> = {
  'cat_investments': '#8b5cf6',
  'cat_taxes': '#ef4444',
  'cat_income': '#22c55e',
  'cat_savings': '#f59e0b',
  'cat_loan_payments': '#06b6d4',
  'cat_groceries': '#10b981',
  'cat_other': '#6366f1',
  'cat_shopping': '#ec4899',
  'cat_housing': '#f97316',
  'cat_dining': '#14b8a6',
  'cat_transport': '#3b82f6',
  'cat_utilities': '#84cc16',
  'cat_entertainment': '#a855f7',
  'cat_health': '#ef4444',
  'cat_travel': '#0ea5e9',
  'cat_subscriptions': '#64748b',
  'cat_insurance': '#78716c',
  'uncategorized': '#9ca3af',
};

const getCategoryColor = (categoryId: string, index: number): string => {
  const fallbackColors = ['#8b5cf6', '#ec4899', '#f97316', '#10b981', '#3b82f6', '#ef4444', '#06b6d4', '#f59e0b'];
  return CATEGORY_COLORS[categoryId] || fallbackColors[index % fallbackColors.length];
};

/**
 * Vertical bar chart showing spending by category
 * Click on bar to show transactions in separate card below
 */
export function BudgetCategoryChart({
  categories,
  uncategorizedAmount = 0,
  uncategorizedCount = 0,
  startDate,
  endDate,
  isLoading = false,
}: BudgetCategoryChartProps) {
  const { t } = useTranslation('budgeting');
  const { formatCurrency } = useCurrency();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Filter out income/transfers and add uncategorized
  const chartData = useMemo(() => {
    const filtered = categories
      .filter(cat => 
        cat.categoryId !== 'cat_internal_transfers' && 
        cat.categoryId !== 'cat_income'
      )
      .map((cat, index) => ({
        name: t(`categories.${cat.categoryId}`, { defaultValue: cat.categoryName }),
        amount: Math.abs(parseFloat(cat.totalAmount) || 0),
        budget: cat.budgetGoal ? parseFloat(cat.budgetGoal.amount) || 0 : 0,
        color: getCategoryColor(cat.categoryId, index),
        hasBudget: !!cat.budgetGoal,
        categoryId: cat.categoryId,
        transactionCount: cat.transactionCount,
      }));

    if (uncategorizedAmount > 0) {
      filtered.push({
        name: t('uncategorized'),
        amount: Math.abs(uncategorizedAmount),
        budget: 0,
        color: CATEGORY_COLORS['uncategorized'],
        hasBudget: false,
        categoryId: 'uncategorized',
        transactionCount: uncategorizedCount,
      });
    }

    return filtered.sort((a, b) => b.amount - a.amount).slice(0, 12);
  }, [categories, uncategorizedAmount, uncategorizedCount, t]);

  // Fetch transactions for selected category
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['budgeting-category-transactions', selectedCategoryId, startDate, endDate],
    queryFn: () => budgetingApi.getCategoryTransactions(selectedCategoryId!, startDate, endDate),
    enabled: !!selectedCategoryId && selectedCategoryId !== 'uncategorized',
  });

  const handleBarClick = (data: Record<string, unknown>) => {
    const categoryId = data?.categoryId as string | undefined;
    if (categoryId) {
      setSelectedCategoryId(prev => prev === categoryId ? null : categoryId);
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; amount: number; budget: number; hasBudget: boolean; transactionCount: number } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover/95 backdrop-blur-sm border rounded-xl shadow-xl p-4 min-w-[200px]">
          <p className="font-semibold text-base mb-2">{data.name}</p>
          <p className="text-sm">
            <span className="text-muted-foreground">{t('spent')}: </span>
            <span className="font-bold text-red-600 dark:text-red-400">
              {formatCurrency(data.amount)}
            </span>
          </p>
          {data.hasBudget && (
            <p className="text-sm mt-1">
              <span className="text-muted-foreground">{t('budget')}: </span>
              <span className="font-medium">{formatCurrency(data.budget)}</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {data.transactionCount} {t('transactions')}
          </p>
          <p className="text-xs text-primary font-medium mt-2 pt-2 border-t">
            {t('clickToExpand')}
          </p>
        </div>
      );
    }
    return null;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const selectedCategory = chartData.find(c => c.categoryId === selectedCategoryId);

  if (chartData.length === 0) {
    return (
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">{t('expenses')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            {t('noData')}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Chart Card */}
      <Card className={`border shadow-sm ${isLoading ? "opacity-50 animate-pulse" : ""}`}>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">{t('expenses')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                barCategoryGap="15%"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  interval={0}
                />
                <YAxis 
                  tickFormatter={(value) => {
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)} mil.`;
                    if (value >= 1000) return `${Math.round(value / 1000)} tis.`;
                    return `${value}`;
                  }}
                  tick={{ fontSize: 13, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  width={70}
                />
                <Tooltip 
                  content={<CustomTooltip />} 
                  cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                />
                
                {/* Budget bars (shadow) */}
                <Bar
                  dataKey="budget"
                  fill="hsl(var(--muted))"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={60}
                />
                
                {/* Actual spending bars */}
                <Bar
                  dataKey="amount"
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  maxBarSize={50}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onClick={(data: any) => handleBarClick(data)}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.hasBudget && entry.amount > entry.budget 
                        ? "#ef4444"
                        : entry.color}
                      stroke={selectedCategoryId === entry.categoryId ? "hsl(var(--primary))" : undefined}
                      strokeWidth={selectedCategoryId === entry.categoryId ? 3 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Legend */}
          <div className="flex items-center justify-center gap-8 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-primary" />
              <span>{t('actualSpending')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted border" />
              <span>{t('budgetLimit')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Card - Separate block */}
      {selectedCategoryId && selectedCategoryId !== 'uncategorized' && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: selectedCategory?.color }}
                />
                {selectedCategory?.name}
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedCategoryId(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {txLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
              </div>
            ) : transactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">{t('date')}</TableHead>
                    <TableHead>{t('description')}</TableHead>
                    <TableHead>{t('account')}</TableHead>
                    <TableHead className="text-right w-[150px]">{t('amount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDate(tx.bookingDate)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ArrowUpRight className="h-4 w-4 text-red-500 shrink-0" />
                          <span className="font-medium truncate">
                            {tx.counterpartyName || tx.description || t('noDescription')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tx.bankAccountName}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-red-600 dark:text-red-400">
                        -{formatCurrency(Math.abs(parseFloat(tx.amount)))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">{t('noTransactions')}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
