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

import type { BankAccountWithInstitution, InsertBankAccount, AccountType, Institution } from "@shared/schema";
import { useCurrency } from "@/lib/currency";
import { currencies } from "@/lib/currency";
import { CurrencyCode } from "@shared/currencies";
import { SavingsAccountZoneManager } from "@/components/savings/SavingsAccountZoneManager";
import { InstitutionCombobox } from "@/components/bank-accounts/InstitutionCombobox";
import { useTranslation } from "react-i18next";
import { Building2, CreditCard, Percent } from "lucide-react";

type UpdateBankAccountData = {
  id: string;
  name?: string;
  balance?: string;
  currency?: string;
  accountType?: AccountType;
  institutionId?: string | null;
  iban?: string;
  bban?: string;
  interestRate?: string;
  hasZoneDesignation?: boolean;

};

interface ZoneData {
  id?: string;
  fromAmount: string;
  toAmount: string;
  interestRate: string;
}

interface BankAccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertBankAccount | UpdateBankAccountData, zones?: ZoneData[]) => void;
  account?: BankAccountWithInstitution | null;
  institutions: Institution[];
  isLoading?: boolean;
  initialZones?: ZoneData[];
}

export function BankAccountFormDialog({
  open,
  onOpenChange,
  onSubmit,
  account,
  institutions,
  isLoading = false,
  initialZones,
}: BankAccountFormDialogProps) {
  const { t } = useTranslation("bank_accounts");
  const { t: tc } = useTranslation("common");
  const { currencyCode: userCurrency } = useCurrency();
  const isEditMode = !!account;

  // Form state
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("0");
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(userCurrency);
  const [accountType, setAccountType] = useState<AccountType>("checking");
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [iban, setIban] = useState("");
  const [bban, setBban] = useState("");
  const [interestRate, setInterestRate] = useState("0");
  const [hasZoneDesignation, setHasZoneDesignation] = useState(false);
  const [zones, setZones] = useState<ZoneData[]>([]);


  // BBAN ↔ IBAN conversion functions for Czech accounts
  // BBAN format: [prefix-]accountNumber/bankCode (e.g., "123456-1234567890/0800" or "1234567890/0800")
  // IBAN format: CZ + 2 check digits + 4 bank code + 6 prefix + 10 account number
  
  const bbanToIban = (bbanValue: string): string | null => {
    try {
      // Parse BBAN: [prefix-]accountNumber/bankCode
      const match = bbanValue.match(/^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/);
      if (!match) return null;
      
      const prefix = (match[1] || "0").padStart(6, "0");
      const accountNumber = match[2].padStart(10, "0");
      const bankCode = match[3];
      
      // Build BBAN part for IBAN: bankCode + prefix + accountNumber
      const bbanForIban = bankCode + prefix + accountNumber;
      
      // Calculate check digits: Move "CZ00" to end and convert letters
      // CZ = 12 35, then append 00 for calculation
      const numericString = bbanForIban + "123500";
      const checkDigits = 98n - (BigInt(numericString) % 97n);
      
      // Format IBAN with spaces
      const ibanRaw = "CZ" + checkDigits.toString().padStart(2, "0") + bbanForIban;
      return ibanRaw.match(/.{1,4}/g)?.join(" ") || ibanRaw;
    } catch {
      return null;
    }
  };

  const ibanToBban = (ibanValue: string): string | null => {
    try {
      // Remove spaces and validate Czech IBAN
      const cleanIban = ibanValue.replace(/\s/g, "").toUpperCase();
      if (!cleanIban.match(/^CZ\d{22}$/)) return null;
      
      // Extract parts: CZ + 2 check + 4 bank + 6 prefix + 10 account
      const bankCode = cleanIban.substring(4, 8);
      const prefix = cleanIban.substring(8, 14);
      const accountNumber = cleanIban.substring(14, 24);
      
      // Remove leading zeros
      const cleanPrefix = parseInt(prefix, 10);
      const cleanAccount = parseInt(accountNumber, 10);
      
      // Format BBAN
      if (cleanPrefix > 0) {
        return `${cleanPrefix}-${cleanAccount}/${bankCode}`;
      }
      return `${cleanAccount}/${bankCode}`;
    } catch {
      return null;
    }
  };

  const handleBbanChange = (value: string) => {
    setBban(value);
    // Auto-convert to IBAN if valid
    const convertedIban = bbanToIban(value);
    if (convertedIban) {
      setIban(convertedIban);
    }
  };

  const handleIbanChange = (value: string) => {
    setIban(value);
    // Auto-convert to BBAN if valid
    const convertedBban = ibanToBban(value);
    if (convertedBban) {
      setBban(convertedBban);
    }
  };

  useEffect(() => {
    if (open) {
      if (account) {
        // Edit mode
        setName(account.name);
        setBalance(account.balance.toString());
        setSelectedCurrency((account.currency || "CZK") as CurrencyCode);
        setAccountType(account.accountType as AccountType);
        setInstitutionId(account.institutionId || null);
        setIban(account.iban || "");
        setBban(account.bban || "");
        setInterestRate(account.interestRate?.toString() || "0");
        setHasZoneDesignation(account.hasZoneDesignation || false);
        
        // Use initial zones if provided (for edit mode)
        if (initialZones && initialZones.length > 0) {
          setZones(initialZones);
        } else {
          setZones([]);
        }
      } else {
        // Add mode
        setName("");
        setBalance("0");
        setSelectedCurrency(userCurrency);
        setAccountType("checking");
        setInstitutionId(null);
        setIban("");
        setBban("");
        setInterestRate("0");
        setHasZoneDesignation(false);
        setZones([]);
      }
    }
  }, [account, open, userCurrency, initialZones]);

  const handleSubmit = () => {
    if (isEditMode && account) {
      onSubmit({
        id: account.id,
        name,
        balance,
        currency: selectedCurrency,
        accountType,
        institutionId,
        iban: iban || undefined,
        bban: bban || undefined,
        interestRate: hasZoneDesignation ? "0" : interestRate,
        hasZoneDesignation,
      }, hasZoneDesignation ? zones : undefined);
    } else {
      onSubmit({
        name,
        balance,
        currency: selectedCurrency,
        accountType,
        institutionId,
        iban: iban || undefined,
        bban: bban || undefined,
        interestRate: hasZoneDesignation ? "0" : interestRate,
        hasZoneDesignation,
      } as InsertBankAccount, hasZoneDesignation ? zones : undefined);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? t("editAccount") : t("addAccount")}
          </DialogTitle>
          <DialogDescription>
            {t("subtitle")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          {/* Basic Information Section */}
          <div className="form-section-accent">
            <h3 className="form-section-header-icon">
              <Building2 />
              {t("form.basicInfo")}
            </h3>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t("fields.name")} *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("form.namePlaceholder")}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="accountType">{t("fields.accountType")}</Label>
                  <Select
                    value={accountType}
                    onValueChange={(v) => setAccountType(v as AccountType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">{t("accountTypes.checking")}</SelectItem>
                      <SelectItem value="savings">{t("accountTypes.savings")}</SelectItem>
                      <SelectItem value="credit_card">{t("accountTypes.credit_card")}</SelectItem>
                      <SelectItem value="investment">{t("accountTypes.investment")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="institution">{t("fields.institution")}</Label>
                  <InstitutionCombobox
                    institutions={institutions}
                    value={institutionId}
                    onChange={(v) => setInstitutionId(v)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="balance">{t("fields.balance")} *</Label>
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
                  <Label htmlFor="currency">{tc("labels.currency")}</Label>
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
            </div>
          </div>

          {/* Account Details Section */}
          <div className="form-section-accent">
            <h3 className="form-section-header-icon">
              <CreditCard />
              {t("form.accountDetails")}
            </h3>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="bban">{t("fields.bban")}</Label>
                  <Input
                    id="bban"
                    value={bban}
                    onChange={(e) => handleBbanChange(e.target.value)}
                    placeholder="123456-1234567890/0300"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="iban">IBAN</Label>
                  <Input
                    id="iban"
                    value={iban}
                    onChange={(e) => handleIbanChange(e.target.value)}
                    placeholder="CZ65 0800 0000 1920 0014 5399"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Interest Rate Section */}
          <div className="form-section-accent">
            <h3 className="form-section-header-icon">
              <Percent />
              {t("form.interestConfig")}
            </h3>

            <div className="space-y-4">
              <div className="form-checkbox-section">
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
                    {t("form.useZones")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("form.zonesHelp")}
                  </p>
                </div>
              </div>

              {!hasZoneDesignation && (
                <div className="grid gap-2">
                  <Label htmlFor="interestRate">{t("fields.interestRate")}</Label>
                  <Input
                    id="interestRate"
                    type="number"
                    step="0.01"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("form.apyHelp")}
                  </p>
                </div>
              )}

              {hasZoneDesignation && (
                <div className="space-y-2">
                  <Label>{t("form.zonesLabel")}</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    {t("form.zonesDescription")}
                  </p>
                  <SavingsAccountZoneManager zones={zones} onChange={setZones} />
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {tc("buttons.cancel")}
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
              ? tc("status.saving")
              : isEditMode
                ? tc("buttons.saveChanges")
                : tc("buttons.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
