/**
 * Annuity Calculator Utility
 * 
 * Provides functions for calculating annuity loan payments and generating
 * amortization schedules. Can be reused throughout the app.
 */

export type PaymentPeriodicity = 'monthly' | 'quarterly' | 'semiAnnually' | 'annually';

export interface AmortizationRow {
    periodNumber: number;
    year: number;
    month: number;
    payment: number;
    principalPayment: number;
    interestPayment: number;
    remainingBalance: number;
}

export interface AnnuityCalculationResult {
    periodicPayment: number;
    totalPayments: number;
    totalInterest: number;
    schedule: AmortizationRow[];
}

/**
 * Get the number of payment periods per year based on periodicity
 */
export function getPeriodsPerYear(periodicity: PaymentPeriodicity): number {
    switch (periodicity) {
        case 'monthly': return 12;
        case 'quarterly': return 4;
        case 'semiAnnually': return 2;
        case 'annually': return 1;
    }
}

/**
 * Calculate the periodic payment for an annuity loan
 * 
 * @param principal - The loan amount
 * @param annualInterestRate - Annual interest rate as percentage (e.g., 5.5 for 5.5%)
 * @param totalPeriods - Total number of payment periods
 * @param periodsPerYear - Number of payment periods per year (12 for monthly, 4 for quarterly, etc.)
 * @returns The periodic payment amount
 */
export function calculateAnnuityPayment(
    principal: number,
    annualInterestRate: number,
    totalPeriods: number,
    periodsPerYear: number
): number {
    if (principal <= 0 || totalPeriods <= 0) {
        return 0;
    }

    // Convert annual rate to periodic rate
    const periodicRate = (annualInterestRate / 100) / periodsPerYear;

    // Handle zero interest rate case
    if (periodicRate === 0) {
        return principal / totalPeriods;
    }

    // Standard annuity formula: PMT = P * (r(1+r)^n) / ((1+r)^n - 1)
    const compoundFactor = Math.pow(1 + periodicRate, totalPeriods);
    const payment = principal * (periodicRate * compoundFactor) / (compoundFactor - 1);

    return payment;
}

/**
 * Generate a complete amortization schedule for an annuity loan
 * 
 * @param principal - The loan amount
 * @param annualInterestRate - Annual interest rate as percentage (e.g., 5.5 for 5.5%)
 * @param totalPeriods - Total number of payment periods
 * @param periodsPerYear - Number of payment periods per year
 * @returns Full calculation result including payment amount and amortization schedule
 */
export function generateAmortizationSchedule(
    principal: number,
    annualInterestRate: number,
    totalPeriods: number,
    periodsPerYear: number
): AnnuityCalculationResult {
    const periodicPayment = calculateAnnuityPayment(principal, annualInterestRate, totalPeriods, periodsPerYear);
    
    if (periodicPayment === 0) {
        return {
            periodicPayment: 0,
            totalPayments: 0,
            totalInterest: 0,
            schedule: []
        };
    }

    const periodicRate = (annualInterestRate / 100) / periodsPerYear;
    const schedule: AmortizationRow[] = [];
    let remainingBalance = principal;
    let totalInterest = 0;

    // Calculate month increment based on periodicity
    const monthsPerPeriod = 12 / periodsPerYear;

    for (let period = 1; period <= totalPeriods; period++) {
        const interestPayment = remainingBalance * periodicRate;
        const principalPayment = periodicPayment - interestPayment;
        remainingBalance = Math.max(0, remainingBalance - principalPayment);
        totalInterest += interestPayment;

        // Calculate year and month for this period
        const totalMonths = period * monthsPerPeriod;
        const year = Math.ceil(totalMonths / 12);
        const month = ((totalMonths - 1) % 12) + 1;

        schedule.push({
            periodNumber: period,
            year,
            month,
            payment: periodicPayment,
            principalPayment,
            interestPayment,
            remainingBalance
        });
    }

    return {
        periodicPayment,
        totalPayments: periodicPayment * totalPeriods,
        totalInterest,
        schedule
    };
}

/**
 * Convert period in years to total number of payment periods
 */
export function yearsToTotalPeriods(years: number, periodsPerYear: number): number {
    return years * periodsPerYear;
}

/**
 * Convert period in months to total number of payment periods
 */
export function monthsToTotalPeriods(months: number, periodsPerYear: number): number {
    return Math.ceil(months / (12 / periodsPerYear));
}
