import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, MoreVertical, Trash2, History as HistoryIcon, Edit, ArrowUp, ArrowDown } from "lucide-react";
import type { HoldingData } from "@/utils/investments";
import { useCurrency } from "@/lib/currency";
import { useMemo, useState } from "react";
import { AssetLogo } from "@/components/common/AssetLogo";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface InvestmentsTableProps {
  holdings: HoldingData[];
  onBuy: (holding: HoldingData) => void;
  onSell: (holding: HoldingData) => void;
  onViewTransactions: (holding: HoldingData) => void;
  onUpdatePrice: (holding: HoldingData) => void;
  onUpdateDividend: (holding: HoldingData) => void;
  onDelete: (holding: HoldingData) => void;
  isLoading?: boolean;
}

export function InvestmentsTable({
  holdings,
  onBuy,
  onSell,
  onViewTransactions,
  onUpdatePrice,
  onUpdateDividend,
  onDelete,
  isLoading,
}: InvestmentsTableProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation('investments');
  const [search, setSearch] = useState("");

  const filteredHoldings = useMemo(() => {
    const term = search.trim().toLowerCase();
    let filtered = holdings;

    if (term) {
      filtered = holdings.filter((h) => {
        const name = (h.companyName ?? "").toString().toLowerCase();
        const code = (h.ticker ?? "").toString().toLowerCase();
        return name.includes(term) || code.includes(term);
      });
    }

    return [...filtered].sort((a, b) =>
      (a.companyName || "").localeCompare(b.companyName || "", undefined, { sensitivity: 'base' })
    );
  }, [holdings, search]);

  return (
    <Card className={cn(
      "border shadow-sm card-hover transition-opacity duration-300",
      isLoading && "opacity-50 animate-pulse"
    )}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold mb-6">{t('table.title')}</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('table.search')}
                className="pl-9 w-64 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                data-testid="input-search-instrument"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader className="[&_th]:bg-muted/50">
              <TableRow>
                <TableHead className="w-[250px] text-xs font-medium uppercase text-muted-foreground">{t('table.investment')}</TableHead>
                <TableHead className="text-right text-xs font-medium uppercase text-muted-foreground">{t('table.quantity')}</TableHead>
                <TableHead className="text-right text-xs font-medium uppercase text-muted-foreground">{t('table.avgCost')}</TableHead>
                <TableHead className="text-right text-xs font-medium uppercase text-muted-foreground">{t('table.marketPrice')}</TableHead>
                <TableHead className="text-right text-xs font-medium uppercase text-muted-foreground">{t('table.marketValue')}</TableHead>
                <TableHead className="text-right text-xs font-medium uppercase text-muted-foreground">{t('table.totalGainLoss')}</TableHead>
                <TableHead className="text-right text-xs font-medium uppercase text-muted-foreground">{t('table.estDividend')}</TableHead>
                <TableHead className="text-right w-[80px] text-xs font-medium uppercase text-muted-foreground">{t('table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHoldings.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground py-8"
                  >
                    {t('table.noHoldings')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredHoldings.map((holding) => (
                  <TableRow key={holding.id} className="row-interactive">
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-0">
                        <AssetLogo
                          ticker={holding.ticker}
                          type="stock"
                          className="flex-shrink-0 text-white"
                        />
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <p className="font-medium break-words">
                            {holding.companyName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {holding.ticker}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium data-value">
                      {holding.quantity.toFixed(0)}
                    </TableCell>
                    <TableCell className="text-right data-value">
                      {formatCurrency(holding.avgCost, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {holding.isManualPrice && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200 cursor-help h-5 px-1.5 text-[10px]">
                                  {t('badges.manual')}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t('tooltips.manualPrice')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <span className="data-value">{formatCurrency(holding.currentPrice, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold data-value">
                      {formatCurrency(holding.marketValue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div
                        className={
                          holding.gainLoss >= 0 ? "text-positive" : "text-negative"
                        }
                      >
                        <p className="font-semibold data-value">
                          {holding.gainLoss >= 0 ? "+" : "-"}
                          {formatCurrency(Math.abs(holding.gainLoss), { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-xs data-value">
                          ({holding.gainLoss >= 0 ? "+" : ""}
                          {holding.gainLossPercent.toFixed(2)}%)
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {holding.isManualDividend && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200 cursor-help h-5 px-1.5 text-[10px]">
                                  {t('badges.manual')}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t('tooltips.manualDividend')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <span className="data-value">
                          {holding.dividendYield
                            ? formatCurrency(holding.dividendYield * holding.quantity, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                            : "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-actions-${holding.ticker}`}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => onViewTransactions(holding)}
                          >
                            <HistoryIcon className="mr-2 h-4 w-4" />
                            {t('actions.viewTransactions')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onBuy(holding)}
                          >
                            <ArrowUp className="mr-2 h-4 w-4" />
                            {t('actions.buy')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onSell(holding)}
                          >
                            <ArrowDown className="mr-2 h-4 w-4" />
                            {t('actions.sell')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onUpdatePrice(holding)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            {t('actions.updatePrice')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onUpdateDividend(holding)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            {t('actions.updateDividend')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDelete(holding)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('actions.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  );
}

