import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrency } from "@/lib/currency";
import { calculateAnnuityPayment, getPeriodsPerYear, yearsToTotalPeriods, generateAmortizationSchedule } from "@/utils/annuity";

export default function EstateCalculator() {
    const { t } = useTranslation('calculators');
    const { formatCurrencyRaw } = useCurrency();

    // Form state - User inputs
    const [purchasePrice, setPurchasePrice] = useState<string>("5000000");
    const [loanAmount, setLoanAmount] = useState<string>("4000000");
    const [loanPeriodYears, setLoanPeriodYears] = useState<string>("30");
    const [interestRate, setInterestRate] = useState<string>("5");
    const [expectedRental, setExpectedRental] = useState<string>("20000");
    const [monthlyExpenses, setMonthlyExpenses] = useState<string>("3000");
    const [unoccupiedMonths, setUnoccupiedMonths] = useState<string>("0.5");

    // Projection state
    const [rentalGrowth, setRentalGrowth] = useState<string>("2");
    const [costsGrowth, setCostsGrowth] = useState<string>("2");
    const [priceGrowth, setPriceGrowth] = useState<string>("3");
    const [investmentDuration, setInvestmentDuration] = useState<string>("10");
    const [oneTimeCostsTotal, setOneTimeCostsTotal] = useState<string>("200000");

    // Calculate all derived values
    const calculations = useMemo(() => {
        const price = parseFloat(purchasePrice) || 0;
        const loan = parseFloat(loanAmount) || 0;
        const years = parseFloat(loanPeriodYears) || 0;
        const rate = parseFloat(interestRate) || 0;
        const rental = parseFloat(expectedRental) || 0;
        const expenses = parseFloat(monthlyExpenses) || 0;
        const unoccupied = parseFloat(unoccupiedMonths) || 0;

        // Own Capital = Purchase Price - Loan Amount
        const ownCapital = price - loan;

        // Monthly Loan Payment using annuity formula
        let monthlyLoanPayment = 0;
        if (loan > 0 && years > 0) {
            const periodsPerYear = getPeriodsPerYear('monthly');
            const totalPeriods = yearsToTotalPeriods(years, periodsPerYear);
            monthlyLoanPayment = calculateAnnuityPayment(loan, rate, totalPeriods, periodsPerYear);
        }

        // Gross Cashflow = Rental - Monthly Loan Payment
        const grossCashflow = rental - monthlyLoanPayment;

        // Net Cashflow = Gross Cashflow - Monthly Expenses - (Rental * Unoccupied Months / 12)
        const vacancyCost = (rental * unoccupied) / 12;
        const netCashflow = grossCashflow - expenses - vacancyCost;

        // Yield on Own Capital = (Net Cashflow * 12 / Own Capital) * 100
        const yieldOnCapital = ownCapital > 0 ? ((netCashflow * 12) / ownCapital) * 100 : 0;

        // LTV (Loan-to-Value) = (Loan Amount / Purchase Price) * 100
        const ltv = price > 0 ? (loan / price) * 100 : 0;

        return {
            ownCapital,
            monthlyLoanPayment,
            grossCashflow,
            netCashflow,
            yieldOnCapital,
            ltv
        };
    }, [purchasePrice, loanAmount, loanPeriodYears, interestRate, expectedRental, monthlyExpenses, unoccupiedMonths]);

    // Projection calculations
    const projection = useMemo(() => {
        const price = parseFloat(purchasePrice) || 0;
        const loan = parseFloat(loanAmount) || 0;
        const loanYears = parseFloat(loanPeriodYears) || 0;
        const rate = parseFloat(interestRate) || 0;
        const initialRental = parseFloat(expectedRental) || 0;
        const initialExpenses = parseFloat(monthlyExpenses) || 0;
        const unoccupied = parseFloat(unoccupiedMonths) || 0;
        const rentalGrowthRate = (parseFloat(rentalGrowth) || 0) / 100;
        const costsGrowthRate = (parseFloat(costsGrowth) || 0) / 100;
        const priceGrowthRate = (parseFloat(priceGrowth) || 0) / 100;
        const duration = parseFloat(investmentDuration) || 0;
        const totalOneTimeCosts = parseFloat(oneTimeCostsTotal) || 0;

        const ownCapital = price - loan;
        const monthlyOneTimeCost = duration > 0 ? totalOneTimeCosts / (duration * 12) : 0;

        // Calculate monthly loan payment
        let monthlyLoanPayment = 0;
        let amortizationSchedule: { remainingBalance: number }[] = [];
        if (loan > 0 && loanYears > 0) {
            const periodsPerYear = getPeriodsPerYear('monthly');
            const totalPeriods = yearsToTotalPeriods(loanYears, periodsPerYear);
            monthlyLoanPayment = calculateAnnuityPayment(loan, rate, totalPeriods, periodsPerYear);
            const result = generateAmortizationSchedule(loan, rate, totalPeriods, periodsPerYear);
            amortizationSchedule = result.schedule;
        }

        // Final estate price after appreciation
        const finalEstatePrice = price * Math.pow(1 + priceGrowthRate, duration);

        // Remaining loan balance after investment duration
        const monthsInDuration = Math.min(duration * 12, loanYears * 12);
        let remainingLoanBalance = loan;
        if (amortizationSchedule.length > 0 && monthsInDuration > 0) {
            const scheduleIndex = Math.min(Math.floor(monthsInDuration) - 1, amortizationSchedule.length - 1);
            remainingLoanBalance = scheduleIndex >= 0 ? amortizationSchedule[scheduleIndex].remainingBalance : 0;
        }
        // If investment duration exceeds loan period, loan is paid off
        if (duration >= loanYears) {
            remainingLoanBalance = 0;
        }

        // Calculate cumulative net cashflow and find positive cashflow month
        let cumulativeNetCashflow = 0;
        let positiveMonthCashflow: number | null = null;
        let currentRental = initialRental;
        let currentExpenses = initialExpenses;

        for (let month = 1; month <= duration * 12; month++) {
            // At the start of each year (after year 1), apply growth rates
            if (month > 1 && (month - 1) % 12 === 0) {
                currentRental = currentRental * (1 + rentalGrowthRate);
                currentExpenses = currentExpenses * (1 + costsGrowthRate);
            }

            const vacancyCost = (currentRental * unoccupied) / 12;
            const grossCashflow = currentRental - monthlyLoanPayment;
            // Operational cashflow (without one-time costs) - this is what's displayed as "Net Cashflow"
            const operationalCashflow = grossCashflow - currentExpenses - vacancyCost;
            // Full cashflow including spread one-time costs
            const netCashflow = operationalCashflow - monthlyOneTimeCost;

            cumulativeNetCashflow += netCashflow;

            // Check for positive OPERATIONAL cashflow (matches displayed Net Cashflow)
            if (positiveMonthCashflow === null && operationalCashflow >= 0) {
                positiveMonthCashflow = month;
            }
        }

        // Total return calculation
        // Total Return = (Final Estate Price - Remaining Loan Balance) - Initial Own Capital + Cumulative Net Cashflows
        const netEquityAtEnd = finalEstatePrice - remainingLoanBalance;
        const totalReturn = netEquityAtEnd - ownCapital + cumulativeNetCashflow;
        
        // Final value multiple = (what you end with) / (what you put in)
        const finalValueMultiple = ownCapital > 0 ? (netEquityAtEnd + cumulativeNetCashflow) / ownCapital : 0;
        
        // Projection yield as percentage of original (e.g., 292% means you end with 2.92x)
        const projectionYield = (finalValueMultiple - 1) * 100;
        
        // CAGR formula: (final/initial)^(1/n) - 1
        const annualizedYield = ownCapital > 0 && duration > 0 && finalValueMultiple > 0
            ? (Math.pow(finalValueMultiple, 1 / duration) - 1) * 100 
            : 0;

        return {
            finalEstatePrice,
            remainingLoanBalance,
            cumulativeNetCashflow,
            positiveMonthCashflow,
            totalReturn,
            projectionYield,
            annualizedYield,
            netEquityAtEnd
        };
    }, [purchasePrice, loanAmount, loanPeriodYears, interestRate, expectedRental, monthlyExpenses, unoccupiedMonths, rentalGrowth, costsGrowth, priceGrowth, investmentDuration, oneTimeCostsTotal]);

    // Helper to format yield percentage
    const formatPercentage = (value: number) => {
        return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
    };

    return (
        <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h1 className="page-title">{t('estate.title')}</h1>
                <p className="page-subtitle">{t('estate.subtitle')}</p>
            </div>

            {/* Input Form */}
            <Card>
                <CardContent className="pt-6">
                    <h2 className="text-xl font-semibold mb-6">{t('estate.form.purchaseParameters')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Purchase Price */}
                        <div className="space-y-2">
                            <Label htmlFor="purchasePrice">{t('estate.form.purchasePrice')}</Label>
                            <Input
                                id="purchasePrice"
                                type="number"
                                min="0"
                                step="10000"
                                value={purchasePrice}
                                onChange={(e) => setPurchasePrice(e.target.value)}
                                placeholder={t('estate.form.purchasePricePlaceholder')}
                                className="form-input-enhanced"
                            />
                        </div>

                        {/* Loan Amount */}
                        <div className="space-y-2">
                            <Label htmlFor="loanAmount">{t('estate.form.loanAmount')}</Label>
                            <Input
                                id="loanAmount"
                                type="number"
                                min="0"
                                step="10000"
                                value={loanAmount}
                                onChange={(e) => setLoanAmount(e.target.value)}
                                placeholder={t('estate.form.loanAmountPlaceholder')}
                                className="form-input-enhanced"
                            />
                            <p className="text-xs text-muted-foreground">{t('estate.form.optional')}</p>
                        </div>

                        {/* Loan Period */}
                        <div className="space-y-2">
                            <Label htmlFor="loanPeriod">{t('estate.form.loanPeriod')}</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="loanPeriod"
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={loanPeriodYears}
                                    onChange={(e) => setLoanPeriodYears(e.target.value)}
                                    className="form-input-enhanced"
                                />
                                <span className="flex items-center text-sm text-muted-foreground whitespace-nowrap">
                                    {t('estate.form.years')}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{t('estate.form.optional')}</p>
                        </div>

                        {/* Interest Rate */}
                        <div className="space-y-2">
                            <Label htmlFor="interestRate">{t('estate.form.interestRate')}</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="interestRate"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={interestRate}
                                    onChange={(e) => setInterestRate(e.target.value)}
                                    placeholder={t('estate.form.interestRatePlaceholder')}
                                    className="form-input-enhanced"
                                />
                                <span className="flex items-center text-sm text-muted-foreground">%</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{t('estate.form.optional')}</p>
                        </div>
                    </div>

                    {/* Calculated Values Row */}
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Own Capital (Calculated) */}
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">{t('estate.form.ownCapital')}</span>
                                <span className="text-lg font-semibold text-primary">{formatCurrencyRaw(calculations.ownCapital)}</span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-xs text-muted-foreground">{t('estate.form.ownCapitalDescription')}</span>
                                <span className="text-xs text-muted-foreground">{t('estate.form.ltv')}: {calculations.ltv.toFixed(1)}%</span>
                            </div>
                        </div>

                        {/* Monthly Loan Payment (Calculated) */}
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">{t('estate.form.monthlyLoanPayment')}</span>
                                <span className="text-lg font-semibold text-red-600 dark:text-red-400">
                                    {formatCurrencyRaw(calculations.monthlyLoanPayment)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-xs text-muted-foreground">{t('estate.form.monthlyLoanPaymentDescription')}</span>
                                <span className="text-xs text-muted-foreground">{t('estate.form.perMonth')}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Rental Income Section */}
            <Card>
                <CardContent className="pt-6">
                    <h2 className="text-xl font-semibold mb-6">{t('estate.form.rentalParameters')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Expected Rental */}
                        <div className="space-y-2">
                            <Label htmlFor="expectedRental">{t('estate.form.expectedRental')}</Label>
                            <Input
                                id="expectedRental"
                                type="number"
                                min="0"
                                step="100"
                                value={expectedRental}
                                onChange={(e) => setExpectedRental(e.target.value)}
                                placeholder={t('estate.form.expectedRentalPlaceholder')}
                                className="form-input-enhanced"
                            />
                            <p className="text-xs text-muted-foreground">{t('estate.form.perMonth')}</p>
                        </div>

                        {/* Expected Monthly Costs */}
                        <div className="space-y-2">
                            <Label htmlFor="monthlyExpenses">{t('estate.form.monthlyExpenses')}</Label>
                            <Input
                                id="monthlyExpenses"
                                type="number"
                                min="0"
                                step="100"
                                value={monthlyExpenses}
                                onChange={(e) => setMonthlyExpenses(e.target.value)}
                                placeholder={t('estate.form.monthlyExpensesPlaceholder')}
                                className="form-input-enhanced"
                            />
                            <p className="text-xs text-muted-foreground">{t('estate.form.monthlyExpensesDescription')}</p>
                        </div>

                        {/* Unoccupied Months */}
                        <div className="space-y-2">
                            <Label htmlFor="unoccupiedMonths">{t('estate.form.unoccupiedMonths')}</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="unoccupiedMonths"
                                    type="number"
                                    min="0"
                                    max="12"
                                    step="0.1"
                                    value={unoccupiedMonths}
                                    onChange={(e) => setUnoccupiedMonths(e.target.value)}
                                    placeholder="0.5"
                                    className="form-input-enhanced"
                                />
                                <span className="flex items-center text-sm text-muted-foreground whitespace-nowrap">
                                    {t('estate.form.monthsPerYear')}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{t('estate.form.unoccupiedMonthsDescription')}</p>
                        </div>
                    </div>

                    {/* Calculated Cashflow Values Row */}
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Monthly Gross Cashflow */}
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">{t('estate.results.grossCashflow')}</span>
                                <span className={`text-lg font-semibold ${calculations.grossCashflow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatCurrencyRaw(calculations.grossCashflow)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-xs text-muted-foreground">{t('estate.form.grossCashflowDescription')}</span>
                                <span className="text-xs text-muted-foreground">{t('estate.form.perMonth')}</span>
                            </div>
                        </div>

                        {/* Monthly Net Cashflow */}
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">{t('estate.results.netCashflow')}</span>
                                <span className={`text-lg font-semibold ${calculations.netCashflow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatCurrencyRaw(calculations.netCashflow)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-xs text-muted-foreground">{t('estate.form.netCashflowDescription')}</span>
                                <span className="text-xs text-muted-foreground">{t('estate.form.perMonth')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Yield on Own Capital - Full Width */}
                    <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">{t('estate.results.yieldOnCapital')}</span>
                            <span className={`text-2xl font-bold ${calculations.yieldOnCapital >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {formatPercentage(calculations.yieldOnCapital)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                            <span className="text-xs text-muted-foreground">{t('estate.form.yieldDescription')}</span>
                            <span className="text-xs text-muted-foreground">{t('estate.results.perYear')}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>


            {/* Projection */}
            <Card>
                <CardContent className="pt-6">
                    <h2 className="text-xl font-semibold mb-6">{t('estate.projection.title')}</h2>
                    
                    {/* Projection Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
                        {/* Rental Growth */}
                        <div className="space-y-2">
                            <Label htmlFor="rentalGrowth">{t('estate.projection.rentalGrowth')}</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="rentalGrowth"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value={rentalGrowth}
                                    onChange={(e) => setRentalGrowth(e.target.value)}
                                    className="form-input-enhanced"
                                />
                                <span className="flex items-center text-sm text-muted-foreground">%</span>
                            </div>
                        </div>

                        {/* Costs Growth */}
                        <div className="space-y-2">
                            <Label htmlFor="costsGrowth">{t('estate.projection.costsGrowth')}</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="costsGrowth"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value={costsGrowth}
                                    onChange={(e) => setCostsGrowth(e.target.value)}
                                    className="form-input-enhanced"
                                />
                                <span className="flex items-center text-sm text-muted-foreground">%</span>
                            </div>
                        </div>

                        {/* Price Growth */}
                        <div className="space-y-2">
                            <Label htmlFor="priceGrowth">{t('estate.projection.priceGrowth')}</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="priceGrowth"
                                    type="number"
                                    min="-10"
                                    max="20"
                                    step="0.1"
                                    value={priceGrowth}
                                    onChange={(e) => setPriceGrowth(e.target.value)}
                                    className="form-input-enhanced"
                                />
                                <span className="flex items-center text-sm text-muted-foreground">%</span>
                            </div>
                        </div>

                        {/* Investment Duration */}
                        <div className="space-y-2">
                            <Label htmlFor="investmentDuration">{t('estate.projection.duration')}</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="investmentDuration"
                                    type="number"
                                    min="1"
                                    max="50"
                                    step="1"
                                    value={investmentDuration}
                                    onChange={(e) => setInvestmentDuration(e.target.value)}
                                    className="form-input-enhanced"
                                />
                                <span className="flex items-center text-sm text-muted-foreground whitespace-nowrap">
                                    {t('estate.form.years')}
                                </span>
                            </div>
                        </div>

                        {/* One-time Costs */}
                        <div className="space-y-2">
                            <Label htmlFor="oneTimeCosts">{t('estate.projection.oneTimeCosts')}</Label>
                            <Input
                                id="oneTimeCosts"
                                type="number"
                                min="0"
                                step="10000"
                                value={oneTimeCostsTotal}
                                onChange={(e) => setOneTimeCostsTotal(e.target.value)}
                                className="form-input-enhanced"
                            />
                            <p className="text-xs text-muted-foreground">{t('estate.projection.oneTimeCostsDescription')}</p>
                        </div>
                    </div>

                    {/* Projection Results - Row 1: Estate Values */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {/* Final Estate Price */}
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">{t('estate.projection.finalPrice')}</span>
                                <span className="text-lg font-semibold">
                                    {formatCurrencyRaw(projection.finalEstatePrice)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-xs text-muted-foreground">{t('estate.projection.afterYears', { years: investmentDuration })}</span>
                                <span className="text-xs text-muted-foreground">
                                    +{formatCurrencyRaw(projection.finalEstatePrice - (parseFloat(purchasePrice) || 0))}
                                </span>
                            </div>
                        </div>

                        {/* Remaining Loan Balance */}
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">{t('estate.projection.remainingLoan')}</span>
                                <span className="text-lg font-semibold text-red-600 dark:text-red-400">
                                    {formatCurrencyRaw(projection.remainingLoanBalance)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-xs text-muted-foreground">{t('estate.projection.paidOff')}</span>
                                <span className="text-xs text-muted-foreground">
                                    {formatCurrencyRaw((parseFloat(loanAmount) || 0) - projection.remainingLoanBalance)}
                                </span>
                            </div>
                        </div>

                        {/* Earnings from Sale */}
                        <div className="col-span-1 md:col-span-2 p-4 bg-muted/50 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">{t('estate.projection.earningsFromSale')}</span>
                                <span className={`text-lg font-semibold ${(projection.finalEstatePrice - projection.remainingLoanBalance - calculations.ownCapital) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatCurrencyRaw(projection.finalEstatePrice - projection.remainingLoanBalance - calculations.ownCapital)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-xs text-muted-foreground">{t('estate.projection.earningsFromSaleDescription')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Cashflow */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {/* Positive Cashflow Month */}
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">{t('estate.projection.positiveCashflow')}</span>
                                <span className={`text-lg font-semibold ${projection.positiveMonthCashflow ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                                    {projection.positiveMonthCashflow 
                                        ? t('estate.projection.month', { month: projection.positiveMonthCashflow })
                                        : t('estate.projection.notInDuration')}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-xs text-muted-foreground">{t('estate.projection.positiveCashflowDescription')}</span>
                                {projection.positiveMonthCashflow && (
                                    <span className="text-xs text-muted-foreground">
                                        {t('estate.projection.year')} {Math.ceil(projection.positiveMonthCashflow / 12)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Cumulative Net Rental Earnings */}
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">{t('estate.projection.cumulativeRentalEarnings')}</span>
                                <span className={`text-lg font-semibold ${projection.cumulativeNetCashflow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatCurrencyRaw(projection.cumulativeNetCashflow)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-xs text-muted-foreground">{t('estate.projection.overDuration')}</span>
                                <span className="text-xs text-muted-foreground">{investmentDuration} {t('estate.form.years')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Total Yield - Full Width */}
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">{t('estate.projection.totalYield')}</span>
                            <div className="text-right">
                                <span className={`text-2xl font-bold ${projection.projectionYield >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatPercentage(projection.projectionYield)}
                                </span>
                                <span className="text-sm text-muted-foreground ml-2">
                                    ({formatPercentage(projection.annualizedYield)} {t('estate.projection.annualized')})
                                </span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                            <span className="text-xs text-muted-foreground">{t('estate.projection.totalYieldDescription')}</span>
                            <span className="text-xs text-muted-foreground">
                                {t('estate.projection.totalReturn')}: {formatCurrencyRaw(projection.totalReturn)}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
