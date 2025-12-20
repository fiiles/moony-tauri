/**
 * Tauri API Client
 *
 * Wraps Tauri invoke calls to provide a consistent API for the frontend.
 * Replaces the HTTP-based API client from the Express.js version.
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  UserProfile,
  SavingsAccount,
  SavingsAccountZone,
  InsertSavingsAccount,
  InvestmentTransaction,
  InsertInvestmentTransaction,
  CryptoTransaction,
  Bond,
  InsertBond,
  Loan,
  InsertLoan,
  RealEstate,
  InsertRealEstate,
  RealEstateOneTimeCost,
  InsertRealEstateOneTimeCost,
  RealEstatePhotoBatch,
  RealEstatePhoto,
  RealEstateDocument,
  InsurancePolicy,
  InsertInsurancePolicy,
  InsuranceDocument,
  OtherAsset,
  InsertOtherAsset,
  OtherAssetTransaction,
  InsertOtherAssetTransaction,
  PortfolioMetrics,
  PortfolioMetricsHistory,
  CashflowReport,
  CashflowItem,
  ProjectionSettings,
  PortfolioProjection,
} from '../../shared/schema';
import type {
  StockInvestmentWithPrice,
  CryptoInvestmentWithPrice,
} from '../../shared/types/extended-types';

// Import result from backend
interface ImportResult {
  success: number;
  imported: string[];
  errors: string[];
}

// Generic invoke wrapper with error handling
async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    // Convert Tauri errors to match our error handling
    console.error(`Tauri command ${command} failed:`, error);
    throw new Error(typeof error === 'string' ? error : String(error));
  }
}

// ============================================================================
// Auth API
// ============================================================================

export const authApi = {
  checkSetup: () => tauriInvoke<boolean>('check_setup'),

  // Legacy single-step setup (kept for compatibility)
  setup: (data: { name: string; surname: string; email: string; password: string }) =>
    tauriInvoke<{ recoveryKey: string; profile: UserProfile }>('setup', { data }),

  // 2-Phase Setup
  prepareSetup: () =>
    tauriInvoke<{ recoveryKey: string; masterKeyHex: string; salt: number[] }>('prepare_setup'),

  confirmSetup: (data: {
    name: string;
    surname: string;
    email: string;
    password: string;
    masterKeyHex: string;
    recoveryKey: string;
    salt: number[];
  }) => tauriInvoke<UserProfile>('confirm_setup', { data }),

  unlock: (password: string) =>
    tauriInvoke<UserProfile>('unlock', { password }),

  // Legacy recover (kept for compatibility)
  recover: (data: { recoveryKey: string; newPassword: string }) =>
    tauriInvoke<{ recoveryKey: string; profile: UserProfile }>('recover', { data }),

  // 2-Phase Recovery (password reset using recovery key)
  prepareRecover: (data: { recoveryKey: string; newPassword: string }) =>
    tauriInvoke<{ recoveryKey: string }>('prepare_recover', { data }),

  confirmRecover: (data: {
    oldRecoveryKey: string;
    newPassword: string;
    newRecoveryKey: string;
  }) => tauriInvoke<UserProfile>('confirm_recover', { data }),

  logout: () => tauriInvoke<void>('logout'),

  isAuthenticated: () => tauriInvoke<boolean>('is_authenticated'),

  getProfile: () => tauriInvoke<UserProfile | null>('get_user_profile'),

  updateProfile: (updates: Partial<UserProfile>) =>
    tauriInvoke<UserProfile>('update_user_profile', { updates }),

  // 2-Phase Change Password
  prepareChangePassword: (data: { currentPassword: string }) =>
    tauriInvoke<{ recoveryKey: string }>('prepare_change_password', { data }),

  confirmChangePassword: (data: {
    currentPassword: string;
    newPassword: string;
    recoveryKey: string;
  }) => tauriInvoke<void>('confirm_change_password', { data }),

  deleteAccount: () => tauriInvoke<void>('delete_account'),
};

// ============================================================================
// Savings API
// ============================================================================

export const savingsApi = {
  getAll: () => tauriInvoke<SavingsAccount[]>('get_all_savings_accounts'),

  get: (id: string) => tauriInvoke<SavingsAccount | null>('get_savings_account', { id }),

  create: (data: InsertSavingsAccount) => tauriInvoke<SavingsAccount>('create_savings_account', { data }),

  update: (id: string, data: Partial<InsertSavingsAccount>) =>
    tauriInvoke<SavingsAccount>('update_savings_account', { id, data }),

  delete: (id: string) => tauriInvoke<void>('delete_savings_account', { id }),

  getZones: (accountId: string) =>
    tauriInvoke<SavingsAccountZone[]>('get_account_zones', { accountId }),

  createZone: (data: Omit<SavingsAccountZone, 'id' | 'createdAt'>) => tauriInvoke<SavingsAccountZone>('create_account_zone', { data }),

  deleteZone: (zoneId: string) =>
    tauriInvoke<void>('delete_account_zone', { zoneId }),
};

// ============================================================================
// Investments API
// ============================================================================

export const investmentsApi = {
  getAll: () => tauriInvoke<StockInvestmentWithPrice[]>('get_all_investments'),

  create: (data: { ticker: string; companyName: string }, initialTransaction?: InsertInvestmentTransaction) =>
    tauriInvoke<StockInvestmentWithPrice>('create_investment', { data, initialTransaction }),

  delete: (id: string) => tauriInvoke<void>('delete_investment', { id }),

  getTransactions: (investmentId: string) =>
    tauriInvoke<InvestmentTransaction[]>('get_investment_transactions', { investmentId }),

  createTransaction: (investmentId: string, data: InsertInvestmentTransaction) =>
    tauriInvoke<InvestmentTransaction>('create_investment_transaction', { investmentId, data }),

  deleteTransaction: (txId: string) =>
    tauriInvoke<void>('delete_investment_transaction', { txId }),

  updateTransaction: (txId: string, data: Partial<InsertInvestmentTransaction>) =>
    tauriInvoke<InvestmentTransaction>('update_investment_transaction', { txId, data }),

  setManualPrice: (ticker: string, price: string, currency: string) =>
    tauriInvoke<any>('set_manual_price', { ticker, price, currency }),

  deleteManualPrice: (ticker: string) =>
    tauriInvoke<void>('delete_manual_price', { ticker }),

  setManualDividend: (ticker: string, amount: string, currency: string) =>
    tauriInvoke<any>('set_manual_dividend', { ticker, amount, currency }),

  deleteManualDividend: (ticker: string) =>
    tauriInvoke<void>('delete_manual_dividend', { ticker }),

  importTransactions: (transactions: InsertInvestmentTransaction[], defaultCurrency: string) =>
    tauriInvoke<ImportResult>('import_investment_transactions', { transactions, defaultCurrency }),
};

// ============================================================================
// Crypto API
// ============================================================================

export const cryptoApi = {
  getAll: () => tauriInvoke<CryptoInvestmentWithPrice[]>('get_all_crypto'),

  create: (data: { ticker: string; name: string; coingeckoId?: string }, initialTransaction?: Omit<CryptoTransaction, 'id' | 'investmentId' | 'createdAt'>) =>
    tauriInvoke<CryptoInvestmentWithPrice>('create_crypto', { data, initialTransaction }),

  delete: (id: string) => tauriInvoke<void>('delete_crypto', { id }),

  getTransactions: (investmentId: string) =>
    tauriInvoke<CryptoTransaction[]>('get_crypto_transactions', { investmentId }),

  createTransaction: (investmentId: string, data: Omit<CryptoTransaction, 'id' | 'investmentId' | 'createdAt'>) =>
    tauriInvoke<CryptoTransaction>('create_crypto_transaction', { investmentId, data }),

  deleteTransaction: (txId: string) =>
    tauriInvoke<void>('delete_crypto_transaction', { txId }),

  updatePrice: (symbol: string, price: string, currency: string, coingeckoId?: string) =>
    tauriInvoke<void>('update_crypto_price', { symbol, price, currency, coingeckoId }),
};

// ============================================================================
// Bonds API
// ============================================================================

export const bondsApi = {
  getAll: () => tauriInvoke<Bond[]>('get_all_bonds'),

  create: (data: InsertBond) => tauriInvoke<Bond>('create_bond', { data }),

  update: (id: string, data: Partial<InsertBond>) => tauriInvoke<Bond>('update_bond', { id, data }),

  delete: (id: string) => tauriInvoke<void>('delete_bond', { id }),
};

// ============================================================================
// Loans API
// ============================================================================

export const loansApi = {
  getAll: () => tauriInvoke<Loan[]>('get_all_loans'),

  create: (data: InsertLoan) => tauriInvoke<Loan>('create_loan', { data }),

  update: (id: string, data: Partial<InsertLoan>) => tauriInvoke<Loan>('update_loan', { id, data }),

  delete: (id: string) => tauriInvoke<void>('delete_loan', { id }),
};

// ============================================================================
// Real Estate API
// ============================================================================

export const realEstateApi = {
  getAll: () => tauriInvoke<RealEstate[]>('get_all_real_estate'),

  get: (id: string) => tauriInvoke<RealEstate | null>('get_real_estate', { id }),

  create: (data: InsertRealEstate) => tauriInvoke<RealEstate>('create_real_estate', { data }),

  update: (id: string, data: Partial<InsertRealEstate>) =>
    tauriInvoke<RealEstate>('update_real_estate', { id, data }),

  delete: (id: string) => tauriInvoke<void>('delete_real_estate', { id }),

  getCosts: (realEstateId: string) =>
    tauriInvoke<RealEstateOneTimeCost[]>('get_real_estate_costs', { realEstateId }),

  createCost: (data: InsertRealEstateOneTimeCost) =>
    tauriInvoke<RealEstateOneTimeCost>('create_real_estate_cost', { data }),

  deleteCost: (costId: string) =>
    tauriInvoke<void>('delete_real_estate_cost', { costId }),

  updateCost: (costId: string, data: Partial<InsertRealEstateOneTimeCost>) =>
    tauriInvoke<RealEstateOneTimeCost>('update_real_estate_cost', { costId, data }),

  getLoans: (realEstateId: string) =>
    tauriInvoke<Loan[]>('get_real_estate_loans', { realEstateId }),

  linkLoan: (realEstateId: string, loanId: string) =>
    tauriInvoke<void>('link_loan_to_real_estate', { realEstateId, loanId }),

  unlinkLoan: (realEstateId: string, loanId: string) =>
    tauriInvoke<void>('unlink_loan_from_real_estate', { realEstateId, loanId }),

  // Photo batches
  getPhotoBatches: (realEstateId: string) =>
    tauriInvoke<RealEstatePhotoBatch[]>('get_real_estate_photo_batches', { realEstateId }),

  createPhotoBatch: (realEstateId: string, data: { photoDate: number; description?: string }) =>
    tauriInvoke<RealEstatePhotoBatch>('create_photo_batch', { realEstateId, data }),

  addPhotosToBatch: (batchId: string, filePaths: string[]) =>
    tauriInvoke<RealEstatePhoto[]>('add_photos_to_batch', { batchId, filePaths }),

  updatePhotoBatch: (batchId: string, data: { photoDate?: number; description?: string }) =>
    tauriInvoke<RealEstatePhotoBatch>('update_photo_batch', { batchId, data }),

  deletePhotoBatch: (batchId: string) =>
    tauriInvoke<void>('delete_photo_batch', { batchId }),

  deletePhoto: (photoId: string) =>
    tauriInvoke<void>('delete_real_estate_photo', { photoId }),

  // Document management
  getDocuments: (realEstateId: string) =>
    tauriInvoke<RealEstateDocument[]>('get_real_estate_documents', { realEstateId }),

  addDocument: (realEstateId: string, filePath: string, data: { name: string; description?: string; fileType?: string }) =>
    tauriInvoke<RealEstateDocument>('add_real_estate_document', { realEstateId, filePath, data }),

  deleteDocument: (documentId: string) =>
    tauriInvoke<void>('delete_real_estate_document', { documentId }),

  openDocument: (documentId: string) =>
    tauriInvoke<void>('open_real_estate_document', { documentId }),
};

// ============================================================================
// Insurance API
// ============================================================================

export const insuranceApi = {
  getAll: () => tauriInvoke<InsurancePolicy[]>('get_all_insurance'),

  get: (id: string) => tauriInvoke<InsurancePolicy | null>('get_insurance', { id }),

  create: (data: InsertInsurancePolicy) => tauriInvoke<InsurancePolicy>('create_insurance', { data }),

  update: (id: string, data: Partial<InsertInsurancePolicy>) =>
    tauriInvoke<InsurancePolicy>('update_insurance', { id, data }),

  delete: (id: string) => tauriInvoke<void>('delete_insurance', { id }),

  // Document management
  getDocuments: (insuranceId: string) =>
    tauriInvoke<InsuranceDocument[]>('get_insurance_documents', { insuranceId }),

  addDocument: (insuranceId: string, filePath: string, data: { name: string; description?: string; fileType?: string }) =>
    tauriInvoke<InsuranceDocument>('add_insurance_document', { insuranceId, filePath, data }),

  deleteDocument: (documentId: string) =>
    tauriInvoke<void>('delete_insurance_document', { documentId }),

  openDocument: (documentId: string) =>
    tauriInvoke<void>('open_insurance_document', { documentId }),
};

// ============================================================================
// Other Assets API
// ============================================================================

export const otherAssetsApi = {
  getAll: () => tauriInvoke<OtherAsset[]>('get_all_other_assets'),

  create: (data: InsertOtherAsset, initialTransaction?: InsertOtherAssetTransaction) =>
    tauriInvoke<OtherAsset>('create_other_asset', { data, initialTransaction }),

  update: (id: string, data: Partial<InsertOtherAsset>) =>
    tauriInvoke<OtherAsset>('update_other_asset', { id, data }),

  delete: (id: string) => tauriInvoke<void>('delete_other_asset', { id }),

  getTransactions: (assetId: string) =>
    tauriInvoke<OtherAssetTransaction[]>('get_other_asset_transactions', { assetId }),

  createTransaction: (assetId: string, data: InsertOtherAssetTransaction) =>
    tauriInvoke<OtherAssetTransaction>('create_other_asset_transaction', { assetId, data }),

  deleteTransaction: (txId: string) =>
    tauriInvoke<void>('delete_other_asset_transaction', { txId }),
};

// ============================================================================
// Portfolio API
// ============================================================================

export const portfolioApi = {
  getMetrics: (excludePersonalRealEstate: boolean = false) =>
    tauriInvoke<PortfolioMetrics>('get_portfolio_metrics', { excludePersonalRealEstate }),

  getHistory: (startDate?: number, endDate?: number) =>
    tauriInvoke<PortfolioMetricsHistory[]>('get_portfolio_history', { startDate, endDate }),

  recordSnapshot: () => tauriInvoke<void>('record_portfolio_snapshot'),

  refreshExchangeRates: () => tauriInvoke<Record<string, number>>('refresh_exchange_rates'),

  getExchangeRates: () => tauriInvoke<Record<string, number>>('get_exchange_rates'),
};

// ============================================================================
// Price API (MarketStack + CoinGecko)
// ============================================================================

export interface ApiKeys {
  marketstack?: string;
  coingecko?: string;
}

export interface StockPriceResult {
  ticker: string;
  price: number;
  currency: string;
}

export interface CryptoPriceResult {
  ticker: string;
  price: number;
  currency: string;
}

export interface CoinGeckoSearchResult {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank: number | null;
  thumb: string | null;
}

export interface DividendResult {
  ticker: string;
  yearly_sum: number;
  currency: string;
}

export interface StockSearchResult {
  symbol: string;
  shortname: string;
  exchange: string;
}

export const priceApi = {
  getApiKeys: () => tauriInvoke<ApiKeys>('get_api_keys'),

  setApiKeys: (keys: ApiKeys) => tauriInvoke<void>('set_api_keys', { keys }),

  refreshStockPrices: () => tauriInvoke<StockPriceResult[]>('refresh_stock_prices'),

  refreshCryptoPrices: () => tauriInvoke<CryptoPriceResult[]>('refresh_crypto_prices'),

  searchCrypto: (query: string) => tauriInvoke<CoinGeckoSearchResult[]>('search_crypto', { query }),

  refreshDividends: () => tauriInvoke<DividendResult[]>('refresh_dividends'),

  searchStockTickers: (query: string) => tauriInvoke<StockSearchResult[]>('search_stock_tickers', { query }),
};


// ============================================================================
// Cashflow API
// ============================================================================

export const cashflowApi = {
  getReport: (viewType: 'monthly' | 'yearly') =>
    tauriInvoke<CashflowReport>('get_cashflow_report', { viewType }),

  getAllItems: () => tauriInvoke<CashflowItem[]>('get_all_cashflow_items'),

  createItem: (data: {
    name: string;
    amount: string;
    currency?: string;
    frequency: 'monthly' | 'yearly';
    itemType: 'income' | 'expense';
    category: string;
  }) => tauriInvoke<CashflowItem>('create_cashflow_item', { data }),

  updateItem: (
    id: string,
    data: {
      name: string;
      amount: string;
      currency?: string;
      frequency: 'monthly' | 'yearly';
      itemType: 'income' | 'expense';
      category: string;
    }
  ) => tauriInvoke<CashflowItem>('update_cashflow_item', { id, data }),

  deleteItem: (id: string) => tauriInvoke<void>('delete_cashflow_item', { id }),
};

// ============================================================================
// Projection API
// ============================================================================

export interface ProjectionInput {
  horizonYears: number;
  viewType: 'monthly' | 'yearly';
  excludePersonalRealEstate?: boolean;
}

export const projectionApi = {
  getSettings: () => tauriInvoke<ProjectionSettings[]>('get_projection_settings'),

  saveSettings: (settings: ProjectionSettings[]) =>
    tauriInvoke<void>('save_projection_settings', { settings }),

  calculate: (input: ProjectionInput) =>
    tauriInvoke<PortfolioProjection>('calculate_portfolio_projection', { input }),
};

// ============================================================================
// Combined API export
// ============================================================================

export const api = {
  auth: authApi,
  savings: savingsApi,
  investments: investmentsApi,
  crypto: cryptoApi,
  bonds: bondsApi,
  loans: loansApi,
  realEstate: realEstateApi,
  insurance: insuranceApi,
  otherAssets: otherAssetsApi,
  portfolio: portfolioApi,
  price: priceApi,
  cashflow: cashflowApi,
  projection: projectionApi,
};

export default api;

