
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
import type { OtherAsset } from "@shared/schema";
import { useTranslation } from "react-i18next";

interface DeleteOtherAssetDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    asset: OtherAsset | null;
    onConfirm: () => void;
    isLoading?: boolean;
}

export function DeleteOtherAssetDialog({
    open,
    onOpenChange,
    asset,
    onConfirm,
    isLoading = false,
}: DeleteOtherAssetDialogProps) {
    const { t } = useTranslation('otherAssets');
    const { t: tc } = useTranslation('common');
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('confirmDelete.title')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('confirmDelete.description', { name: asset?.name || '' })}
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
