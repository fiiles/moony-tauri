import { useQuery } from "@tanstack/react-query";
import { savingsApi } from "@/lib/tauri-api";
import { convertToCzK, type CurrencyCode } from "@shared/currencies";
import type { SavingsAccount } from "@shared/schema";

export interface SavingsAccountsMetrics {
  totalBalance: number;
  averageInterestRate: number;
  projectedYearlyEarnings: number;
}

export function useSavingsAccounts() {


  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["savings-accounts"],
    queryFn: () => savingsApi.getAll(),
  });

  // Calculate metrics in CZK
  const totalBalance = accounts.reduce(
    (sum, account: SavingsAccount) => {
      const balance = parseFloat(account.balance || "0");
      const currency = account.currency || "CZK";
      return sum + convertToCzK(balance, currency as CurrencyCode);
    },
    0
  );

  // Calculate weighted average interest rate (weighted by balance in CZK)
  const averageInterestRate = (() => {
    if (accounts.length === 0) return 0;

    const { weightedSum, totalWeight } = accounts.reduce(
      (acc, account: SavingsAccount) => {
        const balance = parseFloat(account.balance || "0");
        const currency = account.currency || "CZK";
        const balanceInCzk = convertToCzK(balance, currency as CurrencyCode);

        // Use effective rate if available (for zoned accounts), otherwise simple rate
        const rate = account.effectiveInterestRate !== undefined
          ? account.effectiveInterestRate
          : parseFloat(account.interestRate || "0");

        return {
          weightedSum: acc.weightedSum + (balanceInCzk * rate),
          totalWeight: acc.totalWeight + balanceInCzk,
        };
      },
      { weightedSum: 0, totalWeight: 0 }
    );

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  })();

  // Calculate projected yearly earnings in CZK
  const projectedYearlyEarnings = accounts.reduce(
    (sum, account: SavingsAccount) => {
      let earningsInOriginal = 0;
      // Use pre-calculated earnings if available (for zoned accounts)
      if (account.projectedEarnings !== undefined) {
        earningsInOriginal = account.projectedEarnings;
      } else {
        // Fallback for simple accounts
        const balance = parseFloat(account.balance || "0");
        const rate = parseFloat(account.interestRate || "0");
        earningsInOriginal = (balance * rate) / 100;
      }

      const currency = account.currency || "CZK";
      return sum + convertToCzK(earningsInOriginal, currency as CurrencyCode);
    },
    0
  );

  const metrics: SavingsAccountsMetrics = {
    totalBalance,
    averageInterestRate,
    projectedYearlyEarnings,
  };

  return {
    accounts,
    metrics,
    isLoading,
  };
}
