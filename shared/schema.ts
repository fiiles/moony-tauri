/**
 * Shared Schema Types for Tauri Frontend
 * 
 * These are TypeScript types matching the Rust backend models,
 * without the drizzle-orm dependencies.
 */

import { z } from "zod";

// User Profile
export interface UserProfile {
    id: number;
    name: string;
    surname: string;
    email: string;
    menuPreferences: MenuPreferences;
    currency: string;
    language?: string;
    excludePersonalRealEstate: boolean;
    createdAt: number;
}

export interface MenuPreferences {
    savings: boolean;
    loans: boolean;
    insurance: boolean;
    investments: boolean;
    bonds: boolean;
    realEstate: boolean;
}

// Savings
export interface SavingsAccount {
    id: string;
    name: string;
    balance: string;
    currency: string;
    interestRate: string;
    hasZoneDesignation: boolean;
    createdAt: number;
    updatedAt: number;
    effectiveInterestRate?: number;
    projectedEarnings?: number;
    terminationDate?: number | null;
}

export interface SavingsAccountZone {
    id: string;
    savingsAccountId: string;
    fromAmount: string;
    toAmount: string | null;
    interestRate: string;
    createdAt: number;
}

// Stock Investments
export interface StockInvestment {
    id: string;
    ticker: string;
    companyName: string;
    quantity: string;
    averagePrice: string;
}

export interface InvestmentTransaction {
    id: string;
    investmentId: string;
    type: string;
    ticker: string;
    companyName: string;
    quantity: string;
    pricePerUnit: string;
    currency: string;
    transactionDate: number;
    createdAt: number;
}

// Crypto
export interface CryptoInvestment {
    id: string;
    ticker: string;
    coingeckoId: string;
    name: string;
    quantity: string;
    averagePrice: string;
}

export interface CryptoTransaction {
    id: string;
    investmentId: string;
    type: string;
    ticker: string;
    name: string;
    quantity: string;
    pricePerUnit: string;
    currency: string;
    transactionDate: number;
    createdAt: number;
}

// Bonds
export interface Bond {
    id: string;
    name: string;
    isin: string;
    couponValue: string;
    quantity: string;
    currency: string;
    interestRate: string;
    maturityDate: number | null;
    createdAt: number;
    updatedAt: number;
}

// Loans
export interface Loan {
    id: string;
    name: string;
    principal: string;
    currency: string;
    interestRate: string;
    interestRateValidityDate: number | null;
    monthlyPayment: string;
    startDate: number;
    endDate: number | null;
    createdAt: number;
    updatedAt: number;
}

// Real Estate
export interface RecurringCost {
    name: string;
    amount: number;
    frequency: string;
    currency?: string;
}

export interface RealEstate {
    id: string;
    name: string;
    address: string;
    type: string;
    purchasePrice: string;
    purchasePriceCurrency: string;
    marketPrice: string;
    marketPriceCurrency: string;
    monthlyRent: string | null;
    monthlyRentCurrency: string | null;
    recurringCosts: RecurringCost[];
    photos: string[];
    notes: string | null;
    createdAt: number;
    updatedAt: number;
    // Helper fields from backend logic (optional in DB but present in API usually if enriched, otherwise optional)
    // Actually looking at the usage in RealEstate.tsx, these seem to be expected always or defaulted.
    // The previous code had strict types for some but not others.
    // Let's add them as optional or check if they are actually in the DB model.
    // If they are not in the DB model but computed/returned, we might need a separate type or add them here.
}

export interface RealEstateOneTimeCost {
    id: string;
    realEstateId: string;
    name: string;
    description: string | null;
    amount: string;
    currency: string;
    date: number;
    createdAt: number;
}

// Real Estate Photos
export interface RealEstatePhotoBatch {
    id: string;
    realEstateId: string;
    photoDate: number;
    description: string | null;
    photos: RealEstatePhoto[];
    createdAt: number;
}

export interface RealEstatePhoto {
    id: string;
    batchId: string;
    filePath: string;
    thumbnailPath: string;
    createdAt: number;
}

// Real Estate Document
export interface RealEstateDocument {
    id: string;
    realEstateId: string;
    name: string;
    description: string | null;
    filePath: string;
    fileType: string;  // 'deed' | 'contract' | 'appraisal' | 'other'
    fileSize: number | null;
    uploadedAt: number;
}

// Insurance
export interface InsuranceLimit {
    title: string;
    amount: number;
    currency: string;
}

export interface InsurancePolicy {
    id: string;
    type: string;
    provider: string;
    policyName: string;
    policyNumber: string | null;
    startDate: number;
    endDate: number | null;
    paymentFrequency: string;
    oneTimePayment: string | null;
    oneTimePaymentCurrency: string | null;
    regularPayment: string;
    regularPaymentCurrency: string;
    limits: InsuranceLimit[];
    notes: string | null;
    status: string;
    createdAt: number;
    updatedAt: number;
}

// Insurance Document
export interface InsuranceDocument {
    id: string;
    insuranceId: string;
    name: string;
    description: string | null;
    filePath: string;
    fileType: string;  // 'contract' | 'certificate' | 'claim' | 'other'
    fileSize: number | null;
    uploadedAt: number;
}

// Other Assets
export interface OtherAsset {
    id: string;
    name: string;
    quantity: string;
    marketPrice: string;
    currency: string;
    averagePurchasePrice: string;
    yieldType: string;
    yieldValue: string | null;
    createdAt: number;
    updatedAt: number;
}

export interface OtherAssetTransaction {
    id: string;
    assetId: string;
    type: string;
    quantity: string;
    pricePerUnit: string;
    currency: string;
    transactionDate: number;
    createdAt: number;
}

// Portfolio
export interface PortfolioMetrics {
    totalSavings: number;
    totalInvestments: number;
    totalCrypto: number;
    totalBonds: number;
    totalRealEstatePersonal: number;
    totalRealEstateInvestment: number;
    totalRealEstate: number;
    totalOtherAssets: number;
    totalLiabilities: number;
    totalAssets: number;
    netWorth: number;
}

export interface PortfolioMetricsHistory {
    id: string;
    totalSavings: string;
    totalLoansPrincipal: string;
    totalInvestments: string;
    totalCrypto: string;
    totalBonds: string;
    totalRealEstatePersonal: string;
    totalRealEstateInvestment: string;
    totalOtherAssets: string;
    recordedAt: number;
}

// Zod Schemas for form validation
export const setupSchema = z.object({
    name: z.string().min(1, "Name is required"),
    surname: z.string().min(1, "Surname is required"),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm password is required"),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

export const unlockSchema = z.object({
    password: z.string().min(1, "Password is required"),
});

export const recoverSchema = z.object({
    recoveryKey: z.string().min(1, "Recovery key is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm password is required"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

export const insertSavingsAccountSchema = z.object({
    name: z.string().min(1),
    balance: z.string(),
    currency: z.string().optional(),
    interestRate: z.string().optional(),
    hasZoneDesignation: z.boolean().optional(),
});

export const insertBondSchema = z.object({
    name: z.string().min(1),
    isin: z.string().min(1),
    couponValue: z.string(),
    quantity: z.string().optional(),
    interestRate: z.string().optional(),
    maturityDate: z.date().or(z.number()).optional(),
});
export type InsertBond = z.infer<typeof insertBondSchema>;

export const insertLoanSchema = z.object({
    name: z.string().min(1),
    principal: z.string(),
    currency: z.string().optional(),
    interestRate: z.string().optional(),
    interestRateValidityDate: z.date().or(z.number()).optional(),
    monthlyPayment: z.string().optional(),
    startDate: z.date().or(z.number()).optional(),
    endDate: z.date().or(z.number()).optional(),
});

// Type aliases for Insert types
export type InsertSavingsAccount = z.infer<typeof insertSavingsAccountSchema>;
export type InsertLoan = z.infer<typeof insertLoanSchema>;

// Insurance schemas
export const insertInsurancePolicySchema = z.object({
    type: z.string().min(1),
    provider: z.string().min(1),
    policyName: z.string().min(1),
    policyNumber: z.string().optional(),
    startDate: z.number(),
    endDate: z.number().optional(),
    paymentFrequency: z.string(),
    oneTimePayment: z.string().optional(),
    oneTimePaymentCurrency: z.string().optional(),
    regularPayment: z.string().optional(),
    regularPaymentCurrency: z.string().optional(),
    limits: z.array(z.object({
        title: z.string(),
        amount: z.number(),
        currency: z.string(),
    })).optional(),
    notes: z.string().optional(),
    status: z.string().optional(),
});
export type InsertInsurancePolicy = z.infer<typeof insertInsurancePolicySchema>;

// Real Estate schemas
export const insertRealEstateSchema = z.object({
    name: z.string().min(1),
    address: z.string().min(1),
    type: z.string().min(1),
    purchasePrice: z.string().optional(),
    purchasePriceCurrency: z.string().optional(),
    marketPrice: z.string().optional(),
    marketPriceCurrency: z.string().optional(),
    monthlyRent: z.string().optional().nullable(),
    monthlyRentCurrency: z.string().optional(),
    recurringCosts: z.array(z.object({
        name: z.string(),
        amount: z.number(),
        frequency: z.string(),
        currency: z.string().optional(),
    })).optional(),
    photos: z.array(z.string()).optional(),
    notes: z.string().optional(),
});
export type InsertRealEstate = z.infer<typeof insertRealEstateSchema>;

export const insertRealEstateOneTimeCostSchema = z.object({
    realEstateId: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    amount: z.string(),
    currency: z.string().optional(),
    date: z.date().or(z.number()),
});
export type InsertRealEstateOneTimeCost = z.infer<typeof insertRealEstateOneTimeCostSchema>;

// Other Assets schemas
export const insertOtherAssetSchema = z.object({
    name: z.string().min(1),
    quantity: z.string().optional(),
    marketPrice: z.string().optional(),
    currency: z.string().optional(),
    averagePurchasePrice: z.string().optional(),
    yieldType: z.string().optional(),
    yieldValue: z.string().optional(),
});
export type InsertOtherAsset = z.infer<typeof insertOtherAssetSchema>;

export const insertOtherAssetTransactionSchema = z.object({
    assetId: z.string().optional(),
    type: z.string(),
    quantity: z.string(),
    pricePerUnit: z.string(),
    currency: z.string(),
    transactionDate: z.number(),
});
export type InsertOtherAssetTransaction = z.infer<typeof insertOtherAssetTransactionSchema>;

// Investment transaction schema
export const insertInvestmentTransactionSchema = z.object({
    investmentId: z.string().optional(),
    type: z.string(),
    ticker: z.string(),
    companyName: z.string(),
    quantity: z.string(),
    pricePerUnit: z.string(),
    currency: z.string(),
    transactionDate: z.number(),
});
export type InsertInvestmentTransaction = z.infer<typeof insertInvestmentTransactionSchema>;

// Legacy Instrument types (for compatibility)
export interface Instrument {
    id: string;
    name: string;
    code: string;
    type: string;
    currentPrice: string;
    previousPrice: string | null;
}

export interface Purchase {
    id: string;
    instrumentId: string;
    purchaseDate: number;
    quantity: string;
    pricePerUnit: string;
    fees: string;
    note: string | null;
}

export const insertInstrumentSchema = z.object({
    name: z.string().min(1),
    code: z.string().min(1),
    type: z.string(),
    currentPrice: z.string().optional(),
    previousPrice: z.string().optional().nullable(),
});
export type InsertInstrument = z.infer<typeof insertInstrumentSchema>;

export const insertPurchaseSchema = z.object({
    instrumentId: z.string(),
    purchaseDate: z.number(),
    quantity: z.string(),
    pricePerUnit: z.string(),
    fees: z.string().optional(),
    note: z.string().optional(),
});
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;

// Stock Investment with Price (enriched type from API)
export interface StockInvestmentWithPrice extends StockInvestment {
    currentPrice: string;
    fetchedAt: number | null;
    isManualPrice: boolean;
    dividendYield: number;
    dividendCurrency: string;
    isManualDividend: boolean;
}

// Crypto Investment with Price (enriched type from API)
export interface CryptoInvestmentWithPrice extends CryptoInvestment {
    currentPrice: string;
    fetchedAt: number | null;
}

// Cashflow Types
export interface CashflowItem {
    id: string;
    name: string;
    amount: string;
    currency: string;
    frequency: 'monthly' | 'yearly';
    itemType: 'income' | 'expense';
    category: string;
    createdAt: number;
    updatedAt: number;
}

export interface CashflowReportItem {
    id: string;
    name: string;
    amount: number;
    originalAmount: number;
    originalCurrency: string;
    originalFrequency: 'monthly' | 'yearly';
    isUserDefined: boolean;
}

export interface CashflowCategory {
    key: string;
    name: string;
    total: number;
    items: CashflowReportItem[];
    isUserEditable: boolean;
}

export interface CashflowSection {
    income: CashflowCategory[];
    expenses: CashflowCategory[];
    totalIncome: number;
    totalExpenses: number;
    netCashflow: number;
}

export interface CashflowReport {
    viewType: 'monthly' | 'yearly';
    personal: CashflowSection;
    investments: CashflowSection;
    totalIncome: number;
    totalExpenses: number;
    netCashflow: number;
}

// Projection Types
export interface ProjectionSettings {
    id: string;
    assetType: 'savings' | 'investments' | 'crypto' | 'bonds' | 'real_estate' | 'other_assets' | 'loans';
    yearlyGrowthRate: string;
    monthlyContribution: string;
    contributionCurrency: string;
    enabled: boolean;
    createdAt?: number;
    updatedAt?: number;
}

export interface ProjectionTimelinePoint {
    date: number;
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
    savings: number;
    investments: number;
    crypto: number;
    bonds: number;
    realEstate: number;
    otherAssets: number;
    loans: number;
}

export interface PortfolioProjection {
    horizonYears: number;
    viewType: 'monthly' | 'yearly';
    timeline: ProjectionTimelinePoint[];
    projectedNetWorth: number;
    totalContributions: number;
    totalGrowth: number;
    calculatedDefaults: CalculatedDefaults;
}

export interface CalculatedDefaults {
    savingsRate: number;
    bondsRate: number;
}

