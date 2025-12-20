import { useQuery } from "@tanstack/react-query";
import { bondsApi } from "@/lib/tauri-api";
import { convertToCzK, type CurrencyCode } from "@shared/currencies";
import type { Bond } from "@shared/schema";

export interface BondsMetrics {
  totalCouponValue: number;
  averageInterestRate: number;
  projectedYearlyEarnings: number;
  totalValue: number;
  averageYield: number;
  projectedYearlyIncome: number;
}

export function useBonds() {
  const { data: bonds = [], isLoading } = useQuery({
    queryKey: ["bonds"],
    queryFn: () => bondsApi.getAll(),
  });

  // Calculate metrics in CZK
  const totalValue = bonds.reduce(
    (sum, bond: Bond) => {
      const value = parseFloat(bond.couponValue || "0");
      const currency = bond.currency || "CZK";
      return sum + convertToCzK(value, currency as CurrencyCode);
    },
    0
  );

  // Calculate weighted average yield (weighted by coupon value in CZK)
  const averageYield = (() => {
    if (bonds.length === 0) return 0;

    const { weightedSum, totalWeight } = bonds.reduce(
      (acc, bond: Bond) => {
        const value = parseFloat(bond.couponValue || "0");
        const currency = bond.currency || "CZK";
        const valueInCzk = convertToCzK(value, currency as CurrencyCode);
        const rate = parseFloat(bond.interestRate || "0");

        return {
          weightedSum: acc.weightedSum + (valueInCzk * rate),
          totalWeight: acc.totalWeight + valueInCzk,
        };
      },
      { weightedSum: 0, totalWeight: 0 }
    );

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  })();

  const projectedYearlyIncome = bonds.reduce(
    (sum, bond: Bond) => {
      const value = parseFloat(bond.couponValue || "0");
      const rate = parseFloat(bond.interestRate || "0");
      // Calculate income in original currency
      const income = (value * rate) / 100;
      // Convert income to CZK
      const currency = bond.currency || "CZK";
      return sum + convertToCzK(income, currency as CurrencyCode);
    },
    0
  );

  const metrics: BondsMetrics = {
    totalValue,
    averageYield,
    projectedYearlyIncome,
    // Aliases for compatibility
    totalCouponValue: totalValue,
    averageInterestRate: averageYield,
    projectedYearlyEarnings: projectedYearlyIncome,
  };

  return {
    bonds,
    isLoading,
    metrics,
  };
}
