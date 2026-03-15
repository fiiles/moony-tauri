/**
 * Pure calculation function for realized gains/losses.
 * Uses weighted average cost (WAC) method per ticker.
 */

import type { CurrencyCode } from "../currencies";

export interface RealizedGainTransaction {
    type: string; // 'buy' | 'sell'
    ticker: string;
    quantity: string;
    pricePerUnit: string;
    currency: string;
    transactionDate: number;
}

type ConvertFn = (amount: number, from: CurrencyCode, to: CurrencyCode) => number;

/**
 * Calculate total realized gains/losses from a list of transactions.
 * Uses weighted average cost (WAC) method per ticker.
 * Returns the result in targetCurrency using current exchange rates.
 */
export function calculateRealizedGains(
    transactions: RealizedGainTransaction[],
    convertFn: ConvertFn,
    targetCurrency: CurrencyCode
): number {
    const byTicker = new Map<string, RealizedGainTransaction[]>();
    for (const tx of transactions) {
        const group = byTicker.get(tx.ticker) ?? [];
        group.push(tx);
        byTicker.set(tx.ticker, group);
    }

    let totalRealizedGain = 0;

    for (const txs of byTicker.values()) {
        txs.sort((a, b) => a.transactionDate - b.transactionDate);

        let runningQty = 0;
        let runningCost = 0;

        for (const tx of txs) {
            const qty = parseFloat(tx.quantity) || 0;
            const priceRaw = parseFloat(tx.pricePerUnit) || 0;
            const price = convertFn(priceRaw, tx.currency as CurrencyCode, targetCurrency);

            if (tx.type === "buy") {
                runningCost += qty * price;
                runningQty += qty;
            } else if (tx.type === "sell" && runningQty > 0) {
                const avgCost = runningCost / runningQty;
                totalRealizedGain += (price - avgCost) * qty;
                runningCost -= avgCost * qty;
                runningQty -= qty;
            }
        }
    }

    return totalRealizedGain;
}
