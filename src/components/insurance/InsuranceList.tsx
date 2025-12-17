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

export function InsuranceList() {
    const { formatCurrency } = useCurrency();
    const [filterType, setFilterType] = useState<string>("all");
    const [sortBy, setSortBy] = useState<string>("date");
    const [, setLocation] = useLocation();

    const { data: policies, isLoading } = useQuery<InsurancePolicy[]>({
        queryKey: ["insurance"],
        queryFn: () => insuranceApi.getAll(),
    });

    const filteredPolicies = policies?.filter(policy => {
        if (filterType !== "all" && policy.type !== filterType) return false;
        return true;
    }).sort((a, b) => {
        if (sortBy === "date") {
            return new Date(b.createdAt * 1000).getTime() - new Date(a.createdAt * 1000).getTime();
        } else if (sortBy === "cost") {
            return Number(b.regularPayment) - Number(a.regularPayment);
        } else if (sortBy === "name") {
            return a.policyName.localeCompare(b.policyName);
        }
        return 0;
    });

    if (isLoading) return <div>Loading...</div>;

    return (
        <Card className="border">
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">All Policies</h2>
                    <div className="flex gap-4 items-center">
                        <Select value={filterType} onValueChange={setFilterType}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="life">Life</SelectItem>
                                <SelectItem value="travel">Travel</SelectItem>
                                <SelectItem value="accident">Accident</SelectItem>
                                <SelectItem value="property">Property</SelectItem>
                                <SelectItem value="liability">Liability</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="date">Date Created</SelectItem>
                                <SelectItem value="cost">Payment Amount</SelectItem>
                                <SelectItem value="name">Name</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="rounded-lg border">
                    <Table>
                        <TableHeader className="[&_th]:bg-muted/50">
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Provider</TableHead>
                                <TableHead className="text-right">Regular Payment</TableHead>
                                <TableHead>Frequency</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPolicies?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        No insurance policies found. Add one to get started.
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
                                        <TableCell className="capitalize">{policy.type}</TableCell>
                                        <TableCell>{policy.provider}</TableCell>
                                        <TableCell className="text-right">
                                            {formatCurrency(convertToCzK(Number(policy.regularPayment), policy.regularPaymentCurrency as CurrencyCode))}
                                        </TableCell>
                                        <TableCell className="capitalize">{policy.paymentFrequency.replace('_', ' ')}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs ${policy.status === 'active'
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                                }`}>
                                                {policy.status}
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
