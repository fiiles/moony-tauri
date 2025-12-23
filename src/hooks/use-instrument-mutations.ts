/**
 * Legacy Instrument Mutations
 * Note: This is a placeholder for legacy instrument support.
 * The main investment features use investmentsApi from tauri-api.ts
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { InsertInstrument, InsertPurchase } from "@shared/schema";

export function useInstrumentMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (_data: InsertInstrument & { purchase?: InsertPurchase }) => {
      // Legacy instrument support not available in Tauri version
      throw new Error("Instrument feature not implemented in Tauri version. Use Investments instead.");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add investment",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (_data: {
      id: string;
      name?: string;
      code?: string;
      type?: string;
      currentPrice?: string;
      previousPrice?: string | null;
    }) => {
      throw new Error("Instrument feature not implemented in Tauri version. Use Investments instead.");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update instrument",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (_instrumentId: string) => {
      throw new Error("Instrument feature not implemented in Tauri version. Use Investments instead.");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete instrument",
        variant: "destructive",
      });
    },
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
  };
}
