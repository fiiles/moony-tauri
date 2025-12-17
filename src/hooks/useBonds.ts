import { useQuery } from "@tanstack/react-query";
import { bondsApi } from "@/lib/tauri-api";
import { convertToCzK, type CurrencyCode } from "@shared/currencies";

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
    (sum, bond: any) => {
      const value = parseFloat(bond.couponValue || "0");
      const currency = bond.currency || "CZK";
      return sum + convertToCzK(value, currency as CurrencyCode);
    },
    0
  );

  const averageYield = bonds.length > 0
    ? bonds.reduce((sum, bond: any) => sum + parseFloat(bond.interestRate || "0"), 0) / bonds.length
    : 0;

  const projectedYearlyIncome = bonds.reduce(
    (sum, bond: any) => {
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
