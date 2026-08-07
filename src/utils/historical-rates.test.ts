import { describe, it, expect, vi } from 'vitest';
import {
  dayKeyFor,
  resolveRatesForDay,
  convertBreakdownAtDay,
  convertCzkAtDay,
  type RatesByDay,
} from './historical-rates';

const DAY = 86400;

describe('dayKeyFor', () => {
  it('floors a timestamp to midnight UTC', () => {
    expect(dayKeyFor(DAY * 100 + 12345)).toBe(DAY * 100);
  });

  it('returns midnight timestamps unchanged', () => {
    expect(dayKeyFor(DAY * 100)).toBe(DAY * 100);
  });
});

describe('resolveRatesForDay', () => {
  const rates: RatesByDay = {
    [DAY * 1]: { CZK: 1, USD: 22 },
    [DAY * 4]: { CZK: 1, USD: 23 },
    [DAY * 10]: { CZK: 1, USD: 24 },
  };

  it('returns undefined when the map is undefined', () => {
    expect(resolveRatesForDay(undefined, DAY * 4)).toBeUndefined();
  });

  it('returns undefined when the map is empty', () => {
    expect(resolveRatesForDay({}, DAY * 4)).toBeUndefined();
  });

  it('returns the exact day entry when present', () => {
    expect(resolveRatesForDay(rates, DAY * 4)).toEqual({ CZK: 1, USD: 23 });
  });

  it('falls back to the closest earlier day when the exact day is missing', () => {
    expect(resolveRatesForDay(rates, DAY * 6)).toEqual({ CZK: 1, USD: 23 });
    expect(resolveRatesForDay(rates, DAY * 3)).toEqual({ CZK: 1, USD: 22 });
    expect(resolveRatesForDay(rates, DAY * 100)).toEqual({ CZK: 1, USD: 24 });
  });

  it('returns undefined when the day is before the first entry', () => {
    expect(resolveRatesForDay(rates, DAY * 0)).toBeUndefined();
  });
});

describe('convertBreakdownAtDay', () => {
  const dayRates = { CZK: 1, USD: 20, EUR: 25 };

  it('returns the stored CZK total untouched for CZK display', () => {
    const convertToday = vi.fn();
    expect(convertBreakdownAtDay('{"USD":100}', 1234, dayRates, 'CZK', convertToday)).toBe(1234);
    expect(convertToday).not.toHaveBeenCalled();
  });

  it('converts each native bucket at that day rates via the CZK pivot', () => {
    const convertToday = vi.fn();
    // (100 USD * 20 + 500 CZK * 1) / 25 CZK-per-EUR = 100 EUR
    const result = convertBreakdownAtDay(
      '{"USD":100,"CZK":500}',
      99999,
      dayRates,
      'EUR',
      convertToday
    );
    expect(result).toBeCloseTo(100, 10);
    expect(convertToday).not.toHaveBeenCalled();
  });

  it("falls back per bucket to today's rate when a bucket currency is missing from the day map", () => {
    const convertToday = vi.fn().mockReturnValue(7);
    // USD bucket: 100 * 20 / 25 = 80 EUR; GBP bucket missing -> convertToday(10, 'GBP') = 7
    const result = convertBreakdownAtDay(
      '{"USD":100,"GBP":10}',
      99999,
      dayRates,
      'EUR',
      convertToday
    );
    expect(result).toBeCloseTo(87, 10);
    expect(convertToday).toHaveBeenCalledTimes(1);
    expect(convertToday).toHaveBeenCalledWith(10, 'GBP');
  });

  it('falls back to CZK total at today rate when the display currency is missing from the day map', () => {
    const convertToday = vi.fn().mockReturnValue(42);
    const result = convertBreakdownAtDay(
      '{"USD":100}',
      1000,
      { CZK: 1, USD: 20 },
      'EUR',
      convertToday
    );
    expect(result).toBe(42);
    expect(convertToday).toHaveBeenCalledWith(1000, 'CZK');
  });

  it('falls back to CZK total at today rate when there are no day rates', () => {
    const convertToday = vi.fn().mockReturnValue(42);
    expect(convertBreakdownAtDay('{"USD":100}', 1000, undefined, 'EUR', convertToday)).toBe(42);
    expect(convertToday).toHaveBeenCalledWith(1000, 'CZK');
  });

  it('falls back to CZK total at today rate when the breakdown is empty', () => {
    const convertToday = vi.fn().mockReturnValue(42);
    expect(convertBreakdownAtDay('{}', 1000, dayRates, 'EUR', convertToday)).toBe(42);
    expect(convertToday).toHaveBeenCalledWith(1000, 'CZK');
  });

  it('falls back to CZK total at today rate when the breakdown JSON is invalid', () => {
    const convertToday = vi.fn().mockReturnValue(42);
    expect(convertBreakdownAtDay('not json', 1000, dayRates, 'EUR', convertToday)).toBe(42);
  });

  it('falls back to CZK total at today rate when the breakdown is null or undefined', () => {
    const convertToday = vi.fn().mockReturnValue(42);
    expect(convertBreakdownAtDay(null, 1000, dayRates, 'EUR', convertToday)).toBe(42);
    expect(convertBreakdownAtDay(undefined, 1000, dayRates, 'EUR', convertToday)).toBe(42);
  });

  it('treats a zero or non-finite display rate as missing', () => {
    const convertToday = vi.fn().mockReturnValue(42);
    expect(
      convertBreakdownAtDay('{"USD":100}', 1000, { CZK: 1, EUR: 0 }, 'EUR', convertToday)
    ).toBe(42);
    expect(convertToday).toHaveBeenCalledWith(1000, 'CZK');
  });

  it('ignores non-numeric breakdown entries, falling back when nothing valid remains', () => {
    const convertToday = vi.fn().mockReturnValue(42);
    expect(convertBreakdownAtDay('{"USD":"bad"}', 1000, dayRates, 'EUR', convertToday)).toBe(42);
    expect(convertToday).toHaveBeenCalledWith(1000, 'CZK');
  });
});

describe('convertCzkAtDay', () => {
  it('returns the CZK amount untouched for CZK display', () => {
    const convertToday = vi.fn();
    expect(convertCzkAtDay(1234, { CZK: 1, EUR: 25 }, 'CZK', convertToday)).toBe(1234);
    expect(convertToday).not.toHaveBeenCalled();
  });

  it('divides by the day display rate when available', () => {
    const convertToday = vi.fn();
    expect(convertCzkAtDay(2500, { CZK: 1, EUR: 25 }, 'EUR', convertToday)).toBeCloseTo(100, 10);
    expect(convertToday).not.toHaveBeenCalled();
  });

  it("falls back to today's rate when the display rate is missing", () => {
    const convertToday = vi.fn().mockReturnValue(42);
    expect(convertCzkAtDay(2500, { CZK: 1 }, 'EUR', convertToday)).toBe(42);
    expect(convertToday).toHaveBeenCalledWith(2500, 'CZK');
  });

  it("falls back to today's rate when there are no day rates", () => {
    const convertToday = vi.fn().mockReturnValue(42);
    expect(convertCzkAtDay(2500, undefined, 'EUR', convertToday)).toBe(42);
    expect(convertToday).toHaveBeenCalledWith(2500, 'CZK');
  });

  it("falls back to today's rate when the display rate is zero", () => {
    const convertToday = vi.fn().mockReturnValue(42);
    expect(convertCzkAtDay(2500, { CZK: 1, EUR: 0 }, 'EUR', convertToday)).toBe(42);
  });
});
