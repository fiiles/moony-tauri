import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bankAccountsApi, portfolioApi, savingsApi } from "@/lib/tauri-api";
import type { InsertBankAccount, InsertBankTransaction, InsertTransactionCategory, InsertTransactionRule } from "@shared/schema";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { translateApiError } from "@/lib/translate-api-error";

interface ZoneData {
  id?: string;
  fromAmount: string;
  toAmount?: string | null;
  interestRate: string;
}

export function useBankAccountMutations() {
  const queryClient = useQueryClient();
  const { t } = useTranslation("bank_accounts");
  const { t: tc } = useTranslation("common");

  const createAccount = useMutation({
    mutationFn: async ({ data, zones }: { data: InsertBankAccount; zones?: ZoneData[] }) => {
      // 1. Create the account
      const account = await bankAccountsApi.create(data);

      // 2. If there are zones, create them linked to the new account
      if (zones && zones.length > 0) {
        for (const zone of zones) {
          await savingsApi.createZone({
            savingsAccountId: account.id,
            fromAmount: zone.fromAmount,
            toAmount: zone.toAmount === "" ? null : (zone.toAmount ?? null),
            interestRate: zone.interestRate,
          });
        }
      }

      return account;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-report"] });
      // Record new portfolio snapshot to update dashboard history
      await portfolioApi.recordSnapshot();
      queryClient.invalidateQueries({ queryKey: ["portfolio-history"] });
      toast(t("messages.accountCreated"), { description: t("messages.accountCreatedDesc") });
    },
    onError: (error: Error) => {
      toast.error(t("messages.error"), { description: translateApiError(error, tc) });
    },
  });

  const updateAccount = useMutation({
    mutationFn: async ({ id, data, zones }: { id: string; data: InsertBankAccount; zones?: ZoneData[] }) => {
      // 1. Update the account
      const account = await bankAccountsApi.update(id, data);

      // 2. Handle zones if provided
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

      return account;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-report"] });
      // Record new portfolio snapshot to update dashboard history
      await portfolioApi.recordSnapshot();
      queryClient.invalidateQueries({ queryKey: ["portfolio-history"] });
      toast(t("messages.accountUpdated"), { description: t("messages.accountUpdatedDesc") });
    },
    onError: (error: Error) => {
      toast.error(t("messages.error"), { description: translateApiError(error, tc) });
    },
  });

  const deleteAccount = useMutation({
    mutationFn: (id: string) => bankAccountsApi.delete(id),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-report"] });
      // Record new portfolio snapshot to update dashboard history
      await portfolioApi.recordSnapshot();
      queryClient.invalidateQueries({ queryKey: ["portfolio-history"] });
      toast(t("messages.accountDeleted"), { description: t("messages.accountDeletedDesc") });
    },
    onError: (error: Error) => {
      toast.error(t("messages.error"), { description: translateApiError(error, tc) });
    },
  });

  return {
    createAccount,
    updateAccount,
    deleteAccount,
  };
}

export function useBankTransactionMutations(accountId?: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation("bank_accounts");
  const { t: tc } = useTranslation("common");

  const createTransaction = useMutation({
    mutationFn: (data: InsertBankTransaction) => bankAccountsApi.createTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-transactions", accountId] });
      toast(t("messages.transactionCreated"));
    },
    onError: (error: Error) => {
      toast.error(t("messages.error"), { description: translateApiError(error, tc) });
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: (id: string) => bankAccountsApi.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-transactions", accountId] });
      toast(t("messages.transactionDeleted"));
    },
    onError: (error: Error) => {
      toast.error(t("messages.error"), { description: translateApiError(error, tc) });
    },
  });

  return {
    createTransaction,
    deleteTransaction,
  };
}

export function useCategoryMutations() {
  const queryClient = useQueryClient();
  const { t } = useTranslation("bank_accounts");
  const { t: tc } = useTranslation("common");

  const createCategory = useMutation({
    mutationFn: (data: InsertTransactionCategory) => bankAccountsApi.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-categories"] });
      toast(t("messages.categoryCreated"));
    },
    onError: (error: Error) => {
      toast.error(t("messages.error"), { description: translateApiError(error, tc) });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => bankAccountsApi.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-categories"] });
      toast(t("messages.categoryDeleted"));
    },
    onError: (error: Error) => {
      toast.error(t("messages.error"), { description: translateApiError(error, tc) });
    },
  });

  return {
    createCategory,
    deleteCategory,
  };
}

export function useRuleMutations() {
  const queryClient = useQueryClient();
  const { t } = useTranslation("bank_accounts");
  const { t: tc } = useTranslation("common");

  const createRule = useMutation({
    mutationFn: (data: InsertTransactionRule) => bankAccountsApi.createRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-rules"] });
      toast(t("messages.ruleCreated"));
    },
    onError: (error: Error) => {
      toast.error(t("messages.error"), { description: translateApiError(error, tc) });
    },
  });

  const deleteRule = useMutation({
    mutationFn: (id: string) => bankAccountsApi.deleteRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-rules"] });
      toast(t("messages.ruleDeleted"));
    },
    onError: (error: Error) => {
      toast.error(t("messages.error"), { description: translateApiError(error, tc) });
    },
  });

  return {
    createRule,
    deleteRule,
  };
}
