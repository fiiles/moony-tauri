import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { savingsApi } from "@/lib/tauri-api";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { translateApiError } from "@/lib/translate-api-error";
import type { InsertSavingsAccount } from "@shared/schema";

export function useSavingsAccountMutations() {
  const { toast } = useToast();
  const { t } = useTranslation('common');

  const createMutation = useMutation({
    mutationFn: async ({ data, zones }: { data: InsertSavingsAccount; zones?: Array<{ fromAmount: string; toAmount?: string | null; interestRate: string }> }) => {

      // 1. Create the account
      const account = await savingsApi.create(data);


      // 2. If there are zones, create them linked to the new account
      if (zones && zones.length > 0) {

        const zonePromises = zones.map((zone) =>
          savingsApi.createZone({
            ...zone,
            savingsAccountId: account.id,
            // Convert empty strings to null for optional fields if needed
            toAmount: zone.toAmount === "" ? null : (zone.toAmount ?? null),
          })
        );
        await Promise.all(zonePromises);

      }

      return account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
      toast({ title: t('status.success') });
    },
    onError: (error: Error) => {
      toast({
        title: t('status.error'),
        description: translateApiError(error, t),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, zones }: { id: string; data: Partial<InsertSavingsAccount>; zones?: Array<{ id?: string; fromAmount: string; toAmount?: string | null; interestRate: string }> }) => {

      // Update the account first
      const result = await savingsApi.update(id, data);

      // Handle zones if provided
      if (zones) {

        // Get existing zones
        const existingZones = await savingsApi.getZones(id);


        // Delete zones that no longer exist
        for (const existingZone of existingZones) {
          const stillExists = zones.some(z => z.id === existingZone.id);
          if (!stillExists) {

            await savingsApi.deleteZone(existingZone.id);
          }
        }

        // Create new zones (those without id)
        for (const zone of zones) {
          if (!zone.id) {

            await savingsApi.createZone({
              savingsAccountId: id,
              fromAmount: zone.fromAmount,
              toAmount: zone.toAmount === "" ? null : (zone.toAmount ?? null),
              interestRate: zone.interestRate,
            });
          }
        }
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
      toast({ title: t('status.success') });
    },
    onError: (error: Error) => {
      toast({ title: t('status.error'), description: translateApiError(error, t), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => savingsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
      toast({ title: t('status.success') });
    },
    onError: (error: Error) => {
      toast({ title: t('status.error'), description: translateApiError(error, t), variant: "destructive" });
    },
  });

  const createZoneMutation = useMutation({
    mutationFn: (data: { fromAmount: string; toAmount: string | null; interestRate: string; savingsAccountId: string }) => savingsApi.createZone(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      toast({ title: t('status.success') });
    },
    onError: (error: Error) => {
      toast({ title: t('status.error'), description: translateApiError(error, t), variant: "destructive" });
    },
  });

  const deleteZoneMutation = useMutation({
    mutationFn: (zoneId: string) => savingsApi.deleteZone(zoneId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
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
    createZoneMutation,
    deleteZoneMutation,
  };
}
