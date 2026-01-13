import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { portfolioApi } from "@/lib/tauri-api";
import { CURRENCIES, CurrencyCode, CurrencyDef, convertFromCzK, convertToCzK, updateExchangeRates } from "@shared/currencies";

export const currencies = Object.values(CURRENCIES);

type CurrencyContextValue = {
  currencyCode: CurrencyCode;
  currency: CurrencyDef;
  setCurrency: (c: CurrencyCode) => void;
  formatCurrency: (value: number, opts?: Intl.NumberFormatOptions) => string;
  formatCurrencyRaw: (value: number, opts?: Intl.NumberFormatOptions) => string;
  formatCurrencyShort: (value: number) => string;
  /** Format a price with smart rounding: 2 decimals for values < 1000, 0 decimals for values >= 1000 */
  formatPrice: (value: number) => string;
  convert: (amount: number, from: CurrencyCode, to: CurrencyCode) => number;
  ratesTimestamp: number; // Added to trigger re-renders when rates update
};

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [ratesTimestamp, setRatesTimestamp] = useState(0);

  // Derive currencyCode from user profile - no need for separate state
  const currencyCode = useMemo<CurrencyCode>(() => {
    return (user?.currency as CurrencyCode) ?? "CZK";
  }, [user?.currency]);

  // Fetch ECB rates on mount using Tauri API
  useEffect(() => {
    async function fetchExchangeRates() {
      try {
        const rates = await portfolioApi.refreshExchangeRates();
        if (rates && typeof rates === 'object') {
          updateExchangeRates(rates);
          setRatesTimestamp(Date.now()); // Trigger update
        }
      } catch (error) {
        console.warn("[CURRENCY] Failed to fetch ECB rates, using fallbacks:", error);
      }
    }
    fetchExchangeRates();
  }, []);

  const currency = (CURRENCIES as Record<CurrencyCode, CurrencyDef | undefined>)[currencyCode] ?? CURRENCIES.CZK;

  function convert(amount: number, from: CurrencyCode, to: CurrencyCode): number {
    if (from === to) return amount;
    // If converting FROM base (CZK) to target
    if (from === "CZK") {
      return convertFromCzK(amount, to);
    }
    // If converting TO base (CZK) from source
    if (to === "CZK") {
      return convertToCzK(amount, from);
    }
    // Cross conversion: From -> CZK -> To
    const inCzk = convertToCzK(amount, from);
    return convertFromCzK(inCzk, to);
  }

  function formatCurrency(value: number, opts?: Intl.NumberFormatOptions) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "";

    // Convert from base currency (CZK) to display currency
    const convertedValue = convertFromCzK(value, currencyCode);

    const options: Intl.NumberFormatOptions = {
      minimumFractionDigits: opts?.minimumFractionDigits ?? 0,
      maximumFractionDigits: opts?.maximumFractionDigits ?? 0,
      ...opts,
    };

    const formatted = convertedValue.toLocaleString(currency.locale, options);
    return currency.position === "before" ? `${currency.symbol}${formatted}` : `${formatted} ${currency.symbol}`;
  }

  /**
   * Format a value that's already in the user's preferred currency (no conversion)
   * Use this for:
   * - Values already converted to user currency
   * - Calculator inputs where user enters in their preferred currency
   */
  function formatCurrencyRaw(value: number, opts?: Intl.NumberFormatOptions) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "";

    const options: Intl.NumberFormatOptions = {
      minimumFractionDigits: opts?.minimumFractionDigits ?? 0,
      maximumFractionDigits: opts?.maximumFractionDigits ?? 0,
      ...opts,
    };

    const formatted = value.toLocaleString(currency.locale, options);
    return currency.position === "before" ? `${currency.symbol}${formatted}` : `${formatted} ${currency.symbol}`;
  }

  function formatCurrencyShort(value: number) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "";

    // Convert from base currency (CZK) to display currency
    const convertedValue = convertFromCzK(value, currencyCode);

    const abs = Math.abs(convertedValue);
    if (abs >= 1_000_000_000) {
      const v = (convertedValue / 1_000_000_000).toFixed(0);
      return currency.position === "before" ? `${currency.symbol}${v}B` : `${v}B ${currency.symbol}`;
    }
    if (abs >= 1_000_000) {
      const v = (convertedValue / 1_000_000).toFixed(0);
      return currency.position === "before" ? `${currency.symbol}${v}M` : `${v}M ${currency.symbol}`;
    }
    if (abs >= 1000) {
      const v = (convertedValue / 1000).toFixed(0);
      return currency.position === "before" ? `${currency.symbol}${v}k` : `${v}k ${currency.symbol}`;
    }
    return formatCurrency(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  /**
   * Format a price with smart rounding:
   * - 2 decimal places for values <= 999
   * - 0 decimal places for values > 999
   * Use this for per-unit prices (e.g., crypto/stock price per unit)
   */
  function formatPrice(value: number): string {
    const decimals = Math.abs(value) >= 1000 ? 0 : 2;
    return formatCurrencyRaw(value, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  // No-op: currency is now derived from user.currency, changes go through profile API
  const setCurrency = (_code: CurrencyCode) => {
    // Intentionally empty - currency updates happen via profile API
    // The currencyCode is derived from user.currency via useMemo
  };

  return (
    <CurrencyContext.Provider
      value={{ currencyCode, currency, setCurrency, formatCurrency, formatCurrencyRaw, formatCurrencyShort, formatPrice, convert, ratesTimestamp }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
