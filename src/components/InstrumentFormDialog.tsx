import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Instrument, InsertInstrument, InsertPurchase } from "@shared/schema";
import { useCurrency, currencies } from "@/lib/currency";
import { CurrencyCode } from "@shared/currencies";

type UpdateInstrumentData = {
  id: string;
  name?: string;
  code?: string;
  type?: string;
  currentPrice?: string;
  previousPrice?: string | null;
};

type InstrumentWithPurchase = InsertInstrument & {
  purchase: {
    purchaseDate: Date;
    quantity: string;
    pricePerUnit: string;
    fees?: string;
    note?: string;
  };
};

interface InstrumentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertInstrument | UpdateInstrumentData | InstrumentWithPurchase) => void;
  instrument?: Instrument | null;
  isLoading?: boolean;
}

export function InstrumentFormDialog({
  open,
  onOpenChange,
  onSubmit,
  instrument,
  isLoading = false,
}: InstrumentFormDialogProps) {
  const { convert, currencyCode: userCurrency } = useCurrency();
  const isEditMode = !!instrument;
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(userCurrency);

  const [formData, setFormData] = useState<InsertInstrument>({
    name: "",
    code: "",
    type: "stock",
    currentPrice: "0",
    previousPrice: null,
  });

  // Purchase fields (only for add mode)
  const [purchaseData, setPurchaseData] = useState<{
    purchaseDate: string;
    quantity: string;
    pricePerUnit: string;
    fees: string;
    note: string;
  }>({
    purchaseDate: new Date().toISOString().split("T")[0], // Today's date in YYYY-MM-DD format
    quantity: "",
    pricePerUnit: "",
    fees: "",
    note: "",
  });

  useEffect(() => {
    if (open) {
      if (instrument) {
        // Convert stored CZK prices to user's currency for display
        const displayCurrentPrice = convert(Number(instrument.currentPrice), "CZK", userCurrency);
        const displayPreviousPrice = instrument.previousPrice
          ? convert(Number(instrument.previousPrice), "CZK", userCurrency)
          : null;

        setFormData({
          name: instrument.name,
          code: instrument.code,
          type: instrument.type,
          currentPrice: displayCurrentPrice.toFixed(2),
          previousPrice: displayPreviousPrice ? displayPreviousPrice.toFixed(2) : null,
        });
        setSelectedCurrency(userCurrency);
      } else {
        setFormData({
          name: "",
          code: "",
          type: "stock",
          currentPrice: "0",
          previousPrice: null,
        });
        // Reset purchase data to defaults
        setPurchaseData({
          purchaseDate: new Date().toISOString().split("T")[0],
          quantity: "",
          pricePerUnit: "",
          fees: "",
          note: "",
        });
        setSelectedCurrency(userCurrency);
      }
    }
  }, [instrument, open, userCurrency, convert]);

  const handleSubmit = () => {
    // Convert input amounts from SELECTED currency to BASE currency (CZK)
    const currentPriceInCzk = convert(Number(formData.currentPrice), selectedCurrency, "CZK");
    const previousPriceInCzk = formData.previousPrice
      ? convert(Number(formData.previousPrice), selectedCurrency, "CZK")
      : null;

    if (isEditMode && instrument) {
      onSubmit({
        id: instrument.id,
        name: formData.name,
        code: formData.code,
        type: formData.type,
        currentPrice: currentPriceInCzk.toString(),
        previousPrice: previousPriceInCzk ? previousPriceInCzk.toString() : null,
      });
    } else {
      // Add mode: include purchase data
      // Convert purchase amounts to CZK
      const pricePerUnitInCzk = convert(Number(purchaseData.pricePerUnit), selectedCurrency, "CZK");
      const feesInCzk = purchaseData.fees
        ? convert(Number(purchaseData.fees), selectedCurrency, "CZK")
        : "0";

      onSubmit({
        ...formData,
        currentPrice: currentPriceInCzk.toString(),
        previousPrice: previousPriceInCzk ? previousPriceInCzk.toString() : null,
        purchase: {
          purchaseDate: new Date(purchaseData.purchaseDate),
          quantity: purchaseData.quantity,
          pricePerUnit: pricePerUnitInCzk.toString(),
          fees: feesInCzk.toString(),
          note: purchaseData.note || undefined,
        },
      } as InstrumentWithPurchase);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    if (!isEditMode) {
      setFormData({
        name: "",
        code: "",
        type: "stock",
        currentPrice: "0",
        previousPrice: null,
      });
      setPurchaseData({
        purchaseDate: new Date().toISOString().split("T")[0],
        quantity: "",
        pricePerUnit: "",
        fees: "",
        note: "",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Modify Instrument" : "Add New Investment"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the instrument details. Click save when you're done."
              : "Add a new investment instrument to your portfolio. Fill in all required fields."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          {/* Basic Information Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">
              Basic Information
            </h3>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={isEditMode ? "Instrument name" : "e.g., Apple Inc."}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  placeholder={isEditMode ? "Instrument code" : "e.g., AAPL"}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: "stock" | "commodity") =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stock">Stock</SelectItem>
                    <SelectItem value="commodity">Commodity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">
              Pricing Details
            </h3>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="currentPrice">Current Price *</Label>
                  <Input
                    id="currentPrice"
                    type="number"
                    step="0.01"
                    value={formData.currentPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, currentPrice: e.target.value })
                    }
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="currency">Currency</Label>
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
                <Label htmlFor="previousPrice">Previous Price {!isEditMode && "(Optional)"}</Label>
                <Input
                  id="previousPrice"
                  type="number"
                  step="0.01"
                  value={formData.previousPrice || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      previousPrice: e.target.value || null,
                    })
                  }
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Purchase fields - only shown in add mode */}
          {!isEditMode && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">
                Purchase Information
              </h3>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="purchaseDate">Purchase Date *</Label>
                  <Input
                    id="purchaseDate"
                    type="date"
                    value={purchaseData.purchaseDate}
                    onChange={(e) =>
                      setPurchaseData({
                        ...purchaseData,
                        purchaseDate: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="quantity">Quantity *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="0.0001"
                      value={purchaseData.quantity}
                      onChange={(e) =>
                        setPurchaseData({
                          ...purchaseData,
                          quantity: e.target.value,
                        })
                      }
                      placeholder="0.0000"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pricePerUnit">Price Per Unit *</Label>
                    <Input
                      id="pricePerUnit"
                      type="number"
                      step="0.01"
                      value={purchaseData.pricePerUnit}
                      onChange={(e) =>
                        setPurchaseData({
                          ...purchaseData,
                          pricePerUnit: e.target.value,
                        })
                      }
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="fees">Fees (Optional)</Label>
                  <Input
                    id="fees"
                    type="number"
                    step="0.01"
                    value={purchaseData.fees}
                    onChange={(e) =>
                      setPurchaseData({
                        ...purchaseData,
                        fees: e.target.value,
                      })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="note">Note (Optional)</Label>
                  <Textarea
                    id="note"
                    value={purchaseData.note}
                    onChange={(e) =>
                      setPurchaseData({
                        ...purchaseData,
                        note: e.target.value,
                      })
                    }
                    placeholder="Add a note about this purchase..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isLoading ||
              !formData.name ||
              !formData.code ||
              (isEditMode && !instrument) ||
              (!isEditMode && (!purchaseData.quantity || !purchaseData.pricePerUnit))
            }
          >
            {isLoading
              ? isEditMode
                ? "Saving..."
                : "Adding..."
              : isEditMode
                ? "Save Changes"
                : "Add Investment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

