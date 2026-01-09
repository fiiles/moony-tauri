/**
 * Rule Edit Dialog Component
 * 
 * Dialog for creating and editing custom categorization rules.
 */
import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { categorizationApi, type CustomRule, type CustomRuleInput } from '@/lib/tauri-api';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import type { TransactionCategory } from '@shared/schema';

interface RuleEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: CustomRule | null;
  categories: TransactionCategory[];
}

const RULE_TYPES = [
  'Contains',
  'Regex',
  'StartsWith',
  'EndsWith',
] as const;

// Rule mode: either pattern-based (text matching) or IBAN-based (exact account matching)
type RuleMode = 'pattern' | 'iban';

export default function RuleEditDialog({
  open,
  onOpenChange,
  rule,
  categories,
}: RuleEditDialogProps) {
  const { t } = useTranslation('categorization');
  const { t: tCommon } = useTranslation('common');
  const { toast } = useToast();

  // Determine initial mode: if rule has IBAN pattern but no text pattern, it's IBAN-based
  const getInitialMode = (r: CustomRule | null): RuleMode => {
    if (!r) return 'pattern'; // Default to pattern for new rules
    // If there's an IBAN pattern and no meaningful text pattern, it's IBAN mode
    if (r.ibanPattern && (!r.pattern || r.pattern === '*')) return 'iban';
    return 'pattern';
  };

  // Compute initial values based on rule prop
  const initialMode = getInitialMode(rule);
  const initialName = rule?.name ?? '';
  const initialRuleType = rule?.ruleType ?? 'Contains';
  const initialPattern = rule?.pattern ?? '';
  const initialCategoryId = rule?.categoryId ?? categories[0]?.id ?? '';
  const initialPriority = rule?.priority ?? 50;
  const initialIsActive = rule?.isActive ?? true;
  const initialStopProcessing = rule?.stopProcessing ?? false;
  const initialIbanPattern = rule?.ibanPattern ?? '';
  const initialVariableSymbol = rule?.variableSymbol ?? '';

  // Form state - initialized from rule or defaults
  const [ruleMode, setRuleMode] = useState<RuleMode>(initialMode);
  const [name, setName] = useState(initialName);
  const [ruleType, setRuleType] = useState<string>(initialRuleType);
  const [pattern, setPattern] = useState(initialPattern);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [priority, setPriority] = useState(initialPriority);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [stopProcessing, setStopProcessing] = useState(initialStopProcessing);
  const [ibanPattern, setIbanPattern] = useState(initialIbanPattern);
  const [variableSymbol, setVariableSymbol] = useState(initialVariableSymbol);

  // Reset form when rule changes (using key prop pattern in parent is more idiomatic,
  // but this handles the case where dialog stays mounted)
  const ruleId = rule?.id ?? 'new';
  useEffect(() => {
    // Only reset when the rule actually changes (not on every render)
    setRuleMode(getInitialMode(rule));
    setName(rule?.name ?? '');
    setRuleType(rule?.ruleType ?? 'Contains');
    setPattern(rule?.pattern ?? '');
    setCategoryId(rule?.categoryId ?? categories[0]?.id ?? '');
    setPriority(rule?.priority ?? 50);
    setIsActive(rule?.isActive ?? true);
    setStopProcessing(rule?.stopProcessing ?? false);
    setIbanPattern(rule?.ibanPattern ?? '');
    setVariableSymbol(rule?.variableSymbol ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleId]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CustomRuleInput) => categorizationApi.createCustomRule(data),
    onSuccess: () => {
      toast({ title: t('customRules.createSuccess') });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: t('errors.createFailed'), variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CustomRuleInput }) =>
      categorizationApi.updateCustomRule(id, data),
    onSuccess: () => {
      toast({ title: t('customRules.updateSuccess') });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: t('errors.updateFailed'), variant: 'destructive' });
    },
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // For IBAN mode, use a wildcard pattern so the rule engine still processes it
    // The actual matching is done via iban_pattern/variable_symbol
    const data: CustomRuleInput = {
      name,
      ruleType: ruleMode === 'iban' ? 'Contains' : ruleType,
      pattern: ruleMode === 'iban' ? '*' : pattern,
      categoryId,
      priority,
      isActive,
      stopProcessing,
      ibanPattern: ruleMode === 'iban' ? (ibanPattern || undefined) : undefined,
      variableSymbol: ruleMode === 'iban' ? (variableSymbol || undefined) : undefined,
    };

    if (rule) {
      updateMutation.mutate({ id: rule.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {rule ? t('customRules.editRule') : t('customRules.addRule')}
            </DialogTitle>
            <DialogDescription>
              {t('customRules.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">{t('customRules.form.name')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('customRules.form.namePlaceholder')}
                required
              />
            </div>

            {/* Rule Mode Selector */}
            <div className="grid gap-2">
              <Label>{t('customRules.form.mode')}</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={ruleMode === 'pattern' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRuleMode('pattern')}
                  className="flex-1"
                >
                  {t('customRules.form.modePattern')}
                </Button>
                <Button
                  type="button"
                  variant={ruleMode === 'iban' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRuleMode('iban')}
                  className="flex-1"
                >
                  {t('customRules.form.modeIban')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {ruleMode === 'pattern' 
                  ? t('customRules.form.modePatternHelp')
                  : t('customRules.form.modeIbanHelp')
                }
              </p>
            </div>

            {/* Pattern-based fields */}
            {ruleMode === 'pattern' && (
              <>
                {/* Rule Type */}
                <div className="grid gap-2">
                  <Label htmlFor="ruleType">{t('customRules.form.type')}</Label>
                  <Select value={ruleType} onValueChange={setRuleType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(`customRules.ruleTypes.${type}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Pattern */}
                <div className="grid gap-2">
                  <Label htmlFor="pattern">{t('customRules.form.pattern')}</Label>
                  <Input
                    id="pattern"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    placeholder={t('customRules.form.patternPlaceholder')}
                    required={ruleMode === 'pattern'}
                    className="font-mono"
                  />
                </div>
              </>
            )}

            {/* IBAN-based fields */}
            {ruleMode === 'iban' && (
              <>
                {/* IBAN Pattern */}
                <div className="grid gap-2">
                  <Label htmlFor="ibanPattern">{t('customRules.form.ibanPatternRequired')}</Label>
                  <Input
                    id="ibanPattern"
                    value={ibanPattern}
                    onChange={(e) => setIbanPattern(e.target.value)}
                    placeholder={t('customRules.form.ibanPatternPlaceholder')}
                    className="font-mono"
                    required={ruleMode === 'iban'}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('customRules.form.ibanPatternHelp')}
                  </p>
                </div>

                {/* Variable Symbol (optional) */}
                <div className="grid gap-2">
                  <Label htmlFor="variableSymbol">{t('customRules.form.variableSymbol')}</Label>
                  <Input
                    id="variableSymbol"
                    value={variableSymbol}
                    onChange={(e) => setVariableSymbol(e.target.value)}
                    placeholder={t('customRules.form.variableSymbolPlaceholder')}
                    className="font-mono"
                  />
                </div>
              </>
            )}

            {/* Category */}
            <div className="grid gap-2">
              <Label htmlFor="category">{t('customRules.form.category')}</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <CategoryIcon iconName={category.icon || 'tag'} className="h-4 w-4" />
                        <span>{category.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="priority">{t('customRules.form.priority')}</Label>
                <Badge variant="outline">{priority}</Badge>
              </div>
              <Input
                id="priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 50)}
                min={1}
                max={100}
              />
              <p className="text-xs text-muted-foreground">
                {t('customRules.form.priorityHelp')}
              </p>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">{t('customRules.form.active')}</Label>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            {/* Stop Processing Toggle */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="stopProcessing">{t('customRules.form.stopProcessing')}</Label>
                <Switch
                  id="stopProcessing"
                  checked={stopProcessing}
                  onCheckedChange={setStopProcessing}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('customRules.form.stopProcessingHelp')}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {tCommon('buttons.cancel')}
            </Button>
            <Button 
              type="submit" 
              disabled={
                isLoading || 
                !name || 
                !categoryId || 
                (ruleMode === 'pattern' && !pattern) || 
                (ruleMode === 'iban' && !ibanPattern)
              }
            >
              {isLoading
                ? tCommon('status.saving')
                : rule
                ? tCommon('buttons.save')
                : tCommon('buttons.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
