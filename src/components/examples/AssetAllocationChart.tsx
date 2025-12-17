import AssetAllocationChart from '../AssetAllocationChart';

export default function AssetAllocationChartExample() {
  const mockData = [
    { name: 'Stocks', value: 185000, color: 'hsl(217, 91%, 35%)' },
    { name: 'Real Estate', value: 150000, color: 'hsl(142, 76%, 36%)' },
    { name: 'Savings', value: 75000, color: 'hsl(262, 83%, 58%)' },
    { name: 'Crypto', value: 45000, color: 'hsl(32, 98%, 55%)' },
    { name: 'Commodities', value: 25000, color: 'hsl(340, 82%, 52%)' },
  ];

  return <AssetAllocationChart data={mockData} />;
}
