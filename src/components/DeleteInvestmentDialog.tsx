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
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the investment
                        {investment &&
                            ` "${investment.companyName}" (${investment.ticker})`}{" "}
                        and all associated transactions.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isLoading ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
