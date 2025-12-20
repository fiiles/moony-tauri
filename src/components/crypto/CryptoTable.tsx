
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
import { Search, MoreVertical, Trash2, History as HistoryIcon, Edit, ArrowDown, ArrowUp } from "lucide-react";
import { useCurrency } from "@/lib/currency";
import { useMemo, useState } from "react";
import { type CryptoHoldingData } from "@shared/calculations";
import { AssetLogo } from "@/components/common/AssetLogo";
import { useTranslation } from "react-i18next";

// Re-export the type for consumers who import from this file
export type { CryptoHoldingData } from "@shared/calculations";

interface CryptoTableProps {
    holdings: CryptoHoldingData[];
    onSell: (holding: CryptoHoldingData) => void;
    onViewTransactions: (holding: CryptoHoldingData) => void;
    onUpdatePrice: (holding: CryptoHoldingData) => void;
    onDelete: (holding: CryptoHoldingData) => void;
    onBuy: (holding: CryptoHoldingData) => void;
}

export function CryptoTable({
    holdings,
    onSell,
    onViewTransactions,
    onUpdatePrice,
    onDelete,
    onBuy,
}: CryptoTableProps) {
    const { t } = useTranslation('crypto');
    const { t: tc } = useTranslation('common');
    const { formatCurrency } = useCurrency();
    const [search, setSearch] = useState("");

    const filteredHoldings = useMemo(() => {
        const term = search.trim().toLowerCase();
        let filtered = holdings;

        if (term) {
            filtered = holdings.filter((h) => {
                const name = (h.name ?? "").toString().toLowerCase();
                const code = (h.ticker ?? "").toString().toLowerCase();
                return name.includes(term) || code.includes(term);
            });
        }

        // Sort by name
        return [...filtered].sort((a, b) =>
            (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: 'base' })
        );
    }, [holdings, search]);

    return (
        <Card className="border shadow-sm card-hover">
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold tracking-tight">{t('table.title')}</h2>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder={t('table.search')}
                                className="pl-9 w-64 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
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
                                <TableHead className="w-[250px] text-xs font-medium uppercase text-muted-foreground">{tc('labels.asset')}</TableHead>
                                <TableHead className="text-right text-xs font-medium uppercase text-muted-foreground">{tc('labels.quantity')}</TableHead>
                                <TableHead className="text-right text-xs font-medium uppercase text-muted-foreground">{t('table.avgCost')}</TableHead>
                                <TableHead className="text-right text-xs font-medium uppercase text-muted-foreground">{tc('labels.price')}</TableHead>
                                <TableHead className="text-right text-xs font-medium uppercase text-muted-foreground">{tc('labels.value')}</TableHead>
                                <TableHead className="text-right text-xs font-medium uppercase text-muted-foreground">{tc('labels.gainLoss')}</TableHead>
                                <TableHead className="text-right w-[80px] text-xs font-medium uppercase text-muted-foreground">{tc('labels.actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredHoldings.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={7}
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
                                                    type="crypto"
                                                    className="flex-shrink-0"
                                                />
                                                <div className="min-w-0 flex-1 overflow-hidden">
                                                    <p className="font-medium break-words">
                                                        {holding.name}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {holding.ticker}
                                                    </p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium data-value">
                                            {holding.quantity.toFixed(8)}
                                        </TableCell>
                                        <TableCell className="text-right data-value">
                                            {formatCurrency(holding.avgCost)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {holding.isManualPrice && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200 cursor-help h-5 px-1.5 text-[10px]">
                                                                    {tc('labels.manual')}
                                                                </Badge>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>{t('tooltip.manualPrice')}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                                <span className="data-value">{formatCurrency(holding.currentPrice)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-semibold data-value">
                                            {formatCurrency(holding.marketValue)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div
                                                className={
                                                    holding.gainLoss >= 0 ? "text-positive" : "text-negative"
                                                }
                                            >
                                                <p className="font-semibold data-value">
                                                    {holding.gainLoss >= 0 ? "+" : "-"}
                                                    {formatCurrency(Math.abs(holding.gainLoss))}
                                                </p>
                                                <p className="text-xs data-value">
                                                    ({holding.gainLoss >= 0 ? "+" : ""}
                                                    {holding.gainLossPercent.toFixed(2)}%)
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
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
                                                        {tc('buttons.buy')}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => onSell(holding)}
                                                    >
                                                        <ArrowDown className="mr-2 h-4 w-4" />
                                                        {tc('buttons.sell')}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => onUpdatePrice(holding)}
                                                    >
                                                        <Edit className="mr-2 h-4 w-4" />
                                                        {t('actions.updatePrice')}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => onDelete(holding)}
                                                        className="text-destructive focus:text-destructive"
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        {tc('buttons.delete')}
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
