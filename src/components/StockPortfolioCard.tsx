import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Plus } from "lucide-react";
import { useCurrency } from "@/lib/currency";
import { calculateMarketValue, calculateGainLoss, calculateGainLossPercent } from "@shared/calculations";

interface StockHolding {
  id: string;
  symbol: string;
  shares: number;
  costBasis: number;
  currentPrice: number;
}

interface StockPortfolioCardProps {
  holdings: StockHolding[];
  onAdd?: () => void;
}

export default function StockPortfolioCard({ holdings, onAdd }: StockPortfolioCardProps) {
  const { formatCurrency } = useCurrency();
  // Use shared calculation functions
  const totalValue = holdings.reduce((sum, stock) => sum + calculateMarketValue(stock.shares, stock.currentPrice), 0);
  const totalCost = holdings.reduce((sum, stock) => sum + stock.costBasis, 0);
  const totalGainLoss = calculateGainLoss(totalValue, totalCost);
  const totalGainLossPercent = calculateGainLossPercent(totalGainLoss, totalCost);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Stock Portfolio</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            console.log('Add stock clicked');
            onAdd?.();
          }}
          data-testid="button-add-stock"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-baseline pb-3 border-b">
          <div className="space-y-1">
            <span className="text-sm font-medium">Total Value</span>
            <div className={`flex items-center gap-1 text-xs ${totalGainLoss >= 0 ? 'text-chart-2' : 'text-destructive'
              }`}>
              {totalGainLoss >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span className="tabular-nums">
                {totalGainLoss >= 0 ? '+' : ''}{formatCurrency(Math.abs(totalGainLoss))}
                ({totalGainLossPercent >= 0 ? '+' : ''}{totalGainLossPercent.toFixed(2)}%)
              </span>
            </div>
          </div>
          <span className="text-2xl font-bold tabular-nums">
            {formatCurrency(totalValue)}
          </span>
        </div>

        {holdings.map((stock) => {
          const currentValue = calculateMarketValue(stock.shares, stock.currentPrice);
          const gainLoss = calculateGainLoss(currentValue, stock.costBasis);
          const gainLossPercent = calculateGainLossPercent(gainLoss, stock.costBasis);

          return (
            <div key={stock.id} className="flex justify-between items-center py-2 hover-elevate rounded-md px-2 -mx-2">
              <div>
                <p className="font-medium text-sm">{stock.symbol}</p>
                <p className="text-xs text-muted-foreground">{stock.shares} shares</p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums text-sm">
                  {formatCurrency(currentValue)}
                </p>
                <p className={`text-xs tabular-nums ${gainLoss >= 0 ? 'text-chart-2' : 'text-destructive'
                  }`}>
                  {gainLoss >= 0 ? '+' : ''}{formatCurrency(Math.abs(gainLoss))}
                  ({gainLossPercent >= 0 ? '+' : ''}{gainLossPercent.toFixed(2)}%)
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
