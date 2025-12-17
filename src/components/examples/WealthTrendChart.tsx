import WealthTrendChart from '../WealthTrendChart';

export default function WealthTrendChartExample() {
  const mockData = [
    { date: 'Jan', value: 425000 },
    { date: 'Feb', value: 438000 },
    { date: 'Mar', value: 445000 },
    { date: 'Apr', value: 455000 },
    { date: 'May', value: 468000 },
    { date: 'Jun', value: 487325 },
  ];

  return <WealthTrendChart data={mockData} />;
}
