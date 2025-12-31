import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import { savingsApi } from "@/lib/tauri-api";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "react-i18next";
import type { SavingsAccountZone } from "@shared/schema";

interface ZonesInfoModalProps {
  accountId: string;
  accountName: string;
  balance: number;
  currency: string;
  trigger?: React.ReactNode;
}

/**
 * Calculate yearly interest amount based on balance and zones
 * For zoned accounts, rate is applied to different portions of the balance
 * 
 * Zone logic: Each zone defines a range [fromAmount, toAmount] with a rate
 * - If toAmount is 0, it means "unlimited" (applies to remaining balance)
 * - Interest is calculated for each portion of balance that falls in each zone
 * 
 * @returns The yearly interest amount (not the rate percentage)
 */
export function calculateZonedInterest(
  balance: number,
  zones: SavingsAccountZone[]
): number {
  if (!zones || zones.length === 0 || balance <= 0) return 0;

  // Sort zones by fromAmount ascending
  const sortedZones = [...zones].sort(
    (a, b) => parseFloat(a.fromAmount || "0") - parseFloat(b.fromAmount || "0")
  );

  let totalInterest = 0;

  for (const zone of sortedZones) {
    const zoneFrom = parseFloat(zone.fromAmount || "0");
    const zoneTo = parseFloat(zone.toAmount || "0");
    const zoneRate = parseFloat(zone.interestRate || "0");

    // If toAmount is 0, treat as unlimited (use balance as upper limit)
    const effectiveZoneTo = zoneTo === 0 ? balance : zoneTo;

    // Skip zones that don't apply (balance is below zone start)
    if (balance < zoneFrom) continue;

    // Calculate the portion of balance in this zone
    // Zone covers [zoneFrom, effectiveZoneTo]
    const zoneUpperLimit = Math.min(balance, effectiveZoneTo);
    const amountInZone = zoneUpperLimit - zoneFrom;

    if (amountInZone <= 0) continue;

    // Add interest for this zone portion
    totalInterest += (amountInZone * zoneRate) / 100;
  }

  return totalInterest;
}

/**
 * Calculate effective interest rate based on balance and zones
 * For zoned accounts, rate is applied to different portions of the balance
 * 
 * Zone logic: Each zone defines a range [fromAmount, toAmount] with a rate
 * - If toAmount is 0, it means "unlimited" (applies to remaining balance)
 * - Interest is calculated for each portion of balance that falls in each zone
 */
export function calculateEffectiveRate(
  balance: number,
  zones: SavingsAccountZone[]
): number {
  if (!zones || zones.length === 0 || balance <= 0) return 0;

  // Sort zones by fromAmount ascending
  const sortedZones = [...zones].sort(
    (a, b) => parseFloat(a.fromAmount || "0") - parseFloat(b.fromAmount || "0")
  );

  let totalInterest = 0;

  for (const zone of sortedZones) {
    const zoneFrom = parseFloat(zone.fromAmount || "0");
    const zoneTo = parseFloat(zone.toAmount || "0");
    const zoneRate = parseFloat(zone.interestRate || "0");

    // If toAmount is 0, treat as unlimited (use balance as upper limit)
    const effectiveZoneTo = zoneTo === 0 ? balance : zoneTo;

    // Skip zones that don't apply (balance is below zone start)
    if (balance < zoneFrom) continue;

    // Calculate the portion of balance in this zone
    // Zone covers [zoneFrom, effectiveZoneTo]
    const zoneUpperLimit = Math.min(balance, effectiveZoneTo);
    const amountInZone = zoneUpperLimit - zoneFrom;

    if (amountInZone <= 0) continue;

    // Add interest for this zone portion
    totalInterest += (amountInZone * zoneRate) / 100;
  }

  // Calculate effective rate as percentage
  return (totalInterest / balance) * 100;
}

export function ZonesInfoModal({
  accountId,
  accountName,
  balance,
  currency,
  trigger,
}: ZonesInfoModalProps) {
  const { t } = useTranslation("bank_accounts");
  const { formatCurrency } = useCurrency();
  const [open, setOpen] = useState(false);

  const { data: zones } = useQuery({
    queryKey: ["bank-account-zones", accountId],
    queryFn: () => savingsApi.getZones(accountId),
    enabled: open, // Only fetch when modal opens
  });

  const effectiveRate = zones ? calculateEffectiveRate(balance, zones) : 0;

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)} className="cursor-pointer">
          {trigger}
        </span>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 ml-1"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{accountName}</DialogTitle>
            <DialogDescription>
              {t("zones.title", "Interest Rate Zones")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current Balance & Effective Rate */}
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">{t("fields.balance")}</p>
                <p className="font-semibold">{formatCurrency(balance, (currency || "CZK") as any)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t("zones.effectiveRate", "Effective Rate")}</p>
                <p className="text-xl font-bold text-positive">{effectiveRate.toFixed(2)}%</p>
              </div>
            </div>

            {/* Zones Table */}
            {zones && zones.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("zones.fromAmount", "From")}</TableHead>
                    <TableHead>{t("zones.toAmount", "To")}</TableHead>
                    <TableHead className="text-right">{t("zones.interestRate", "Rate")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zones.map((zone) => {
                    const zoneFrom = parseFloat(zone.fromAmount || "0");
                    const zoneTo = parseFloat(zone.toAmount || "0");
                    const isActive = balance >= zoneFrom && balance <= zoneTo;
                    
                    return (
                      <TableRow key={zone.id} className={isActive ? "bg-green-50 dark:bg-green-950" : ""}>
                        <TableCell>
                          {formatCurrency(zoneFrom, (currency || "CZK") as any)}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(zoneTo, (currency || "CZK") as any)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-positive">
                          {parseFloat(zone.interestRate || "0").toFixed(2)}%
                          {isActive && (
                            <Badge variant="outline" className="ml-2 text-green-600 border-green-600">
                              {t("zones.active", "Active")}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                {t("zones.noZones", "No interest rate zones configured")}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Hook to get effective rate for a zoned account
 */
export function useZonedEffectiveRate(accountId: string, balance: number, enabled: boolean) {
  const { data: zones } = useQuery({
    queryKey: ["bank-account-zones", accountId],
    queryFn: () => savingsApi.getZones(accountId),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const effectiveRate = zones ? calculateEffectiveRate(balance, zones) : 0;

  return { effectiveRate, zones };
}
