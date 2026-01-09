import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Target, X, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { budgetingApi, bankAccountsApi, type InsertBudgetGoal, type BudgetGoal } from "@/lib/tauri-api";
import { BudgetingSummary } from "@/components/budgeting/BudgetingSummary";
import { BudgetCategoryChart } from "@/components/budgeting/BudgetCategoryChart";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/lib/currency";

type Timeframe = "monthly" | "quarterly" | "yearly";

/**
 * Budgeting Report Page
 * 
 * Visualizes spending across all accounts by category,
 * with expandable transaction details and budget goal tracking.
 * Monarch-inspired premium UX design.
 */
export default function Budgeting() {
  const { t, i18n } = useTranslation('budgeting');
  const { t: tc } = useTranslation('common');
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [timeframe, setTimeframe] = useState<Timeframe>("monthly");
  const [periodOffset, setPeriodOffset] = useState(-1); // Default to last month
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  
  // Track edited budget amounts (categoryId -> amount string)
  const [editedBudgets, setEditedBudgets] = useState<Record<string, string>>({});

  // Calculate date range based on timeframe and offset
  const { startDate, endDate, periodLabel } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date;
    let label: string;
    
    // Get current language for locale-aware formatting
    const locale = i18n.language === 'cs' ? 'cs-CZ' : 'en-US';

    if (timeframe === "monthly") {
      start = new Date(now.getFullYear(), now.getMonth() + periodOffset, 1);
      end = new Date(now.getFullYear(), now.getMonth() + periodOffset + 1, 0);
      const rawLabel = start.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
      // Capitalize first letter (important for Czech)
      label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
    } else if (timeframe === "quarterly") {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const targetQuarter = currentQuarter + periodOffset;
      const targetYear = now.getFullYear() + Math.floor(targetQuarter / 4);
      const normalizedQuarter = ((targetQuarter % 4) + 4) % 4;
      
      start = new Date(targetYear, normalizedQuarter * 3, 1);
      end = new Date(targetYear, (normalizedQuarter + 1) * 3, 0);
      label = `Q${normalizedQuarter + 1} ${targetYear}`;
    } else {
      const targetYear = now.getFullYear() + periodOffset;
      start = new Date(targetYear, 0, 1);
      end = new Date(targetYear, 11, 31);
      label = targetYear.toString();
    }

    return {
      startDate: Math.floor(start.getTime() / 1000),
      endDate: Math.floor(end.getTime() / 1000),
      periodLabel: label,
    };
  }, [timeframe, periodOffset, i18n.language]);

  // Fetch budgeting report
  const { data: report, isLoading } = useQuery({
    queryKey: ['budgeting-report', startDate, endDate, timeframe],
    queryFn: () => budgetingApi.getReport(startDate, endDate, timeframe),
  });

  // Fetch categories for budget goal dialog
  const { data: categories = [] } = useQuery({
    queryKey: ['transaction-categories'],
    queryFn: () => bankAccountsApi.getCategories(),
  });

  // Fetch all budget goals
  const { data: budgetGoals = [] } = useQuery({
    queryKey: ['budget-goals'],
    queryFn: () => budgetingApi.getBudgetGoals(),
  });

  // Upsert budget goal mutation
  const upsertMutation = useMutation({
    mutationFn: (data: InsertBudgetGoal) => budgetingApi.upsertBudgetGoal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgeting-report'] });
      queryClient.invalidateQueries({ queryKey: ['budget-goals'] });
      toast({ title: t('goalSaved') });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  // Delete budget goal mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => budgetingApi.deleteBudgetGoal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgeting-report'] });
      queryClient.invalidateQueries({ queryKey: ['budget-goals'] });
      toast({ title: t('goalDeleted') });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  // Handler to save inline budget edit (always save as monthly)
  const handleSaveInlineBudget = (categoryId: string) => {
    const amount = editedBudgets[categoryId];
    if (!amount || parseFloat(amount) <= 0) return;

    upsertMutation.mutate({
      categoryId,
      timeframe: "monthly", // Always save as monthly
      amount,
    });

    // Clear edited state
    setEditedBudgets(prev => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
  };

  // Handler to delete a budget goal
  const handleDeleteBudget = (goal: BudgetGoal) => {
    deleteMutation.mutate(goal.id);
  };

  // Get goal for a category (budgets are always stored as monthly)
  const getGoalForCategory = (categoryId: string): BudgetGoal | undefined => {
    return budgetGoals.find(g => g.categoryId === categoryId && g.timeframe === "monthly");
  };

  // Calculate stats (exclude internal transfers and income from expenses)
  const filteredExpenses = useMemo(() => {
    return (report?.expenseCategories || [])
      .filter(c => 
        c.categoryId !== 'cat_internal_transfers' && 
        c.categoryId !== 'cat_income'
      );
  }, [report?.expenseCategories]);

  // Categories available for budget setting (expense categories only)
  const budgetableCategories = useMemo(() => {
    return categories.filter(c => 
      c.id !== 'cat_income' && 
      c.id !== 'cat_internal_transfers'
    );
  }, [categories]);

  const totalIncome = parseFloat(report?.totalIncome || "0");
  const totalExpenses = filteredExpenses.reduce(
    (sum, cat) => sum + Math.abs(parseFloat(cat.totalAmount) || 0), 
    0
  ) + Math.abs(parseFloat(report?.uncategorizedExpenses || "0"));
  
  const netBalance = totalIncome - totalExpenses;

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">{t('title')}</h1>
          <p className="page-subtitle">{t('subtitle')}</p>
        </div>

        {/* Period navigation + Timeframe buttons */}
        <div className="flex items-center gap-3">
          {/* Period navigation */}
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPeriodOffset(prev => prev - 1)}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[100px] text-center">
              {periodLabel}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPeriodOffset(prev => prev + 1)}
              disabled={periodOffset >= 0}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Timeframe buttons - styled like tabs */}
          <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
            <Button
              variant={timeframe === "monthly" ? "default" : "ghost"}
              size="sm"
              onClick={() => { setTimeframe("monthly"); setPeriodOffset(0); }}
              className={`h-8 px-4 text-sm font-medium transition-all ${
                timeframe === "monthly" 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "hover:bg-muted"
              }`}
            >
              {t('monthly')}
            </Button>
            <Button
              variant={timeframe === "quarterly" ? "default" : "ghost"}
              size="sm"
              onClick={() => { setTimeframe("quarterly"); setPeriodOffset(0); }}
              className={`h-8 px-4 text-sm font-medium transition-all ${
                timeframe === "quarterly" 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "hover:bg-muted"
              }`}
            >
              {t('quarterly')}
            </Button>
            <Button
              variant={timeframe === "yearly" ? "default" : "ghost"}
              size="sm"
              onClick={() => { setTimeframe("yearly"); setPeriodOffset(0); }}
              className={`h-8 px-4 text-sm font-medium transition-all ${
                timeframe === "yearly" 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "hover:bg-muted"
              }`}
            >
              {t('yearly')}
            </Button>
          </div>

          {/* Manage Budgets button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsManagementOpen(prev => !prev)}
            className="h-8 px-3 gap-1.5"
          >
            <Settings2 className="h-4 w-4" />
            {t('manageBudgets')}
          </Button>
        </div>
      </div>

      {/* Budget Management Panel - inline collapsible */}
      {isManagementOpen && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-lg font-semibold">{t('budgetManagement')}</CardTitle>
                <CardDescription>{t('budgetManagementDescriptionMonthly')}</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsManagementOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Monthly budget indicator */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4" />
                <span>{t('monthlyBudgetsNote')}</span>
              </div>

              {/* Category budget rows */}
              <div className="grid gap-3">
                {budgetableCategories.map(category => {
                  const goal = getGoalForCategory(category.id);
                  const spent = filteredExpenses.find(e => e.categoryId === category.id);
                  const spentAmount = spent ? Math.abs(parseFloat(spent.totalAmount) || 0) : 0;
                  const hasEditedValue = category.id in editedBudgets;
                  const displayAmount = hasEditedValue 
                    ? editedBudgets[category.id] 
                    : (goal?.amount || "");

                  return (
                    <div 
                      key={category.id} 
                      className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                    >
                      {/* Category info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div 
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: category.color || '#9E9E9E' }}
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">
                            {t(`categories.${category.id}`, { defaultValue: category.name })}
                          </div>
                          {spentAmount > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {t('spent')}: {formatCurrency(spentAmount)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Budget input */}
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="100"
                          placeholder={t('noBudget')}
                          value={displayAmount}
                          onChange={(e) => setEditedBudgets(prev => ({
                            ...prev,
                            [category.id]: e.target.value
                          }))}
                          className="w-32 h-8 text-right"
                        />
                        
                        {/* Save button - shows when value changed */}
                        {hasEditedValue && editedBudgets[category.id] !== (goal?.amount || "") && (
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={() => handleSaveInlineBudget(category.id)}
                            disabled={upsertMutation.isPending}
                          >
                            {tc('buttons.save')}
                          </Button>
                        )}

                        {/* Status badge */}
                        {goal && !hasEditedValue && (
                          <Badge variant="secondary" className="shrink-0">
                            {parseFloat(goal.amount) > 0
                              ? `${Math.round(spentAmount / parseFloat(goal.amount) * 100)}%`
                              : t('active')
                            }
                          </Badge>
                        )}

                        {/* Delete button */}
                        {goal && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-destructive/20"
                            onClick={() => handleDeleteBudget(goal)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      <BudgetingSummary
        totalIncome={totalIncome}
        totalExpenses={totalExpenses}
        netBalance={netBalance}
        isLoading={isLoading}
      />

      {/* Expenses Chart */}
      <BudgetCategoryChart
        categories={filteredExpenses}
        uncategorizedAmount={parseFloat(report?.uncategorizedExpenses || "0")}
        uncategorizedCount={report?.uncategorizedTransactionCount || 0}
        startDate={startDate}
        endDate={endDate}
        timeframe={timeframe}
        isLoading={isLoading}
      />

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  );
}
