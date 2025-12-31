import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bankAccountsApi, portfolioApi } from "@/lib/tauri-api";
import type { InsertBankAccount, InsertBankTransaction, InsertTransactionCategory, InsertTransactionRule } from "@shared/schema";
import { useToast } from "./use-toast";
import { useTranslation } from "react-i18next";

export function useBankAccountMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("bank_accounts");

  const createAccount = useMutation({
    mutationFn: (data: InsertBankAccount) => bankAccountsApi.create(data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
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
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateAccount = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InsertBankAccount }) =>
      bankAccountsApi.update(id, data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
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
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteAccount = useMutation({
    mutationFn: (id: string) => bankAccountsApi.delete(id),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
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
        description: error.message,
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
        description: error.message,
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
        description: error.message,
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
        description: error.message,
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
        description: error.message,
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
        description: error.message,
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
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    createRule,
    deleteRule,
  };
}
