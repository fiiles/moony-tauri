import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SavingsAccount, InsertSavingsAccount } from "@shared/schema";
import { useCurrency, currencies } from "@/lib/currency";
import { CurrencyCode } from "@shared/currencies";
import { SavingsAccountZoneManager } from "@/components/SavingsAccountZoneManager";
import { savingsApi } from "@/lib/tauri-api";
import { useTranslation } from "react-i18next";

type UpdateSavingsAccountData = {
  id: string;
  name?: string;
  balance?: string;
  interestRate?: string;
  hasZoneDesignation?: boolean;
  terminationDate?: number | null;
};

interface ZoneData {
  id?: string;
  fromAmount: string;
  toAmount: string;
  interestRate: string;
}

interface SavingsAccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertSavingsAccount | UpdateSavingsAccountData, zones?: ZoneData[]) => void;
  account?: SavingsAccount | null;
  isLoading?: boolean;
}

export function SavingsAccountFormDialog({
  open,
  onOpenChange,
  onSubmit,
  account,
  isLoading = false,
}: SavingsAccountFormDialogProps) {
  const { t } = useTranslation('savings');
  const { t: tc } = useTranslation('common');
  const { convert, currencyCode: userCurrency } = useCurrency();
  const isEditMode = !!account;

  // Form state - balance and currency are stored as-is (not converted)
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("0");
  const [interestRate, setInterestRate] = useState("0");
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(userCurrency);
  const [hasZoneDesignation, setHasZoneDesignation] = useState(false);
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [terminationDate, setTerminationDate] = useState<string>("");

  useEffect(() => {
    if (open) {
      if (account) {
        // Edit mode: Display account in its STORED currency
        setName(account.name);
        setBalance(account.balance.toString());
        setInterestRate(account.interestRate.toString());
        setSelectedCurrency((account as any).currency || "CZK"); // Use stored currency
        setHasZoneDesignation(account.hasZoneDesignation || false);
        setTerminationDate(
          account.terminationDate
            ? new Date(account.terminationDate * 1000).toISOString().split('T')[0]
            : ""
        );

        // Fetch zones if the account has zone designation
        if (account.hasZoneDesignation) {
          savingsApi.getZones(account.id)
            .then(data => {
              const formattedZones = data.map((zone: any) => ({
                id: zone.id,
                fromAmount: zone.fromAmount,
                toAmount: zone.toAmount || "",
                interestRate: zone.interestRate,
              }));
              setZones(formattedZones);
            })
            .catch(err => {
              console.error("Failed to fetch zones:", err);
              setZones([]);
            });
        } else {
          setZones([]);
        }
      } else {
        // Add mode
        setName("");
        setBalance("0");
        setInterestRate("0");
        setSelectedCurrency(userCurrency);
        setHasZoneDesignation(false);
        setZones([]);
        setTerminationDate("");
      }
    }
  }, [account, open, userCurrency]);

  const handleSubmit = () => {
    const terminationTimestamp = terminationDate
      ? Math.floor(new Date(terminationDate).getTime() / 1000)
      : null;

    // Send balance in ORIGINAL currency (no conversion)
    if (isEditMode && account) {
      onSubmit({
        id: account.id,
        name,
        balance: balance,
        currency: selectedCurrency,
        interestRate: hasZoneDesignation ? "0" : interestRate,
        hasZoneDesignation,
        terminationDate: terminationTimestamp,
      }, hasZoneDesignation ? zones : undefined);
    } else {
      onSubmit({
        name,
        balance: balance,
        currency: selectedCurrency,
        interestRate: hasZoneDesignation ? "0" : interestRate,
        hasZoneDesignation,
        terminationDate: terminationTimestamp,
      } as any, hasZoneDesignation ? zones : undefined);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    if (!isEditMode) {
      setName("");
      setBalance("0");
      setInterestRate("0");
      setHasZoneDesignation(false);
      setZones([]);
      setTerminationDate("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? t('form.editTitle') : t('form.addTitle')}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? t('modal.editDescription')
              : t('modal.addDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          {/* Basic Information Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">
              {t('modal.basicInfo')}
            </h3>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t('form.name')} *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('form.namePlaceholder')}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="balance">{t('form.balance')} *</Label>
                  <Input
                    id="balance"
                    type="number"
                    step="0.01"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="currency">{tc('labels.currency')}</Label>
                  <Select
                    value={selectedCurrency}
                    onValueChange={(v) => setSelectedCurrency(v as CurrencyCode)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code} ({c.symbol})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="terminationDate">{t('form.terminationDate')}</Label>
                <Input
                  id="terminationDate"
                  type="date"
                  value={terminationDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t('form.terminationDateHelp')}
                </p>
              </div>
            </div>
          </div>

          {/* Interest Rate Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">
              {t('modal.interestConfig')}
            </h3>

            <div className="space-y-4">
              <div className="flex items-start space-x-3 p-4 bg-muted/50 rounded-lg border">
                <Checkbox
                  id="hasZoneDesignation"
                  checked={hasZoneDesignation}
                  onCheckedChange={(checked) => setHasZoneDesignation(checked as boolean)}
                  className="mt-1"
                />
                <div className="space-y-1">
                  <Label
                    htmlFor="hasZoneDesignation"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {t('modal.useZones')}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t('modal.zonesHelp')}
                  </p>
                </div>
              </div>

              {!hasZoneDesignation && (
                <div className="grid gap-2">
                  <Label htmlFor="interestRate">{t('form.interestRate')} *</Label>
                  <Input
                    id="interestRate"
                    type="number"
                    step="0.01"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('modal.apyHelp')}
                  </p>
                </div>
              )}

              {hasZoneDesignation && (
                <div className="space-y-2">
                  <Label>{t('modal.zonesLabel')}</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    {t('modal.zonesDescription')}
                  </p>
                  <SavingsAccountZoneManager zones={zones} onChange={setZones} />
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {tc('buttons.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isLoading ||
              !name ||
              !balance ||
              (isEditMode && !account)
            }
          >
            {isLoading
              ? tc('status.saving')
              : isEditMode
                ? tc('buttons.saveChanges')
                : t('addAccount')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

