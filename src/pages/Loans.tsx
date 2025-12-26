import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useLoans } from "@/hooks/use-loans";
import { useLoanMutations } from "@/hooks/use-loan-mutations";
import { useToast } from "@/hooks/use-toast";
import { LoanFormDialog } from "@/components/loans/LoanFormDialog";
import { DeleteLoanDialog } from "@/components/loans/DeleteLoanDialog";
import { LoansSummary } from "@/components/loans/LoansSummary";
import { LoansTable } from "@/components/loans/LoansTable";
import type { Loan, InsertLoan } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { ExportButton } from "@/components/common/ExportButton";
import { exportApi } from "@/lib/tauri-api";

export default function Loans() {
  const { t } = useTranslation('loans');
  const { loans, metrics, isLoading } = useLoans();
  const { createMutation, updateMutation, deleteMutation } = useLoanMutations();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  const handleAddClick = () => {
    setAddDialogOpen(true);
  };

  const handleAddSubmit = (data: InsertLoan | any) => {
    if ("id" in data) {
      return;
    }
    createMutation.mutate(data as InsertLoan, {
      onSuccess: () => {
        setAddDialogOpen(false);
      },
    });
  };

  const handleEditClick = (loan: Loan) => {
    setSelectedLoan(loan);
    setEditDialogOpen(true);
  };

  const handleEditSubmit = (data: InsertLoan | (Partial<Loan> & { id: string })) => {
    if (!("id" in data)) {
      return;
    }
    updateMutation.mutate({ ...data, id: data.id } as { id: string } & Record<string, unknown>, {
      onSuccess: () => {
        setEditDialogOpen(false);
        setSelectedLoan(null);
        queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
        queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
        queryClient.invalidateQueries({ queryKey: ["portfolio-history"] });
        toast({
          title: "Success",
          description: "Loan updated successfully",
        });
      },
    });
  };

  const handleDeleteClick = (loan: Loan) => {
    setSelectedLoan(loan);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedLoan) return;
    deleteMutation.mutate(selectedLoan.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setSelectedLoan(null);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="page-title">{t('title')}</h1>
          <p className="page-subtitle">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t('title')}</h1>
          <p className="page-subtitle">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <ExportButton exportFn={exportApi.loans} />
          <Button onClick={handleAddClick} className="transition-all duration-200">
            <Plus className="mr-2 h-4 w-4" />
            {t('addLoan')}
          </Button>
        </div>
      </div>

      <LoansSummary metrics={metrics} />

      <LoansTable
        loans={loans}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
      />

      <LoanFormDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleAddSubmit}
        isLoading={createMutation.isPending}
      />

      <LoanFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSubmit={handleEditSubmit}
        loan={selectedLoan}
        isLoading={updateMutation.isPending}
      />

      <DeleteLoanDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        loan={selectedLoan}
        onConfirm={handleDeleteConfirm}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
