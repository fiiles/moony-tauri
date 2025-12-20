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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    ArrowLeft,
    Building2,
    DollarSign,
    Home,
    Trash2,
    Pencil,
    ExternalLink,
} from "lucide-react";
import { AddRealEstateModal } from "@/components/real-estate/AddRealEstateModal";
import { OneTimeCostModal } from "@/components/real-estate/OneTimeCostModal";
import { PhotoTimelineGallery } from "@/components/real-estate/PhotoTimelineGallery";
import { RealEstateDocuments } from "@/components/real-estate/RealEstateDocuments";
import type { RealEstate, RealEstateOneTimeCost, Loan } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { realEstateApi } from "@/lib/tauri-api";
import { convertToCzK, convertFromCzK, type CurrencyCode } from "@shared/currencies";
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

export default function RealEstateDetail() {
    const [, params] = useRoute("/real-estate/:id");
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const id = params?.id;
    const { currencyCode: userCurrency, formatCurrency } = useCurrency();
    const { t } = useTranslation('realEstate');
    const { t: tc } = useTranslation('common');
    const { formatDate } = useLanguage();

    const { data: realEstate, isLoading } = useQuery<RealEstate | null>({
        queryKey: ["real-estate", id],
        queryFn: () => realEstateApi.get(id!),
        enabled: !!id,
    });

    const { data: oneTimeCosts } = useQuery<RealEstateOneTimeCost[]>({
        queryKey: ["real-estate-costs", id],
        queryFn: () => realEstateApi.getCosts(id!),
        enabled: !!id,
    });

    const { data: linkedLoans } = useQuery<Loan[]>({
        queryKey: ["real-estate-loans", id],
        queryFn: () => realEstateApi.getLoans(id!),
        enabled: !!id,
    });

    const deleteMutation = useMutation({
        mutationFn: () => realEstateApi.delete(id!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["real-estate"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            toast({
                title: tc('status.success'),
                description: t('toast.deleted'),
            });
            setLocation("/real-estate");
        },
        onError: (error) => {
            toast({
                title: tc('status.error'),
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const deleteCostMutation = useMutation({
        mutationFn: (costId: string) => realEstateApi.deleteCost(costId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["real-estate-costs", id] });
            toast({
                title: tc('status.success'),
                description: t('toast.costDeleted'),
            });
        },
    });

    if (isLoading || !realEstate) {
        return (
            <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto">
                <div className="mb-6">
                    <Button variant="ghost" onClick={() => setLocation("/real-estate")} className="mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4" /> {t('detail.backToList')}
                    </Button>
                    <p className="text-sm text-muted-foreground">{t('loading')}</p>
                </div>
            </div>
        );
    }

    const totalLoansInCzk = linkedLoans?.reduce((sum, loan) => {
        const principal = Number(loan.principal);
        const currency = (loan as any).currency || "CZK";
        return sum + convertToCzK(principal, currency as CurrencyCode);
    }, 0) || 0;
    const totalLoans = convertFromCzK(totalLoansInCzk, userCurrency as CurrencyCode);

    const marketPriceNum = Number(realEstate.marketPrice);
    const marketCurrency = (realEstate as any).marketPriceCurrency || "CZK";
    const marketPriceInCzk = convertToCzK(marketPriceNum, marketCurrency as CurrencyCode);
    const marketPriceConverted = convertFromCzK(marketPriceInCzk, userCurrency as CurrencyCode);
    const equityInCzk = marketPriceInCzk - totalLoansInCzk;

    const totalRecurringCostsInCzk = (realEstate.recurringCosts as any[])?.reduce((sum, cost) => {
        let yearlyAmount = Number(cost.amount);
        if (cost.frequency === 'monthly') yearlyAmount *= 12;
        if (cost.frequency === 'quarterly') yearlyAmount *= 4;
        const costCurrency = cost.currency || "CZK";
        return sum + convertToCzK(yearlyAmount, costCurrency as CurrencyCode);
    }, 0) || 0;

    const monthlyRent = realEstate.monthlyRent ? Number(realEstate.monthlyRent) : 0;
    const rentCurrency = (realEstate as any).monthlyRentCurrency || "CZK";
    const rentInCzk = convertToCzK(monthlyRent * 12, rentCurrency as CurrencyCode);

    const yearlyLoanPaymentsInCzk = linkedLoans?.reduce((sum, loan) => {
        const monthlyPayment = Number(loan.monthlyPayment);
        const currency = (loan as any).currency || "CZK";
        return sum + convertToCzK(monthlyPayment * 12, currency as CurrencyCode);
    }, 0) || 0;

    const netCashflowInCzk = rentInCzk - totalRecurringCostsInCzk - yearlyLoanPaymentsInCzk;
    const netCashflow = convertFromCzK(netCashflowInCzk, userCurrency as CurrencyCode);

    return (
        <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto">
            {/* ... navigation ... */}
            <div className="mb-6">
                <Button variant="ghost" onClick={() => setLocation("/real-estate")} className="mb-4 pl-0 hover:pl-0 hover:bg-transparent">
                    <ArrowLeft className="mr-2 h-4 w-4" /> {t('detail.backToList')}
                </Button>
                {/* ... header ... */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight mb-2">{realEstate.name}</h1>
                        <p className="text-sm text-muted-foreground flex items-center">
                            <Building2 className="mr-1 h-4 w-4" /> {realEstate.address}
                        </p>
                    </div>
                    {/* ... buttons ... */}
                    <div className="flex gap-2">
                        <AddRealEstateModal
                            realEstate={realEstate}
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
                                        {t('confirmDelete.description', { name: realEstate.name })}
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>{tc('buttons.cancel')}</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        {tc('buttons.delete')}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('detail.marketValue')}</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(marketPriceInCzk)}</div>
                        <p className="text-xs text-muted-foreground">
                            {t('detail.purchase')}: {formatCurrency(convertToCzK(Number(realEstate.purchasePrice), (realEstate as any).purchasePriceCurrency as CurrencyCode || "CZK"))}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('detail.equity')}</CardTitle>
                        <Home className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(equityInCzk)}</div>
                        <p className="text-xs text-muted-foreground">
                            {((equityInCzk / marketPriceInCzk) * 100).toFixed(1)}% {t('detail.ofMarketValue')}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('detail.outstandingLoans')}</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalLoansInCzk)}</div>
                        <p className="text-xs text-muted-foreground">
                            {linkedLoans?.length || 0} {t('detail.linkedLoansCount', { count: linkedLoans?.length || 0 })}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('detail.estNetCashflow')}</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${netCashflowInCzk >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(netCashflowInCzk)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t('detail.cashflowFormula')}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="financials" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="financials">{t('detail.financials')}</TabsTrigger>
                    <TabsTrigger value="history">{t('detail.history')}</TabsTrigger>
                    <TabsTrigger value="gallery">{t('detail.gallery')}</TabsTrigger>
                    <TabsTrigger value="documents">{t('detail.documents')}</TabsTrigger>
                    <TabsTrigger value="notes">{t('detail.notes')}</TabsTrigger>
                </TabsList>

                <TabsContent value="financials" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('detail.recurringCosts')}</CardTitle>
                                <CardDescription>{t('detail.recurringCostsDesc')}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>{tc('labels.name')}</TableHead>
                                            <TableHead>{t('detail.frequency')}</TableHead>
                                            <TableHead className="text-right">{tc('labels.amount')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(realEstate.recurringCosts as any[])?.map((cost, i) => (
                                            <TableRow key={i}>
                                                <TableCell>{cost.name}</TableCell>
                                                <TableCell className="capitalize">{t('modal.add.' + cost.frequency)}</TableCell>
                                                <TableCell className="text-right">
                                                    {formatCurrency(convertToCzK(Number(cost.amount), cost.currency as CurrencyCode || "CZK"))}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {(!realEstate.recurringCosts || (realEstate.recurringCosts as any[]).length === 0) && (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center text-muted-foreground">{t('detail.noRecurringCosts')}</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{t('detail.linkedLoans')}</CardTitle>
                                <CardDescription>{t('detail.linkedLoansDesc')}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>{tc('labels.name')}</TableHead>
                                            <TableHead className="text-right">{t('detail.principal')}</TableHead>
                                            <TableHead className="text-right">{t('detail.rate')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {linkedLoans?.map((loan) => (
                                            <TableRow key={loan.id}>
                                                <TableCell>{loan.name}</TableCell>
                                                <TableCell className="text-right">
                                                    {formatCurrency(convertToCzK(Number(loan.principal), (loan as any).currency as CurrencyCode || "CZK"))}
                                                </TableCell>
                                                <TableCell className="text-right">{loan.interestRate}%</TableCell>
                                            </TableRow>
                                        ))}
                                        {(!linkedLoans || linkedLoans.length === 0) && (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center text-muted-foreground">{t('detail.noLinkedLoans')}</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="history">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>{t('detail.oneTimeCosts')}</CardTitle>
                                <CardDescription>{t('detail.oneTimeCostsDesc')}</CardDescription>
                            </div>
                            <OneTimeCostModal realEstateId={id!} />
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{tc('labels.date')}</TableHead>
                                        <TableHead>{tc('labels.name')}</TableHead>
                                        <TableHead>{tc('labels.description')}</TableHead>
                                        <TableHead className="text-right">{tc('labels.amount')}</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {oneTimeCosts?.map((cost) => (
                                        <TableRow key={cost.id}>
                                            <TableCell>{formatDate(new Date(cost.date * 1000))}</TableCell>
                                            <TableCell className="font-medium">{cost.name}</TableCell>
                                            <TableCell>{cost.description}</TableCell>
                                            <TableCell className="text-right">
                                                {formatCurrency(convertToCzK(Number(cost.amount), (cost as any).currency as CurrencyCode || "CZK"))}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-end gap-1">
                                                    <OneTimeCostModal
                                                        realEstateId={id!}
                                                        cost={cost}
                                                        trigger={
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        }
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive"
                                                        onClick={() => deleteCostMutation.mutate(cost.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {(!oneTimeCosts || oneTimeCosts.length === 0) && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                                                {t('detail.noOneTimeCosts')}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="gallery">
                    <PhotoTimelineGallery realEstateId={id!} />
                </TabsContent>

                <TabsContent value="documents">
                    <RealEstateDocuments realEstateId={id!} />
                </TabsContent>

                <TabsContent value="notes">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('detail.notes')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="whitespace-pre-wrap text-sm">
                                {realEstate.notes || t('detail.noNotes')}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
