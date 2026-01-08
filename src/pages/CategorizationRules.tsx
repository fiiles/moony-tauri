/**
 * Categorization Rules Management Page
 * 
 * Allows users to view, edit, and delete learned rules,
 * as well as create and manage custom pattern-based rules.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { categorizationApi, bankAccountsApi, type CustomRule } from '@/lib/tauri-api';
import { 
  Trash2, 
  Search, 
  Info, 
  Plus, 
  BookOpen, 
  Settings2,
  User,
  Building,
  AlertCircle,
} from 'lucide-react';
import CategorySelector from '@/components/bank-accounts/CategorySelector';
import RuleEditDialog from '@/components/categorization/RuleEditDialog';

// Helper to format IBAN for display - shows Czech BBAN format if applicable
function formatIbanDisplay(iban: string | undefined | null): string {
  if (!iban) return '';
  const normalized = iban.replace(/\s/g, '').toUpperCase();
  // Convert Czech IBAN to BBAN format
  if (normalized.startsWith('CZ') && normalized.length === 24) {
    const bankCode = normalized.slice(4, 8);
    const prefix = normalized.slice(8, 14).replace(/^0+/, '');
    const accountNumber = normalized.slice(14).replace(/^0+/, '');
    if (prefix) {
      return `${prefix}-${accountNumber}/${bankCode}`;
    }
    return `${accountNumber}/${bankCode}`;
  }
  return iban;
}

// Rule type badge component
function RuleTypeBadge({ 
  ruleType, 
  t 
}: { 
  ruleType: string; 
  t: (key: string) => string 
}) {
  const badgeColors: Record<string, string> = {
    payee_default: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    iban_only_default: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    iban_default: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  };

  const icons: Record<string, React.ReactNode> = {
    payee_default: <User className="h-3 w-3" />,
    iban_only_default: <Building className="h-3 w-3" />,
    iban_default: <><User className="h-3 w-3" /><Building className="h-3 w-3" /></>,
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={`flex items-center gap-1 ${badgeColors[ruleType] || ''}`}>
          {icons[ruleType]}
          <span>{t(`learnedRules.ruleTypes.${ruleType}`)}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>{t(`learnedRules.ruleTypeTooltips.${ruleType}`)}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function CategorizationRules() {
  const { t } = useTranslation('categorization');
  const { t: tCommon } = useTranslation('common');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [activeTab, setActiveTab] = useState<'learned' | 'custom'>('learned');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single' | 'bulk'; id?: string } | null>(null);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CustomRule | null>(null);

  // Queries
  const { data: learnedRules = [], isLoading: loadingLearned } = useQuery({
    queryKey: ['learnedPayees'],
    queryFn: () => categorizationApi.getLearnedPayees(),
  });

  const { data: customRules = [], isLoading: loadingCustom } = useQuery({
    queryKey: ['customRules'],
    queryFn: () => categorizationApi.getCustomRules(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => bankAccountsApi.getCategories(),
  });

  // Mutations
  const deleteLearnedMutation = useMutation({
    mutationFn: (id: string) => categorizationApi.deleteLearnedPayee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learnedPayees'] });
      toast({ title: t('learnedRules.deleteSuccess') });
    },
    onError: () => {
      toast({ title: t('errors.deleteFailed'), variant: 'destructive' });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => categorizationApi.deleteLearnedPayeesBulk(ids),
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['learnedPayees'] });
      setSelectedIds(new Set());
      toast({ title: t('learnedRules.bulkDeleteSuccess', { count: ids.length }) });
    },
    onError: () => {
      toast({ title: t('errors.deleteFailed'), variant: 'destructive' });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string }) =>
      categorizationApi.updateLearnedPayeeCategory(id, categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learnedPayees'] });
      toast({ title: t('learnedRules.updateCategorySuccess') });
    },
    onError: () => {
      toast({ title: t('errors.updateFailed'), variant: 'destructive' });
    },
  });

  const deleteCustomRuleMutation = useMutation({
    mutationFn: (id: string) => categorizationApi.deleteCustomRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customRules'] });
      toast({ title: t('customRules.deleteSuccess') });
    },
    onError: () => {
      toast({ title: t('errors.deleteFailed'), variant: 'destructive' });
    },
  });

  // Filter rules by search query
  const filteredLearnedRules = learnedRules.filter((rule) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      rule.originalPayee?.toLowerCase().includes(query) ||
      rule.normalizedPayee?.toLowerCase().includes(query) ||
      rule.counterpartyIban?.toLowerCase().includes(query) ||
      getCategoryName(rule.categoryId)?.toLowerCase().includes(query)
    );
  });

  const filteredCustomRules = customRules.filter((rule) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      rule.name.toLowerCase().includes(query) ||
      rule.pattern.toLowerCase().includes(query) ||
      getCategoryName(rule.categoryId)?.toLowerCase().includes(query)
    );
  });

  // Helpers
  function getCategoryName(categoryId: string): string {
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || categoryId;
  }

  function handleDeleteClick(type: 'single' | 'bulk', id?: string) {
    setDeleteTarget({ type, id });
    setDeleteDialogOpen(true);
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    
    if (activeTab === 'learned') {
      if (deleteTarget.type === 'bulk') {
        bulkDeleteMutation.mutate(Array.from(selectedIds));
      } else if (deleteTarget.id) {
        deleteLearnedMutation.mutate(deleteTarget.id);
      }
    } else {
      if (deleteTarget.id) {
        deleteCustomRuleMutation.mutate(deleteTarget.id);
      }
    }
    
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  }

  function handleSelectAll() {
    if (selectedIds.size === filteredLearnedRules.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLearnedRules.map((r) => r.id)));
    }
  }

  function handleSelectOne(id: string) {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  }

  function handleEditRule(rule: CustomRule) {
    setEditingRule(rule);
    setRuleDialogOpen(true);
  }

  function handleAddRule() {
    setEditingRule(null);
    setRuleDialogOpen(true);
  }

  function handleRuleDialogClose() {
    setRuleDialogOpen(false);
    setEditingRule(null);
    queryClient.invalidateQueries({ queryKey: ['customRules'] });
  }

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="page-title">{t('title')}</h1>
        <p className="page-subtitle">{t('subtitle')}</p>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="flex items-start gap-3 pt-4">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {t('learnedRules.hierarchyInfo')}
          </p>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'learned' | 'custom')}>
        <div className="flex items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="learned" className="gap-2">
              <BookOpen className="h-4 w-4" />
              {t('tabs.learnedRules')}
              <Badge variant="secondary" className="ml-1">
                {learnedRules.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="custom" className="gap-2">
              <Settings2 className="h-4 w-4" />
              {t('tabs.customRules')}
              <Badge variant="secondary" className="ml-1">
                {customRules.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={tCommon('labels.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pl-9"
              />
            </div>

            {/* Bulk delete button for learned rules */}
            {activeTab === 'learned' && selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteClick('bulk')}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('learnedRules.bulkDelete')} ({selectedIds.size})
              </Button>
            )}

            {/* Add rule button for custom rules */}
            {activeTab === 'custom' && (
              <Button onClick={handleAddRule}>
                <Plus className="h-4 w-4 mr-2" />
                {t('customRules.addRule')}
              </Button>
            )}
          </div>
        </div>

        {/* Learned Rules Tab */}
        <TabsContent value="learned" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('learnedRules.title')}</CardTitle>
              <CardDescription>{t('learnedRules.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLearned ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">{tCommon('status.loading')}</p>
                </div>
              ) : filteredLearnedRules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold">{t('learnedRules.noRules')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('learnedRules.noRulesDescription')}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 align-middle">
                        <Checkbox
                          checked={selectedIds.size === filteredLearnedRules.length && filteredLearnedRules.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>{t('learnedRules.columns.ruleType')}</TableHead>
                      <TableHead>{t('learnedRules.columns.payee')}</TableHead>
                      <TableHead>{t('learnedRules.columns.iban')}</TableHead>
                      <TableHead>{t('learnedRules.columns.category')}</TableHead>
                      <TableHead className="w-20">{tCommon('labels.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLearnedRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="align-middle">
                          <Checkbox
                            checked={selectedIds.has(rule.id)}
                            onCheckedChange={() => handleSelectOne(rule.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <RuleTypeBadge ruleType={rule.ruleType} t={t} />
                        </TableCell>
                        <TableCell className="font-medium">
                          {rule.originalPayee || rule.normalizedPayee || '—'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatIbanDisplay(rule.counterpartyIban) || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="w-48">
                            <CategorySelector
                              currentCategoryId={rule.categoryId}
                              categories={categories}
                              onCategoryChange={(categoryId) => {
                                if (categoryId) {
                                  updateCategoryMutation.mutate({ id: rule.id, categoryId });
                                }
                              }}
                              compact
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick('single', rule.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Rules Tab */}
        <TabsContent value="custom" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('customRules.title')}</CardTitle>
              <CardDescription>{t('customRules.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCustom ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">{tCommon('status.loading')}</p>
                </div>
              ) : filteredCustomRules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold">{t('customRules.noRules')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('customRules.noRulesDescription')}
                  </p>
                  <Button className="mt-4" onClick={handleAddRule}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('customRules.addRule')}
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('customRules.columns.name')}</TableHead>
                      <TableHead>{t('customRules.columns.type')}</TableHead>
                      <TableHead>{t('customRules.columns.pattern')}</TableHead>
                      <TableHead>{t('customRules.columns.category')}</TableHead>
                      <TableHead className="text-center">{t('customRules.columns.priority')}</TableHead>
                      <TableHead className="text-center">{t('customRules.columns.active')}</TableHead>
                      <TableHead className="w-20">{tCommon('labels.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">
                          {rule.name}
                          {rule.isSystem && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {t('customRules.systemRule')}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t('customRules.systemRuleTooltip')}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {t(`customRules.ruleTypes.${rule.ruleType}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm max-w-[200px] truncate">
                          {rule.pattern}
                        </TableCell>
                        <TableCell>
                          <Badge style={{ backgroundColor: categories.find(c => c.id === rule.categoryId)?.color || undefined }}>
                            {getCategoryName(rule.categoryId)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{rule.priority}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                            {rule.isActive ? '✓' : '—'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditRule(rule)}
                              disabled={rule.isSystem}
                            >
                              <Settings2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick('single', rule.id)}
                              disabled={rule.isSystem}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.type === 'bulk'
                ? t('learnedRules.bulkDeleteConfirmTitle')
                : activeTab === 'learned'
                ? t('learnedRules.deleteConfirmTitle')
                : t('customRules.deleteConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'bulk'
                ? t('learnedRules.bulkDeleteConfirmDescription', { count: selectedIds.size })
                : activeTab === 'learned'
                ? t('learnedRules.deleteConfirmDescription')
                : t('customRules.deleteConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tCommon('buttons.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rule Edit Dialog */}
      <RuleEditDialog
        open={ruleDialogOpen}
        onOpenChange={handleRuleDialogClose}
        rule={editingRule}
        categories={categories}
      />
    </div>
  );
}
