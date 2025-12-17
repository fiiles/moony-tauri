import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
import { format } from "date-fns";
import { InsuranceFormDialog } from "./InsuranceFormDialog";
import { InsuranceDetailModal } from "./InsuranceDetailModal";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/lib/currency";
import { convertToCzK, type CurrencyCode } from "@shared/currencies";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function InsuranceList() {
    const { toast } = useToast();
    const { formatCurrency } = useCurrency();
    const queryClient = useQueryClient();
    const [filterType, setFilterType] = useState<string>("all");
    const [sortBy, setSortBy] = useState<string>("date");
    const [editingPolicy, setEditingPolicy] = useState<InsurancePolicy | null>(null);
    const [deletingPolicy, setDeletingPolicy] = useState<InsurancePolicy | null>(null);
    const [viewingPolicy, setViewingPolicy] = useState<InsurancePolicy | null>(null);

    const { data: policies, isLoading } = useQuery<InsurancePolicy[]>({
        queryKey: ["insurance"],
        queryFn: () => insuranceApi.getAll(),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await insuranceApi.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["insurance"] });
            setDeletingPolicy(null);
            toast({ title: "Success", description: "Policy deleted successfully" });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
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
                                    <TableRow key={policy.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <span>{policy.policyName}</span>
                                                <span className="text-xs text-muted-foreground">{policy.policyNumber}</span>
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
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setViewingPolicy(policy)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => setEditingPolicy(policy)}>
                                                            <Pencil className="h-4 w-4 mr-2" />
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() => setDeletingPolicy(policy)}
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Detail Modal */}
            {viewingPolicy && (
                <InsuranceDetailModal
                    open={!!viewingPolicy}
                    onOpenChange={(open: boolean) => !open && setViewingPolicy(null)}
                    policy={viewingPolicy}
                />
            )}

            {/* Edit Dialog */}
            {editingPolicy && (
                <InsuranceFormDialog
                    open={!!editingPolicy}
                    onOpenChange={(open) => !open && setEditingPolicy(null)}
                    policy={editingPolicy}
                />
            )}

            {/* Delete Confirmation */}
            <AlertDialog open={!!deletingPolicy} onOpenChange={(open) => !open && setDeletingPolicy(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the insurance policy
                            "{deletingPolicy?.policyName}".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deletingPolicy && deleteMutation.mutate(deletingPolicy.id)}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
