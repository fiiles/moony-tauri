import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useBonds } from "@/hooks/useBonds";
import { BondsSummary } from "@/components/BondsSummary";
import { BondsTable } from "@/components/BondsTable";
import { BondsFormDialog } from "@/components/BondsFormDialog";
import { DeleteBondDialog } from "@/components/DeleteBondDialog";
import { useBondMutations } from "@/hooks/useBondMutations";
import type { Bond, InsertBond } from "@shared/schema";
import { useTranslation } from "react-i18next";

export default function Bonds() {
  const { t } = useTranslation('bonds');
  const { bonds, metrics, isLoading } = useBonds();
  const { createMutation, updateMutation, deleteMutation } = useBondMutations();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBond, setSelectedBond] = useState<Bond | null>(null);

  const handleAddClick = () => setAddDialogOpen(true);

  const handleAddSubmit = (data: InsertBond | any) => {
    if ("id" in data) return;
    createMutation.mutate(data as InsertBond, { onSuccess: () => setAddDialogOpen(false) });
  };

  const handleEditClick = (bond: Bond) => {
    setSelectedBond(bond);
    setEditDialogOpen(true);
  };

  const handleEditSubmit = (data: InsertBond | { id: string; name?: string; couponValue?: string; interestRate?: string }) => {
    if (!("id" in data)) return;
    updateMutation.mutate(data, { onSuccess: () => { setEditDialogOpen(false); setSelectedBond(null); } });
  };

  const handleDeleteClick = (bond: Bond) => {
    setSelectedBond(bond);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedBond) return;
    deleteMutation.mutate(selectedBond.id, { onSuccess: () => { setDeleteDialogOpen(false); setSelectedBond(null); } });
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
        <Button onClick={handleAddClick} className="transition-all duration-200">
          <Plus className="mr-2 h-4 w-4" />
          {t('addBond')}
        </Button>
      </div>

      <BondsSummary metrics={metrics} />

      <BondsTable bonds={bonds} onEdit={handleEditClick} onDelete={handleDeleteClick} />

      <BondsFormDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onSubmit={handleAddSubmit} isLoading={createMutation.isPending} />

      <BondsFormDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} onSubmit={handleEditSubmit} bond={selectedBond} isLoading={updateMutation.isPending} />

      <DeleteBondDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} bond={selectedBond} onConfirm={handleDeleteConfirm} isLoading={deleteMutation.isPending} />
    </div>
  );
}
