import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Plus } from "lucide-react";
import { useCurrency } from "@/lib/currency";

interface InsurancePolicy {
  id: string;
  policyType: string;
  provider: string;
  coverageAmount: number;
  annualPremium: number;
  status: string;
}

interface InsuranceCardProps {
  policies: InsurancePolicy[];
  onAdd?: () => void;
}

export default function InsuranceCard({ policies, onAdd }: InsuranceCardProps) {
  const { formatCurrency, formatCurrencyShort } = useCurrency();
  const totalCoverage = policies.reduce((sum, policy) => sum + policy.coverageAmount, 0);
  const totalPremiums = policies.reduce((sum, policy) => sum + policy.annualPremium, 0);

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'default';
      case 'expiring soon':
        return 'secondary';
      case 'expired':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-chart-3" />
          <h3 className="text-lg font-semibold">Insurance</h3>
        </div>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => {
            console.log('Add insurance clicked');
            onAdd?.();
          }}
          data-testid="button-add-insurance"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between items-baseline pb-3 border-b">
          <div className="space-y-1">
            <span className="text-sm font-medium">Total Coverage</span>
            <p className="text-xs text-muted-foreground">
              {formatCurrencyShort(totalPremiums)}/yr premiums
            </p>
          </div>
          <span className="text-2xl font-bold tabular-nums">
            {formatCurrency(totalCoverage)}
          </span>
        </div>
        
        {policies.map((policy) => (
          <div key={policy.id} className="flex justify-between items-start py-2 hover-elevate rounded-md px-2 -mx-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{policy.policyType}</p>
                <Badge variant={getStatusVariant(policy.status)} className="text-xs">
                  {policy.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{policy.provider}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold tabular-nums text-sm">
                {formatCurrency(policy.coverageAmount)}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatCurrency(policy.annualPremium)}/yr
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
