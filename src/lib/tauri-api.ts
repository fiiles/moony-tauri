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
  // Bank account types
  BankAccountWithInstitution,
  BankAccount,
  InsertBankAccount,
  Institution,
  BankTransaction,
  InsertBankTransaction,
  TransactionCategory,
  InsertTransactionCategory,
  TransactionRule,
  InsertTransactionRule,
  TransactionFilters,
  TransactionQueryResult,
  BankCsvPreset,
  CsvPreviewResult,
  CsvImportResult,
  CsvImportConfigInput,
  CsvImportBatch,
  // Stock tags types
  StockTag,
  InsertStockTag,
  StockTagGroup,
  InsertStockTagGroup,
  StockInvestmentWithTags,
  TagMetrics,
} from '../../shared/schema';
import type {
  StockInvestmentWithPrice,
  CryptoInvestmentWithPrice,
  InvestmentWithDetails,
} from '../../shared/types/extended-types';

// Import result from backend
interface ImportResult {
  success: number;
  imported: string[];
  errors: string[];
}

// Per-ticker value history record
export interface TickerValueHistory {
  ticker: string;
  recordedAt: number;
  valueCzk: string;
  quantity: string;
  price: string;
  currency: string;
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
    language?: string;
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

  get: (id: string) => tauriInvoke<StockInvestmentWithPrice>('get_investment', { id }),

  /** Get investment with all details (transactions + tags) in a single IPC call */
  getWithDetails: (id: string) =>
    tauriInvoke<InvestmentWithDetails>('get_investment_with_details', { id }),

  create: (data: { ticker: string; companyName: string }, initialTransaction?: InsertInvestmentTransaction) =>
    tauriInvoke<StockInvestmentWithPrice>('create_investment', { data, initialTransaction }),

  delete: (id: string) => tauriInvoke<void>('delete_investment', { id }),

  updateName: (id: string, companyName: string) =>
    tauriInvoke<StockInvestmentWithPrice>('update_investment_name', { id, companyName }),

  getTransactions: (investmentId: string) =>
    tauriInvoke<InvestmentTransaction[]>('get_investment_transactions', { investmentId }),

  getAllTransactions: () =>
    tauriInvoke<InvestmentTransaction[]>('get_all_stock_transactions'),

  createTransaction: (investmentId: string, data: InsertInvestmentTransaction) =>
    tauriInvoke<InvestmentTransaction>('create_investment_transaction', { investmentId, data }),

  deleteTransaction: (txId: string) =>
    tauriInvoke<void>('delete_investment_transaction', { txId }),

  updateTransaction: (txId: string, data: Partial<InsertInvestmentTransaction>) =>
    tauriInvoke<InvestmentTransaction>('update_investment_transaction', { txId, data }),

  setManualPrice: (ticker: string, price: string, currency: string) =>
    tauriInvoke<void>('set_manual_price', { ticker, price, currency }),

  deleteManualPrice: (ticker: string) =>
    tauriInvoke<void>('delete_manual_price', { ticker }),

  setManualDividend: (ticker: string, amount: string, currency: string) =>
    tauriInvoke<void>('set_manual_dividend', { ticker, amount, currency }),

  deleteManualDividend: (ticker: string) =>
    tauriInvoke<void>('delete_manual_dividend', { ticker }),

  importTransactions: (transactions: Record<string, string | number | boolean | null | undefined>[], defaultCurrency: string) =>
    tauriInvoke<ImportResult>('import_investment_transactions', { transactions, defaultCurrency }),


  refreshMetadata: (ticker: string) =>
    tauriInvoke<boolean>('refresh_stock_metadata', { ticker }),

  getHistory: (ticker: string, startDate?: number, endDate?: number) =>
    tauriInvoke<TickerValueHistory[]>('get_stock_value_history', { ticker, startDate, endDate }),
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

  getAllTransactions: () =>
    tauriInvoke<CryptoTransaction[]>('get_all_crypto_transactions'),

  createTransaction: (investmentId: string, data: Omit<CryptoTransaction, 'id' | 'investmentId' | 'createdAt'>) =>
    tauriInvoke<CryptoTransaction>('create_crypto_transaction', { investmentId, data }),

  deleteTransaction: (txId: string) =>
    tauriInvoke<void>('delete_crypto_transaction', { txId }),

  updatePrice: (symbol: string, price: string, currency: string, coingeckoId?: string) =>
    tauriInvoke<void>('update_crypto_price', { symbol, price, currency, coingeckoId }),

  deleteManualPrice: (symbol: string) =>
    tauriInvoke<void>('delete_crypto_manual_price', { symbol }),

  getHistory: (ticker: string, startDate?: number, endDate?: number) =>
    tauriInvoke<TickerValueHistory[]>('get_crypto_value_history', { ticker, startDate, endDate }),
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

  // Real estate linking
  getRealEstate: (loanId: string) =>
    tauriInvoke<RealEstate | null>('get_loan_real_estate', { loanId }),

  getAvailable: () =>
    tauriInvoke<Loan[]>('get_available_loans'),
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

  // Insurance linking
  getInsurances: (realEstateId: string) =>
    tauriInvoke<InsurancePolicy[]>('get_real_estate_insurances', { realEstateId }),

  linkInsurance: (realEstateId: string, insuranceId: string) =>
    tauriInvoke<void>('link_insurance_to_real_estate', { realEstateId, insuranceId }),

  unlinkInsurance: (realEstateId: string, insuranceId: string) =>
    tauriInvoke<void>('unlink_insurance_from_real_estate', { realEstateId, insuranceId }),

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

  // Real estate linking
  getRealEstate: (insuranceId: string) =>
    tauriInvoke<RealEstate | null>('get_insurance_real_estate', { insuranceId }),

  getAvailable: () =>
    tauriInvoke<InsurancePolicy[]>('get_available_insurances'),
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

export interface BackfillResult {
  days_processed: number;
  total_days: number;
  completed: boolean;
  message: string;
}

export const portfolioApi = {
  getMetrics: (excludePersonalRealEstate: boolean = false) =>
    tauriInvoke<PortfolioMetrics>('get_portfolio_metrics', { excludePersonalRealEstate }),

  getHistory: (startDate?: number, endDate?: number) =>
    tauriInvoke<PortfolioMetricsHistory[]>('get_portfolio_history', { startDate, endDate }),

  recordSnapshot: () => tauriInvoke<void>('record_portfolio_snapshot'),

  refreshExchangeRates: () => tauriInvoke<Record<string, number>>('refresh_exchange_rates'),

  getExchangeRates: () => tauriInvoke<Record<string, number>>('get_exchange_rates'),

  startBackfill: () => tauriInvoke<BackfillResult>('start_snapshot_backfill'),
};

// ============================================================================
// Price API (Finnhub + MarketStack + CoinGecko)
// ============================================================================

export interface ApiKeys {
  marketstack?: string;
  finnhub?: string;
  coingecko?: string;
}

export interface StockPriceResult {
  ticker: string;
  price: number;
  currency: string;
}

// Result from Finnhub stock price refresh with rate limit info
export interface StockPriceRefreshResult {
  updated: StockPriceResult[];
  remaining_tickers: string[];
  rate_limit_hit: boolean;
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

  refreshStockPrices: () => tauriInvoke<StockPriceRefreshResult>('refresh_stock_prices'),

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
// Export API
// ============================================================================

export interface ExportResult {
  csv: string;
  filename: string;
  count: number;
}

export const exportApi = {
  stockTransactions: () => tauriInvoke<ExportResult>('export_stock_transactions'),
  cryptoTransactions: () => tauriInvoke<ExportResult>('export_crypto_transactions'),
  bonds: () => tauriInvoke<ExportResult>('export_bonds'),
  savingsAccounts: () => tauriInvoke<ExportResult>('export_savings_accounts'),
  savingsAccountZones: () => tauriInvoke<ExportResult>('export_savings_account_zones'),
  realEstate: () => tauriInvoke<ExportResult>('export_real_estate'),
  realEstateCosts: () => tauriInvoke<ExportResult>('export_real_estate_costs'),
  insurancePolicies: () => tauriInvoke<ExportResult>('export_insurance_policies'),
  loans: () => tauriInvoke<ExportResult>('export_loans'),
  otherAssets: () => tauriInvoke<ExportResult>('export_other_assets'),
  otherAssetTransactions: () => tauriInvoke<ExportResult>('export_other_asset_transactions'),
};

// ============================================================================
// Bank Accounts API
// ============================================================================

export const bankAccountsApi = {
  // Bank accounts
  getAll: () => tauriInvoke<BankAccountWithInstitution[]>('get_all_bank_accounts'),
  get: (id: string) => tauriInvoke<BankAccountWithInstitution | null>('get_bank_account', { id }),
  create: (data: InsertBankAccount) => tauriInvoke<BankAccount>('create_bank_account', { data }),
  update: (id: string, data: InsertBankAccount) => tauriInvoke<BankAccount>('update_bank_account', { id, data }),
  delete: (id: string) => tauriInvoke<void>('delete_bank_account', { id }),

  // Institutions
  getInstitutions: () => tauriInvoke<Institution[]>('get_all_institutions'),
  createInstitution: (name: string) => tauriInvoke<Institution>('create_institution', { name }),

  // Transactions
  getTransactions: (accountId: string, filters?: TransactionFilters) =>
    tauriInvoke<TransactionQueryResult>('get_bank_transactions', { accountId, filters }),
  createTransaction: (data: InsertBankTransaction) =>
    tauriInvoke<BankTransaction>('create_bank_transaction', { data }),
  deleteTransaction: (id: string) => tauriInvoke<void>('delete_bank_transaction', { id }),
  updateTransactionCategory: (transactionId: string, categoryId: string | null) =>
    tauriInvoke<void>('update_transaction_category', { transactionId, categoryId }),

  // Categories
  getCategories: () => tauriInvoke<TransactionCategory[]>('get_transaction_categories'),
  createCategory: (data: InsertTransactionCategory) =>
    tauriInvoke<TransactionCategory>('create_transaction_category', { data }),
  deleteCategory: (id: string) => tauriInvoke<void>('delete_transaction_category', { id }),

  // Rules
  getRules: () => tauriInvoke<TransactionRule[]>('get_transaction_rules'),
  createRule: (data: InsertTransactionRule) =>
    tauriInvoke<TransactionRule>('create_transaction_rule', { data }),
  deleteRule: (id: string) => tauriInvoke<void>('delete_transaction_rule', { id }),

  // CSV Import
  getCsvPresets: () => tauriInvoke<BankCsvPreset[]>('get_csv_presets'),
  getCsvPresetByInstitution: (institutionId: string) =>
    tauriInvoke<BankCsvPreset | null>('get_csv_preset_by_institution', { institutionId }),
  parseCsvFile: (filePath: string, delimiter?: string, skipRows?: number) =>
    tauriInvoke<CsvPreviewResult>('parse_csv_file', { 
      filePath, 
      delimiter,  // Let backend auto-detect if undefined
      skipRows: skipRows || 0 
    }),
  importCsvTransactions: (accountId: string, filePath: string, config: CsvImportConfigInput) =>
    tauriInvoke<CsvImportResult>('import_csv_transactions', { accountId, filePath, config }),
  getImportBatches: (accountId: string) =>
    tauriInvoke<CsvImportBatch[]>('get_import_batches', { accountId }),
  deleteImportBatch: (batchId: string) =>
    tauriInvoke<void>('delete_import_batch', { batchId }),
};

// ============================================================================
// Stock Tags API
// ============================================================================

export const stockTagsApi = {
  getAll: () => tauriInvoke<StockTag[]>('get_all_stock_tags'),

  create: (data: InsertStockTag) => tauriInvoke<StockTag>('create_stock_tag', { data }),

  update: (id: string, data: InsertStockTag) =>
    tauriInvoke<StockTag>('update_stock_tag', { id, data }),

  delete: (id: string) => tauriInvoke<void>('delete_stock_tag', { id }),

  getForInvestment: (investmentId: string) =>
    tauriInvoke<StockTag[]>('get_investment_tags', { investmentId }),

  setForInvestment: (investmentId: string, tagIds: string[]) =>
    tauriInvoke<void>('set_investment_tags', { investmentId, tagIds }),

  getAnalysis: () => tauriInvoke<StockInvestmentWithTags[]>('get_stocks_analysis'),

  getTagMetrics: (tagIds: string[] = []) =>
    tauriInvoke<TagMetrics[]>('get_tag_metrics', { tagIds }),

  // Tag Group operations
  getAllGroups: () => tauriInvoke<StockTagGroup[]>('get_all_stock_tag_groups'),

  createGroup: (data: InsertStockTagGroup) =>
    tauriInvoke<StockTagGroup>('create_stock_tag_group', { data }),

  updateGroup: (id: string, data: InsertStockTagGroup) =>
    tauriInvoke<StockTagGroup>('update_stock_tag_group', { id, data }),

  deleteGroup: (id: string) => tauriInvoke<void>('delete_stock_tag_group', { id }),
};

// ============================================================================
// Categorization API
// ============================================================================

// Categorization result from waterfall engine
export type CategorizationSource =
  | { type: 'Rule'; data: { ruleId: string; ruleName: string } }
  | { type: 'ExactMatch'; data: { payee: string } }
  | { type: 'MachineLearning'; data: { confidence: number } }
  | { type: 'Manual' };

export type CategorizationResult =
  | { type: 'Match'; data: { categoryId: string; source: CategorizationSource } }
  | { type: 'Suggestion'; data: { categoryId: string; confidence: number } }
  | { type: 'None' };

// Transaction input for categorization
export interface TransactionInput {
  id: string;
  description?: string;
  counterparty?: string;
  counterpartyIban?: string;
  variableSymbol?: string;
  constantSymbol?: string;
  specificSymbol?: string;
  amount: number;
  isCredit: boolean;
}

// Categorization rule types
export type RuleType = 'Regex' | 'Contains' | 'StartsWith' | 'EndsWith' | 'VariableSymbol' | 'ConstantSymbol' | 'SpecificSymbol';

export interface CategorizationRule {
  id: string;
  name: string;
  ruleType: RuleType;
  pattern: string;
  categoryId: string;
  priority: number;
  isActive: boolean;
  stopProcessing: boolean;
}

// Engine statistics
export interface CategorizationStats {
  activeRules: number;
  learnedPayees: number;
  mlClasses: number;
  mlVocabularySize: number;
}

// Training sample for ML model
export interface TrainingSample {
  text: string;
  categoryId: string;
}

export const categorizationApi = {
  // Categorize a single transaction
  categorize: (transaction: TransactionInput) =>
    tauriInvoke<CategorizationResult>('categorize_transaction', { transaction }),

  // Categorize multiple transactions in batch
  categorizeBatch: (transactions: TransactionInput[]) =>
    tauriInvoke<CategorizationResult[]>('categorize_batch', { transactions }),

  // Learn from user's manual categorization
  learn: (payee: string, categoryId: string) =>
    tauriInvoke<void>('learn_categorization', { payee, categoryId }),

  // Forget a learned payee
  forget: (payee: string) =>
    tauriInvoke<boolean>('forget_payee', { payee }),

  // Update categorization rules
  updateRules: (rules: CategorizationRule[]) =>
    tauriInvoke<void>('update_categorization_rules', { rules }),

  // Get engine statistics
  getStats: () =>
    tauriInvoke<CategorizationStats>('get_categorization_stats'),

  // Retrain ML model with samples
  retrainModel: (samples: TrainingSample[]) =>
    tauriInvoke<void>('retrain_ml_model', { samples }),

  // Export learned payees for backup/persistence
  exportLearnedPayees: () =>
    tauriInvoke<Record<string, string>>('export_learned_payees'),

  // Import learned payees
  importLearnedPayees: (payees: Record<string, string>) =>
    tauriInvoke<number>('import_learned_payees', { payees }),

  // Load learned payees from database (call after app unlock)
  loadFromDb: () =>
    tauriInvoke<number>('load_learned_payees_from_db'),

  // Initialize ML model from existing categorized transactions
  initializeFromTransactions: (samples: TrainingSample[]) =>
    tauriInvoke<void>('initialize_ml_from_transactions', { samples }),
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
  export: exportApi,
  bankAccounts: bankAccountsApi,
  stockTags: stockTagsApi,
  categorization: categorizationApi,
};

export default api;

