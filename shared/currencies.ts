// Display currencies - shown in UI dropdowns
export type DisplayCurrencyCode = "USD" | "EUR" | "CZK";

// All supported currencies - for internal conversion
export type CurrencyCode = "USD" | "EUR" | "CZK" | "GBP" | "CNY" | "JPY" | "CHF" | "HKD";

export interface CurrencyDef {
    code: DisplayCurrencyCode;
    symbol: string;
    locale: string;
    position: "before" | "after";
    label: string;
}

// Only display currencies are shown in UI
export const CURRENCIES: Record<DisplayCurrencyCode, CurrencyDef> = {
    USD: { code: "USD", symbol: "$", locale: "en-US", position: "before", label: "US Dollar (USD)" },
    EUR: { code: "EUR", symbol: "€", locale: "de-DE", position: "before", label: "Euro (EUR)" },
    CZK: { code: "CZK", symbol: "Kč", locale: "cs-CZ", position: "after", label: "Czech Crown (CZK)" },
};

// Base currency is CZK
export const BASE_CURRENCY: CurrencyCode = "CZK";

// Exchange rates relative to CZK (1 Unit of Currency = X CZK)
// These are updated automatically from ECB API before price fetching
// Includes both display and internal currencies for proper conversion
export let EXCHANGE_RATES: Record<CurrencyCode, number> = {
    CZK: 1,
    // Display currencies (updated from ECB)
    EUR: 25.0,  // Fallback value
    USD: 23.0,  // Fallback value
    // Internal currencies (updated from ECB)
    GBP: 29.0,  // Fallback value
    CNY: 3.2,   // Fallback value
    JPY: 0.15,  // Fallback value
    CHF: 26.0,  // Fallback value
    HKD: 3.0,   // Fallback value
};

/**
 * Update exchange rates dynamically (called from server-side)
 * Rates should be in CZK base: 1 Currency = X CZK
 */
export function updateExchangeRates(rates: Partial<Record<CurrencyCode, number>>): void {
    Object.entries(rates).forEach(([currency, rate]) => {
        if (rate !== undefined) {
            EXCHANGE_RATES[currency as CurrencyCode] = rate;
        }
    });
    EXCHANGE_RATES.CZK = 1; // Always 1
}

export function convertToCzK(amount: number, fromCurrency: CurrencyCode): number {
    const rate = EXCHANGE_RATES[fromCurrency];
    return amount * rate;
}

export function convertFromCzK(amountInCzk: number, toCurrency: CurrencyCode): number {
    const rate = EXCHANGE_RATES[toCurrency];
    return amountInCzk / rate;
}
