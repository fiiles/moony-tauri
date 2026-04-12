import { describe, it, expect, beforeEach } from "vitest";
import {
  CURRENCIES,
  BASE_CURRENCY,
  EXCHANGE_RATES,
  convertToCzK,
  convertFromCzK,
  updateExchangeRates,
  CurrencyCode,
} from "./currencies";

describe("CURRENCIES constant", () => {
  const ALL_CODES: CurrencyCode[] = [
    "CZK","EUR","USD","GBP","JPY","AUD","CAD","CHF",
    "HKD","CNY","SEK","NOK","DKK","SGD","NZD",
  ];

  it("contains all 15 supported currencies", () => {
    for (const code of ALL_CODES) {
      expect(CURRENCIES).toHaveProperty(code);
    }
  });

  it("each currency has symbol, locale, position, and label", () => {
    for (const [, def] of Object.entries(CURRENCIES)) {
      expect(def.symbol).toBeTruthy();
      expect(def.locale).toBeTruthy();
      expect(["before", "after"]).toContain(def.position);
      expect(def.label).toBeTruthy();
    }
  });

  it("has exactly 15 currencies", () => {
    expect(Object.keys(CURRENCIES)).toHaveLength(15);
  });
});

describe("BASE_CURRENCY constant", () => {
  it("should be CZK", () => {
    expect(BASE_CURRENCY).toBe("CZK");
  });
});

describe("EXCHANGE_RATES", () => {
  it("includes all 15 currencies with fallback rates", () => {
    const codes: CurrencyCode[] = [
      "CZK","EUR","USD","GBP","JPY","AUD","CAD","CHF",
      "HKD","CNY","SEK","NOK","DKK","SGD","NZD",
    ];
    for (const code of codes) {
      expect(EXCHANGE_RATES).toHaveProperty(code);
    }
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

describe("Cross-rate derivation via CZK", () => {
  beforeEach(() => {
    updateExchangeRates({ EUR: 25.0, USD: 20.0, JPY: 0.16, AUD: 14.0 });
  });

  it("EUR→USD cross-rate equals (EUR/CZK) / (USD/CZK)", () => {
    const eurInCzk = convertToCzK(100, "EUR");  // 2500 CZK
    const result = convertFromCzK(eurInCzk, "USD"); // 2500/20 = 125
    expect(result).toBeCloseTo(125, 2);
  });

  it("JPY→AUD cross-rate is accurate", () => {
    const jpyInCzk = convertToCzK(10000, "JPY"); // 1600 CZK
    const result = convertFromCzK(jpyInCzk, "AUD"); // 1600/14 ≈ 114.29
    expect(result).toBeCloseTo(1600 / 14, 2);
  });

  it("round-trip for all new currencies is lossless", () => {
    updateExchangeRates({ AUD: 14.5, CAD: 17.0, SEK: 2.2, NOK: 2.1, DKK: 3.4, SGD: 17.5, NZD: 13.5 });
    const codes: CurrencyCode[] = ["AUD","CAD","SEK","NOK","DKK","SGD","NZD"];
    for (const code of codes) {
      const original = 100;
      const inCzk = convertToCzK(original, code);
      const back = convertFromCzK(inCzk, code);
      expect(back).toBeCloseTo(original, 6);
    }
  });
});
