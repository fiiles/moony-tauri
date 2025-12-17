import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { portfolioApi } from "@/lib/tauri-api";
import { CURRENCIES, CurrencyCode, CurrencyDef, convertFromCzK, convertToCzK, updateExchangeRates } from "@shared/currencies";

type CurrencyContextValue = {
  currencyCode: CurrencyCode;
  currency: CurrencyDef;
  setCurrency: (c: CurrencyCode) => void;
  formatCurrency: (value: number, opts?: Intl.NumberFormatOptions) => string;
  formatCurrencyShort: (value: number) => string;
  convert: (amount: number, from: CurrencyCode, to: CurrencyCode) => number;
};

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>("CZK");

  // Fetch ECB rates on mount using Tauri API
  useEffect(() => {
    async function fetchExchangeRates() {
      try {
        const rates = await portfolioApi.refreshExchangeRates();
        if (rates && typeof rates === 'object') {
          updateExchangeRates(rates);
          console.log("[CURRENCY] Updated exchange rates from ECB:", rates);
        }
      } catch (error) {
        console.warn("[CURRENCY] Failed to fetch ECB rates, using fallbacks:", error);
      }
    }
    fetchExchangeRates();
  }, []);

  useEffect(() => {
    if (user?.currency) {
      setCurrencyCode(user.currency as CurrencyCode);
    }
  }, [user?.currency]);

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

  return (
    <CurrencyContext.Provider
      value={{ currencyCode, currency, setCurrency: setCurrencyCode, formatCurrency, formatCurrencyShort, convert }}
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

export const currencies = Object.values(CURRENCIES);
