import { useState, useMemo, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { budgetingApi, type InsertBudgetGoal, type BudgetGoal } from "@/lib/tauri-api";
import type { TransactionCategory } from "@shared/schema";
import { Trash2, Tag, ShoppingCart, Utensils, Car, Zap, Film, Heart, Home, Briefcase, Plane, Gift, Coffee, Gamepad2, Dumbbell, PiggyBank, TrendingUp, type LucideProps } from "lucide-react";

// Simple icon map for category display
const ICON_MAP: Record<string, ComponentType<LucideProps>> = {
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
  'tag': Tag,
};

function getCategoryIcon(iconName: string | null | undefined): ComponentType<LucideProps> {
  return ICON_MAP[iconName || 'tag'] || Tag;
}

interface BudgetGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId?: string;
  categories: TransactionCategory[];
  existingGoal?: BudgetGoal;
  timeframe: string;
}

/**
 * Dialog for setting/editing budget goals per category
 */
export default function BudgetGoalDialog({
  open,
  onOpenChange,
  categoryId,
  categories,
  existingGoal,
  timeframe,
}: BudgetGoalDialogProps) {
  const { t } = useTranslation('budgeting');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Initialize state from props
  const initialCategoryId = categoryId || existingGoal?.categoryId || "";
  const initialAmount = existingGoal?.amount || "";
  const initialTimeframe = existingGoal?.timeframe || timeframe;

  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategoryId);
  const [amount, setAmount] = useState(initialAmount);
  const [selectedTimeframe, setSelectedTimeframe] = useState(initialTimeframe);

  // Reset form when props change (controlled by useMemo to avoid effect)
  useMemo(() => {
    if (open) {
      setSelectedCategoryId(categoryId || existingGoal?.categoryId || "");
      setAmount(existingGoal?.amount || "");
      setSelectedTimeframe(existingGoal?.timeframe || timeframe);
    }
  }, [open, categoryId, existingGoal, timeframe]);

  const upsertMutation = useMutation({
    mutationFn: (data: InsertBudgetGoal) => budgetingApi.upsertBudgetGoal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgeting-report'] });
      queryClient.invalidateQueries({ queryKey: ['budget-goals'] });
      toast({ title: t('goalSaved') });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => budgetingApi.deleteBudgetGoal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgeting-report'] });
      queryClient.invalidateQueries({ queryKey: ['budget-goals'] });
      toast({ title: t('goalDeleted') });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId || !amount) return;

    upsertMutation.mutate({
      categoryId: selectedCategoryId,
      timeframe: selectedTimeframe,
      amount,
    });
  };

  const handleDelete = () => {
    if (existingGoal) {
      deleteMutation.mutate(existingGoal.id);
    }
  };

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const IconComponent = selectedCategory ? getCategoryIcon(selectedCategory.icon) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {existingGoal ? t('editBudgetGoal') : t('setBudgetGoal')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category selector */}
          <div className="space-y-2">
            <Label htmlFor="category">{t('category')}</Label>
            <Select 
              value={selectedCategoryId} 
              onValueChange={setSelectedCategoryId}
              disabled={!!categoryId}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder={t('selectCategory')}>
                  {selectedCategory && (
                    <div className="flex items-center gap-2">
                      {IconComponent && (
                        <IconComponent 
                          className="h-4 w-4" 
                          style={{ color: selectedCategory.color || '#9E9E9E' }}
                        />
                      )}
                      <span>
                        {t(`categories.${selectedCategory.id}`, { defaultValue: selectedCategory.name })}
                      </span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories
                  .filter(c => c.id !== 'cat_income' && c.id !== 'cat_internal_transfers')
                  .map((cat) => {
                    const CatIcon = getCategoryIcon(cat.icon);
                    return (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <CatIcon 
                            className="h-4 w-4" 
                            style={{ color: cat.color || '#9E9E9E' }}
                          />
                          <span>{t(`categories.${cat.id}`, { defaultValue: cat.name })}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
          </div>

          {/* Timeframe selector */}
          <div className="space-y-2">
            <Label htmlFor="timeframe">{t('timeframe')}</Label>
            <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
              <SelectTrigger id="timeframe">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">{t('monthly')}</SelectItem>
                <SelectItem value="quarterly">{t('quarterly')}</SelectItem>
                <SelectItem value="yearly">{t('yearly')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount input */}
          <div className="space-y-2">
            <Label htmlFor="amount">{t('budgetAmount')}</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="5000"
            />
          </div>

          <DialogFooter className="flex justify-between">
            <div>
              {existingGoal && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t('delete')}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button 
                type="submit" 
                disabled={!selectedCategoryId || !amount || upsertMutation.isPending}
              >
                {t('save')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
