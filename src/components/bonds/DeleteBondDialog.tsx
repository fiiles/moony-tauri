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
import type { Bond } from "@shared/schema";
import { useTranslation } from "react-i18next";

interface DeleteBondDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bond: Bond | null;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function DeleteBondDialog({ open, onOpenChange, bond, onConfirm, isLoading = false }: DeleteBondDialogProps) {
  const { t } = useTranslation('bonds');
  const { t: tc } = useTranslation('common');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('confirmDelete.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('confirmDelete.description', { name: bond?.name || '' })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tc('buttons.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {isLoading ? tc('status.deleting') : tc('buttons.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
