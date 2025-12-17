import { useQuery } from "@tanstack/react-query";
import { savingsApi } from "@/lib/tauri-api";
import { useCurrency } from "@/lib/currency";
import { convertToCzK, type CurrencyCode } from "@shared/currencies";

export interface SavingsAccountsMetrics {
  totalBalance: number;
  averageInterestRate: number;
  projectedYearlyEarnings: number;
}

export function useSavingsAccounts() {
  const { currencyCode: userCurrency } = useCurrency();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["savings-accounts"],
    queryFn: () => savingsApi.getAll(),
  });

  // Calculate metrics in CZK
  const totalBalance = accounts.reduce(
    (sum, account: any) => {
      const balance = parseFloat(account.balance || "0");
      const currency = account.currency || "CZK";
      return sum + convertToCzK(balance, currency as CurrencyCode);
    },
    0
  );

  const averageInterestRate =
    accounts.length > 0
      ? accounts.reduce(
        (sum, account: any) => {
          // Use effective rate if available (for zoned accounts), otherwise simple rate
          const rate = account.effectiveInterestRate !== undefined
            ? account.effectiveInterestRate
            : parseFloat(account.interestRate || "0");
          return sum + rate;
        },
        0
      ) / accounts.length
      : 0;

  // Calculate projected yearly earnings in CZK
  const projectedYearlyEarnings = accounts.reduce(
    (sum, account: any) => {
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
