import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { budgetingApi, bankAccountsApi } from "@/lib/tauri-api";
import { BudgetingSummary } from "@/components/budgeting/BudgetingSummary";
import { BudgetCategoryChart } from "@/components/budgeting/BudgetCategoryChart";
import BudgetGoalDialog from "@/components/budgeting/BudgetGoalDialog";

type Timeframe = "monthly" | "quarterly" | "yearly";

/**
 * Budgeting Report Page
 * 
 * Visualizes spending across all accounts by category,
 * with expandable transaction details and budget goal tracking.
 * Monarch-inspired premium UX design.
 */
export default function Budgeting() {
  const { t } = useTranslation('budgeting');

  // State
  const [timeframe, setTimeframe] = useState<Timeframe>("monthly");
  const [periodOffset, setPeriodOffset] = useState(0);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [selectedCategoryId] = useState<string | undefined>();

  // Calculate date range based on timeframe and offset
  const { startDate, endDate, periodLabel } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date;
    let label: string;

    if (timeframe === "monthly") {
      start = new Date(now.getFullYear(), now.getMonth() + periodOffset, 1);
      end = new Date(now.getFullYear(), now.getMonth() + periodOffset + 1, 0);
      label = start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
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
  }, [timeframe, periodOffset]);

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

  // Find existing budget goal for selected category
  const selectedGoal = useMemo(() => {
    if (!selectedCategoryId || !report) return undefined;
    const category = (report.expenseCategories || [])
      .find(c => c.categoryId === selectedCategoryId);
    return category?.budgetGoal;
  }, [selectedCategoryId, report]);

  // Calculate stats (exclude internal transfers and income from expenses)
  const filteredExpenses = useMemo(() => {
    return (report?.expenseCategories || [])
      .filter(c => 
        c.categoryId !== 'cat_internal_transfers' && 
        c.categoryId !== 'cat_income'
      );
  }, [report?.expenseCategories]);

  const totalIncome = parseFloat(report?.totalIncome || "0");
  const totalExpenses = filteredExpenses.reduce(
    (sum, cat) => sum + Math.abs(parseFloat(cat.totalAmount) || 0), 
    0
  ) + Math.abs(parseFloat(report?.uncategorizedExpenses || "0"));
  
  const netBalance = totalIncome - totalExpenses;
  const categoriesOverBudget = filteredExpenses
    .filter(c => c.budgetPercentage && c.budgetPercentage > 100).length;

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
        </div>
      </div>

      {/* Summary cards */}
      <BudgetingSummary
        totalIncome={totalIncome}
        totalExpenses={totalExpenses}
        netBalance={netBalance}
        categoriesOverBudget={categoriesOverBudget}
        isLoading={isLoading}
      />

      {/* Expenses Chart */}
      <BudgetCategoryChart
        categories={filteredExpenses}
        uncategorizedAmount={parseFloat(report?.uncategorizedExpenses || "0")}
        uncategorizedCount={report?.uncategorizedTransactionCount || 0}
        startDate={startDate}
        endDate={endDate}
        isLoading={isLoading}
      />

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      )}

      {/* Budget goal dialog */}
      <BudgetGoalDialog
        open={budgetDialogOpen}
        onOpenChange={setBudgetDialogOpen}
        categoryId={selectedCategoryId}
        categories={categories}
        existingGoal={selectedGoal}
        timeframe={timeframe}
      />
    </div>
  );
}
