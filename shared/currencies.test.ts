import { describe, it, expect, beforeEach } from "vitest";
import {
  CURRENCIES,
  BASE_CURRENCY,
  EXCHANGE_RATES,
  convertToCzK,
  convertFromCzK,
  updateExchangeRates,
} from "./currencies";

describe("CURRENCIES constant", () => {
  it("contains USD, EUR, CZK, GBP", () => {
    expect(CURRENCIES).toHaveProperty("USD");
    expect(CURRENCIES).toHaveProperty("EUR");
    expect(CURRENCIES).toHaveProperty("CZK");
    expect(CURRENCIES).toHaveProperty("GBP");
  });

  it("each currency has symbol, locale, position, and label", () => {
    for (const [, def] of Object.entries(CURRENCIES)) {
      expect(def.symbol).toBeTruthy();
      expect(def.locale).toBeTruthy();
      expect(["before", "after"]).toContain(def.position);
      expect(def.label).toBeTruthy();
    }
  });

  it("has correct properties for USD", () => {
    expect(CURRENCIES.USD.symbol).toBe("$");
    expect(CURRENCIES.USD.locale).toBe("en-US");
    expect(CURRENCIES.USD.position).toBe("before");
    expect(CURRENCIES.USD.label).toBe("US Dollar (USD)");
  });

  it("has correct properties for EUR", () => {
    expect(CURRENCIES.EUR.symbol).toBe("€");
    expect(CURRENCIES.EUR.locale).toBe("de-DE");
    expect(CURRENCIES.EUR.position).toBe("before");
    expect(CURRENCIES.EUR.label).toBe("Euro (EUR)");
  });

  it("has correct properties for CZK", () => {
    expect(CURRENCIES.CZK.symbol).toBe("Kč");
    expect(CURRENCIES.CZK.locale).toBe("cs-CZ");
    expect(CURRENCIES.CZK.position).toBe("after");
    expect(CURRENCIES.CZK.label).toBe("Czech Crown (CZK)");
  });

  it("has correct properties for GBP", () => {
    expect(CURRENCIES.GBP.symbol).toBe("£");
    expect(CURRENCIES.GBP.locale).toBe("en-GB");
    expect(CURRENCIES.GBP.position).toBe("before");
    expect(CURRENCIES.GBP.label).toBe("British Pound (GBP)");
  });
});

describe("BASE_CURRENCY constant", () => {
  it("should be CZK", () => {
    expect(BASE_CURRENCY).toBe("CZK");
  });
});

describe("EXCHANGE_RATES", () => {
  it("includes all display currencies with fallback rates", () => {
    expect(EXCHANGE_RATES).toHaveProperty("USD");
    expect(EXCHANGE_RATES).toHaveProperty("EUR");
    expect(EXCHANGE_RATES).toHaveProperty("CZK");
    expect(EXCHANGE_RATES).toHaveProperty("GBP");
  });

  it("includes internal currencies", () => {
    expect(EXCHANGE_RATES).toHaveProperty("CNY");
    expect(EXCHANGE_RATES).toHaveProperty("JPY");
    expect(EXCHANGE_RATES).toHaveProperty("CHF");
    expect(EXCHANGE_RATES).toHaveProperty("HKD");
  });

  it("CZK rate is always 1", () => {
    expect(EXCHANGE_RATES.CZK).toBe(1);
  });

  it("all rates are positive numbers", () => {
    for (const rate of Object.values(EXCHANGE_RATES)) {
      expect(typeof rate).toBe("number");
      expect(rate).toBeGreaterThan(0);
    }
  });
});

describe("convertToCzK", () => {
  beforeEach(() => {
    updateExchangeRates({ EUR: 25.0, USD: 23.0, GBP: 29.0 });
  });

  it("converts EUR to CZK using rate", () => {
    expect(convertToCzK(100, "EUR")).toBeCloseTo(2500, 2);
  });

  it("converts USD to CZK using rate", () => {
    expect(convertToCzK(10, "USD")).toBeCloseTo(230, 2);
  });

  it("converts GBP to CZK using rate", () => {
    expect(convertToCzK(1, "GBP")).toBeCloseTo(29, 2);
  });

  it("returns amount unchanged for CZK", () => {
    expect(convertToCzK(500, "CZK")).toBe(500);
  });

  it("handles zero amount", () => {
    expect(convertToCzK(0, "EUR")).toBe(0);
  });

  it("handles negative amounts", () => {
    expect(convertToCzK(-100, "EUR")).toBe(-2500);
  });

  it("handles decimal amounts", () => {
    expect(convertToCzK(1.5, "USD")).toBeCloseTo(34.5, 2);
  });

  it("handles internal currencies like CNY", () => {
    updateExchangeRates({ CNY: 3.2 });
    expect(convertToCzK(100, "CNY")).toBeCloseTo(320, 2);
  });
});

describe("convertFromCzK", () => {
  beforeEach(() => {
    updateExchangeRates({ EUR: 25.0, USD: 23.0, GBP: 29.0 });
  });

  it("converts CZK to EUR", () => {
    expect(convertFromCzK(2500, "EUR")).toBeCloseTo(100, 2);
  });

  it("converts CZK to USD", () => {
    expect(convertFromCzK(230, "USD")).toBeCloseTo(10, 2);
  });

  it("converts CZK to GBP", () => {
    expect(convertFromCzK(29, "GBP")).toBeCloseTo(1, 2);
  });

  it("returns amount unchanged for CZK", () => {
    expect(convertFromCzK(500, "CZK")).toBe(500);
  });

  it("handles zero amount", () => {
    expect(convertFromCzK(0, "EUR")).toBe(0);
  });

  it("handles negative amounts", () => {
    expect(convertFromCzK(-2500, "EUR")).toBeCloseTo(-100, 2);
  });

  it("handles decimal amounts", () => {
    expect(convertFromCzK(34.5, "USD")).toBeCloseTo(1.5, 2);
  });

  it("handles internal currencies like JPY", () => {
    updateExchangeRates({ JPY: 0.15 });
    expect(convertFromCzK(15, "JPY")).toBeCloseTo(100, 2);
  });
});

describe("updateExchangeRates", () => {
  it("updates EUR rate and affects subsequent conversions", () => {
    updateExchangeRates({ EUR: 30.0 });
    expect(convertToCzK(1, "EUR")).toBeCloseTo(30, 2);
  });

  it("updates multiple rates at once", () => {
    updateExchangeRates({ EUR: 26.0, USD: 24.0, GBP: 30.0 });
    expect(EXCHANGE_RATES.EUR).toBe(26.0);
    expect(EXCHANGE_RATES.USD).toBe(24.0);
    expect(EXCHANGE_RATES.GBP).toBe(30.0);
  });

  it("CZK rate always stays 1 even if update attempts to change it", () => {
    updateExchangeRates({ CZK: 999 } as any);
    expect(EXCHANGE_RATES.CZK).toBe(1);
  });

  it("preserves existing rates when updating partial rates", () => {
    updateExchangeRates({ EUR: 25.0, USD: 23.0, GBP: 29.0, CNY: 3.2 });
    const previousChf = EXCHANGE_RATES.CHF;
    updateExchangeRates({ EUR: 30.0 });
    expect(EXCHANGE_RATES.CHF).toBe(previousChf);
  });

  it("handles empty update object", () => {
    const currentEur = EXCHANGE_RATES.EUR;
    updateExchangeRates({});
    expect(EXCHANGE_RATES.EUR).toBe(currentEur);
    expect(EXCHANGE_RATES.CZK).toBe(1);
  });

  it("ignores undefined rates in update", () => {
    updateExchangeRates({ EUR: 25.0, USD: undefined as any });
    expect(EXCHANGE_RATES.EUR).toBe(25.0);
  });

  it("updates internal currency rates", () => {
    updateExchangeRates({ CNY: 3.5, JPY: 0.18, CHF: 27.0 });
    expect(EXCHANGE_RATES.CNY).toBe(3.5);
    expect(EXCHANGE_RATES.JPY).toBe(0.18);
    expect(EXCHANGE_RATES.CHF).toBe(27.0);
  });
});

describe("Currency conversion round-trip", () => {
  beforeEach(() => {
    updateExchangeRates({ EUR: 25.0, USD: 23.0 });
  });

  it("CZK -> EUR -> CZK returns original amount", () => {
    const original = 1000;
    const inEur = convertFromCzK(original, "EUR");
    const backToCzk = convertToCzK(inEur, "EUR");
    expect(backToCzk).toBeCloseTo(original, 2);
  });

  it("USD -> CZK -> USD returns original amount", () => {
    const original = 100;
    const inCzk = convertToCzK(original, "USD");
    const backToUsd = convertFromCzK(inCzk, "USD");
    expect(backToUsd).toBeCloseTo(original, 2);
  });
});
