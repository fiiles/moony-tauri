import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cashflowApi } from "@/lib/tauri-api";
import CashflowViewSelector, { type CashflowViewType } from "@/components/cashflow/CashflowViewSelector";
import CashflowCategory from "@/components/cashflow/CashflowCategory";
import AddCashflowItemDialog from "@/components/cashflow/AddCashflowItemDialog";
import { SummaryCard } from "@/components/common/SummaryCard";
import { Button } from "@/components/ui/button";
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
import type { CashflowReport, CashflowReportItem } from "@shared/schema";

export default function Cashflow() {
    const { t } = useTranslation('reports');
    const { t: tc } = useTranslation('common');
    const { formatCurrency } = useCurrency();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [viewType, setViewType] = useState<CashflowViewType>('monthly');
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [addDialogType, setAddDialogType] = useState<'income' | 'expense'>('income');
    const [editItem, setEditItem] = useState<CashflowReportItem | null>(null);
    const [editCategory, setEditCategory] = useState<string>("");
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

    const handleOpenAddDialog = (type: 'income' | 'expense') => {
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

    const handleEditClick = (item: CashflowReportItem, categoryKey: string) => {
        setEditItem(item);
        setEditCategory(categoryKey);
    };

    // Format currency without negative zero
    const formatAmount = (amount: number) => {
        const value = Math.abs(amount) < 0.01 ? 0 : amount;
        return formatCurrency(value);
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

            {/* Summary Cards - neutral styling, except net cashflow */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
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

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Income Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                            {t('sections.income')}
                        </h2>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => handleOpenAddDialog('income')}
                        >
                            <Plus className="h-4 w-4" />
                            {t('addItem.title')}
                        </Button>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">{tc('status.loading')}</div>
                    ) : (
                        <div className="space-y-3">
                            {report?.income.map((category) => (
                                <CashflowCategory
                                    key={category.key}
                                    category={category}
                                    onEditItem={(item) => handleEditClick(item, category.key)}
                                    onDeleteItem={(item) => setDeleteItem(item)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Expense Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                            {t('sections.expenses')}
                        </h2>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => handleOpenAddDialog('expense')}
                        >
                            <Plus className="h-4 w-4" />
                            {t('addItem.title')}
                        </Button>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">{tc('status.loading')}</div>
                    ) : (
                        <div className="space-y-3">
                            {report?.expenses.map((category) => (
                                <CashflowCategory
                                    key={category.key}
                                    category={category}
                                    onEditItem={(item) => handleEditClick(item, category.key)}
                                    onDeleteItem={(item) => setDeleteItem(item)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Add Dialog with category selection */}
            <AddCashflowItemDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
                onSubmit={handleAddItem}
                itemType={addDialogType}
                categories={addDialogType === 'income' ? report?.income : report?.expenses}
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
                itemType={editItem ? (report?.income.some(c => c.key === editCategory) ? 'income' : 'expense') : 'income'}
                categories={editItem ? (report?.income.some(c => c.key === editCategory) ? report?.income : report?.expenses) : []}
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
