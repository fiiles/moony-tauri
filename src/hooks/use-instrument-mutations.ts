/**
 * Legacy Instrument Mutations
 * Note: This is a placeholder for legacy instrument support.
 * The main investment features use investmentsApi from tauri-api.ts
 */
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { translateApiError } from "@/lib/translate-api-error";
import type { InsertInstrument, InsertPurchase } from "@shared/schema";

export function useInstrumentMutations() {
  const { t } = useTranslation('common');

  const createMutation = useMutation({
    mutationFn: async (_data: InsertInstrument & { purchase?: InsertPurchase }) => {
      // Legacy instrument support not available in Tauri version
      throw new Error("Instrument feature not implemented in Tauri version. Use Investments instead.");
    },
    onError: (error: Error) => {
      toast.error(t('status.error'), { description: translateApiError(error, tc) });
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
      toast.error(t('status.error'), { description: translateApiError(error, tc) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (_instrumentId: string) => {
      throw new Error("Instrument feature not implemented in Tauri version. Use Investments instead.");
    },
    onError: (error: Error) => {
      toast.error(t('status.error'), { description: translateApiError(error, tc) });
    },
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
  };
}
