import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Banknote, Plus } from "lucide-react";
import { useCurrency } from "@/lib/currency";

interface SavingsAccount {
  id: string;
  name: string;
  institution: string;
  balance: number;
}

interface SavingsAccountCardProps {
  accounts: SavingsAccount[];
  onAdd?: () => void;
}

export default function SavingsAccountCard({ accounts, onAdd }: SavingsAccountCardProps) {
  const { formatCurrency } = useCurrency();
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Banknote className="w-5 h-5 text-chart-1" />
          <h3 className="text-lg font-semibold">Savings Accounts</h3>
        </div>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => {
            onAdd?.();
          }}
          data-testid="button-add-savings"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between items-baseline pb-3 border-b">
          <span className="text-sm font-medium">Total</span>
          <span className="text-2xl font-bold tabular-nums">
            {formatCurrency(totalBalance)}
          </span>
        </div>
        
        {accounts.map((account) => (
          <div key={account.id} className="flex justify-between items-center py-2 hover-elevate rounded-md px-2 -mx-2">
            <div>
              <p className="font-medium text-sm">{account.name}</p>
              <p className="text-xs text-muted-foreground">{account.institution}</p>
            </div>
            <span className="font-semibold tabular-nums">
              {formatCurrency(account.balance)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
