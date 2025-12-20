import { useState, useEffect, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
import { useTranslation } from "react-i18next";
import { currencies } from "@/lib/currency";
import type { CashflowReportItem, CashflowCategory } from "@shared/schema";

interface AddCashflowItemDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: {
        name: string;
        amount: string;
        currency: string;
        frequency: 'monthly' | 'yearly';
        itemType: 'income' | 'expense';
        category: string;
    }) => void;
    editItem?: CashflowReportItem | null;
    editCategory?: string;
    itemType: 'income' | 'expense';
    categories?: CashflowCategory[];
    isLoading?: boolean;
}

export default function AddCashflowItemDialog({
    open,
    onOpenChange,
    onSubmit,
    editItem,
    editCategory,
    itemType,
    categories,
    isLoading,
}: AddCashflowItemDialogProps) {
    const { t } = useTranslation('reports');
    const { t: tc } = useTranslation('common');

    const [name, setName] = useState("");
    const [amount, setAmount] = useState("");
    const [currency, setCurrency] = useState("CZK");
    const [frequency, setFrequency] = useState<'monthly' | 'yearly'>('monthly');
    const [selectedCategory, setSelectedCategory] = useState<string>("");

    const isEditing = !!editItem;

    // All categories are now editable - memoized to avoid useEffect dependency issues
    const availableCategories = useMemo(() => categories ?? [], [categories]);

    // Reset form when dialog opens/closes or editItem changes
    useEffect(() => {
        if (open) {
            if (editItem) {
                setName(editItem.name);
                setAmount(editItem.originalAmount.toString());
                setCurrency(editItem.originalCurrency);
                setFrequency(editItem.originalFrequency);
                setSelectedCategory(editCategory || "");
            } else {
                setName("");
                setAmount("");
                setCurrency("CZK");
                setFrequency("monthly");
                // Default to first category
                if (availableCategories.length > 0) {
                    setSelectedCategory(availableCategories[0].key);
                }
            }
        }
    }, [open, editItem, editCategory, availableCategories]);

    // Update selected category when categories change (for new items)
    useEffect(() => {
        if (!isEditing && availableCategories.length > 0 && !selectedCategory) {
            setSelectedCategory(availableCategories[0].key);
        }
    }, [availableCategories, isEditing, selectedCategory]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !amount.trim() || !selectedCategory) return;

        onSubmit({
            name: name.trim(),
            amount: amount.trim(),
            currency,
            frequency,
            itemType,
            category: selectedCategory,
        });
    };

    const dialogTitle = isEditing ? t('addItem.editTitle') : t('addItem.title');
    const dialogDescription = itemType === 'income' ? t('addItem.income') : t('addItem.expense');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{dialogTitle}</DialogTitle>
                        <DialogDescription>{dialogDescription}</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Category selector */}
                        {availableCategories.length > 0 && (
                            <div className="grid gap-2">
                                <Label htmlFor="category">{t('addItem.category')}</Label>
                                <Select
                                    value={selectedCategory}
                                    onValueChange={setSelectedCategory}
                                    disabled={isEditing}
                                >
                                    <SelectTrigger id="category" className="form-input-enhanced">
                                        <SelectValue placeholder={t('addItem.selectCategory')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableCategories.map((cat) => (
                                            <SelectItem key={cat.key} value={cat.key}>
                                                {t(`categories.${cat.key}`)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label htmlFor="name">{t('addItem.name')}</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t('addItem.namePlaceholder')}
                                className="form-input-enhanced"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="amount">{t('addItem.amount')}</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder={t('addItem.amountPlaceholder')}
                                    className="form-input-enhanced"
                                    required
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="currency">{t('addItem.currency')}</Label>
                                <Select value={currency} onValueChange={setCurrency}>
                                    <SelectTrigger id="currency" className="form-input-enhanced">
                                        <SelectValue placeholder={tc('labels.selectCurrency')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {currencies.map((c) => (
                                            <SelectItem key={c.code} value={c.code}>
                                                {c.code} ({c.symbol})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="frequency">{t('addItem.frequency')}</Label>
                            <Select value={frequency} onValueChange={(v) => setFrequency(v as 'monthly' | 'yearly')}>
                                <SelectTrigger id="frequency" className="form-input-enhanced">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monthly">{t('viewType.monthly')}</SelectItem>
                                    <SelectItem value="yearly">{t('viewType.yearly')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {tc('buttons.cancel')}
                        </Button>
                        <Button type="submit" disabled={isLoading || !name.trim() || !amount.trim() || !selectedCategory}>
                            {isLoading ? tc('status.saving') : (isEditing ? tc('buttons.saveChanges') : tc('buttons.add'))}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
