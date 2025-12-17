import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MoreVertical, History as HistoryIcon, Trash, Pencil, ArrowUp, ArrowDown } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/lib/currency";
import { convertToCzK, type CurrencyCode } from "@shared/currencies";
import type { OtherAsset } from "@shared/schema";
import { useTranslation } from "react-i18next";

// Removed local formatCurrency function

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
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { formatCurrency } = useCurrency();

    return (
        <>
            <Table>
                <TableHeader className="[&_th]:bg-muted/50">
                    <TableRow>
                        <TableHead>{tc('labels.name')}</TableHead>
                        <TableHead>{tc('labels.quantity')}</TableHead>
                        <TableHead className="text-right">{t('table.marketPrice')}</TableHead>
                        <TableHead className="text-right">{t('table.avgPurchasePrice')}</TableHead>
                        <TableHead className="text-right">{t('table.totalValue')}</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {assets.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                {t('table.noAssets')}
                            </TableCell>
                        </TableRow>
                    ) : (
                        assets.map((asset) => {
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
