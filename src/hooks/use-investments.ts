import { useQuery } from "@tanstack/react-query";
import { investmentsApi } from "@/lib/tauri-api";

export function useInvestments() {
  const { data: investments = [], isLoading } = useQuery({
    queryKey: ["investments"],
    queryFn: () => investmentsApi.getAll(),
  });

  // Calculate metrics
  const totalValue = investments.reduce((sum, inv: any) => {
    const qty = parseFloat(inv.quantity || "0");
    const price = parseFloat(inv.currentPrice || "0");
    return sum + qty * price;
  }, 0);

  const totalCost = investments.reduce((sum, inv: any) => {
    const qty = parseFloat(inv.quantity || "0");
    const avgPrice = parseFloat(inv.averagePrice || "0");
    return sum + qty * avgPrice;
  }, 0);

  const totalGain = totalValue - totalCost;
  const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  const totalDividends = investments.reduce((sum, inv: any) => {
    const qty = parseFloat(inv.quantity || "0");
    const divYield = inv.dividendYield || 0;
    return sum + qty * divYield;
  }, 0);

  return {
    investments,
    isLoading,
    metrics: {
      totalValue,
      totalCost,
      totalGain,
      totalGainPercent,
      totalDividends,
    },
  };
}
