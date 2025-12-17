/**
 * Shared calculations module.
 * Re-exports all calculation functions and types.
 */

// Holding-level calculations
export {
    calculateMarketValue,
    calculateTotalCost,
    calculateGainLoss,
    calculateGainLossPercent,
    calculateHoldingMetrics,
    type HoldingInput,
    type HoldingMetrics,
} from "./holding-metrics";

// Portfolio-level calculations
export {
    sumHoldingValues,
    calculatePortfolioTotals,
    findTopPerformer,
    type PortfolioTotals,
} from "./portfolio-metrics";

// Yield calculations
export {
    calculateAnnualYield,
    calculateYieldPercentOnCost,
    calculateYieldPercentOnMarket,
    type YieldType,
    type YieldInput,
} from "./yield-metrics";

// Crypto-specific calculations
export {
    calculateCryptoHoldingMetrics,
    calculateCryptoPortfolioMetrics,
    findLargestHolding,
    mapCryptoInvestmentToHolding,
    type CryptoHoldingInput,
    type CryptoHoldingData,
    type CryptoPortfolioMetrics,
} from "./crypto-metrics";

// Change/percentage calculations
export {
    calculatePercentageChange,
    calculateAbsoluteChange,
    calculateNetWorth,
    calculateTotalAssets,
    calculateAllocationPercentage,
    type AssetComponents,
} from "./change-metrics";
