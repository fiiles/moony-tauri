import SavingsAccountCard from '../SavingsAccountCard';

export default function SavingsAccountCardExample() {
  const mockAccounts = [
    { id: '1', name: 'High Yield Savings', institution: 'Marcus by Goldman Sachs', balance: 45000.00 },
    { id: '2', name: 'Emergency Fund', institution: 'Ally Bank', balance: 25000.00 },
    { id: '3', name: 'Checking', institution: 'Chase', balance: 5000.00 },
  ];

  return <SavingsAccountCard accounts={mockAccounts} />;
}
