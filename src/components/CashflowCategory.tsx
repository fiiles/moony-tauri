import { useState } from "react";
import { ChevronDown, ChevronRight, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "react-i18next";
import type { CashflowCategory as CashflowCategoryType, CashflowReportItem } from "@shared/schema";

interface CashflowCategoryProps {
    category: CashflowCategoryType;
    onEditItem?: (item: CashflowReportItem) => void;
    onDeleteItem?: (item: CashflowReportItem) => void;
}

export default function CashflowCategory({
    category,
    onEditItem,
    onDeleteItem,
}: CashflowCategoryProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { formatCurrency } = useCurrency();
    const { t } = useTranslation('reports');

    const hasItems = category.items.length > 0;

    // Format amount without negative zero
    const formatAmount = (amount: number) => {
        const value = Math.abs(amount) < 0.01 ? 0 : amount;
        return formatCurrency(value);
    };

    return (
        <Card className="border shadow-sm">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CardHeader className="p-4">
                    <div className="flex items-center justify-between">
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto hover:bg-transparent">
                                {isOpen ? (
                                    <ChevronDown className="h-4 w-4 shrink-0" />
                                ) : (
                                    <ChevronRight className="h-4 w-4 shrink-0" />
                                )}
                                <CardTitle className="text-base font-medium">
                                    {t(`categories.${category.key}`)}
                                </CardTitle>
                                <span className="text-sm text-muted-foreground">
                                    ({category.items.length})
                                </span>
                            </Button>
                        </CollapsibleTrigger>

                        <span className="font-semibold">
                            {formatAmount(category.total)}
                        </span>
                    </div>
                </CardHeader>

                <CollapsibleContent>
                    <CardContent className="pt-0 pb-4 px-4">
                        {hasItems ? (
                            <div className="space-y-2">
                                {category.items.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md border"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm">{item.name}</span>
                                            {item.isUserDefined && (
                                                <span className="text-xs text-muted-foreground">
                                                    {item.originalAmount.toLocaleString()} {item.originalCurrency} / {item.originalFrequency === 'monthly' ? t('perMonth') : t('perYear')}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">
                                                {formatAmount(item.amount)}
                                            </span>

                                            {item.isUserDefined && (
                                                <div className="flex gap-1">
                                                    {onEditItem && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6"
                                                            onClick={() => onEditItem(item)}
                                                        >
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                    {onDeleteItem && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-destructive hover:text-destructive"
                                                            onClick={() => onDeleteItem(item)}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                {t('empty.noItems')}
                            </p>
                        )}
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}
