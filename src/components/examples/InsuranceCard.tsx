import InsuranceCard from '../InsuranceCard';

export default function InsuranceCardExample() {
  const mockPolicies = [
    { id: '1', policyType: 'Life Insurance', provider: 'State Farm', coverageAmount: 500000, annualPremium: 1200, status: 'Active' },
    { id: '2', policyType: 'Home Insurance', provider: 'Allstate', coverageAmount: 350000, annualPremium: 1800, status: 'Active' },
    { id: '3', policyType: 'Auto Insurance', provider: 'Geico', coverageAmount: 100000, annualPremium: 900, status: 'Expiring Soon' },
  ];

  return <InsuranceCard policies={mockPolicies} />;
}
