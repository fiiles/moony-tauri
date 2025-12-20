import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectionApi } from "@/lib/tauri-api";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SummaryCard } from "@/components/common/SummaryCard";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "react-i18next";
import { TrendingUp, Wallet, PiggyBank, Calendar, ChevronDown, ChevronRight, Settings, Pencil } from "lucide-react";
import type { PortfolioProjection, ProjectionTimelinePoint, ProjectionSettings } from "@shared/schema";

// View type selector
const viewTypes = ['monthly', 'yearly'] as const;
type ViewType = typeof viewTypes[number];

// Quick horizon buttons for monthly (months) and yearly (years)
const monthlyHorizonOptions = [6, 12, 24, 36];
const yearlyHorizonOptions = [5, 10, 20, 30];

// Asset categories for settings
const assetCategories = [
    { key: 'savings', labelKey: 'categories.savings', hasContribution: true },
    { key: 'investments', labelKey: 'categories.investments', hasContribution: true },
    { key: 'crypto', labelKey: 'categories.crypto', hasContribution: true },
    { key: 'bonds', labelKey: 'categories.bonds', hasContribution: true },
    { key: 'real_estate', labelKey: 'categories.realEstate', hasContribution: false },
    { key: 'other_assets', labelKey: 'categories.otherAssets', hasContribution: true },
] as const;

// Default growth rates
const defaultRates: Record<string, number> = {
    savings: 0, // Uses weighted avg
    investments: 7,
    crypto: 7,
    bonds: 0,
    real_estate: 3,
    other_assets: 0,
};

export default function Projection() {
    const { t } = useTranslation('reports');
    const { t: tc } = useTranslation('common');
    const { formatCurrency } = useCurrency();
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [viewType, setViewType] = useState<ViewType>('yearly');
    const [horizonValue, setHorizonValue] = useState(10); // years for yearly, months for monthly
    const [committedHorizon, setCommittedHorizon] = useState(10); // The value used for queries
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingSettings, setEditingSettings] = useState<Record<string, { rate: string; contribution: string }>>({});

    // Get horizon in years for API
    const horizonYears = viewType === 'monthly' ? Math.ceil(committedHorizon / 12) : committedHorizon;

    // Fetch projection settings
    const { data: projectionSettings } = useQuery<ProjectionSettings[]>({
        queryKey: ['projection-settings'],
        queryFn: () => projectionApi.getSettings(),
    });

    // Save settings mutation
    const saveSettingsMutation = useMutation({
        mutationFn: (settings: ProjectionSettings[]) => projectionApi.saveSettings(settings),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projection-settings'] });
            queryClient.invalidateQueries({ queryKey: ['projection'] });
            setEditDialogOpen(false);
        },
    });

    // Fetch projection data - must be before settingsMap which depends on it
    const excludePersonalRE = user?.excludePersonalRealEstate ?? false;
    const { data: projection, isLoading } = useQuery<PortfolioProjection>({
        queryKey: ['projection', horizonYears, viewType, excludePersonalRE],
        queryFn: () => projectionApi.calculate({ horizonYears, viewType, excludePersonalRealEstate: excludePersonalRE }),
        refetchOnMount: 'always',
    });

    // Build settings map from saved settings or calculated defaults from projection
    const settingsMap = useMemo(() => {
        const map: Record<string, { rate: number; contribution: number }> = {};
        assetCategories.forEach(cat => {
            const saved = projectionSettings?.find(s => s.assetType === cat.key);
            let defaultRate = defaultRates[cat.key];

            // Use calculated defaults for savings and bonds if available
            if (cat.key === 'savings' && projection?.calculatedDefaults?.savingsRate) {
                defaultRate = projection.calculatedDefaults.savingsRate;
            } else if (cat.key === 'bonds' && projection?.calculatedDefaults?.bondsRate) {
                defaultRate = projection.calculatedDefaults.bondsRate;
            }

            map[cat.key] = {
                rate: saved ? parseFloat(saved.yearlyGrowthRate) : defaultRate,
                contribution: saved ? parseFloat(saved.monthlyContribution) : 0,
            };
        });
        return map;
    }, [projectionSettings, projection?.calculatedDefaults]);

    // Handle view type change - reset horizon to sensible defaults
    const handleViewTypeChange = (vt: ViewType) => {
        setViewType(vt);
        if (vt === 'monthly') {
            setHorizonValue(12);
            setCommittedHorizon(12);
        } else {
            setHorizonValue(10);
            setCommittedHorizon(10);
        }
    };

    // Handle opening edit dialog
    const handleOpenEdit = () => {
        const initial: Record<string, { rate: string; contribution: string }> = {};
        assetCategories.forEach(cat => {
            const rate = settingsMap[cat.key]?.rate ?? defaultRates[cat.key];
            initial[cat.key] = {
                rate: rate.toFixed(2),
                contribution: (settingsMap[cat.key]?.contribution ?? 0).toFixed(0),
            };
        });
        setEditingSettings(initial);
        setEditDialogOpen(true);
    };

    // Handle save settings
    const handleSaveSettings = () => {
        const settings: ProjectionSettings[] = assetCategories.map(cat => ({
            id: '', // Will be generated
            assetType: cat.key as ProjectionSettings['assetType'],
            yearlyGrowthRate: editingSettings[cat.key]?.rate || '0',
            monthlyContribution: editingSettings[cat.key]?.contribution || '0',
            contributionCurrency: 'CZK',
            enabled: true,
        }));
        saveSettingsMutation.mutate(settings);
    };

    // Format timeline for charts
    const chartData = useMemo(() => {
        if (!projection?.timeline) return [];
        return projection.timeline.map((point: ProjectionTimelinePoint) => {
            const date = new Date(point.date * 1000);
            const label = viewType === 'monthly'
                ? `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`
                : date.getFullYear().toString();
            return {
                label,
                netWorth: point.netWorth,
                totalAssets: point.totalAssets,
                totalLiabilities: point.totalLiabilities,
                savings: point.savings,
                investments: point.investments,
                crypto: point.crypto,
                bonds: point.bonds,
                realEstate: point.realEstate,
                otherAssets: point.otherAssets,
            };
        });
    }, [projection, viewType]);

    // Current values (first point)
    const currentNetWorth = projection?.timeline?.[0]?.netWorth ?? 0;

    // Projected values
    const projectedNetWorth = projection?.projectedNetWorth ?? 0;
    const totalContributions = projection?.totalContributions ?? 0;
    const totalGrowth = projection?.totalGrowth ?? 0;

    // Colors
    const colors = {
        netWorth: 'hsl(var(--chart-1))',
        assets: '#10B981',
        liabilities: 'hsl(var(--destructive))',
        savings: '#10B981',
        investments: '#8B5CF6',
        crypto: '#EC4899',
        bonds: '#F59E0B',
        realEstate: '#3B82F6',
        otherAssets: '#6366F1',
    };

    // Slider config based on view type
    const sliderMin = 1;
    const sliderMax = viewType === 'monthly' ? 36 : 30;
    const horizonOptions = viewType === 'monthly' ? monthlyHorizonOptions : yearlyHorizonOptions;
    const unitLabel = viewType === 'monthly'
        ? (horizonValue === 1 ? t('projection.month') : t('projection.months'))
        : (horizonValue === 1 ? t('projection.year') : t('projection.years'));

    if (isLoading) {
        return (
            <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
                <div>
                    <h1 className="page-title">{t('projection.title')}</h1>
                    <p className="page-subtitle">{tc('status.loading')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
            {/* Header with controls */}
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="page-title">{t('projection.title')}</h1>
                    <p className="page-subtitle">{t('projection.subtitle')}</p>
                </div>
                <div className="flex gap-2">
                    {/* View type selector */}
                    <div className="flex gap-1 p-1 bg-card border rounded-lg">
                        {viewTypes.map((vt) => (
                            <Button
                                key={vt}
                                variant="ghost"
                                size="sm"
                                className={`h-8 px-4 ${viewType === vt
                                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                    : ''
                                    }`}
                                onClick={() => handleViewTypeChange(vt)}
                            >
                                {t(`viewType.${vt}`)}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Horizon selector */}
            <Card className="p-6 border">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm font-medium">{t('projection.horizon')}</span>
                        </div>
                        <div className="flex gap-2">
                            {horizonOptions.map((val) => (
                                <Button
                                    key={val}
                                    variant={horizonValue === val ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => {
                                        setHorizonValue(val);
                                        setCommittedHorizon(val);
                                    }}
                                >
                                    {val}{viewType === 'monthly' ? 'M' : 'Y'}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <Slider
                        value={[horizonValue]}
                        onValueChange={(value) => setHorizonValue(value[0])}
                        onValueCommit={(value) => setCommittedHorizon(value[0])}
                        min={sliderMin}
                        max={sliderMax}
                        step={1}
                        className="w-full"
                    />
                    <div className="text-center text-sm text-muted-foreground">
                        {horizonValue} {unitLabel}
                    </div>
                </div>
            </Card>

            {/* Expandable Settings Panel */}
            <Card className="border shadow-sm">
                <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
                    <CardHeader className="p-4">
                        <div className="flex items-center justify-between">
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto hover:bg-transparent">
                                    {settingsOpen ? (
                                        <ChevronDown className="h-4 w-4 shrink-0" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 shrink-0" />
                                    )}
                                    <Settings className="h-4 w-4" />
                                    <CardTitle className="text-base font-medium">
                                        {t('projection.settings.title')}
                                    </CardTitle>
                                </Button>
                            </CollapsibleTrigger>
                            <Button variant="outline" size="sm" onClick={handleOpenEdit}>
                                <Pencil className="h-4 w-4 mr-2" />
                                {tc('buttons.edit')}
                            </Button>
                        </div>
                    </CardHeader>
                    <CollapsibleContent>
                        <CardContent className="pt-0 pb-4 px-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {assetCategories.map((cat) => (
                                    <div
                                        key={cat.key}
                                        className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md border"
                                    >
                                        <span className="text-sm font-medium">
                                            {t(`projection.${cat.labelKey}`)}
                                        </span>
                                        <div className="text-right text-sm">
                                            <div className="font-medium">
                                                {(settingsMap[cat.key]?.rate ?? defaultRates[cat.key]).toFixed(2)}%
                                            </div>
                                            {cat.hasContribution && (
                                                <div className="text-muted-foreground text-xs">
                                                    +{formatCurrency(settingsMap[cat.key]?.contribution ?? 0, { minimumFractionDigits: 0 })}/m
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </CollapsibleContent>
                </Collapsible>
            </Card>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <SummaryCard
                    title={t('projection.currentNetWorth')}
                    value={formatCurrency(currentNetWorth, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    icon={<Wallet className="h-4 w-4" />}
                />
                <SummaryCard
                    title={t('projection.projectedNetWorth')}
                    value={formatCurrency(projectedNetWorth, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    icon={<TrendingUp className="h-4 w-4" />}
                    valueClassName="text-positive"
                    subtitle={currentNetWorth > 0 ? `+${((projectedNetWorth / currentNetWorth - 1) * 100).toFixed(0)}%` : undefined}
                />
                <SummaryCard
                    title={t('projection.totalContributions')}
                    value={formatCurrency(totalContributions, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    icon={<PiggyBank className="h-4 w-4" />}
                />
                <SummaryCard
                    title={t('projection.totalGrowth')}
                    value={formatCurrency(totalGrowth, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    icon={<TrendingUp className="h-4 w-4" />}
                    valueClassName={totalGrowth >= 0 ? "text-positive" : "text-negative"}
                />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Net Worth Projection */}
                <Card className="p-6 border">
                    <h3 className="text-lg font-medium mb-4">{t('projection.netWorthTrend')}</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                <defs>
                                    <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={colors.netWorth} stopOpacity={0.2} />
                                        <stop offset="95%" stopColor={colors.netWorth} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    stroke="hsl(var(--muted-foreground))"
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval="preserveStartEnd"
                                />
                                <YAxis hide />
                                <Tooltip
                                    formatter={(value: number) => [formatCurrency(value, { minimumFractionDigits: 0 }), t('projection.netWorth')]}
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--popover))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '6px',
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="netWorth"
                                    stroke={colors.netWorth}
                                    strokeWidth={2}
                                    fill="url(#colorNetWorth)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Assets vs Liabilities */}
                <Card className="p-6 border">
                    <h3 className="text-lg font-medium mb-4">{t('projection.assetsVsLiabilities')}</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                <defs>
                                    <linearGradient id="colorProjAssets" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={colors.assets} stopOpacity={0.2} />
                                        <stop offset="95%" stopColor={colors.assets} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorProjLiabilities" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={colors.liabilities} stopOpacity={0.2} />
                                        <stop offset="95%" stopColor={colors.liabilities} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    stroke="hsl(var(--muted-foreground))"
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval="preserveStartEnd"
                                />
                                <YAxis hide />
                                <Tooltip
                                    formatter={(value: number, name: string) => [
                                        formatCurrency(value, { minimumFractionDigits: 0 }),
                                        name === 'totalAssets' ? t('projection.assets') : t('projection.liabilities')
                                    ]}
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--popover))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '6px',
                                    }}
                                />
                                <Area type="monotone" dataKey="totalAssets" stroke={colors.assets} strokeWidth={2} fill="url(#colorProjAssets)" name="totalAssets" />
                                <Area type="monotone" dataKey="totalLiabilities" stroke={colors.liabilities} strokeWidth={2} fill="url(#colorProjLiabilities)" name="totalLiabilities" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Asset Breakdown Stacked */}
                <Card className="p-6 border lg:col-span-2">
                    <h3 className="text-lg font-medium mb-4">{t('projection.assetBreakdown')}</h3>
                    <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    stroke="hsl(var(--muted-foreground))"
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval="preserveStartEnd"
                                />
                                <YAxis hide />
                                <Tooltip
                                    formatter={(value: number) => formatCurrency(value, { minimumFractionDigits: 0 })}
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--popover))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '6px',
                                    }}
                                />
                                <Legend />
                                <Area type="monotone" dataKey="savings" stackId="1" stroke={colors.savings} fill={colors.savings} fillOpacity={0.6} name={t('projection.categories.savings')} />
                                <Area type="monotone" dataKey="investments" stackId="1" stroke={colors.investments} fill={colors.investments} fillOpacity={0.6} name={t('projection.categories.investments')} />
                                <Area type="monotone" dataKey="crypto" stackId="1" stroke={colors.crypto} fill={colors.crypto} fillOpacity={0.6} name={t('projection.categories.crypto')} />
                                <Area type="monotone" dataKey="bonds" stackId="1" stroke={colors.bonds} fill={colors.bonds} fillOpacity={0.6} name={t('projection.categories.bonds')} />
                                <Area type="monotone" dataKey="realEstate" stackId="1" stroke={colors.realEstate} fill={colors.realEstate} fillOpacity={0.6} name={t('projection.categories.realEstate')} />
                                <Area type="monotone" dataKey="otherAssets" stackId="1" stroke={colors.otherAssets} fill={colors.otherAssets} fillOpacity={0.6} name={t('projection.categories.otherAssets')} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* Edit Settings Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{t('projection.settings.editTitle')}</DialogTitle>
                        <DialogDescription>{t('projection.settings.editDescription')}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        {/* Growth Rates Section */}
                        <div className="form-section">
                            <h3 className="form-section-header">
                                {t('projection.settings.growthRates')}
                            </h3>
                            <div className="grid gap-4">
                                {assetCategories.map((cat) => (
                                    <div key={cat.key} className="grid grid-cols-2 gap-4 items-center">
                                        <Label className="text-sm font-medium">
                                            {t(`projection.${cat.labelKey}`)}
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                value={editingSettings[cat.key]?.rate || '0'}
                                                onChange={(e) => setEditingSettings(prev => ({
                                                    ...prev,
                                                    [cat.key]: { ...prev[cat.key], rate: e.target.value }
                                                }))}
                                                className="form-input-enhanced"
                                                step="0.1"
                                            />
                                            <span className="text-sm text-muted-foreground whitespace-nowrap">% {t('projection.settings.perYear')}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Monthly Contributions Section */}
                        <div className="form-section">
                            <h3 className="form-section-header">
                                {t('projection.settings.contributions')}
                            </h3>
                            <div className="grid gap-4">
                                {assetCategories.filter(cat => cat.hasContribution).map((cat) => (
                                    <div key={cat.key} className="grid grid-cols-2 gap-4 items-center">
                                        <Label className="text-sm font-medium">
                                            {t(`projection.${cat.labelKey}`)}
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                value={editingSettings[cat.key]?.contribution || '0'}
                                                onChange={(e) => setEditingSettings(prev => ({
                                                    ...prev,
                                                    [cat.key]: { ...prev[cat.key], contribution: e.target.value }
                                                }))}
                                                className="form-input-enhanced"
                                                step="100"
                                            />
                                            <span className="text-sm text-muted-foreground whitespace-nowrap">/{t('projection.settings.month')}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Button onClick={handleSaveSettings} className="w-full" disabled={saveSettingsMutation.isPending}>
                            {saveSettingsMutation.isPending ? tc('status.saving') : tc('buttons.save')}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
