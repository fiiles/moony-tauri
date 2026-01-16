import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { bondsApi } from "@/lib/tauri-api";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { translateApiError } from "@/lib/translate-api-error";
import type { InsertBond } from "@shared/schema";

export interface UpdateBondData {
  name?: string;
  isin?: string;
  couponValue?: string;
  interestRate?: string;
  maturityDate?: number | Date;
}

export function useBondMutations() {
  const { toast } = useToast();
  const { t } = useTranslation('common');

  const createMutation = useMutation({
    mutationFn: async (data: InsertBond & { maturityDate?: Date | number | null }) => {
      // Convert Date to timestamp if needed
      const payload = {
        ...data,
        maturityDate: data.maturityDate instanceof Date
          ? Math.floor(data.maturityDate.getTime() / 1000)
          : data.maturityDate,
      };
      return bondsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bonds"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["projection"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-report"] });
      toast({ title: t('status.success') });
    },
    onError: (error: Error) => {
      toast({ title: t('status.error'), description: translateApiError(error, t), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & UpdateBondData) => {
      // Convert Date to timestamp if needed
      const payload = {
        ...data,
        maturityDate: data.maturityDate instanceof Date
          ? Math.floor(data.maturityDate.getTime() / 1000)
          : data.maturityDate,
      };
      return bondsApi.update(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bonds"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["projection"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-report"] });
      toast({ title: t('status.success') });
    },
    onError: (error: Error) => {
      toast({ title: t('status.error'), description: translateApiError(error, t), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => bondsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bonds"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["projection"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-report"] });
      toast({ title: t('status.success') });
    },
    onError: (error: Error) => {
      toast({ title: t('status.error'), description: translateApiError(error, t), variant: "destructive" });
    },
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
  };
}
