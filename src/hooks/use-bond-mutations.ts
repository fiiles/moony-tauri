import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { bondsApi } from "@/lib/tauri-api";
import { useToast } from "@/hooks/use-toast";
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
      toast({ title: "Bond created" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create bond", description: error.message, variant: "destructive" });
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
      toast({ title: "Bond updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update bond", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => bondsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bonds"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
      toast({ title: "Bond deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete bond", description: error.message, variant: "destructive" });
    },
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
  };
}
