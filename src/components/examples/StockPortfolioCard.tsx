import StockPortfolioCard from '../StockPortfolioCard';

export default function StockPortfolioCardExample() {
  const mockHoldings = [
    { id: '1', symbol: 'AAPL', shares: 100, costBasis: 15000, currentPrice: 175.50 },
    { id: '2', symbol: 'MSFT', shares: 50, costBasis: 18000, currentPrice: 380.00 },
    { id: '3', symbol: 'GOOGL', shares: 75, costBasis: 9500, currentPrice: 142.00 },
    { id: '4', symbol: 'TSLA', shares: 40, costBasis: 8200, currentPrice: 245.00 },
  ];

  return <StockPortfolioCard holdings={mockHoldings} />;
}
