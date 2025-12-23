import { Card } from "@/components/ui/card";
import { ShoppingCart, DollarSign, Coffee, Home } from "lucide-react";
import { useCurrency } from "@/lib/currency";

interface Transaction {
  id: string;
  type: string;
  description: string;
  date: string;
  amount: number;
  icon: 'shopping' | 'deposit' | 'food' | 'mortgage';
}

interface RecentTransactionsProps {
  transactions: Transaction[];
  onViewAll?: () => void;
}

const iconMap = {
  shopping: ShoppingCart,
  deposit: DollarSign,
  food: Coffee,
  mortgage: Home,
};

export default function RecentTransactions({ transactions, onViewAll }: RecentTransactionsProps) {
  const { formatCurrency } = useCurrency();

  return (
    <Card className="p-6 border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Recent Transactions</h3>
        <button 
          className="text-sm font-bold text-primary hover:underline"
          onClick={() => {
            onViewAll?.();
          }}
          data-testid="button-view-all-transactions"
        >
          View All
        </button>
      </div>
      
      <div className="space-y-4">
        {transactions.map((transaction) => {
          const Icon = iconMap[transaction.icon];
          const isNegative = transaction.amount < 0;
          
          return (
            <div key={transaction.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{transaction.description}</p>
                  <p className="text-xs text-muted-foreground">{transaction.date}</p>
                </div>
              </div>
              <p className={`text-sm font-semibold ${isNegative ? 'text-negative' : 'text-positive'}`}>
                {isNegative ? '-' : '+'}{formatCurrency(Math.abs(transaction.amount))}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
