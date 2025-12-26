import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useSavingsAccounts } from "@/hooks/use-savings-accounts";
import { useSavingsAccountMutations } from "@/hooks/use-savings-account-mutations";
import { SavingsAccountFormDialog } from "@/components/savings/SavingsAccountFormDialog";
import { DeleteSavingsAccountDialog } from "@/components/savings/DeleteSavingsAccountDialog";
import { SavingsAccountsSummary } from "@/components/savings/SavingsAccountsSummary";
import { SavingsAccountsTable } from "@/components/savings/SavingsAccountsTable";
import type { SavingsAccount, InsertSavingsAccount } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { ExportButton } from "@/components/common/ExportButton";
import { exportApi } from "@/lib/tauri-api";

export default function Accounts() {
  const { t } = useTranslation('savings');
  const { accounts, metrics, isLoading } = useSavingsAccounts();
  const { createMutation, updateMutation, deleteMutation } =
    useSavingsAccountMutations();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] =
    useState<SavingsAccount | null>(null);

  const handleAddClick = () => {
    setAddDialogOpen(true);
  };

  const handleAddSubmit = (data: InsertSavingsAccount | any, zones?: any[]) => {
    if ("id" in data) {
      return;
    }
    createMutation.mutate({ data: data as InsertSavingsAccount, zones }, {
      onSuccess: () => {
        setAddDialogOpen(false);
      },
    });
  };

  const handleEditClick = (account: SavingsAccount) => {
    setSelectedAccount(account);
    setEditDialogOpen(true);
  };

  const handleEditSubmit = (
    data: InsertSavingsAccount | { id: string; name?: string; balance?: string; interestRate?: string; hasZoneDesignation?: boolean },
    zones?: any[]
  ) => {
    if (!("id" in data)) {
      return;
    }
    updateMutation.mutate({ id: data.id, data, zones }, {
      onSuccess: () => {
        setEditDialogOpen(false);
        setSelectedAccount(null);
      },
    });
  };

  const handleDeleteClick = (account: SavingsAccount) => {
    setSelectedAccount(account);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedAccount) return;
    deleteMutation.mutate(selectedAccount.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setSelectedAccount(null);
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
          <ExportButton exportFn={exportApi.savingsAccounts} />
          <Button onClick={handleAddClick} className="transition-all duration-200">
            <Plus className="mr-2 h-4 w-4" />
            {t('addAccount')}
          </Button>
        </div>
      </div>

      <SavingsAccountsSummary metrics={metrics} />

      <SavingsAccountsTable
        accounts={accounts}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
      />

      <SavingsAccountFormDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleAddSubmit}
        isLoading={createMutation.isPending}
      />

      <SavingsAccountFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSubmit={handleEditSubmit}
        account={selectedAccount}
        isLoading={updateMutation.isPending}
      />

      <DeleteSavingsAccountDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        account={selectedAccount}
        onConfirm={handleDeleteConfirm}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

