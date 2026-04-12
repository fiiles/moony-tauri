// All supported currencies — every currency is both a position currency and a display currency
export type CurrencyCode =
  | "CZK" | "EUR" | "USD" | "GBP"
  | "JPY" | "AUD" | "CAD" | "CHF"
  | "HKD" | "CNY" | "SEK" | "NOK"
  | "DKK" | "SGD" | "NZD";

export interface CurrencyDef {
    code: CurrencyCode;
    symbol: string;
    locale: string;
    position: "before" | "after";
    label: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyDef> = {
    CZK: { code: "CZK", symbol: "Kč",  locale: "cs-CZ",  position: "after",  label: "Czech Crown (CZK)" },
    EUR: { code: "EUR", symbol: "€",   locale: "de-DE",  position: "before", label: "Euro (EUR)" },
    USD: { code: "USD", symbol: "$",   locale: "en-US",  position: "before", label: "US Dollar (USD)" },
    GBP: { code: "GBP", symbol: "£",   locale: "en-GB",  position: "before", label: "British Pound (GBP)" },
    JPY: { code: "JPY", symbol: "¥",   locale: "ja-JP",  position: "before", label: "Japanese Yen (JPY)" },
    AUD: { code: "AUD", symbol: "A$",  locale: "en-AU",  position: "before", label: "Australian Dollar (AUD)" },
    CAD: { code: "CAD", symbol: "C$",  locale: "en-CA",  position: "before", label: "Canadian Dollar (CAD)" },
    CHF: { code: "CHF", symbol: "Fr.", locale: "de-CH",  position: "before", label: "Swiss Franc (CHF)" },
    HKD: { code: "HKD", symbol: "HK$", locale: "zh-HK",  position: "before", label: "Hong Kong Dollar (HKD)" },
    CNY: { code: "CNY", symbol: "¥",   locale: "zh-CN",  position: "before", label: "Chinese Yuan (CNY)" },
    SEK: { code: "SEK", symbol: "kr",  locale: "sv-SE",  position: "after",  label: "Swedish Krona (SEK)" },
    NOK: { code: "NOK", symbol: "kr",  locale: "nb-NO",  position: "after",  label: "Norwegian Krone (NOK)" },
    DKK: { code: "DKK", symbol: "kr",  locale: "da-DK",  position: "after",  label: "Danish Krone (DKK)" },
    SGD: { code: "SGD", symbol: "S$",  locale: "en-SG",  position: "before", label: "Singapore Dollar (SGD)" },
    NZD: { code: "NZD", symbol: "NZ$", locale: "en-NZ",  position: "before", label: "New Zealand Dollar (NZD)" },
};

// Base currency is CZK
export const BASE_CURRENCY: CurrencyCode = "CZK";

// Fallback exchange rates (1 unit of currency = X CZK). Updated from ECB on unlock.
export let EXCHANGE_RATES: Record<CurrencyCode, number> = {
    CZK: 1,
    EUR: 25.0,
    USD: 23.0,
    GBP: 29.0,
    JPY: 0.15,
    AUD: 14.5,
    CAD: 17.0,
    CHF: 26.0,
    HKD: 3.0,
    CNY: 3.2,
    SEK: 2.2,
    NOK: 2.1,
    DKK: 3.4,
    SGD: 17.5,
    NZD: 13.5,
};

export function updateExchangeRates(rates: Partial<Record<CurrencyCode, number>>): void {
    Object.entries(rates).forEach(([currency, rate]) => {
        if (rate !== undefined) {
            EXCHANGE_RATES[currency as CurrencyCode] = rate;
        }
    });
    EXCHANGE_RATES.CZK = 1;
}

export function convertToCzK(amount: number, fromCurrency: CurrencyCode): number {
    const rate = EXCHANGE_RATES[fromCurrency];
    return amount * rate;
}

export function convertFromCzK(amountInCzk: number, toCurrency: CurrencyCode): number {
    const rate = EXCHANGE_RATES[toCurrency];
    return amountInCzk / rate;
}
