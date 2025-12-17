#!/usr/bin/env node
/**
 * NeonDB to Moony-Tauri Migration Script
 * 
 * Reads neondb-export.json and generates SQL INSERT statements
 * compatible with the Tauri app's SQLCipher database schema.
 * 
 * Usage: node scripts/migrate-neondb.mjs [userId]
 *   userId: Optional user ID to migrate (default: 3)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

// Configuration
const TARGET_USER_ID = parseInt(process.argv[2]) || 3;
const INPUT_FILE = join(ROOT_DIR, 'neondb-export.json');
const OUTPUT_FILE = join(__dirname, 'migration.sql');

console.log(`Migrating data for user ID: ${TARGET_USER_ID}`);
console.log(`Reading from: ${INPUT_FILE}`);

// Helper functions
const isoToUnix = (isoDate) => {
    if (!isoDate) return null;
    return Math.floor(new Date(isoDate).getTime() / 1000);
};

const escapeString = (str) => {
    if (str === null || str === undefined) return 'NULL';
    return `'${String(str).replace(/'/g, "''")}'`;
};

const toSqlValue = (val) => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'boolean') return val ? '1' : '0';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') return escapeString(JSON.stringify(val));
    return escapeString(val);
};

// Read and parse JSON
const data = JSON.parse(readFileSync(INPUT_FILE, 'utf8'));
const tables = data.tables;

// SQL output buffer
const sql = [];

sql.push('-- NeonDB Migration Script');
sql.push(`-- Generated: ${new Date().toISOString()}`);
sql.push(`-- Source user ID: ${TARGET_USER_ID}`);
sql.push('');
sql.push('-- Clear existing data (in reverse dependency order)');
sql.push('DELETE FROM portfolio_metrics_history;');
sql.push('DELETE FROM entity_history;');
sql.push('DELETE FROM crypto_transactions;');
sql.push('DELETE FROM crypto_prices;');
sql.push('DELETE FROM crypto_investments;');
sql.push('DELETE FROM dividend_overrides;');
sql.push('DELETE FROM dividend_data;');
sql.push('DELETE FROM stock_price_overrides;');
sql.push('DELETE FROM stock_prices;');
sql.push('DELETE FROM investment_transactions;');
sql.push('DELETE FROM stock_investments;');
sql.push('DELETE FROM real_estate_loans;');
sql.push('DELETE FROM real_estate;');
sql.push('DELETE FROM savings_account_zones;');
sql.push('DELETE FROM savings_accounts;');
sql.push('DELETE FROM bonds;');
sql.push('DELETE FROM loans;');
sql.push('');

// 1. User Profile (only menu_preferences, currency, exclude_personal settings)
const user = tables.users?.find(u => u.id === TARGET_USER_ID);
if (user) {
    sql.push('-- User Profile');
    sql.push(`INSERT INTO user_profile (name, surname, email, menu_preferences, currency, exclude_personal_real_estate) VALUES (
  ${escapeString(user.name)},
  ${escapeString(user.surname)},
  ${escapeString(user.email)},
  ${toSqlValue(user.menuPreferences)},
  ${escapeString(user.currency)},
  ${user.excludePersonalRealEstate ? 1 : 0}
);`);
    sql.push('');
}

// 2. Savings Accounts
const savingsAccounts = tables.savingsAccounts?.filter(s => s.userId === TARGET_USER_ID) || [];
if (savingsAccounts.length > 0) {
    sql.push('-- Savings Accounts');
    for (const sa of savingsAccounts) {
        sql.push(`INSERT INTO savings_accounts (id, name, balance, currency, interest_rate, has_zone_designation, created_at, updated_at) VALUES (
  ${escapeString(sa.id)},
  ${escapeString(sa.name)},
  ${escapeString(sa.balance)},
  ${escapeString(sa.currency)},
  ${escapeString(sa.interestRate)},
  ${sa.hasZoneDesignation ? 1 : 0},
  ${isoToUnix(sa.createdAt)},
  ${isoToUnix(sa.updatedAt)}
);`);
    }
    sql.push('');
}

// 3. Savings Account Zones
const savingsAccountIds = new Set(savingsAccounts.map(sa => sa.id));
const zones = tables.savingsAccountZones?.filter(z => savingsAccountIds.has(z.savingsAccountId)) || [];
if (zones.length > 0) {
    sql.push('-- Savings Account Zones');
    for (const z of zones) {
        sql.push(`INSERT INTO savings_account_zones (id, savings_account_id, from_amount, to_amount, interest_rate, created_at) VALUES (
  ${escapeString(z.id)},
  ${escapeString(z.savingsAccountId)},
  ${escapeString(z.fromAmount)},
  ${z.toAmount ? escapeString(z.toAmount) : 'NULL'},
  ${escapeString(z.interestRate)},
  ${isoToUnix(z.createdAt)}
);`);
    }
    sql.push('');
}

// 4. Loans
const loans = tables.loans?.filter(l => l.userId === TARGET_USER_ID) || [];
if (loans.length > 0) {
    sql.push('-- Loans');
    for (const l of loans) {
        sql.push(`INSERT INTO loans (id, name, principal, currency, interest_rate, interest_rate_validity_date, monthly_payment, start_date, end_date, created_at, updated_at) VALUES (
  ${escapeString(l.id)},
  ${escapeString(l.name)},
  ${escapeString(l.principal)},
  ${escapeString(l.currency)},
  ${escapeString(l.interestRate)},
  ${isoToUnix(l.interestRateValidityDate)},
  ${escapeString(l.monthlyPayment)},
  ${isoToUnix(l.startDate)},
  ${isoToUnix(l.endDate)},
  ${isoToUnix(l.createdAt)},
  ${isoToUnix(l.updatedAt)}
);`);
    }
    sql.push('');
}

// 5. Bonds
const bonds = tables.bonds?.filter(b => b.userId === TARGET_USER_ID) || [];
if (bonds.length > 0) {
    sql.push('-- Bonds');
    for (const b of bonds) {
        sql.push(`INSERT INTO bonds (id, name, isin, coupon_value, interest_rate, maturity_date, currency, created_at, updated_at) VALUES (
  ${escapeString(b.id)},
  ${escapeString(b.name)},
  ${escapeString(b.isin || '')},
  ${escapeString(b.couponValue)},
  ${escapeString(b.interestRate)},
  ${isoToUnix(b.maturityDate)},
  'CZK',
  ${isoToUnix(b.createdAt)},
  ${isoToUnix(b.updatedAt)}
);`);
    }
    sql.push('');
}

// 6. Real Estate
const realEstates = tables.realEstate?.filter(r => r.userId === TARGET_USER_ID) || [];
if (realEstates.length > 0) {
    sql.push('-- Real Estate');
    for (const re of realEstates) {
        sql.push(`INSERT INTO real_estate (id, name, address, type, purchase_price, purchase_price_currency, market_price, market_price_currency, monthly_rent, monthly_rent_currency, recurring_costs, photos, notes, created_at, updated_at) VALUES (
  ${escapeString(re.id)},
  ${escapeString(re.name)},
  ${escapeString(re.address)},
  ${escapeString(re.type)},
  ${escapeString(re.purchasePrice)},
  ${escapeString(re.purchasePriceCurrency)},
  ${escapeString(re.marketPrice)},
  ${escapeString(re.marketPriceCurrency)},
  ${escapeString(re.monthlyRent)},
  ${escapeString(re.monthlyRentCurrency)},
  ${toSqlValue(re.recurringCosts)},
  ${toSqlValue(re.photos)},
  ${escapeString(re.notes)},
  ${isoToUnix(re.createdAt)},
  ${isoToUnix(re.updatedAt)}
);`);
    }
    sql.push('');
}

// 7. Real Estate Loans (join table)
const realEstateIds = new Set(realEstates.map(re => re.id));
const loanIds = new Set(loans.map(l => l.id));
const realEstateLoans = tables.realEstateLoans?.filter(rel =>
    realEstateIds.has(rel.realEstateId) && loanIds.has(rel.loanId)
) || [];
if (realEstateLoans.length > 0) {
    sql.push('-- Real Estate Loans');
    for (const rel of realEstateLoans) {
        sql.push(`INSERT INTO real_estate_loans (real_estate_id, loan_id) VALUES (
  ${escapeString(rel.realEstateId)},
  ${escapeString(rel.loanId)}
);`);
    }
    sql.push('');
}

// 8. Stock Investments
const stockInvestments = tables.stockInvestments?.filter(s => s.userId === TARGET_USER_ID) || [];
if (stockInvestments.length > 0) {
    sql.push('-- Stock Investments');
    for (const si of stockInvestments) {
        sql.push(`INSERT INTO stock_investments (id, ticker, company_name, quantity, average_price) VALUES (
  ${escapeString(si.id)},
  ${escapeString(si.ticker)},
  ${escapeString(si.companyName)},
  ${escapeString(si.quantity)},
  ${escapeString(si.averagePrice)}
);`);
    }
    sql.push('');
}

// 9. Investment Transactions
const investmentIds = new Set(stockInvestments.map(si => si.id));
const investmentTransactions = tables.investmentTransactions?.filter(t =>
    t.userId === TARGET_USER_ID && investmentIds.has(t.investmentId)
) || [];
if (investmentTransactions.length > 0) {
    sql.push('-- Investment Transactions');
    for (const t of investmentTransactions) {
        sql.push(`INSERT INTO investment_transactions (id, investment_id, type, ticker, company_name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  ${escapeString(t.id)},
  ${escapeString(t.investmentId)},
  ${escapeString(t.type)},
  ${escapeString(t.ticker)},
  ${escapeString(t.companyName)},
  ${escapeString(t.quantity)},
  ${escapeString(t.pricePerUnit)},
  ${escapeString(t.currency)},
  ${isoToUnix(t.transactionDate)},
  ${isoToUnix(t.createdAt)}
);`);
    }
    sql.push('');
}

// 10. Stock Prices (global, not user-specific)
const stockPrices = tables.stockPrices || [];
if (stockPrices.length > 0) {
    sql.push('-- Stock Prices');
    for (const sp of stockPrices) {
        sql.push(`INSERT OR REPLACE INTO stock_prices (id, ticker, original_price, currency, price_date, fetched_at) VALUES (
  ${escapeString(sp.id)},
  ${escapeString(sp.ticker)},
  ${escapeString(sp.originalPrice)},
  ${escapeString(sp.currency)},
  ${isoToUnix(sp.priceDate)},
  ${isoToUnix(sp.fetchedAt)}
);`);
    }
    sql.push('');
}

// 11. User Stock Price Overrides
const userStockPrices = tables.userStockPrices?.filter(usp => usp.userId === TARGET_USER_ID) || [];
if (userStockPrices.length > 0) {
    sql.push('-- Stock Price Overrides');
    for (const usp of userStockPrices) {
        sql.push(`INSERT INTO stock_price_overrides (id, ticker, price, currency, updated_at) VALUES (
  ${escapeString(usp.id)},
  ${escapeString(usp.ticker)},
  ${escapeString(usp.price)},
  ${escapeString(usp.currency)},
  ${isoToUnix(usp.updatedAt)}
);`);
    }
    sql.push('');
}

// 12. Dividend Data (global, not user-specific)
const dividendData = tables.dividendData || [];
if (dividendData.length > 0) {
    sql.push('-- Dividend Data');
    for (const dd of dividendData) {
        sql.push(`INSERT OR REPLACE INTO dividend_data (id, ticker, yearly_dividend_sum, currency, last_fetched_at, created_at) VALUES (
  ${escapeString(dd.id)},
  ${escapeString(dd.ticker)},
  ${escapeString(dd.yearlyDividendSum)},
  ${escapeString(dd.currency)},
  ${isoToUnix(dd.lastFetchedAt)},
  ${isoToUnix(dd.createdAt)}
);`);
    }
    sql.push('');
}

// 13. Dividend Overrides
const dividendOverrides = tables.userDividendOverrides?.filter(udo => udo.userId === TARGET_USER_ID) || [];
if (dividendOverrides.length > 0) {
    sql.push('-- Dividend Overrides');
    for (const udo of dividendOverrides) {
        sql.push(`INSERT INTO dividend_overrides (id, ticker, yearly_dividend_sum, currency, updated_at) VALUES (
  ${escapeString(udo.id)},
  ${escapeString(udo.ticker)},
  ${escapeString(udo.yearlyDividendSum)},
  ${escapeString(udo.currency)},
  ${isoToUnix(udo.updatedAt)}
);`);
    }
    sql.push('');
}

// 14. Crypto Investments
const cryptoInvestments = tables.cryptoInvestments?.filter(c => c.userId === TARGET_USER_ID) || [];
if (cryptoInvestments.length > 0) {
    sql.push('-- Crypto Investments');
    for (const ci of cryptoInvestments) {
        sql.push(`INSERT INTO crypto_investments (id, ticker, coingecko_id, name, quantity, average_price) VALUES (
  ${escapeString(ci.id)},
  ${escapeString(ci.ticker)},
  ${escapeString(ci.coingeckoId)},
  ${escapeString(ci.name)},
  ${escapeString(ci.quantity)},
  ${escapeString(ci.averagePrice)}
);`);
    }
    sql.push('');
}

// 15. Crypto Prices (global)
const cryptoPrices = tables.cryptoPrices || [];
if (cryptoPrices.length > 0) {
    sql.push('-- Crypto Prices');
    for (const cp of cryptoPrices) {
        sql.push(`INSERT OR REPLACE INTO crypto_prices (id, symbol, coingecko_id, price, currency, fetched_at) VALUES (
  ${escapeString(cp.id)},
  ${escapeString(cp.symbol)},
  ${escapeString(cp.coingeckoId)},
  ${escapeString(cp.price)},
  ${escapeString(cp.currency)},
  ${isoToUnix(cp.fetchedAt)}
);`);
    }
    sql.push('');
}

// 16. Crypto Transactions
const cryptoIds = new Set(cryptoInvestments.map(ci => ci.id));
const cryptoTransactions = tables.cryptoTransactions?.filter(t =>
    t.userId === TARGET_USER_ID && cryptoIds.has(t.investmentId)
) || [];
if (cryptoTransactions.length > 0) {
    sql.push('-- Crypto Transactions');
    for (const t of cryptoTransactions) {
        sql.push(`INSERT INTO crypto_transactions (id, investment_id, type, ticker, name, quantity, price_per_unit, currency, transaction_date, created_at) VALUES (
  ${escapeString(t.id)},
  ${escapeString(t.investmentId)},
  ${escapeString(t.type)},
  ${escapeString(t.ticker)},
  ${escapeString(t.name)},
  ${escapeString(t.quantity)},
  ${escapeString(t.pricePerUnit)},
  ${escapeString(t.currency)},
  ${isoToUnix(t.transactionDate)},
  ${isoToUnix(t.createdAt)}
);`);
    }
    sql.push('');
}

// 17. Entity History
const entityHistory = tables.entityHistory?.filter(eh => eh.userId === TARGET_USER_ID) || [];
if (entityHistory.length > 0) {
    sql.push('-- Entity History');
    for (const eh of entityHistory) {
        sql.push(`INSERT INTO entity_history (id, entity_type, entity_id, value, recorded_at) VALUES (
  ${escapeString(eh.id)},
  ${escapeString(eh.entityType)},
  ${escapeString(eh.entityId)},
  ${escapeString(eh.value)},
  ${isoToUnix(eh.recordedAt)}
);`);
    }
    sql.push('');
}

// 18. Portfolio Metrics History
const portfolioHistory = tables.portfolioMetricsHistory?.filter(ph => ph.userId === TARGET_USER_ID) || [];
if (portfolioHistory.length > 0) {
    sql.push('-- Portfolio Metrics History');
    for (const ph of portfolioHistory) {
        sql.push(`INSERT INTO portfolio_metrics_history (id, total_savings, total_loans_principal, total_investments, total_crypto, total_bonds, total_real_estate_personal, total_real_estate_investment, recorded_at) VALUES (
  ${escapeString(ph.id)},
  ${escapeString(ph.totalSavings)},
  ${escapeString(ph.totalLoansPrincipal)},
  ${escapeString(ph.totalInvestments)},
  ${escapeString(ph.totalCrypto)},
  ${escapeString(ph.totalBonds)},
  ${escapeString(ph.totalRealEstatePersonal)},
  ${escapeString(ph.totalRealEstateInvestment)},
  ${isoToUnix(ph.recordedAt)}
);`);
    }
    sql.push('');
}

// Write output
const output = sql.join('\n');
writeFileSync(OUTPUT_FILE, output, 'utf8');

console.log(`\nMigration SQL generated: ${OUTPUT_FILE}`);
console.log(`\nSummary:`);
console.log(`  - Savings Accounts: ${savingsAccounts.length}`);
console.log(`  - Savings Account Zones: ${zones.length}`);
console.log(`  - Loans: ${loans.length}`);
console.log(`  - Bonds: ${bonds.length}`);
console.log(`  - Real Estate: ${realEstates.length}`);
console.log(`  - Stock Investments: ${stockInvestments.length}`);
console.log(`  - Investment Transactions: ${investmentTransactions.length}`);
console.log(`  - Stock Prices: ${stockPrices.length}`);
console.log(`  - Stock Price Overrides: ${userStockPrices.length}`);
console.log(`  - Dividend Data: ${dividendData.length}`);
console.log(`  - Dividend Overrides: ${dividendOverrides.length}`);
console.log(`  - Crypto Investments: ${cryptoInvestments.length}`);
console.log(`  - Crypto Prices: ${cryptoPrices.length}`);
console.log(`  - Crypto Transactions: ${cryptoTransactions.length}`);
console.log(`  - Entity History: ${entityHistory.length}`);
console.log(`  - Portfolio History: ${portfolioHistory.length}`);
