import { useQuery } from "@tanstack/react-query";
import { investmentsApi } from "@/lib/tauri-api";

interface InvestmentData {
  quantity?: string;
  currentPrice?: string | number;
  averagePrice?: string;
  dividendYield?: number;
}

export function useInvestments() {
  const { data: investments = [], isLoading } = useQuery({
    queryKey: ["investments"],
    queryFn: () => investmentsApi.getAll(),
  });

  // Calculate metrics
  const investmentData = investments as unknown as InvestmentData[];
  
  const totalValue = investmentData.reduce((sum: number, inv: InvestmentData) => {
    const qty = parseFloat(String(inv.quantity) || "0");
    const price = parseFloat(String(inv.currentPrice) || "0");
    return sum + qty * price;
  }, 0);

  const totalCost = investmentData.reduce((sum: number, inv: InvestmentData) => {
    const qty = parseFloat(String(inv.quantity) || "0");
    const avgPrice = parseFloat(String(inv.averagePrice) || "0");
    return sum + qty * avgPrice;
  }, 0);

  const totalGain = totalValue - totalCost;
  const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  const totalDividends = investmentData.reduce((sum: number, inv: InvestmentData) => {
    const qty = parseFloat(String(inv.quantity) || "0");
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
