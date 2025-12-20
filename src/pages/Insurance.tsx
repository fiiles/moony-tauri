import { InsuranceList } from "@/components/insurance/InsuranceList";
import { InsuranceFormDialog } from "@/components/insurance/InsuranceFormDialog";
import { Button } from "@/components/ui/button";
import { Plus, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { insuranceApi } from "@/lib/tauri-api";
import { InsurancePolicy } from "@shared/schema";
import { SummaryCard } from "@/components/common/SummaryCard";
import { useCurrency } from "@/lib/currency";
import { convertToCzK, convertFromCzK, type CurrencyCode } from "@shared/currencies";
import { useTranslation } from "react-i18next";

export default function Insurance() {
  const { t } = useTranslation('insurance');
  const { formatCurrency, currencyCode: userCurrency } = useCurrency();

  const { data: policies, isLoading } = useQuery<InsurancePolicy[]>({
    queryKey: ["insurance"],
    queryFn: () => insuranceApi.getAll(),
  });

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="page-title">{t('title')}</h1>
          <p className="page-subtitle">{t('loading')}</p>
        </div>
      </div>
    );
  }

  // Calculate total yearly cost with currency conversion
  const totalYearlyCost = policies?.reduce((sum, policy) => {
    if (policy.status !== 'active') return sum;

    const regularPayment = Number(policy.regularPayment);
    const currency = (policy as any).regularPaymentCurrency || "CZK";

    // Convert to CZK first, then to user currency
    const inCzk = convertToCzK(regularPayment, currency as CurrencyCode);
    const converted = convertFromCzK(inCzk, userCurrency as CurrencyCode);

    // Calculate yearly amount based on frequency
    let yearlyAmount = 0;
    if (policy.paymentFrequency === 'monthly') {
      yearlyAmount = converted * 12;
    } else if (policy.paymentFrequency === 'quarterly') {
      yearlyAmount = converted * 4;
    } else if (policy.paymentFrequency === 'yearly') {
      yearlyAmount = converted;
    } else if (policy.paymentFrequency === 'one_time') {
      yearlyAmount = 0; // One-time payments don't contribute to recurring costs
    }

    return sum + yearlyAmount;
  }, 0) || 0;

  const activePolicies = policies?.filter(p => p.status === 'active').length || 0;

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t('title')}</h1>
          <p className="page-subtitle">{t('subtitle')}</p>
        </div>
        <InsuranceFormDialog
          trigger={
            <Button className="transition-all duration-200">
              <Plus className="mr-2 h-4 w-4" />
              {t('addPolicy')}
            </Button>
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard
          title={t('summary.totalPremium')}
          value={formatCurrency(totalYearlyCost)}
          icon={<Shield className="h-4 w-4" />}
          subtitle={t('summary.policyCount')}
        />
        <SummaryCard
          title={t('summary.policyCount')}
          value={activePolicies}
          icon={<Shield className="h-4 w-4" />}
        />
      </div>

      <InsuranceList />
    </div>
  );
}
