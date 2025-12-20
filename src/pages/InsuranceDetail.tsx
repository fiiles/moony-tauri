import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    ArrowLeft,
    Shield,
    Calendar,
    DollarSign,
    Trash2,
    Pencil,
    FileText,
    Plus,
    ExternalLink,
    File,
} from "lucide-react";
import { InsuranceFormDialog } from "@/components/insurance/InsuranceFormDialog";
import { InsuranceDocuments } from "@/components/insurance/InsuranceDocuments";
import type { InsurancePolicy } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { insuranceApi } from "@/lib/tauri-api";
import { convertToCzK, type CurrencyCode } from "@shared/currencies";
import { useCurrency } from "@/lib/currency";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/I18nProvider";
import { format } from "date-fns";

export default function InsuranceDetail() {
    const [, params] = useRoute("/insurance/:id");
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const id = params?.id;
    const { formatCurrency } = useCurrency();
    const { t } = useTranslation('insurance');
    const { t: tc } = useTranslation('common');
    const { formatDate } = useLanguage();

    const { data: policy, isLoading } = useQuery<InsurancePolicy | null>({
        queryKey: ["insurance", id],
        queryFn: () => insuranceApi.get(id!),
        enabled: !!id,
    });

    const deleteMutation = useMutation({
        mutationFn: () => insuranceApi.delete(id!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["insurance"] });
            toast({
                title: tc('status.success'),
                description: t('toast.deleted'),
            });
            setLocation("/insurance");
        },
        onError: (error) => {
            toast({
                title: tc('status.error'),
                description: error.message,
                variant: "destructive",
            });
        },
    });

    if (isLoading || !policy) {
        return (
            <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto">
                <div className="mb-6">
                    <Button variant="ghost" onClick={() => setLocation("/insurance")} className="mb-4 pl-0 hover:pl-0 hover:bg-transparent">
                        <ArrowLeft className="mr-2 h-4 w-4" /> {t('detail.backToList')}
                    </Button>
                    <p className="text-sm text-muted-foreground">{t('loading')}</p>
                </div>
            </div>
        );
    }

    const regularPaymentInCzk = convertToCzK(
        Number(policy.regularPayment),
        policy.regularPaymentCurrency as CurrencyCode
    );

    const oneTimePaymentInCzk = policy.oneTimePayment && Number(policy.oneTimePayment) > 0
        ? convertToCzK(Number(policy.oneTimePayment), (policy.oneTimePaymentCurrency as CurrencyCode) || "CZK")
        : null;

    // Calculate yearly cost based on frequency
    let yearlyCost = 0;
    if (policy.paymentFrequency === 'monthly') {
        yearlyCost = regularPaymentInCzk * 12;
    } else if (policy.paymentFrequency === 'quarterly') {
        yearlyCost = regularPaymentInCzk * 4;
    } else if (policy.paymentFrequency === 'yearly') {
        yearlyCost = regularPaymentInCzk;
    }

    return (
        <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto">
            {/* Navigation */}
            <div className="mb-6">
                <Button variant="ghost" onClick={() => setLocation("/insurance")} className="mb-4 pl-0 hover:pl-0 hover:bg-transparent">
                    <ArrowLeft className="mr-2 h-4 w-4" /> {t('detail.backToList')}
                </Button>

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl font-black tracking-tight">{policy.policyName}</h1>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${policy.status === 'active'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                }`}>
                                {policy.status}
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center">
                            <Shield className="mr-1 h-4 w-4" /> {policy.provider} • {policy.type}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                        <InsuranceFormDialog
                            policy={policy}
                            trigger={
                                <Button variant="outline">
                                    <Pencil className="mr-2 h-4 w-4" /> {tc('buttons.edit')}
                                </Button>
                            }
                        />
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive">
                                    <Trash2 className="mr-2 h-4 w-4" /> {tc('buttons.delete')}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>{t('confirmDelete.title')}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {t('confirmDelete.description', { name: policy.policyName })}
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>{tc('buttons.cancel')}</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => deleteMutation.mutate()}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                        {tc('buttons.delete')}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('detail.regularPayment')}</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(regularPaymentInCzk)}</div>
                        <p className="text-xs text-muted-foreground capitalize">
                            {policy.paymentFrequency.replace('_', ' ')}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('detail.yearlyCost')}</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(yearlyCost)}</div>
                        <p className="text-xs text-muted-foreground">{t('detail.perYear')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('detail.startDate')}</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {format(new Date(policy.startDate * 1000), "PP")}
                        </div>
                        {policy.endDate && (
                            <p className="text-xs text-muted-foreground">
                                {t('detail.until')} {format(new Date(policy.endDate * 1000), "PP")}
                            </p>
                        )}
                    </CardContent>
                </Card>
                {oneTimePaymentInCzk && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{t('detail.oneTimePayment')}</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(oneTimePaymentInCzk)}</div>
                            <p className="text-xs text-muted-foreground">{t('detail.paidOnce')}</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="details" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="details">{t('detail.details')}</TabsTrigger>
                    <TabsTrigger value="documents">{t('detail.documents')}</TabsTrigger>
                    <TabsTrigger value="notes">{t('detail.notes')}</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Basic Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('detail.basicInfo')}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">{t('form.policyNumber')}</p>
                                        <p className="font-medium">{policy.policyNumber || "—"}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">{t('form.provider')}</p>
                                        <p className="font-medium">{policy.provider}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">{t('form.type')}</p>
                                        <p className="font-medium capitalize">{policy.type}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">{tc('labels.status')}</p>
                                        <p className="font-medium capitalize">{policy.status}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Coverage Limits */}
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('detail.coverageLimits')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {policy.limits && (policy.limits as any[]).length > 0 ? (
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
                                ) : (
                                    <p className="text-sm text-muted-foreground">{t('detail.noLimits')}</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="documents">
                    <InsuranceDocuments insuranceId={id!} />
                </TabsContent>

                <TabsContent value="notes">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('detail.notes')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="whitespace-pre-wrap text-sm">
                                {policy.notes || t('detail.noNotes')}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
