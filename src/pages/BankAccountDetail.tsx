import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Edit,
  FileUp,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useLocation } from "wouter";
import { calculateZonedInterest } from "@/components/bank-accounts/ZonesInfoModal";
import { convertToCzK, type CurrencyCode } from "@shared/currencies";
import { useBankAccount, useInstitutions } from "@/hooks/use-bank-accounts";
import { useBankTransactionMutations, useBankAccountMutations } from "@/hooks/use-bank-account-mutations";
import { bankAccountsApi, savingsApi } from "@/lib/tauri-api";
import { BankAccountFormDialog } from "@/components/bank-accounts/BankAccountFormDialog";
import { CsvImportDialog } from "@/components/bank-accounts/CsvImportDialog";
import type { InsertBankTransaction, TransactionType } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/lib/currency";

export default function BankAccountDetail() {
  const { t } = useTranslation("bank_accounts");
  const { t: tCommon } = useTranslation("common");
  const [, params] = useRoute("/bank-accounts/:id");
  const [, setLocation] = useLocation();
  const accountId = params?.id;
  const { account, isLoading } = useBankAccount(accountId);
  const { institutions } = useInstitutions();
  const { createTransaction, deleteTransaction } = useBankTransactionMutations(accountId);
  const { updateAccount, deleteAccount } = useBankAccountMutations();
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addTxDialogOpen, setAddTxDialogOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [formData, setFormData] = useState<InsertBankTransaction>({
    bankAccountId: accountId || "",
    type: "debit",
    amount: "",
    bookingDate: Math.floor(Date.now() / 1000),
    description: "",
  });

  // Date filters - default to current month
  const today = new Date();
  const [dateFrom, setDateFrom] = useState<string>(
    new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  );
  const [dateTo, setDateTo] = useState<string>(
    new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
  );

  // Fetch transactions
  const { data: transactionsResult, isLoading: txLoading } = useQuery({
    queryKey: ["bank-transactions", accountId, dateFrom, dateTo],
    queryFn: () =>
      accountId
        ? bankAccountsApi.getTransactions(accountId, { 
            limit: 1000, 
            dateFrom: dateFrom ? Math.floor(new Date(dateFrom).getTime() / 1000) : undefined,
            dateTo: dateTo ? Math.floor(new Date(dateTo).setHours(23, 59, 59, 999) / 1000) : undefined
          })
        : null,
    enabled: !!accountId,
  });

  // Fetch zones for zoned interest rate accounts
  const { data: zones, refetch: refetchZones } = useQuery({
    queryKey: ["bank-account-zones", accountId],
    queryFn: () => (accountId ? savingsApi.getZones(accountId) : null),
    enabled: !!accountId && !!account?.hasZoneDesignation,
  });

  // Fetch import batches
  const { data: importBatches } = useQuery({
    queryKey: ["import-batches", accountId],
    queryFn: () => (accountId ? bankAccountsApi.getImportBatches(accountId) : null),
    enabled: !!accountId,
  });

  const deleteBatchMutation = useMutation({
    mutationFn: (batchId: string) => bankAccountsApi.deleteImportBatch(batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-batches", accountId] });
      queryClient.invalidateQueries({ queryKey: ["bank-transactions", accountId] });
      queryClient.invalidateQueries({ queryKey: ["bank-account", accountId] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
    },
  });

  const transactions = transactionsResult?.transactions || [];

  const handleAddTxClick = () => {
    setFormData({
      bankAccountId: accountId || "",
      type: "debit",
      amount: "",
      bookingDate: Math.floor(Date.now() / 1000),
      description: "",
    });
    setAddTxDialogOpen(true);
  };

  const handleAddTxSubmit = () => {
    createTransaction.mutate(formData, {
      onSuccess: () => {
        setAddTxDialogOpen(false);
      },
    });
  };

  const handleDeleteTx = (id: string) => {
    deleteTransaction.mutate(id);
  };

  const handleEditSubmit = async (data: any, zones?: any[]) => {
    // Extract id from data and pass correctly to mutation
    const { id, ...updateData } = data;
    
    // Save zones if provided (for zoned interest rate accounts)
    if (zones && accountId) {
      try {
        // Get existing zones
        const existingZones = await savingsApi.getZones(accountId);
        
        // Delete removed zones
        for (const existingZone of existingZones) {
          const stillExists = zones.some(z => z.id === existingZone.id);
          if (!stillExists) {
            await savingsApi.deleteZone(existingZone.id);
          }
        }
        
        // Create new zones (those without id)
        for (const zone of zones) {
          if (!zone.id) {
            await savingsApi.createZone({
              savingsAccountId: accountId,
              fromAmount: zone.fromAmount,
              toAmount: zone.toAmount,
              interestRate: zone.interestRate,
            });
          }
        }
        
        // Refetch zones
        refetchZones();
      } catch (e) {
        console.error('Error saving zones:', e);
      }
    }
    
    updateAccount.mutate({ id, data: updateData }, {
      onSuccess: () => {
        setEditDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ["bank-account", accountId] });
        queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
        queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
        queryClient.invalidateQueries({ queryKey: ["bank-account-zones", accountId] });
      },
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto">
        <p>{tCommon("status.loading")}</p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto">
        <p>Account not found</p>
        <Link href="/bank-accounts">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to accounts
          </Button>
        </Link>
      </div>
    );
  }

  // Calculate yearly interest for this account
  const balance = parseFloat(account.balance || "0");
  const currency = account.currency || "CZK";
  let yearlyInterest = 0;
  let effectiveRate = 0;

  if (account.hasZoneDesignation && zones && zones.length > 0) {
    yearlyInterest = calculateZonedInterest(balance, zones);
    effectiveRate = balance > 0 ? (yearlyInterest / balance) * 100 : 0;
  } else if (account.interestRate) {
    const rate = parseFloat(account.interestRate);
    yearlyInterest = balance * (rate / 100);
    effectiveRate = rate;
  }

  // Convert yearly interest to display currency
  const yearlyInterestInCzk = convertToCzK(yearlyInterest, currency as CurrencyCode);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <Link href="/bank-accounts">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("detail.backToList", "Back to accounts")}
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{account.name}</h1>
            <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-100">
              {t(`accountTypes.${account.accountType}`)}
            </Badge>
            {account.excludeFromBalance && (
              <Badge variant="outline">{t("fields.excludeFromBalance")}</Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {account.institution?.name || ""}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setCsvImportOpen(true)}>
            <FileUp className="mr-2 h-4 w-4" />
            {t("csvImport.button", "Import CSV")}
          </Button>
          <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            {tCommon("buttons.edit")}
          </Button>
          <Button onClick={handleAddTxClick}>
            <Plus className="mr-2 h-4 w-4" />
            {t("transaction.add")}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" title={tCommon("buttons.delete")}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("confirmDelete.title", "Delete Account?")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("confirmDelete.description", "This will permanently delete the account and all its transactions. This action cannot be undone.")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tCommon("buttons.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    deleteAccount.mutate(accountId!, {
                      onSuccess: () => setLocation("/bank-accounts"),
                    });
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {tCommon("buttons.delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("fields.balance")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(convertToCzK(balance, currency as CurrencyCode))}
            </div>
            <div className="text-sm text-muted-foreground">
              {account.excludeFromBalance 
                ? t("detail.excludedFromPortfolio", "Excluded from portfolio")
                : t("detail.includedInPortfolio", "Included in portfolio")
              }
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("fields.interestRate")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-positive">
                {effectiveRate > 0 ? `${effectiveRate.toFixed(2)}%` : "—"}
              </span>
              {effectiveRate > 0 && (
                account.hasZoneDesignation ? (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
                    {t("interestType.zoned")}
                  </Badge>
                ) : (
                  <Badge variant="outline">{t("interestType.simple")}</Badge>
                )
              )}
            </div>
            {effectiveRate <= 0 && (
              <div className="text-sm text-muted-foreground">
                {t("detail.noInterest", "No interest")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("detail.yearlyInterest", "Yearly Interest")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-positive">
              {yearlyInterestInCzk > 0 ? formatCurrency(yearlyInterestInCzk) : "—"}
            </div>
            <div className="text-sm text-muted-foreground">
              {yearlyInterestInCzk > 0 ? t("detail.perYear", "per year") : t("detail.noInterest", "No interest")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import History */}
      {importBatches && importBatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("importHistory.title", "Import History")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCommon("labels.date", "Date")}</TableHead>
                  <TableHead>{t("importHistory.fileName", "File Name")}</TableHead>
                  <TableHead>{t("importHistory.imported", "Imported")}</TableHead>
                  <TableHead>{t("importHistory.duplicates", "Duplicates")}</TableHead>
                  <TableHead>{t("importHistory.errors", "Errors")}</TableHead>
                  <TableHead className="text-right">{tCommon("labels.actions", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importBatches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>{formatDate(batch.importedAt)}</TableCell>
                    <TableCell className="font-medium">{batch.fileName}</TableCell>
                    <TableCell>{batch.importedCount}</TableCell>
                    <TableCell>{batch.duplicateCount}</TableCell>
                    <TableCell>{batch.errorCount}</TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            {tCommon("buttons.delete")}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{tCommon("confirmDelete.title", "Delete?")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("confirmDelete.importDescription", "This will delete the import record and all transactions imported in this batch.")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{tCommon("buttons.cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteBatchMutation.mutate(batch.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {tCommon("buttons.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}


      
      {/* Interest Zones */}
      {account.hasZoneDesignation && zones && zones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("zones.title", "Interest Rate Zones")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("zones.fromAmount", "From Amount")}</TableHead>
                  <TableHead>{t("zones.toAmount", "To Amount")}</TableHead>
                  <TableHead>{t("zones.interestRate", "Interest Rate")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((zone) => (
                  <TableRow key={zone.id}>
                    <TableCell>
                      {formatCurrency(convertToCzK(parseFloat(zone.fromAmount || "0"), (currency || "CZK") as CurrencyCode))}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(convertToCzK(parseFloat(zone.toAmount || "0"), (currency || "CZK") as CurrencyCode))}
                    </TableCell>
                    <TableCell className="font-semibold text-positive">
                      {parseFloat(zone.interestRate || "0").toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle>{t("transactions")}</CardTitle>
            {(account.bban || account.iban) && (
              <p className="text-sm text-muted-foreground">
                {[
                  account.bban && `BBAN: ${account.bban}`,
                  account.iban && `IBAN: ${account.iban}`
                ].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">{tCommon("labels.from", "From")}:</span>
              <Input 
                type="date" 
                value={dateFrom} 
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-auto h-8"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">{tCommon("labels.to", "To")}:</span>
              <Input 
                type="date" 
                value={dateTo} 
                onChange={(e) => setDateTo(e.target.value)}
                className="w-auto h-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">


          {/* Transaction List */}
          <div>
          {txLoading ? (
            <div className="p-4">{tCommon("status.loading")}</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No transactions yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("transaction.date")}</TableHead>
                  <TableHead>{t("transaction.description")}</TableHead>
                  <TableHead>{t("transaction.counterparty")}</TableHead>
                  <TableHead className="text-right">
                    {t("transaction.amount")}
                  </TableHead>
                  <TableHead className="text-right">
                    {tCommon("labels.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{formatDate(tx.bookingDate)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {tx.type === "credit" ? (
                          <ArrowDownLeft className="h-4 w-4 text-green-500" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-red-500" />
                        )}
                        {tx.description || "-"}
                      </div>
                    </TableCell>
                    <TableCell>{tx.counterpartyName || "-"}</TableCell>
                    <TableCell
                      className={`text-right font-mono ${
                        tx.type === "credit" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {tx.type === "credit" ? "+" : "-"}
                      {parseFloat(tx.amount).toLocaleString()} {tx.currency}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTx(tx.id)}
                      >
                        {tCommon("buttons.delete")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          </div>
        </CardContent>
      </Card>

      {/* Add Transaction Dialog */}
      <Dialog open={addTxDialogOpen} onOpenChange={setAddTxDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("transaction.add")}</DialogTitle>
            <DialogDescription>Add a new transaction to this account</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="type">{t("transaction.type")}</Label>
              <Select
                value={formData.type}
                onValueChange={(value: TransactionType) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">{t("transaction.credit")}</SelectItem>
                  <SelectItem value="debit">{t("transaction.debit")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">{t("transaction.amount")}</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">{t("transaction.description")}</Label>
              <Input
                id="description"
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="counterparty">{t("transaction.counterparty")}</Label>
              <Input
                id="counterparty"
                value={formData.counterpartyName || ""}
                onChange={(e) =>
                  setFormData({ ...formData, counterpartyName: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="date">{t("transaction.date")}</Label>
              <Input
                id="date"
                type="date"
                value={new Date(formData.bookingDate * 1000).toISOString().split("T")[0]}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bookingDate: Math.floor(new Date(e.target.value).getTime() / 1000),
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTxDialogOpen(false)}>
              {tCommon("buttons.cancel")}
            </Button>
            <Button
              onClick={handleAddTxSubmit}
              disabled={!formData.amount || createTransaction.isPending}
            >
              {createTransaction.isPending ? tCommon("status.adding") : tCommon("buttons.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <BankAccountFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSubmit={handleEditSubmit}
        account={account}
        institutions={institutions}
        isLoading={updateAccount.isPending}
      />

      {/* CSV Import Dialog */}
      <CsvImportDialog
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
        accountId={accountId || ""}
        institutionId={account?.institutionId}
      />
    </div>
  );
}
