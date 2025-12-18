/**
 * Tauri API Client
 * 
 * Wraps Tauri invoke calls to provide a consistent API for the frontend.
 * Replaces the HTTP-based API client from the Express.js version.
 */

import { invoke } from '@tauri-apps/api/core';

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
    tauriInvoke<{ recoveryKey: string; profile: any }>('setup', { data }),

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
  }) => tauriInvoke<any>('confirm_setup', { data }),

  unlock: (password: string) =>
    tauriInvoke<any>('unlock', { password }),

  // Legacy recover (kept for compatibility)
  recover: (data: { recoveryKey: string; newPassword: string }) =>
    tauriInvoke<{ recoveryKey: string; profile: any }>('recover', { data }),

  // 2-Phase Recovery (password reset using recovery key)
  prepareRecover: (data: { recoveryKey: string; newPassword: string }) =>
    tauriInvoke<{ recoveryKey: string }>('prepare_recover', { data }),

  confirmRecover: (data: {
    oldRecoveryKey: string;
    newPassword: string;
    newRecoveryKey: string;
  }) => tauriInvoke<any>('confirm_recover', { data }),

  logout: () => tauriInvoke<void>('logout'),

  isAuthenticated: () => tauriInvoke<boolean>('is_authenticated'),

  getProfile: () => tauriInvoke<any | null>('get_user_profile'),

  updateProfile: (updates: any) =>
    tauriInvoke<any>('update_user_profile', { updates }),

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
  getAll: () => tauriInvoke<any[]>('get_all_savings_accounts'),

  get: (id: string) => tauriInvoke<any | null>('get_savings_account', { id }),

  create: (data: any) => tauriInvoke<any>('create_savings_account', { data }),

  update: (id: string, data: any) =>
    tauriInvoke<any>('update_savings_account', { id, data }),

  delete: (id: string) => tauriInvoke<void>('delete_savings_account', { id }),

  getZones: (accountId: string) =>
    tauriInvoke<any[]>('get_account_zones', { accountId }),

  createZone: (data: any) => tauriInvoke<any>('create_account_zone', { data }),

  deleteZone: (zoneId: string) =>
    tauriInvoke<void>('delete_account_zone', { zoneId }),
};

// ============================================================================
// Investments API
// ============================================================================

export const investmentsApi = {
  getAll: () => tauriInvoke<any[]>('get_all_investments'),

  create: (data: any, initialTransaction?: any) =>
    tauriInvoke<any>('create_investment', { data, initialTransaction }),

  delete: (id: string) => tauriInvoke<void>('delete_investment', { id }),

  getTransactions: (investmentId: string) =>
    tauriInvoke<any[]>('get_investment_transactions', { investmentId }),

  createTransaction: (investmentId: string, data: any) =>
    tauriInvoke<any>('create_investment_transaction', { investmentId, data }),

  deleteTransaction: (txId: string) =>
    tauriInvoke<void>('delete_investment_transaction', { txId }),

  updateTransaction: (txId: string, data: any) =>
    tauriInvoke<any>('update_investment_transaction', { txId, data }),

  setManualPrice: (ticker: string, price: string, currency: string) =>
    tauriInvoke<any>('set_manual_price', { ticker, price, currency }),

  deleteManualPrice: (ticker: string) =>
    tauriInvoke<void>('delete_manual_price', { ticker }),

  setManualDividend: (ticker: string, amount: string, currency: string) =>
    tauriInvoke<any>('set_manual_dividend', { ticker, amount, currency }),

  deleteManualDividend: (ticker: string) =>
    tauriInvoke<void>('delete_manual_dividend', { ticker }),

  importTransactions: (transactions: any[], defaultCurrency: string) =>
    tauriInvoke<any>('import_investment_transactions', { transactions, defaultCurrency }),
};

// ============================================================================
// Crypto API
// ============================================================================

export const cryptoApi = {
  getAll: () => tauriInvoke<any[]>('get_all_crypto'),

  create: (data: any, initialTransaction?: any) =>
    tauriInvoke<any>('create_crypto', { data, initialTransaction }),

  delete: (id: string) => tauriInvoke<void>('delete_crypto', { id }),

  getTransactions: (investmentId: string) =>
    tauriInvoke<any[]>('get_crypto_transactions', { investmentId }),

  createTransaction: (investmentId: string, data: any) =>
    tauriInvoke<any>('create_crypto_transaction', { investmentId, data }),

  deleteTransaction: (txId: string) =>
    tauriInvoke<void>('delete_crypto_transaction', { txId }),

  updatePrice: (symbol: string, price: string, currency: string, coingeckoId?: string) =>
    tauriInvoke<void>('update_crypto_price', { symbol, price, currency, coingeckoId }),
};

// ============================================================================
// Bonds API
// ============================================================================

export const bondsApi = {
  getAll: () => tauriInvoke<any[]>('get_all_bonds'),

  create: (data: any) => tauriInvoke<any>('create_bond', { data }),

  update: (id: string, data: any) => tauriInvoke<any>('update_bond', { id, data }),

  delete: (id: string) => tauriInvoke<void>('delete_bond', { id }),
};

// ============================================================================
// Loans API
// ============================================================================

export const loansApi = {
  getAll: () => tauriInvoke<any[]>('get_all_loans'),

  create: (data: any) => tauriInvoke<any>('create_loan', { data }),

  update: (id: string, data: any) => tauriInvoke<any>('update_loan', { id, data }),

  delete: (id: string) => tauriInvoke<void>('delete_loan', { id }),
};

// ============================================================================
// Real Estate API
// ============================================================================

export const realEstateApi = {
  getAll: () => tauriInvoke<any[]>('get_all_real_estate'),

  get: (id: string) => tauriInvoke<any | null>('get_real_estate', { id }),

  create: (data: any) => tauriInvoke<any>('create_real_estate', { data }),

  update: (id: string, data: any) =>
    tauriInvoke<any>('update_real_estate', { id, data }),

  delete: (id: string) => tauriInvoke<void>('delete_real_estate', { id }),

  getCosts: (realEstateId: string) =>
    tauriInvoke<any[]>('get_real_estate_costs', { realEstateId }),

  createCost: (data: any) =>
    tauriInvoke<any>('create_real_estate_cost', { data }),

  deleteCost: (costId: string) =>
    tauriInvoke<void>('delete_real_estate_cost', { costId }),

  updateCost: (costId: string, data: any) =>
    tauriInvoke<any>('update_real_estate_cost', { costId, data }),

  getLoans: (realEstateId: string) =>
    tauriInvoke<any[]>('get_real_estate_loans', { realEstateId }),

  linkLoan: (realEstateId: string, loanId: string) =>
    tauriInvoke<void>('link_loan_to_real_estate', { realEstateId, loanId }),

  unlinkLoan: (realEstateId: string, loanId: string) =>
    tauriInvoke<void>('unlink_loan_from_real_estate', { realEstateId, loanId }),

  // Photo batches
  getPhotoBatches: (realEstateId: string) =>
    tauriInvoke<any[]>('get_real_estate_photo_batches', { realEstateId }),

  createPhotoBatch: (realEstateId: string, data: { photoDate: number; description?: string }) =>
    tauriInvoke<any>('create_photo_batch', { realEstateId, data }),

  addPhotosToBatch: (batchId: string, filePaths: string[]) =>
    tauriInvoke<any[]>('add_photos_to_batch', { batchId, filePaths }),

  updatePhotoBatch: (batchId: string, data: { photoDate?: number; description?: string }) =>
    tauriInvoke<any>('update_photo_batch', { batchId, data }),

  deletePhotoBatch: (batchId: string) =>
    tauriInvoke<void>('delete_photo_batch', { batchId }),

  deletePhoto: (photoId: string) =>
    tauriInvoke<void>('delete_real_estate_photo', { photoId }),
};

// ============================================================================
// Insurance API
// ============================================================================

export const insuranceApi = {
  getAll: () => tauriInvoke<any[]>('get_all_insurance'),

  get: (id: string) => tauriInvoke<any | null>('get_insurance', { id }),

  create: (data: any) => tauriInvoke<any>('create_insurance', { data }),

  update: (id: string, data: any) =>
    tauriInvoke<any>('update_insurance', { id, data }),

  delete: (id: string) => tauriInvoke<void>('delete_insurance', { id }),

  // Document management
  getDocuments: (insuranceId: string) =>
    tauriInvoke<any[]>('get_insurance_documents', { insuranceId }),

  addDocument: (insuranceId: string, filePath: string, data: { name: string; description?: string; fileType?: string }) =>
    tauriInvoke<any>('add_insurance_document', { insuranceId, filePath, data }),

  deleteDocument: (documentId: string) =>
    tauriInvoke<void>('delete_insurance_document', { documentId }),

  openDocument: (documentId: string) =>
    tauriInvoke<void>('open_insurance_document', { documentId }),
};

// ============================================================================
// Other Assets API
// ============================================================================

export const otherAssetsApi = {
  getAll: () => tauriInvoke<any[]>('get_all_other_assets'),

  create: (data: any, initialTransaction?: any) =>
    tauriInvoke<any>('create_other_asset', { data, initialTransaction }),

  update: (id: string, data: any) =>
    tauriInvoke<any>('update_other_asset', { id, data }),

  delete: (id: string) => tauriInvoke<void>('delete_other_asset', { id }),

  getTransactions: (assetId: string) =>
    tauriInvoke<any[]>('get_other_asset_transactions', { assetId }),

  createTransaction: (assetId: string, data: any) =>
    tauriInvoke<any>('create_other_asset_transaction', { assetId, data }),

  deleteTransaction: (txId: string) =>
    tauriInvoke<void>('delete_other_asset_transaction', { txId }),
};

// ============================================================================
// Portfolio API
// ============================================================================

export const portfolioApi = {
  getMetrics: (excludePersonalRealEstate: boolean = false) =>
    tauriInvoke<any>('get_portfolio_metrics', { excludePersonalRealEstate }),

  getHistory: (startDate?: number, endDate?: number) =>
    tauriInvoke<any[]>('get_portfolio_history', { startDate, endDate }),

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
    tauriInvoke<any>('get_cashflow_report', { viewType }),

  getAllItems: () => tauriInvoke<any[]>('get_all_cashflow_items'),

  createItem: (data: {
    name: string;
    amount: string;
    currency?: string;
    frequency: 'monthly' | 'yearly';
    itemType: 'income' | 'expense';
    category: string;
  }) => tauriInvoke<any>('create_cashflow_item', { data }),

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
  ) => tauriInvoke<any>('update_cashflow_item', { id, data }),

  deleteItem: (id: string) => tauriInvoke<void>('delete_cashflow_item', { id }),
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
};

export default api;

