import { InsurancePolicy } from "@shared/schema";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { useCurrency } from "@/lib/currency";
import { convertToCzK, type CurrencyCode } from "@shared/currencies";

interface InsuranceDetailModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    policy: InsurancePolicy;
}

export function InsuranceDetailModal({ open, onOpenChange, policy }: InsuranceDetailModalProps) {
    const { formatCurrency } = useCurrency();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{policy.policyName}</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Basic Information */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Basic Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Policy Number</p>
                                <p className="font-medium">{policy.policyNumber}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Provider</p>
                                <p className="font-medium">{policy.provider}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Type</p>
                                <p className="font-medium capitalize">{policy.type}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Status</p>
                                <p className="font-medium capitalize">{policy.status}</p>
                            </div>
                        </div>
                    </div>

                    {/* Payment Information */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Payment Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Payment Frequency</p>
                                <p className="font-medium capitalize">{policy.paymentFrequency.replace('_', ' ')}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Regular Payment</p>
                                <p className="font-medium">
                                    {formatCurrency(convertToCzK(Number(policy.regularPayment), policy.regularPaymentCurrency as CurrencyCode))}
                                </p>
                            </div>
                            {policy.oneTimePayment && Number(policy.oneTimePayment) > 0 && (
                                <div>
                                    <p className="text-sm text-muted-foreground">One-Time Payment</p>
                                    <p className="font-medium">
                                        {formatCurrency(convertToCzK(Number(policy.oneTimePayment), policy.oneTimePaymentCurrency as CurrencyCode || "CZK"))}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Coverage Period */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Coverage Period</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Start Date</p>
                                <p className="font-medium">{format(new Date(policy.startDate * 1000), "PP")}</p>
                            </div>
                            {policy.endDate && (
                                <div>
                                    <p className="text-sm text-muted-foreground">End Date</p>
                                    <p className="font-medium">{format(new Date(policy.endDate * 1000), "PP")}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Coverage Limits */}
                    {policy.limits && (policy.limits as any[]).length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium text-muted-foreground">Coverage Limits</h3>
                            <div className="space-y-2">
                                {(policy.limits as any[]).map((limit, index) => (
                                    <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded">
                                        <span className="font-medium">{limit.title}</span>
                                        <span className="text-muted-foreground">
                                            {formatCurrency(convertToCzK(Number(limit.amount), limit.currency as CurrencyCode || "CZK"))}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    {policy.notes && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium text-muted-foreground">Notes</h3>
                            <p className="text-sm whitespace-pre-wrap">{policy.notes}</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
