import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { Bond, InsertBond } from "@shared/schema";
import { useCurrency, currencies } from "@/lib/currency";
import { CurrencyCode } from "@shared/currencies";
import { useTranslation } from "react-i18next";
import { FileText, Coins } from "lucide-react";

type UpdateBondData = {
  id: string;
  name?: string;
  couponValue?: string;
  interestRate?: string;
  maturityDate?: Date | null | undefined;
};

interface BondsFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertBond | UpdateBondData) => void;
  bond?: Bond | null;
  isLoading?: boolean;
}

export function BondsFormDialog({ open, onOpenChange, onSubmit, bond, isLoading = false }: BondsFormDialogProps) {
  const { t } = useTranslation('bonds');
  const { t: tc } = useTranslation('common');
  const { currencyCode: userCurrency } = useCurrency();
  const isEditMode = !!bond;

  const [name, setName] = useState("");
  const [isin, setIsin] = useState("");
  const [couponValue, setCouponValue] = useState("0");
  const [quantity, setQuantity] = useState("1");
  const [interestRate, setInterestRate] = useState("0");
  const [maturityDate, setMaturityDate] = useState<string>("");
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(userCurrency);

  useEffect(() => {
    if (open) {
      if (bond) {
        setName(bond.name);
        setIsin(bond.isin);
        setCouponValue(bond.couponValue);
        setQuantity(bond.quantity || "1");
        setInterestRate(bond.interestRate.toString());
        setMaturityDate(bond.maturityDate ? new Date(bond.maturityDate * 1000).toISOString().split('T')[0] : "");
        setSelectedCurrency((bond.currency as CurrencyCode) || "CZK");
      } else {
        setName("");
        setIsin("");
        setCouponValue("0");
        setQuantity("1");
        setInterestRate("0");
        setMaturityDate("");
        setSelectedCurrency(userCurrency);
      }
    }
  }, [bond, open, userCurrency]);

  const handleSubmit = () => {
    const submissionData = {
      name,
      isin,
      couponValue: couponValue,
      quantity,
      currency: selectedCurrency,
      interestRate,
      maturityDate: maturityDate ? Math.floor(new Date(maturityDate).getTime() / 1000) : undefined
    };

    if (isEditMode && bond) {
      onSubmit({
        id: bond.id,
        ...submissionData
      });
    } else {
      onSubmit(submissionData);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    if (!isEditMode) {
      setName("");
      setIsin("");
      setCouponValue("0");
      setQuantity("1");
      setInterestRate("0");
      setMaturityDate("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? t('form.editTitle') : t('form.addTitle')}</DialogTitle>
          <DialogDescription>
            {isEditMode ? t('modal.editDescription') : t('modal.addDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Basic Information Section */}
          <div className="form-section-accent">
            <h3 className="form-section-header-icon">
              <FileText />
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

              <div className="grid gap-2">
                <Label htmlFor="isin">{t('modal.isin')} *</Label>
                <Input
                  id="isin"
                  value={isin}
                  onChange={(e) => setIsin(e.target.value)}
                  placeholder={t('modal.isinPlaceholder')}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t('modal.isinHelp')}
                </p>
              </div>
            </div>
          </div>

          {/* Financial Details Section */}
          <div className="form-section-accent">
            <h3 className="form-section-header-icon">
              <Coins />
              {t('modal.financialDetails')}
            </h3>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="couponValue">{t('modal.couponValue')} *</Label>
                  <Input
                    id="couponValue"
                    type="number"
                    step="0.01"
                    value={couponValue}
                    onChange={(e) => setCouponValue(e.target.value)}
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
                <Label htmlFor="quantity">{t('modal.quantity')}</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="1"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="1"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="maturityDate">{t('form.maturityDate')}</Label>
                <Input
                  id="maturityDate"
                  type="date"
                  value={maturityDate}
                  onChange={(e) => setMaturityDate(e.target.value)}
                />
              </div>

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
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>{tc('buttons.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={isLoading || !name || !couponValue}>
            {isLoading
              ? tc('status.saving')
              : (isEditMode ? tc('buttons.saveChanges') : t('addBond'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
