import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { insuranceApi } from "@/lib/tauri-api";
import { InsurancePolicy } from "@shared/schema";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Eye, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useCurrency } from "@/lib/currency";
import { convertToCzK, type CurrencyCode } from "@shared/currencies";
import { useTranslation } from "react-i18next";

export function InsuranceList() {
    const { t } = useTranslation('insurance');
    const { formatCurrency } = useCurrency();
    const [filterType, setFilterType] = useState<string>("all");
    const [, setLocation] = useLocation();

    // Sorting state
    type SortColumn = 'name' | 'type' | 'provider' | 'premium' | 'frequency' | 'status';
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

    const { data: policies, isLoading } = useQuery<InsurancePolicy[]>({
        queryKey: ["insurance"],
        queryFn: () => insuranceApi.getAll(),
    });

    const filteredAndSortedPolicies = useMemo(() => {
        let filtered = policies?.filter(policy => {
            if (filterType !== "all" && policy.type !== filterType) return false;
            return true;
        }) || [];

        return [...filtered].sort((a, b) => {
            let comparison = 0;
            switch (sortColumn) {
                case 'name':
                    comparison = (a.policyName || '').localeCompare(b.policyName || '');
                    break;
                case 'type':
                    comparison = (a.type || '').localeCompare(b.type || '');
                    break;
                case 'provider':
                    comparison = (a.provider || '').localeCompare(b.provider || '');
                    break;
                case 'premium':
                    comparison = Number(a.regularPayment) - Number(b.regularPayment);
                    break;
                case 'frequency':
                    comparison = (a.paymentFrequency || '').localeCompare(b.paymentFrequency || '');
                    break;
                case 'status':
                    comparison = (a.status || '').localeCompare(b.status || '');
                    break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [policies, filterType, sortColumn, sortDirection]);

    if (isLoading) return <div>{t('loading')}</div>;

    return (
        <Card className="border">
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">{t('table.title')}</h2>
                    <div className="flex gap-4 items-center">
                        <Select value={filterType} onValueChange={setFilterType}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder={t('modal.selectType')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('types.allTypes')}</SelectItem>
                                <SelectItem value="life">{t('types.life')}</SelectItem>
                                <SelectItem value="travel">{t('types.travel')}</SelectItem>
                                <SelectItem value="accident">{t('types.accident')}</SelectItem>
                                <SelectItem value="property">{t('types.property')}</SelectItem>
                                <SelectItem value="liability">{t('types.liability')}</SelectItem>
                                <SelectItem value="other">{t('types.other')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="rounded-lg border">
                    <Table>
                        <TableHeader className="[&_th]:bg-muted/50">
                            <TableRow>
                                <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('name')}>
                                    <span className="flex items-center">{t('table.name')}<SortIcon column="name" /></span>
                                </TableHead>
                                <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('type')}>
                                    <span className="flex items-center">{t('table.type')}<SortIcon column="type" /></span>
                                </TableHead>
                                <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('provider')}>
                                    <span className="flex items-center">{t('table.provider')}<SortIcon column="provider" /></span>
                                </TableHead>
                                <TableHead className="text-right cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('premium')}>
                                    <span className="flex items-center justify-end">{t('table.premium')}<SortIcon column="premium" /></span>
                                </TableHead>
                                <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('frequency')}>
                                    <span className="flex items-center">{t('modal.paymentFrequency')}<SortIcon column="frequency" /></span>
                                </TableHead>
                                <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('status')}>
                                    <span className="flex items-center">{t('table.status')}<SortIcon column="status" /></span>
                                </TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAndSortedPolicies?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        {t('table.noPolicies')}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredAndSortedPolicies?.map((policy) => (
                                    <TableRow
                                        key={policy.id}
                                        className="cursor-pointer row-interactive"
                                        onClick={() => setLocation(`/insurance/${policy.id}`)}
                                    >
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <span>{policy.policyName}</span>
                                                {policy.policyNumber && <span className="text-xs text-muted-foreground">{policy.policyNumber}</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="capitalize">{t(`types.${policy.type}`)}</TableCell>
                                        <TableCell>{policy.provider}</TableCell>
                                        <TableCell className="text-right">
                                            {formatCurrency(convertToCzK(Number(policy.regularPayment), policy.regularPaymentCurrency as CurrencyCode))}
                                        </TableCell>
                                        <TableCell className="capitalize">{t(`modal.frequency.${policy.paymentFrequency}`)}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs ${policy.status === 'active'
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                                }`}>
                                                {t(`modal.status.${policy.status}`)}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setLocation(`/insurance/${policy.id}`);
                                                }}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
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
