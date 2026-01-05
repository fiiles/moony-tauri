import { useState } from "react";
import { ChevronDown, ChevronRight, Target, Tag, ShoppingCart, Utensils, Car, Zap, Film, Heart, Home, Briefcase, Plane, Gift, Coffee, Gamepad2, Dumbbell, PiggyBank, TrendingUp, HelpCircle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "react-i18next";
import BudgetProgressBar from "./BudgetProgressBar";
import type { CategorySpendingSummary } from "@/lib/tauri-api";
import { budgetingApi } from "@/lib/tauri-api";
import { useQuery } from "@tanstack/react-query";
import { CategorySelector } from "@/components/bank-accounts/CategorySelector";
import type { TransactionCategory } from "@shared/schema";

// Simple icon map for category display
const ICON_MAP: Record<string, LucideIcon> = {
  'shopping-cart': ShoppingCart,
  'utensils': Utensils,
  'car': Car,
  'zap': Zap,
  'film': Film,
  'heart': Heart,
  'home': Home,
  'briefcase': Briefcase,
  'plane': Plane,
  'gift': Gift,
  'coffee': Coffee,
  'gamepad-2': Gamepad2,
  'dumbbell': Dumbbell,
  'piggy-bank': PiggyBank,
  'trending-up': TrendingUp,
  'help-circle': HelpCircle,
  'tag': Tag,
};

function getCategoryIcon(iconName: string | null | undefined): LucideIcon {
  return ICON_MAP[iconName || 'tag'] || Tag;
}

interface BudgetingCategoryRowProps {
  category: CategorySpendingSummary;
  startDate: number;
  endDate: number;
  onSetBudget?: (categoryId: string) => void;
  categories: TransactionCategory[];
  onCategoryChange?: (transactionId: string, categoryId: string | null) => void;
  isExpense?: boolean;
}

/**
 * Expandable category row for budgeting view
 * Shows category name, total spent, budget progress, and expandable transaction list
 */
export default function BudgetingCategoryRow({
  category,
  startDate,
  endDate,
  onSetBudget,
  categories,
  onCategoryChange,
  isExpense = true,
}: BudgetingCategoryRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation('budgeting');

  // Fetch transactions when expanded
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['budgeting-category-transactions', category.categoryId, startDate, endDate],
    queryFn: () => budgetingApi.getCategoryTransactions(category.categoryId, startDate, endDate),
    enabled: isOpen,
  });

  const totalAmount = parseFloat(category.totalAmount) || 0;
  const hasBudget = !!category.budgetGoal;
  const budgetAmount = hasBudget ? parseFloat(category.budgetGoal!.amount) || 0 : 0;

  // Get category icon component
  const IconComponent = getCategoryIcon(category.categoryIcon);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <Card className="bg-card/50 border">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="p-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left side: expand button + icon + name + count */}
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="flex items-center gap-3 p-0 h-auto hover:bg-transparent flex-1 justify-start"
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                
                {/* Category icon */}
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: category.categoryColor ? `${category.categoryColor}20` : '#9E9E9E20' }}
                >
                  <IconComponent 
                    className="h-4 w-4" 
                    style={{ color: category.categoryColor || '#9E9E9E' }} 
                  />
                </div>
                
                <div className="flex flex-col items-start">
                  <span className="font-medium text-sm">
                    {t(`categories.${category.categoryId}`, { defaultValue: category.categoryName })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {category.transactionCount} {t('transactions')}
                  </span>
                </div>
              </Button>
            </CollapsibleTrigger>

            {/* Right side: budget progress or set budget button + amount */}
            <div className="flex items-center gap-4">
              {/* Budget progress or set budget */}
              {isExpense && (
                <div className="w-32">
                  {hasBudget ? (
                    <BudgetProgressBar 
                      spent={totalAmount} 
                      budget={budgetAmount}
                      showLabels={true}
                    />
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetBudget?.(category.categoryId);
                      }}
                    >
                      <Target className="h-3 w-3 mr-1" />
                      {t('setBudget')}
                    </Button>
                  )}
                </div>
              )}

              {/* Amount */}
              <span className={`font-semibold text-sm min-w-[100px] text-right ${
                isExpense ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
              }`}>
                {isExpense ? '-' : '+'}{formatCurrency(totalAmount)}
              </span>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4">
            {isLoading ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                {t('loading')}
              </div>
            ) : transactions.length > 0 ? (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-md border text-sm"
                  >
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {tx.counterpartyName || tx.description || t('noDescription')}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDate(tx.bookingDate)}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground truncate">
                        {tx.bankAccountName}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Category selector for uncategorized transactions */}
                      {!tx.categoryId && onCategoryChange && (
                        <div className="w-32">
                          <CategorySelector
                            categories={categories}
                            currentCategoryId={tx.categoryId}
                            onCategoryChange={(newCategoryId) => onCategoryChange(tx.id, newCategoryId)}
                            compact
                          />
                        </div>
                      )}

                      <span className={`font-medium ${
                        tx.txType.toLowerCase() === 'credit' 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {tx.txType.toLowerCase() === 'credit' ? '+' : '-'}
                        {formatCurrency(Math.abs(parseFloat(tx.amount)))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('noTransactions')}
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
