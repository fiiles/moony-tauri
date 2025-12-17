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
import { Loan } from "@shared/schema";
import { useTranslation } from "react-i18next";

interface DeleteLoanDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    loan: Loan | null;
    onConfirm: () => void;
    isLoading?: boolean;
}

export function DeleteLoanDialog({
    open,
    onOpenChange,
    loan,
    onConfirm,
    isLoading,
}: DeleteLoanDialogProps) {
    const { t } = useTranslation('loans');
    const { t: tc } = useTranslation('common');

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('confirmDelete.title')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('confirmDelete.description', { name: loan?.name || '' })}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{tc('buttons.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            onConfirm();
                        }}
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
