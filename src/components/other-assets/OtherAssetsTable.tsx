import { useState, useMemo } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MoreVertical, History as HistoryIcon, Trash, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrency } from "@/lib/currency";
import { convertToCzK, type CurrencyCode } from "@shared/currencies";
import type { OtherAsset } from "@shared/schema";
import { useTranslation } from "react-i18next";

interface OtherAssetsTableProps {
    assets: OtherAsset[];
    onBuy: (asset: OtherAsset) => void;
    onSell: (asset: OtherAsset) => void;
    onViewTransactions: (asset: OtherAsset) => void;
    onDelete: (asset: OtherAsset) => void;
}

export function OtherAssetsTable({ assets, onBuy, onSell, onViewTransactions, onDelete }: OtherAssetsTableProps) {
    const { t } = useTranslation('otherAssets');
    const { t: tc } = useTranslation('common');
    const { formatCurrency } = useCurrency();

    // Sorting state
    type SortColumn = 'name' | 'quantity' | 'marketPrice' | 'avgPurchasePrice' | 'totalValue';
    const [sortColumn, setSortColumn] = useState<SortColumn>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const handleSort = (column: SortColumn) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const SortIcon = ({ column }: { column: SortColumn }) => {
        if (sortColumn !== column) {
            return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
        }
        return sortDirection === 'asc'
            ? <ArrowUp className="h-3 w-3 ml-1" />
            : <ArrowDown className="h-3 w-3 ml-1" />;
    };

    const sortedAssets = useMemo(() => {
        return [...assets].sort((a, b) => {
            let comparison = 0;
            const quantityA = parseFloat(a.quantity);
            const quantityB = parseFloat(b.quantity);
            const marketPriceA = parseFloat(a.marketPrice);
            const marketPriceB = parseFloat(b.marketPrice);

            switch (sortColumn) {
                case 'name':
                    comparison = (a.name || '').localeCompare(b.name || '');
                    break;
                case 'quantity':
                    comparison = quantityA - quantityB;
                    break;
                case 'marketPrice':
                    comparison = marketPriceA - marketPriceB;
                    break;
                case 'avgPurchasePrice':
                    comparison = parseFloat(a.averagePurchasePrice) - parseFloat(b.averagePurchasePrice);
                    break;
                case 'totalValue':
                    comparison = (quantityA * marketPriceA) - (quantityB * marketPriceB);
                    break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [assets, sortColumn, sortDirection]);

    return (
        <>
            <Table>
                <TableHeader className="[&_th]:bg-muted/50">
                    <TableRow>
                        <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('name')}>
                            <span className="flex items-center">{tc('labels.name')}<SortIcon column="name" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('quantity')}>
                            <span className="flex items-center">{tc('labels.quantity')}<SortIcon column="quantity" /></span>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('marketPrice')}>
                            <span className="flex items-center justify-end">{t('table.marketPrice')}<SortIcon column="marketPrice" /></span>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('avgPurchasePrice')}>
                            <span className="flex items-center justify-end">{t('table.avgPurchasePrice')}<SortIcon column="avgPurchasePrice" /></span>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('totalValue')}>
                            <span className="flex items-center justify-end">{t('table.totalValue')}<SortIcon column="totalValue" /></span>
                        </TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedAssets.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                {t('table.noAssets')}
                            </TableCell>
                        </TableRow>
                    ) : (
                        sortedAssets.map((asset) => {
                            const marketValue = parseFloat(asset.quantity) * parseFloat(asset.marketPrice);
                            return (
                                <TableRow key={asset.id} className="cursor-pointer hover:bg-muted/50">
                                    <TableCell className="font-medium">{asset.name}</TableCell>
                                    <TableCell>{asset.quantity}</TableCell>
                                    <TableCell className="text-right">
                                        {formatCurrency(convertToCzK(parseFloat(asset.marketPrice), asset.currency as CurrencyCode))}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {formatCurrency(convertToCzK(parseFloat(asset.averagePurchasePrice), asset.currency as CurrencyCode))}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {formatCurrency(convertToCzK(marketValue, asset.currency as CurrencyCode))}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={(e) => {
                                                    e.stopPropagation();
                                                    onViewTransactions(asset);
                                                }}>
                                                    <HistoryIcon className="mr-2 h-4 w-4" />
                                                    {tc('buttons.viewTransactions')}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => {
                                                    e.stopPropagation();
                                                    onBuy(asset);
                                                }}>
                                                    <ArrowUp className="mr-2 h-4 w-4" />
                                                    {tc('buttons.buy')}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSell(asset);
                                                }}>
                                                    <ArrowDown className="mr-2 h-4 w-4" />
                                                    {tc('buttons.sell')}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-red-600 focus:text-red-600"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDelete(asset);
                                                    }}
                                                >
                                                    <Trash className="mr-2 h-4 w-4" />
                                                    {tc('buttons.delete')}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </>
    );
}
