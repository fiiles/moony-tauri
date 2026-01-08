import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownLeft, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/lib/currency";
import { isCzechIBAN, ibanToBBAN, formatAccountNumber } from "@/utils/iban-utils";
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
  const [excludedCategoryIds, setExcludedCategoryIds] = useState<string[]>([]);

  // Sorting state for transaction table
  type SortColumn = 'date' | 'description' | 'payee' | 'account' | 'amount';
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Toggle category filter
  const handleToggleCategoryFilter = (categoryId: string) => {
    setExcludedCategoryIds(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // All available categories for the filter (before any filtering)
  const allCategoryItems = useMemo(() => {
    const filtered = categories
      .filter(cat => 
        cat.categoryId !== 'cat_internal_transfers' && 
        cat.categoryId !== 'cat_income'
      )
      .map((cat, index) => ({
        name: t(`categories.${cat.categoryId}`, { defaultValue: cat.categoryName }),
        categoryId: cat.categoryId,
        color: getCategoryColor(cat.categoryId, index),
        amount: Math.abs(parseFloat(cat.totalAmount) || 0),
      }));

    if (uncategorizedAmount > 0) {
      filtered.push({
        name: t('uncategorized'),
        categoryId: 'uncategorized',
        color: CATEGORY_COLORS['uncategorized'],
        amount: Math.abs(uncategorizedAmount),
      });
    }

    return filtered.sort((a, b) => b.amount - a.amount);
  }, [categories, uncategorizedAmount, t]);

  // Filter out income/transfers, apply exclusion filter, and add uncategorized
  const chartData = useMemo(() => {
    const filtered = categories
      .filter(cat => 
        cat.categoryId !== 'cat_internal_transfers' && 
        cat.categoryId !== 'cat_income' &&
        !excludedCategoryIds.includes(cat.categoryId)
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

    if (uncategorizedAmount > 0 && !excludedCategoryIds.includes('uncategorized')) {
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
  }, [categories, uncategorizedAmount, uncategorizedCount, excludedCategoryIds, t]);

  // Fetch transactions for selected category
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['budgeting-category-transactions', selectedCategoryId, startDate, endDate],
    queryFn: () => budgetingApi.getCategoryTransactions(selectedCategoryId!, startDate, endDate),
    enabled: !!selectedCategoryId,
  });

  // Sort transactions based on selected column
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'date':
          comparison = a.bookingDate - b.bookingDate;
          break;
        case 'description':
          comparison = (a.description || '').localeCompare(b.description || '');
          break;
        case 'payee':
          comparison = (a.counterpartyName || '').localeCompare(b.counterpartyName || '');
          break;
        case 'account':
          comparison = (a.bankAccountName || '').localeCompare(b.bankAccountName || '');
          break;
        case 'amount': {
          const amountA = parseFloat(a.amount);
          const amountB = parseFloat(b.amount);
          comparison = amountA - amountB;
          break;
        }
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [transactions, sortColumn, sortDirection]);

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

  // Check if we have data to show (considering the filter might hide everything)
  const hasAnyData = allCategoryItems.length > 0;

  if (!hasAnyData) {
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
          <div className="flex flex-col gap-1">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col">
                <CardTitle className="text-xl font-semibold">{t('expenses')}</CardTitle>
                {excludedCategoryIds.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {t('total', 'Total')} <span className="font-semibold text-foreground">{formatCurrency(chartData.reduce((sum, cat) => sum + cat.amount, 0))}</span>
                  </span>
                )}
              </div>
              {/* Category Filters - inline with header, right-aligned, limited to 2/3 width */}
              {allCategoryItems.length > 0 && (
                <div className="w-2/3 flex flex-wrap items-center justify-end gap-1.5">
                  {allCategoryItems.map(cat => {
                    const isExcluded = excludedCategoryIds.includes(cat.categoryId);
                    return (
                      <Badge
                        key={cat.categoryId}
                        variant={isExcluded ? "outline" : "default"}
                        className={`cursor-pointer transition-all h-6 px-2 text-xs ${
                          isExcluded ? "opacity-50 bg-muted" : ""
                        }`}
                        style={{
                          backgroundColor: isExcluded ? undefined : cat.color,
                          borderColor: cat.color,
                        }}
                        onClick={() => handleToggleCategoryFilter(cat.categoryId)}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full mr-1"
                          style={{ backgroundColor: isExcluded ? cat.color : '#fff' }}
                        />
                        {cat.name}
                      </Badge>
                    );
                  })}
                  {excludedCategoryIds.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-6 px-2"
                      onClick={() => setExcludedCategoryIds([])}
                    >
                      {t('showAll', 'Show All')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[500px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                barCategoryGap="20%" // Slightly increased gap for better look with overlaid bars
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  xAxisId="0"
                  tick={{ fontSize: 14, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  angle={-45}
                  textAnchor="end"
                  height={70}
                  interval={0}
                />
                {/* Secondary hidden axis to allow layering bars on top of each other */}
                <XAxis 
                  dataKey="name" 
                  xAxisId="1"
                  hide
                  interval={0}
                />
                <YAxis 
                  tickFormatter={(value) => {
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)} mil.`;
                    if (value >= 1000) return `${Math.round(value / 1000)} tis.`;
                    return `${value}`;
                  }}
                  tick={{ fontSize: 14, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  width={70}
                />
                <Tooltip 
                  content={<CustomTooltip />} 
                  cursor={{ fill: 'hsl(var(--muted-foreground) / 0.2)' }}
                />
                
                {/* Actual spending bars */}
                <Bar
                  dataKey="amount"
                  xAxisId="0"
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  maxBarSize={80} // Increased maxBarSize slightly
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onClick={(data: any) => handleBarClick(data)}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke={selectedCategoryId === entry.categoryId ? "hsl(var(--primary))" : undefined}
                      strokeWidth={selectedCategoryId === entry.categoryId ? 3 : 0}
                    />
                  ))}
                </Bar>

                {/* Budget lines (overlaid) */}
                <Bar
                  dataKey="budget"
                  xAxisId="1"
                  shape={(props: unknown) => {
                    const { x, y, width, payload } = props as { x: number; y: number; width: number; payload: { budget: number } };
                    // Only draw line if there is a budget
                    if (!width || payload?.budget === 0) return <g />;
                    
                    // Calculate the full width of the category slot
                    // User requested 1.35x width
                    const fullWidth = width * 1.35;
                    const offset = (fullWidth - width) / 2;
                    
                    return (
                       <g>
                        {/* The dashed line */}
                        <line 
                          x1={x - offset} 
                          y1={y} 
                          x2={x + width + offset} 
                          y2={y} 
                          stroke="hsl(var(--foreground))" 
                          strokeWidth={2} 
                          strokeDasharray="2 4"
                          strokeLinecap="round"
                          className=""
                        />
                       </g>
                    );
                  }}
                  isAnimationActive={false} // Disable animation for the line to avoid weird transitions
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Legend */}
          <div className="flex items-center justify-center gap-8 -mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-primary" />
              <span>{t('actualSpending')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0 border-t-2 border-dotted border-foreground" />
              <span>{t('budgetLimit')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Card - Separate block */}
      {selectedCategoryId && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: selectedCategory?.color || '#9ca3af' }}
                />
                {selectedCategory?.name || t('uncategorized')}
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
              <div className="rounded-lg border">
              <Table>
                <TableHeader className="[&_th]:bg-muted/50">
                  <TableRow>
                    <TableHead 
                      className="w-[90px] cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('date')}
                    >
                      <span className="flex items-center">
                        {t('date')}
                        <SortIcon column="date" />
                      </span>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('description')}
                    >
                      <span className="flex items-center">
                        {t('description')}
                        <SortIcon column="description" />
                      </span>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('payee')}
                    >
                      <span className="flex items-center">
                        {t('payee', 'Payee')}
                        <SortIcon column="payee" />
                      </span>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('account')}
                    >
                      <span className="flex items-center">
                        {t('account')}
                        <SortIcon column="account" />
                      </span>
                    </TableHead>
                    <TableHead 
                      className="text-right w-[120px] cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('amount')}
                    >
                      <span className="flex items-center justify-end">
                        {t('amount')}
                        <SortIcon column="amount" />
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTransactions.map((tx) => {
                    const isCredit = tx.txType?.toLowerCase() === 'credit';
                    const amountNum = parseFloat(tx.amount);
                    return (
                      <TableRow key={tx.id}>
                        <TableCell>{formatDate(tx.bookingDate)}</TableCell>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            {isCredit ? (
                              <ArrowDownLeft className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                            )}
                            <span className="break-words whitespace-normal">
                              {tx.description || '-'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="break-words whitespace-normal">
                              {tx.counterpartyName || '-'}
                            </div>
                            {tx.counterpartyIban && (
                              <div className="text-xs text-muted-foreground">
                                {isCzechIBAN(tx.counterpartyIban) 
                                  ? ibanToBBAN(tx.counterpartyIban) 
                                  : formatAccountNumber(tx.counterpartyIban)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {tx.bankAccountName}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${isCredit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {isCredit ? '+' : '-'}{Math.abs(amountNum).toLocaleString()} {tx.currency || 'CZK'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">{t('noTransactions')}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
