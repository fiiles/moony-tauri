import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useCurrency } from "@/lib/currency";
import {
    generateAmortizationSchedule,
    getPeriodsPerYear,
    yearsToTotalPeriods,
    type PaymentPeriodicity,
    type AmortizationRow,
} from "@/utils/annuity";

export default function AnnuityCalculator() {
    const { t } = useTranslation('calculators');
    const { formatCurrencyRaw } = useCurrency();

    // Form state
    const [loanAmount, setLoanAmount] = useState<string>("1000000");
    const [periodYears, setPeriodYears] = useState<string>("30");
    const [interestRate, setInterestRate] = useState<string>("5");
    const [periodicity, setPeriodicity] = useState<PaymentPeriodicity>("monthly");
    
    // Expandable table state
    const [showSchedule, setShowSchedule] = useState(false);
    
    // Chart aggregation view - defaults to 'yearly', will be 'period' or 'yearly'
    const [chartView, setChartView] = useState<'period' | 'yearly'>('yearly');

    // Calculate results
    const result = useMemo(() => {
        const principal = parseFloat(loanAmount) || 0;
        const years = parseFloat(periodYears) || 0;
        const rate = parseFloat(interestRate) || 0;
        const periodsPerYear = getPeriodsPerYear(periodicity);
        const totalPeriods = yearsToTotalPeriods(years, periodsPerYear);

        return generateAmortizationSchedule(principal, rate, totalPeriods, periodsPerYear);
    }, [loanAmount, periodYears, interestRate, periodicity]);

    // Prepare chart data - aggregate by period based on view
    const chartData = useMemo(() => {
        if (!result.schedule.length) return [];

        if (chartView === 'yearly' || periodicity === 'annually') {
            const yearlyData: Record<number, { label: string; principal: number; interest: number; balance: number }> = {};
            
            result.schedule.forEach((row: AmortizationRow) => {
                if (!yearlyData[row.year]) {
                    yearlyData[row.year] = {
                        label: String(row.year),
                        principal: 0,
                        interest: 0,
                        balance: row.remainingBalance
                    };
                }
                yearlyData[row.year].principal += row.principalPayment;
                yearlyData[row.year].interest += row.interestPayment;
                yearlyData[row.year].balance = row.remainingBalance;
            });

            return Object.values(yearlyData);
        } else {
            // Period view - use individual periods with appropriate labeling
            return result.schedule.map((row: AmortizationRow) => {
                let label = '';
                if (periodicity === 'monthly') {
                    label = `${row.year}/${row.month.toString().padStart(2, '0')}`;
                } else if (periodicity === 'quarterly') {
                    const quarter = Math.ceil(row.month / 3);
                    label = `${row.year}/Q${quarter}`;
                } else if (periodicity === 'semiAnnually') {
                    const half = row.month <= 6 ? 1 : 2;
                    label = `${row.year}/H${half}`;
                }
                return {
                    label,
                    principal: row.principalPayment,
                    interest: row.interestPayment,
                    balance: row.remainingBalance
                };
            });
        }
    }, [result.schedule, chartView, periodicity]);

    return (
        <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h1 className="page-title">{t('annuity.title')}</h1>
                <p className="page-subtitle">{t('annuity.subtitle')}</p>
            </div>

            {/* Input Form */}
            <Card>
                <CardContent className="pt-6">
                    <h2 className="text-xl font-semibold mb-6">{t('annuity.form.loanParameters')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Loan Amount */}
                        <div className="space-y-2">
                            <Label htmlFor="loanAmount">{t('annuity.form.loanAmount')}</Label>
                            <Input
                                id="loanAmount"
                                type="number"
                                min="0"
                                step="1000"
                                value={loanAmount}
                                onChange={(e) => setLoanAmount(e.target.value)}
                                placeholder={t('annuity.form.loanAmountPlaceholder')}
                                className="form-input-enhanced"
                            />
                        </div>

                        {/* Loan Period */}
                        <div className="space-y-2">
                            <Label htmlFor="period">{t('annuity.form.period')}</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="period"
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={periodYears}
                                    onChange={(e) => setPeriodYears(e.target.value)}
                                    className="form-input-enhanced"
                                />
                                <span className="flex items-center text-sm text-muted-foreground whitespace-nowrap">
                                    {t('annuity.form.periodYears')}
                                </span>
                            </div>
                        </div>

                        {/* Interest Rate */}
                        <div className="space-y-2">
                            <Label htmlFor="interestRate">{t('annuity.form.interestRate')}</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="interestRate"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={interestRate}
                                    onChange={(e) => setInterestRate(e.target.value)}
                                    placeholder={t('annuity.form.interestRatePlaceholder')}
                                    className="form-input-enhanced"
                                />
                                <span className="flex items-center text-sm text-muted-foreground">%</span>
                            </div>
                        </div>

                        {/* Payment Periodicity */}
                        <div className="space-y-2">
                            <Label>{t('annuity.form.periodicity')}</Label>
                            <Select value={periodicity} onValueChange={(v) => setPeriodicity(v as PaymentPeriodicity)}>
                                <SelectTrigger className="form-input-enhanced">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monthly">{t('annuity.form.periodicityOptions.monthly')}</SelectItem>
                                    <SelectItem value="quarterly">{t('annuity.form.periodicityOptions.quarterly')}</SelectItem>
                                    <SelectItem value="semiAnnually">{t('annuity.form.periodicityOptions.semiAnnually')}</SelectItem>
                                    <SelectItem value="annually">{t('annuity.form.periodicityOptions.annually')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Results Summary */}
            {result.periodicPayment > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="pt-6">
                            <p className="text-sm text-muted-foreground">{t('annuity.results.regularPayment')}</p>
                            <p className="text-3xl font-bold text-primary">{formatCurrencyRaw(result.periodicPayment)}</p>
                            <p className="text-xs text-muted-foreground mt-1">{t('annuity.results.perPeriod')}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <p className="text-sm text-muted-foreground">{t('annuity.results.totalPayments')}</p>
                            <p className="text-2xl font-semibold">{formatCurrencyRaw(result.totalPayments)}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <p className="text-sm text-muted-foreground">{t('annuity.results.totalInterest')}</p>
                            <p className="text-2xl font-semibold text-orange-600 dark:text-orange-400">{formatCurrencyRaw(result.totalInterest)}</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Chart */}
            {chartData.length > 0 && (
            <Card className="p-6 border">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium">{t('annuity.chart.title')}</h3>
                        {periodicity !== 'annually' && (
                            <div className="flex gap-1 p-1 bg-card border rounded-lg">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-8 px-4 ${chartView === 'period' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''}`}
                                    onClick={() => setChartView('period')}
                                >
                                    {t(`annuity.form.periodicityOptions.${periodicity}`)}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-8 px-4 ${chartView === 'yearly' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''}`}
                                    onClick={() => setChartView('yearly')}
                                >
                                    {t('annuity.chart.yearly')}
                                </Button>
                            </div>
                        )}
                    </div>
                    <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height={350}>
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                <defs>
                                    <linearGradient id="colorPrincipal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1}/>
                                    </linearGradient>
                                    <linearGradient id="colorInterest" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0.1}/>
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
                                    formatter={(value, name) => [
                                        formatCurrencyRaw(value as number ?? 0), 
                                        name === 'principal' ? t('annuity.chart.principal') : t('annuity.chart.interest')
                                    ]}
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--popover))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '6px',
                                    }}
                                    labelFormatter={(label) => `${t('annuity.table.year')} ${label}`}
                                    itemSorter={(item) => String(item.dataKey) === 'principal' ? 0 : 1}
                                />
                                <Legend 
                                    formatter={(value) => value === 'principal' ? t('annuity.chart.principal') : t('annuity.chart.interest')}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="interest"
                                    stackId="1"
                                    stroke="hsl(var(--destructive))"
                                    fill="url(#colorInterest)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="principal"
                                    stackId="1"
                                    stroke="hsl(var(--chart-1))"
                                    fill="url(#colorPrincipal)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            )}

            {/* Expandable Amortization Table */}
            {result.schedule.length > 0 && (
                <Card>
                    <CardHeader>
                        <Button
                            variant="ghost"
                            className="w-full justify-start p-0 h-auto hover:bg-transparent"
                            onClick={() => setShowSchedule(!showSchedule)}
                        >
                            <div className="flex items-center gap-2">
                                {showSchedule ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                <CardTitle className="text-lg">{t('annuity.table.title')}</CardTitle>
                            </div>
                        </Button>
                    </CardHeader>
                    {showSchedule && (
                        <CardContent>
                            <div className="max-h-[500px] overflow-auto rounded-md border">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background">
                                        <TableRow>
                                            <TableHead className="w-16">{t('annuity.table.periodNo')}</TableHead>
                                            <TableHead>{t('annuity.table.year')}</TableHead>
                                            <TableHead>{t('annuity.table.month')}</TableHead>
                                            <TableHead className="text-right">{t('annuity.table.payment')}</TableHead>
                                            <TableHead className="text-right">{t('annuity.table.principalPayment')}</TableHead>
                                            <TableHead className="text-right">{t('annuity.table.interestPayment')}</TableHead>
                                            <TableHead className="text-right">{t('annuity.table.remainingBalance')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {result.schedule.map((row: AmortizationRow) => (
                                            <TableRow key={row.periodNumber}>
                                                <TableCell className="font-medium">{row.periodNumber}</TableCell>
                                                <TableCell>{row.year}</TableCell>
                                                <TableCell>{row.month}</TableCell>
                                                <TableCell className="text-right">{formatCurrencyRaw(row.payment)}</TableCell>
                                                <TableCell className="text-right text-primary">{formatCurrencyRaw(row.principalPayment)}</TableCell>
                                                <TableCell className="text-right text-orange-600 dark:text-orange-400">{formatCurrencyRaw(row.interestPayment)}</TableCell>
                                                <TableCell className="text-right">{formatCurrencyRaw(row.remainingBalance)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    )}
                </Card>
            )}
        </div>
    );
}
