import { useState } from "react";
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
import { Eye } from "lucide-react";
import { useCurrency } from "@/lib/currency";
import { convertToCzK, type CurrencyCode } from "@shared/currencies";
import { useTranslation } from "react-i18next";

export function InsuranceList() {
    const { t } = useTranslation('insurance');
    const { formatCurrency } = useCurrency();
    const [filterType, setFilterType] = useState<string>("all");
    const [, setLocation] = useLocation();

    const { data: policies, isLoading } = useQuery<InsurancePolicy[]>({
        queryKey: ["insurance"],
        queryFn: () => insuranceApi.getAll(),
    });

    const filteredPolicies = policies?.filter(policy => {
        if (filterType !== "all" && policy.type !== filterType) return false;
        return true;
    }).sort((a, b) => {
        // Default sort by date descending
        return new Date(b.createdAt * 1000).getTime() - new Date(a.createdAt * 1000).getTime();
    });

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
                                <TableHead>{t('table.name')}</TableHead>
                                <TableHead>{t('table.type')}</TableHead>
                                <TableHead>{t('table.provider')}</TableHead>
                                <TableHead className="text-right">{t('table.premium')}</TableHead>
                                <TableHead>{t('modal.paymentFrequency')}</TableHead>
                                <TableHead>{t('table.status')}</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPolicies?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        {t('table.noPolicies')}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredPolicies?.map((policy) => (
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
