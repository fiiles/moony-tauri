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
import type { HoldingData } from "@/utils/investments";
import { useTranslation } from "react-i18next";

interface DeleteInvestmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    investment: HoldingData | null;
    onConfirm: () => void;
    isLoading?: boolean;
}

export function DeleteInvestmentDialog({
    open,
    onOpenChange,
    investment,
    onConfirm,
    isLoading = false,
}: DeleteInvestmentDialogProps) {
    const { t } = useTranslation('investments');
    const { t: tc } = useTranslation('common');
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('confirmDelete.title')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('confirmDelete.description', { name: investment?.ticker || '' })}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{tc('buttons.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isLoading ? tc('status.deleting') : tc('buttons.delete')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
