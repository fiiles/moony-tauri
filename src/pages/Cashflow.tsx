import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cashflowApi } from "@/lib/tauri-api";
import CashflowViewSelector, { type CashflowViewType } from "@/components/cashflow/CashflowViewSelector";
import CashflowCategory from "@/components/cashflow/CashflowCategory";
import CashflowSankeyChart from "@/components/cashflow/CashflowSankeyChart";
import AddCashflowItemDialog from "@/components/cashflow/AddCashflowItemDialog";
import { SummaryCard } from "@/components/common/SummaryCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, Plus } from "lucide-react";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { CashflowReport, CashflowReportItem, CashflowCategory as CashflowCategoryType } from "@shared/schema";

export default function Cashflow() {
    const { t } = useTranslation('reports');
    const { t: tc } = useTranslation('common');
    const { formatCurrency } = useCurrency();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [viewType, setViewType] = useState<CashflowViewType>('monthly');
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [addDialogType, setAddDialogType] = useState<'income' | 'expense'>('income');
    const [addDialogSection, setAddDialogSection] = useState<'personal' | 'investments'>('personal');
    const [editItem, setEditItem] = useState<CashflowReportItem | null>(null);
    const [editCategory, setEditCategory] = useState<string>("");
    const [editSection, setEditSection] = useState<'personal' | 'investments'>('personal');
    const [deleteItem, setDeleteItem] = useState<CashflowReportItem | null>(null);

    // Fetch cashflow report
    const { data: report, isLoading } = useQuery<CashflowReport>({
        queryKey: ['cashflow-report', viewType],
        queryFn: () => cashflowApi.getReport(viewType),
        refetchOnMount: 'always',
    });

    // Create item mutation
    const createMutation = useMutation({
        mutationFn: cashflowApi.createItem,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cashflow-report'] });
            setAddDialogOpen(false);
            toast({ title: tc('status.success') });
        },
        onError: (error: Error) => {
            toast({ title: tc('status.error'), description: error.message, variant: 'destructive' });
        },
    });

    // Update item mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof cashflowApi.updateItem>[1] }) =>
            cashflowApi.updateItem(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cashflow-report'] });
            setEditItem(null);
            setEditCategory("");
            toast({ title: tc('status.success') });
        },
        onError: (error: Error) => {
            toast({ title: tc('status.error'), description: error.message, variant: 'destructive' });
        },
    });

    // Delete item mutation
    const deleteMutation = useMutation({
        mutationFn: cashflowApi.deleteItem,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cashflow-report'] });
            setDeleteItem(null);
            toast({ title: tc('status.success') });
        },
        onError: (error: Error) => {
            toast({ title: tc('status.error'), description: error.message, variant: 'destructive' });
        },
    });

    const handleOpenAddDialog = (section: 'personal' | 'investments', type: 'income' | 'expense') => {
        setAddDialogSection(section);
        setAddDialogType(type);
        setAddDialogOpen(true);
    };

    const handleAddItem = (data: Parameters<typeof cashflowApi.createItem>[0]) => {
        createMutation.mutate(data);
    };

    const handleEditItem = (data: Parameters<typeof cashflowApi.createItem>[0]) => {
        if (editItem) {
            updateMutation.mutate({ id: editItem.id, data });
        }
    };

    const handleConfirmDelete = () => {
        if (deleteItem) {
            deleteMutation.mutate(deleteItem.id);
        }
    };

    const handleEditClick = (item: CashflowReportItem, categoryKey: string, section: 'personal' | 'investments') => {
        setEditItem(item);
        setEditCategory(categoryKey);
        setEditSection(section);
    };

    // Format currency without negative zero
    const formatAmount = (amount: number) => {
        const value = Math.abs(amount) < 0.01 ? 0 : amount;
        return formatCurrency(value);
    };

    // Get categories for add dialog based on section and type
    const getAddDialogCategories = (): CashflowCategoryType[] => {
        if (!report) return [];
        const section = addDialogSection === 'personal' ? report.personal : report.investments;
        return addDialogType === 'income' ? section.income : section.expenses;
    };

    // Get categories for edit dialog
    const getEditDialogCategories = (): CashflowCategoryType[] => {
        if (!report || !editItem) return [];
        const section = editSection === 'personal' ? report.personal : report.investments;
        const isIncome = section.income.some(c => c.key === editCategory);
        return isIncome ? section.income : section.expenses;
    };

    // Determine edit item type
    const getEditItemType = (): 'income' | 'expense' => {
        if (!report || !editItem || !editCategory) return 'income';
        const section = editSection === 'personal' ? report.personal : report.investments;
        return section.income.some(c => c.key === editCategory) ? 'income' : 'expense';
    };

    return (
        <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="page-title">{t('title')}</h1>
                    <p className="page-subtitle">{t('subtitle')}</p>
                </div>
                <CashflowViewSelector value={viewType} onChange={setViewType} />
            </div>

            {/* Overall Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCard
                    title={t('summary.totalIncome')}
                    value={formatAmount(report?.totalIncome ?? 0)}
                    icon={<TrendingUp className="h-4 w-4" />}
                />
                <SummaryCard
                    title={t('summary.totalExpenses')}
                    value={formatAmount(report?.totalExpenses ?? 0)}
                    icon={<TrendingDown className="h-4 w-4" />}
                />
                <SummaryCard
                    title={t('summary.netCashflow')}
                    value={formatAmount(report?.netCashflow ?? 0)}
                    icon={<Wallet className="h-4 w-4" />}
                    valueClassName={(report?.netCashflow ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
                />
            </div>

            {/* Overall Cashflow Sankey Chart */}
            {report && <CashflowSankeyChart report={report} />}

            {/* Personal Cashflow Section */}
            <Card>
                <CardContent className="pt-6">
                    <h2 className="text-xl font-semibold mb-6">{t('sections.personal')}</h2>
                    
                    {/* Section Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="p-4 bg-muted/50 border rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">{t('sections.personalIncome')}</span>
                                <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                                    {formatAmount(report?.personal?.totalIncome ?? 0)}
                                </span>
                            </div>
                        </div>
                        <div className="p-4 bg-muted/50 border rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">{t('sections.personalExpenses')}</span>
                                <span className="text-lg font-semibold text-red-600 dark:text-red-400">
                                    {formatAmount(report?.personal?.totalExpenses ?? 0)}
                                </span>
                            </div>
                        </div>
                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">{t('summary.netCashflow')}</span>
                                <span className={`text-lg font-semibold ${(report?.personal?.netCashflow ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatAmount(report?.personal?.netCashflow ?? 0)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Income and Expenses Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Income Column */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    {t('sections.income')}
                                </h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenAddDialog('personal', 'income')}
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    {t('addItem.title')}
                                </Button>
                            </div>

                            {isLoading ? (
                                <div className="text-center py-6 text-muted-foreground text-sm">{tc('status.loading')}</div>
                            ) : (
                                <div className="space-y-2">
                                    {report?.personal?.income.map((category) => (
                                        <CashflowCategory
                                            key={category.key}
                                            category={category}
                                            onEditItem={(item) => handleEditClick(item, category.key, 'personal')}
                                            onDeleteItem={(item) => setDeleteItem(item)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Expenses Column */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold flex items-center gap-2">
                                    <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                                    {t('sections.expenses')}
                                </h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenAddDialog('personal', 'expense')}
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    {t('addItem.title')}
                                </Button>
                            </div>

                            {isLoading ? (
                                <div className="text-center py-6 text-muted-foreground text-sm">{tc('status.loading')}</div>
                            ) : (
                                <div className="space-y-2">
                                    {report?.personal?.expenses.map((category) => (
                                        <CashflowCategory
                                            key={category.key}
                                            category={category}
                                            onEditItem={(item) => handleEditClick(item, category.key, 'personal')}
                                            onDeleteItem={(item) => setDeleteItem(item)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Investments Cashflow Section */}
            <Card>
                <CardContent className="pt-6">
                    <h2 className="text-xl font-semibold mb-6">{t('sections.investments')}</h2>
                    
                    {/* Section Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="p-4 bg-muted/50 border rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">{t('sections.investmentIncome')}</span>
                                <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                                    {formatAmount(report?.investments?.totalIncome ?? 0)}
                                </span>
                            </div>
                        </div>
                        <div className="p-4 bg-muted/50 border rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">{t('sections.investmentExpenses')}</span>
                                <span className="text-lg font-semibold text-red-600 dark:text-red-400">
                                    {formatAmount(report?.investments?.totalExpenses ?? 0)}
                                </span>
                            </div>
                        </div>
                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">{t('summary.netCashflow')}</span>
                                <span className={`text-lg font-semibold ${(report?.investments?.netCashflow ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatAmount(report?.investments?.netCashflow ?? 0)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Income and Expenses Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Income Column */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    {t('sections.income')}
                                </h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenAddDialog('investments', 'income')}
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    {t('addItem.title')}
                                </Button>
                            </div>

                            {isLoading ? (
                                <div className="text-center py-6 text-muted-foreground text-sm">{tc('status.loading')}</div>
                            ) : (
                                <div className="space-y-2">
                                    {report?.investments?.income.map((category) => (
                                        <CashflowCategory
                                            key={category.key}
                                            category={category}
                                            onEditItem={(item) => handleEditClick(item, category.key, 'investments')}
                                            onDeleteItem={(item) => setDeleteItem(item)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Expenses Column */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold flex items-center gap-2">
                                    <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                                    {t('sections.expenses')}
                                </h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenAddDialog('investments', 'expense')}
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    {t('addItem.title')}
                                </Button>
                            </div>

                            {isLoading ? (
                                <div className="text-center py-6 text-muted-foreground text-sm">{tc('status.loading')}</div>
                            ) : (
                                <div className="space-y-2">
                                    {report?.investments?.expenses.map((category) => (
                                        <CashflowCategory
                                            key={category.key}
                                            category={category}
                                            onEditItem={(item) => handleEditClick(item, category.key, 'investments')}
                                            onDeleteItem={(item) => setDeleteItem(item)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Add Dialog with category selection */}
            <AddCashflowItemDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
                onSubmit={handleAddItem}
                itemType={addDialogType}
                categories={getAddDialogCategories()}
                isLoading={createMutation.isPending}
            />

            {/* Edit Dialog */}
            <AddCashflowItemDialog
                open={!!editItem}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditItem(null);
                        setEditCategory("");
                    }
                }}
                onSubmit={handleEditItem}
                editItem={editItem}
                editCategory={editCategory}
                itemType={getEditItemType()}
                categories={getEditDialogCategories()}
                isLoading={updateMutation.isPending}
            />

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteConfirm.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('deleteConfirm.description')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tc('buttons.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleteMutation.isPending ? tc('status.deleting') : tc('buttons.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
