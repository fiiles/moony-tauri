/**
 * CategorySelector - Category dropdown with learning and suggestion support
 * 
 * Shows a combobox for selecting transaction category with:
 * - Lucide icons mapped from database icon names
 * - Suggestion badge with confidence when ML suggested
 * - Learning on manual selection (toast notification)
 */

import { useState, useMemo, type ComponentType } from 'react';
import { 
  Check, 
  ChevronsUpDown, 
  Sparkles, 
  Tag,
  ShoppingCart,
  Utensils,
  Car,
  Zap,
  Film,
  ShoppingBag,
  Heart,
  Home,
  Briefcase,
  GraduationCap,
  Plane,
  Gift,
  Wallet,
  CreditCard,
  Building,
  Coffee,
  Gamepad2,
  Dumbbell,
  Phone,
  Wifi,
  Fuel,
  Bus,
  Train,
  Baby,
  PawPrint,
  Scissors,
  Shirt,
  PiggyBank,
  ArrowRightLeft,
  TrendingUp,
  Repeat,
  LineChart,
  Hammer,
  MoreHorizontal,
  Landmark,
  Shield,
  X,
  Brain,
  type LucideProps,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { categorizationApi, type CategorizationResult } from '@/lib/tauri-api';
import type { TransactionCategory } from '@shared/schema';
import { useTranslation } from 'react-i18next';

// Map Lucide icon names to components
const ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  'shopping-cart': ShoppingCart,
  'utensils': Utensils,
  'car': Car,
  'zap': Zap,
  'film': Film,
  'shopping-bag': ShoppingBag,
  'heart': Heart,
  'home': Home,
  'briefcase': Briefcase,
  'graduation-cap': GraduationCap,
  'plane': Plane,
  'gift': Gift,
  'wallet': Wallet,
  'credit-card': CreditCard,
  'building': Building,
  'coffee': Coffee,
  'gamepad-2': Gamepad2,
  'dumbbell': Dumbbell,
  'phone': Phone,
  'wifi': Wifi,
  'fuel': Fuel,
  'bus': Bus,
  'train': Train,
  'baby': Baby,
  'paw-print': PawPrint,
  'scissors': Scissors,
  'shirt': Shirt,
  // New category icons
  'piggy-bank': PiggyBank,
  'arrows-right-left': ArrowRightLeft,
  'trending-up': TrendingUp,
  'repeat': Repeat,
  'line-chart': LineChart,
  'hammer': Hammer,
  'more-horizontal': MoreHorizontal,
  'landmark': Landmark,
  'shield': Shield,
};

interface CategorySelectorProps {
  currentCategoryId?: string | null;
  categorizationResult?: CategorizationResult;
  counterpartyName?: string | null;
  counterpartyIban?: string | null;
  /** Variable symbol for hierarchical matching */
  variableSymbol?: string | null;
  categories: TransactionCategory[];
  onCategoryChange: (categoryId: string | null) => void;
  onDeclineSuggestion?: () => void;
  disabled?: boolean;
  compact?: boolean;
}

/** Get category display info */
function getCategoryDisplay(categoryId: string | null, categories: TransactionCategory[]) {
  if (!categoryId) return null;
  const category = categories.find(c => c.id === categoryId);
  if (!category) {
    console.warn(`Category not found: "${categoryId}". Available IDs:`, categories.slice(0, 5).map(c => c.id)); // Debug
    return null;
  }
  return {
    id: category.id,
    name: category.name,
    iconName: category.icon || 'tag',
    color: category.color || '#6b7280',
  };
}

/** Render icon component from name */
function CategoryIcon({ iconName, className }: { iconName: string; className?: string }) {
  const IconComponent = ICON_MAP[iconName] || Tag;
  return <IconComponent className={className} />;
}

/** Check if result is a suggestion with confidence */
function isSuggestion(result?: CategorizationResult): boolean {
  return result?.type === 'Suggestion';
}

export function CategorySelector({
  currentCategoryId,
  categorizationResult,
  counterpartyName,
  counterpartyIban,
  variableSymbol,
  categories,
  onCategoryChange,
  onDeclineSuggestion,
  disabled = false,
  compact = false,
}: CategorySelectorProps) {
  const { t } = useTranslation('bank_accounts');
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const currentCategory = useMemo(
    () => getCategoryDisplay(currentCategoryId ?? null, categories),
    [currentCategoryId, categories]
  );

  const suggestion = useMemo(() => {
    if (isSuggestion(categorizationResult) && categorizationResult?.type === 'Suggestion') {
      const cat = getCategoryDisplay(categorizationResult.data.categoryId, categories);
      return cat ? { ...cat, confidence: categorizationResult.data.confidence } : null;
    }
    return null;
  }, [categorizationResult, categories]);

  const handleSelect = async (categoryId: string, skipLearning: boolean = false) => {
    setOpen(false);
    if (categoryId === currentCategoryId) return;
    
    onCategoryChange(categoryId);

    // Skip learning if explicitly requested (one-time categorization)
    if (skipLearning) {
      return;
    }

    // Learn from counterparty details with hierarchical matching:
    // - payee + iban + vs = exact match
    // - payee + iban (null vs) = iban default
    // - payee only (null iban + vs) = payee default
    const payee = (counterpartyName && counterpartyName.trim().length > 2)
      ? counterpartyName.trim()
      : null;
    const iban = (counterpartyIban && counterpartyIban.trim().length > 5)
      ? counterpartyIban.trim()
      : null;
    const vs = (variableSymbol && variableSymbol.trim().length > 0)
      ? variableSymbol.trim()
      : null;

    // Only learn if we have at least payee or iban
    if (payee || iban) {
      try {
        await categorizationApi.learn(payee, iban, vs, categoryId);
        const category = getCategoryDisplay(categoryId, categories);
        const learnKey = payee || iban || 'unknown';
        toast({
          title: t('categorization.learned', 'Category learned'),
          description: `"${learnKey}" → ${category?.name || categoryId}`,
          duration: 3000,
        });
      } catch (e) {
        console.error('Failed to learn categorization:', e);
      }
    }
  };

  const handleAcceptSuggestion = () => {
    if (suggestion) {
      handleSelect(suggestion.id, false);
    }
  };

  const handleDeclineSuggestion = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeclineSuggestion?.();
  };

  // Compact mode for table cells
  if (compact) {
    if (currentCategory) {
      return (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs font-medium justify-start gap-1.5 hover:bg-muted"
              disabled={disabled}
            >
              <CategoryIcon 
                iconName={currentCategory.iconName} 
                className="h-3.5 w-3.5" 
              />
              <span className="truncate">{t(`categoryNames.${currentCategory.id}`, currentCategory.name)}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0" align="start">
            <CategoryCommandList
              categories={categories}
              selectedId={currentCategoryId}
              onSelect={handleSelect}
            />
          </PopoverContent>
        </Popover>
      );
    }

    // Show suggestion if available
    if (suggestion) {
      return (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs font-medium gap-1.5 border-dashed border-amber-400/50 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30 dark:border-amber-500/30"
            onClick={handleAcceptSuggestion}
            disabled={disabled}
          >
            <Sparkles className="h-3 w-3 text-amber-500" />
            <CategoryIcon iconName={suggestion.iconName} className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span className="truncate text-amber-700 dark:text-amber-300">{t(`categoryNames.${suggestion.id}`, suggestion.name)}</span>
            <Badge 
              variant="secondary" 
              className="h-4 px-1 text-[10px] bg-amber-200/50 text-amber-700 dark:bg-amber-800/50 dark:text-amber-300"
            >
              {Math.round(suggestion.confidence * 100)}%
            </Badge>
          </Button>
          {onDeclineSuggestion && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={handleDeclineSuggestion}
              disabled={disabled}
              title={t('categorization.declineSuggestion', 'Decline suggestion')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      );
    }

    // No category - show simple selector
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs font-normal text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5"
            disabled={disabled}
          >
            <Tag className="h-3.5 w-3.5" />
            <span>{t('categorization.selectCategory', 'Select...')}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0" align="start">
          <CategoryCommandList
            categories={categories}
            selectedId={currentCategoryId}
            onSelect={handleSelect}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Full-size combobox (non-compact mode)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
          disabled={disabled}
        >
          {currentCategory ? (
            <span className="flex items-center gap-2">
              <CategoryIcon iconName={currentCategory.iconName} className="h-4 w-4" />
              {currentCategory.name}
            </span>
          ) : suggestion ? (
            <span className="flex items-center gap-2 text-amber-600">
              <Sparkles className="h-4 w-4" />
              {suggestion.name} ({Math.round(suggestion.confidence * 100)}%)
            </span>
          ) : (
            <span className="text-muted-foreground">
              {t('categorization.selectCategory', 'Select category...')}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0">
        <CategoryCommandList
          categories={categories}
          selectedId={currentCategoryId}
          onSelect={handleSelect}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Category command list used in popovers */
function CategoryCommandList({
  categories,
  selectedId,
  onSelect,
}: {
  categories: TransactionCategory[];
  selectedId?: string | null;
  onSelect: (id: string, skipLearning: boolean) => void;
}) {
  const { t } = useTranslation('bank_accounts');
  const [rememberForFuture, setRememberForFuture] = useState(true);

  // Sort categories by sortOrder
  const sortedCategories = useMemo(() => {
    return [...categories]
      .filter(c => !c.parentId)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [categories]);

  return (
    <Command>
      <CommandInput placeholder={t('categorization.searchCategory', 'Search...')} />
      <CommandList className="max-h-[300px]">
        <CommandEmpty>{t('categorization.noCategory', 'No category found')}</CommandEmpty>
        <CommandGroup>
          {sortedCategories.map((category) => (
            <CommandItem
              key={category.id}
              value={category.name}
              onSelect={() => onSelect(category.id, !rememberForFuture)}
              className="flex items-center gap-2 py-2"
            >
              <Check
                className={cn(
                  'h-4 w-4 shrink-0',
                  selectedId === category.id ? 'opacity-100' : 'opacity-0'
                )}
              />
              <CategoryIcon 
                iconName={category.icon || 'tag'} 
                className="h-4 w-4 shrink-0 text-muted-foreground"
              />
              <span className="truncate">{t(`categoryNames.${category.id}`, category.name)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      {/* Toggle for learning preference */}
      <div className="border-t px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-muted-foreground" />
            <Label 
              htmlFor="remember-toggle" 
              className="text-xs text-muted-foreground cursor-pointer"
            >
              {t('categorization.rememberForFuture', 'Remember for future')}
            </Label>
          </div>
          <Switch
            id="remember-toggle"
            checked={rememberForFuture}
            onCheckedChange={setRememberForFuture}
            className="scale-75 data-[state=unchecked]:bg-muted-foreground/30 data-[state=unchecked]:border data-[state=unchecked]:border-muted-foreground/40"
          />
        </div>
      </div>
    </Command>
  );
}

export default CategorySelector;
