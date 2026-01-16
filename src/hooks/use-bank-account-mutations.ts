import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bankAccountsApi, portfolioApi, savingsApi } from "@/lib/tauri-api";
import type { InsertBankAccount, InsertBankTransaction, InsertTransactionCategory, InsertTransactionRule } from "@shared/schema";
import { useToast } from "./use-toast";
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
  const { toast } = useToast();
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
      toast({
        title: t("messages.accountCreated", "Account created"),
        description: t("messages.accountCreatedDesc", "The bank account has been created successfully."),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("messages.error", "Error"),
        description: translateApiError(error, tc),
        variant: "destructive",
      });
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
      toast({
        title: t("messages.accountUpdated", "Account updated"),
        description: t("messages.accountUpdatedDesc", "The bank account has been updated successfully."),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("messages.error", "Error"),
        description: translateApiError(error, tc),
        variant: "destructive",
      });
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
      toast({
        title: t("messages.accountDeleted", "Account deleted"),
        description: t("messages.accountDeletedDesc", "The bank account has been deleted."),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("messages.error", "Error"),
        description: translateApiError(error, tc),
        variant: "destructive",
      });
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
  const { toast } = useToast();
  const { t } = useTranslation("bank_accounts");
  const { t: tc } = useTranslation("common");

  const createTransaction = useMutation({
    mutationFn: (data: InsertBankTransaction) => bankAccountsApi.createTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-transactions", accountId] });
      toast({
        title: t("messages.transactionCreated", "Transaction created"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("messages.error", "Error"),
        description: translateApiError(error, tc),
        variant: "destructive",
      });
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: (id: string) => bankAccountsApi.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-transactions", accountId] });
      toast({
        title: t("messages.transactionDeleted", "Transaction deleted"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("messages.error", "Error"),
        description: translateApiError(error, tc),
        variant: "destructive",
      });
    },
  });

  return {
    createTransaction,
    deleteTransaction,
  };
}

export function useCategoryMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("bank_accounts");
  const { t: tc } = useTranslation("common");

  const createCategory = useMutation({
    mutationFn: (data: InsertTransactionCategory) => bankAccountsApi.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-categories"] });
      toast({
        title: t("messages.categoryCreated", "Category created"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("messages.error", "Error"),
        description: translateApiError(error, tc),
        variant: "destructive",
      });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => bankAccountsApi.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-categories"] });
      toast({
        title: t("messages.categoryDeleted", "Category deleted"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("messages.error", "Error"),
        description: translateApiError(error, tc),
        variant: "destructive",
      });
    },
  });

  return {
    createCategory,
    deleteCategory,
  };
}

export function useRuleMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("bank_accounts");
  const { t: tc } = useTranslation("common");

  const createRule = useMutation({
    mutationFn: (data: InsertTransactionRule) => bankAccountsApi.createRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-rules"] });
      toast({
        title: t("messages.ruleCreated", "Rule created"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("messages.error", "Error"),
        description: translateApiError(error, tc),
        variant: "destructive",
      });
    },
  });

  const deleteRule = useMutation({
    mutationFn: (id: string) => bankAccountsApi.deleteRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-rules"] });
      toast({
        title: t("messages.ruleDeleted", "Rule deleted"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("messages.error", "Error"),
        description: translateApiError(error, tc),
        variant: "destructive",
      });
    },
  });

  return {
    createRule,
    deleteRule,
  };
}
