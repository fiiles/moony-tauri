import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { savingsApi } from "@/lib/tauri-api";
import { useToast } from "@/hooks/use-toast";

export function useSavingsAccountMutations() {
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async ({ data, zones }: { data: any; zones?: any[] }) => {
      // 1. Create the account
      const account = await savingsApi.create(data);

      // 2. If there are zones, create them linked to the new account
      if (zones && zones.length > 0) {
        const zonePromises = zones.map((zone) =>
          savingsApi.createZone({
            ...zone,
            savingsAccountId: account.id,
            // Convert empty strings to null for optional fields if needed
            toAmount: zone.toAmount === "" ? null : zone.toAmount,
          })
        );
        await Promise.all(zonePromises);
      }

      return account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
      toast({ title: "Savings account created" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create account",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data, zones }: { id: string; data: any; zones?: any[] }) => {
      // Call update and optionally handle zones
      return savingsApi.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
      toast({ title: "Savings account updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update account", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => savingsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
      toast({ title: "Savings account deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete account", description: error.message, variant: "destructive" });
    },
  });

  const createZoneMutation = useMutation({
    mutationFn: (data: any) => savingsApi.createZone(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      toast({ title: "Interest rate zone created" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create zone", description: error.message, variant: "destructive" });
    },
  });

  const deleteZoneMutation = useMutation({
    mutationFn: (zoneId: string) => savingsApi.deleteZone(zoneId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      toast({ title: "Interest rate zone deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete zone", description: error.message, variant: "destructive" });
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
