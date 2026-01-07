
import { useState, useMemo, useCallback } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit,
  FileUp,
  Trash2,
  Sparkles,
  Loader2,
  X,
  History,
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
import { AddTransactionModal } from "@/components/bank-accounts/AddTransactionModal";
import { CsvImportDialog } from "@/components/bank-accounts/CsvImportDialog";
import type { CategorizationResult } from "@/hooks/useCategorization";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/lib/currency";
import { CategorySelector } from "@/components/bank-accounts/CategorySelector";
import { useCategorization } from "@/hooks/useCategorization";
import { useToast } from "@/hooks/use-toast";
import { isCzechIBAN, ibanToBBAN, formatAccountNumber } from "@/utils/iban-utils";

export default function BankAccountDetail() {
  const { t } = useTranslation("bank_accounts");
  const { t: tCommon } = useTranslation("common");
  const [, params] = useRoute("/bank-accounts/:id");
  const [, setLocation] = useLocation();
  const accountId = params?.id;
  const { account, isLoading } = useBankAccount(accountId);
  const { institutions } = useInstitutions();
  const { deleteTransaction } = useBankTransactionMutations(accountId);
  const { updateAccount, deleteAccount } = useBankAccountMutations();
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const { categorizeBatch, clearCache, isLoading: isCategorizingBatch } = useCategorization();
  const [categorizationResults, setCategorizationResults] = useState<Map<string, CategorizationResult>>(new Map());
  const { toast } = useToast();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [importHistoryOpen, setImportHistoryOpen] = useState(false);

  // Date filters - default to current month
  // Note: We must format dates manually to avoid UTC shift from toISOString()
  const today = new Date();
  const formatInitialDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [dateFrom, setDateFrom] = useState<string>(
    formatInitialDate(new Date(today.getFullYear(), today.getMonth(), 1))
  );
  const [dateTo, setDateTo] = useState<string>(
    formatInitialDate(new Date(today.getFullYear(), today.getMonth() + 1, 0))
  );
  const [datePreset, setDatePreset] = useState<string>("thisMonth");
  const [transactionType, setTransactionType] = useState<"all" | "income" | "outcome">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Sorting state
  type SortColumn = 'date' | 'description' | 'counterparty' | 'vs' | 'category' | 'amount';
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Helper to format date as YYYY-MM-DD in local timezone (avoids UTC shift issues)
  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Date preset calculator
  const applyDatePreset = (preset: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const quarter = Math.floor(month / 3);
    
    let from: Date;
    let to: Date;
    
    switch (preset) {
      case "thisMonth":
        from = new Date(year, month, 1);
        to = new Date(year, month + 1, 0);
        break;
      case "lastMonth":
        from = new Date(year, month - 1, 1);
        to = new Date(year, month, 0);
        break;
      case "thisQuarter":
        from = new Date(year, quarter * 3, 1);
        to = new Date(year, quarter * 3 + 3, 0);
        break;
      case "lastQuarter":
        from = new Date(year, (quarter - 1) * 3, 1);
        to = new Date(year, quarter * 3, 0);
        break;
      case "thisYear":
        from = new Date(year, 0, 1);
        to = new Date(year, 11, 31);
        break;
      case "lastYear":
        from = new Date(year - 1, 0, 1);
        to = new Date(year - 1, 11, 31);
        break;
      default:
        return;
    }
    
    setDateFrom(formatLocalDate(from));
    setDateTo(formatLocalDate(to));
    setDatePreset(preset);
  };

  const handleDateChange = (type: 'from' | 'to', value: string) => {
    if (type === 'from') {
      setDateFrom(value);
    } else {
      setDateTo(value);
    }
    setDatePreset("custom");
  };


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

  // Fetch transaction categories
  const { data: categories = [] } = useQuery({
    queryKey: ["transaction-categories"],
    queryFn: () => bankAccountsApi.getCategories(),
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

  const transactions = useMemo(() => transactionsResult?.transactions || [], [transactionsResult]);

  // Get effective category for sorting
  const getEffectiveCategoryForSort = useCallback((tx: typeof transactions[0]) => {
    const localResult = categorizationResults.get(tx.id);
    if (localResult && localResult.type === 'Match') {
      return localResult.data.categoryId;
    }
    return tx.categoryId || '';
  }, [categorizationResults]);

  // Filter and sort transactions based on user selection
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    
    if (transactionType === "income") {
      filtered = filtered.filter(tx => tx.type === "credit");
    } else if (transactionType === "outcome") {
      filtered = filtered.filter(tx => tx.type === "debit");
    }
    
    // Filter by category
    if (categoryFilter === "uncategorized") {
      // Show only transactions without a category
      filtered = filtered.filter(tx => {
        if (tx.categoryId) return false;
        const localResult = categorizationResults.get(tx.id);
        if (localResult && localResult.type === 'Match') return false;
        return true;
      });
    } else if (categoryFilter !== "all") {
      filtered = filtered.filter(tx => {
        const effectiveCat = getEffectiveCategoryForSort(tx);
        return effectiveCat === categoryFilter;
      });
    }

    // Filter by search query (counterparty name and description)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(tx => {
        const counterparty = (tx.counterpartyName || '').toLowerCase();
        const description = (tx.description || '').toLowerCase();
        return counterparty.includes(query) || description.includes(query);
      });
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'date':
          comparison = a.bookingDate - b.bookingDate;
          break;
        case 'description':
          comparison = (a.description || '').localeCompare(b.description || '');
          break;
        case 'counterparty':
          comparison = (a.counterpartyName || '').localeCompare(b.counterpartyName || '');
          break;
        case 'vs':
          comparison = (a.variableSymbol || '').localeCompare(b.variableSymbol || '');
          break;
        case 'category':
          comparison = getEffectiveCategoryForSort(a).localeCompare(getEffectiveCategoryForSort(b));
          break;
        case 'amount': {
          const amountA = parseFloat(a.amount) * (a.type === 'credit' ? 1 : -1);
          const amountB = parseFloat(b.amount) * (b.type === 'credit' ? 1 : -1);
          comparison = amountA - amountB;
          break;
        }
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [transactions, transactionType, categoryFilter, searchQuery, categorizationResults, sortColumn, sortDirection, getEffectiveCategoryForSort]);

  // Calculate statistics based on currently filtered transactions
  const stats = useMemo(() => {
    const totalIncome = filteredTransactions
      .filter(tx => tx.type === "credit")
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    const totalOutcome = filteredTransactions
      .filter(tx => tx.type === "debit")
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    
    return {
      count: filteredTransactions.length,
      income: totalIncome,
      outcome: totalOutcome,
      netFlow: totalIncome - totalOutcome
    };
  }, [filteredTransactions]);


  // Auto-categorize all uncategorized transactions
  const handleAutoCategorize = async () => {
    // Clear the cache first so we get fresh results after any learning
    clearCache();
    
    const uncategorized = transactions.filter(tx => {
      // Check if already has category from DB
      if (tx.categoryId) return false;
      // Check local state - only skip if it's a confirmed Match (not Suggestion or None)
      const localResult = categorizationResults.get(tx.id);
      if (localResult && localResult.type === 'Match') return false;
      // Re-try Suggestions and None results (may find better match after learning)
      return true;
    });
    if (uncategorized.length === 0) return;

    const results = await categorizeBatch(uncategorized);
    console.log('Categorization results:', results.slice(0, 5)); // Debug: first 5 results
    const newResults = new Map(categorizationResults);
    let matchCount = 0;
    let suggestionCount = 0;
    
    // Collect Match results to persist to database
    const matchesToPersist: Array<{ txId: string; categoryId: string; counterpartyName?: string }> = [];
    
    uncategorized.forEach((tx, i) => {
      if (results[i] && results[i].type !== 'None') {
        newResults.set(tx.id, results[i]);
        if (results[i].type === 'Match') {
          matchCount++;
          // Add to list for database persistence (include counterparty for learning)
          matchesToPersist.push({ 
            txId: tx.id, 
            categoryId: results[i].data.categoryId,
            counterpartyName: tx.counterpartyName || undefined,
          });
        } else if (results[i].type === 'Suggestion') {
          suggestionCount++;
        }
      }
    });
    console.log('Match count:', matchCount, 'Suggestion count:', suggestionCount); // Debug
    setCategorizationResults(newResults);

    // Persist all Match results to database in parallel
    if (matchesToPersist.length > 0) {
      try {
        await Promise.all(
          matchesToPersist.map(({ txId, categoryId }) =>
            bankAccountsApi.updateTransactionCategory(txId, categoryId)
          )
        );
        
        // Note: We don't call learn() here because:
        // - Auto-matched payees already exist in the engine (that's why they matched)
        // - Manual categorization via CategorySelector calls learn() on user selection
        // - This avoids redundant database writes and keeps the flow clean
        
        // Invalidate query to reflect saved changes
        queryClient.invalidateQueries({ queryKey: ["bank-transactions", accountId] });
        console.log(`Persisted ${matchesToPersist.length} categories to database`);
      } catch (error) {
        console.error('Failed to persist some categories:', error);
      }
    }

    // Show toast notification
    const totalCategorized = matchCount + suggestionCount;
    if (totalCategorized > 0) {
      toast({
        title: t('categorization.categorizeComplete', 'Categorization complete'),
        description: t('categorization.categorizeResult', {
          matches: matchCount,
          suggestions: suggestionCount,
          defaultValue: `${matchCount} matched, ${suggestionCount} suggestions`,
        }),
        duration: 5000,
      });
    } else {
      toast({
        title: t('categorization.noMatches', 'No matches found'),
        description: t('categorization.noMatchesDesc', 'Try adding more rules or training the ML model.'),
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  // Get effective category for a transaction (from local state or DB)
  const getEffectiveCategory = (tx: typeof transactions[0]) => {
    const localResult = categorizationResults.get(tx.id);
    if (localResult) {
      if (localResult.type === 'Match') {
        return localResult.data.categoryId;
      }
      // For suggestions, don't override - let user accept
    }
    return tx.categoryId;
  };

  // Count uncategorized transactions
  const uncategorizedCount = transactions.filter(tx => {
    if (tx.categoryId) return false;
    const localResult = categorizationResults.get(tx.id);
    if (localResult && localResult.type === 'Match') return false;
    return true;
  }).length;

  // Handle category change for a transaction
  const handleCategoryChange = async (txId: string, categoryId: string | null) => {
    if (!categoryId) return;
    
    try {
      // Persist to database
      await bankAccountsApi.updateTransactionCategory(txId, categoryId);
      
      // Update local state for immediate UI feedback
      setCategorizationResults(prev => {
        const updated = new Map(prev);
        updated.set(txId, {
          type: 'Match',
          data: { categoryId, source: { type: 'Manual' } }
        });
        return updated;
      });
      
      // Invalidate transactions query to reflect the change
      queryClient.invalidateQueries({ queryKey: ["bank-transactions", accountId] });
    } catch (error) {
      console.error('Failed to update category:', error);
      toast({
        title: t('messages.error', 'Error'),
        description: String(error),
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  const handleDeleteTx = (id: string) => {
    deleteTransaction.mutate(id);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          </div>
          <p className="text-muted-foreground">
            {account.institution?.name || ""}
          </p>
          {(account.bban || account.iban) && (
            <div className="text-sm text-muted-foreground mt-1">
              {account.bban && <span>BBAN: {account.bban}</span>}
              {account.bban && account.iban && <span className="mx-2">|</span>}
              {account.iban && <span>IBAN: {account.iban}</span>}
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setImportHistoryOpen(prev => !prev)}>
            <History className="mr-2 h-4 w-4" />
            {t("importHistory.button", "Transaction Imports")}
          </Button>
          <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            {tCommon("buttons.edit")}
          </Button>
          <AddTransactionModal accountId={accountId || ""} accountCurrency={account.currency || "CZK"} />
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
              {t("detail.includedInPortfolio", "Included in portfolio")
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
      {importHistoryOpen && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>{t("importHistory.title", "Import History")}</CardTitle>
            <div className="flex items-center gap-2">
              <Button onClick={() => setCsvImportOpen(true)}>
                <FileUp className="mr-2 h-4 w-4" />
                {t("csvImport.button", "Import CSV")}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setImportHistoryOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {importBatches && importBatches.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCommon("labels.date", "Date")}</TableHead>
                  <TableHead>{t("importHistory.fileName", "File Name")}</TableHead>
                  <TableHead>{t("importHistory.imported", "Imported")}</TableHead>
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
            ) : (
              <div className="text-center text-muted-foreground py-8">
                {t("importHistory.empty", "No imports yet. Import your first CSV file.")}
              </div>
            )}
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
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <CardTitle>{t("transactions")}</CardTitle>
          <Button
            onClick={handleAutoCategorize}
            disabled={isCategorizingBatch || uncategorizedCount === 0}
            size="sm"
          >
            {isCategorizingBatch ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {t("categorization.autoCategorize")}
            {uncategorizedCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                {uncategorizedCount}
              </Badge>
            )}
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3 pb-4 border-b">
            {/* Date Range Section */}
            <div className="flex items-center gap-2">
              {/* Date Preset Dropdown */}
              <Select value={datePreset} onValueChange={(v) => applyDatePreset(v)}>
                <SelectTrigger className="w-[150px] h-8">
                  <SelectValue placeholder={t("filters.selectPeriod", "Select period")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thisMonth">{t("filters.thisMonth")}</SelectItem>
                  <SelectItem value="lastMonth">{t("filters.lastMonth")}</SelectItem>
                  <SelectItem value="thisQuarter">{t("filters.thisQuarter")}</SelectItem>
                  <SelectItem value="lastQuarter">{t("filters.lastQuarter")}</SelectItem>
                  <SelectItem value="thisYear">{t("filters.thisYear")}</SelectItem>
                  <SelectItem value="lastYear">{t("filters.lastYear")}</SelectItem>
                  <SelectItem value="custom">{t("filters.custom")}</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Date Range Pickers */}
              <div className="flex items-center gap-1 text-sm">
                <Input 
                  type="date" 
                  value={dateFrom} 
                  onChange={(e) => handleDateChange('from', e.target.value)}
                  className="w-[130px] h-8"
                />
                <span className="text-muted-foreground px-1">→</span>
                <Input 
                  type="date" 
                  value={dateTo} 
                  onChange={(e) => handleDateChange('to', e.target.value)}
                  className="w-[130px] h-8"
                />
              </div>
            </div>
            
            {/* Separator */}
            <div className="h-6 w-px bg-border" />
            
            {/* Transaction Type Filter */}
            <div className="flex items-center gap-2">
              <Select value={transactionType} onValueChange={(v: "all" | "income" | "outcome") => setTransactionType(v)}>
                <SelectTrigger className="w-[135px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allTransactions")}</SelectItem>
                  <SelectItem value="income">
                    <span className="flex items-center gap-2">
                      <ArrowDownLeft className="h-3 w-3 text-green-500" />
                      {t("filters.incomeOnly")}
                    </span>
                  </SelectItem>
                  <SelectItem value="outcome">
                    <span className="flex items-center gap-2">
                      <ArrowUpRight className="h-3 w-3 text-red-500" />
                      {t("filters.outcomeOnly")}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[200px] h-8">
                  <SelectValue placeholder={t("filters.allCategories")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allCategories")}</SelectItem>
                  <SelectItem value="uncategorized">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gray-400" />
                      {t("filters.uncategorized")}
                    </span>
                  </SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        <span 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: cat.color || '#888' }}
                        />
                        {t(`categoryNames.${cat.id}`, { defaultValue: cat.name })}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Search Filter - fills remaining space */}
            <div className="flex-1">
              <Input
                type="text"
                placeholder={t("filters.searchPlaceholder", "Search...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full"
              />
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">{t("stats.totalTransactions")}</div>
              <div className="text-lg font-medium">{stats.count}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t("stats.income")}</div>
              <div className="text-lg font-medium text-green-600 dark:text-green-400">
                +{formatCurrency(stats.income)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t("stats.outcome")}</div>
              <div className="text-lg font-medium text-red-600 dark:text-red-400">
                -{formatCurrency(stats.outcome)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t("stats.netFlow")}</div>
              <div className={`text-lg font-medium ${stats.netFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {stats.netFlow >= 0 ? '+' : ''}{formatCurrency(stats.netFlow)}
              </div>
            </div>
          </div>

          {/* Transaction List */}
          <div>
          {txLoading ? (
            <div className="p-4">{tCommon("status.loading")}</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {transactions.length === 0 ? t("empty.noTransactions", "No transactions yet") : t("empty.noMatchingTransactions", "No transactions match the current filters")}
            </div>
          ) : (
            <div className="rounded-lg border">
          <Table>
              <TableHeader className="[&_th]:bg-muted/50">
                <TableRow>
                  <TableHead 
                    className="w-[90px] cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('date')}
                  >
                    <span className="flex items-center">
                      {t("transaction.date")}
                      <SortIcon column="date" />
                    </span>
                  </TableHead>
                  <TableHead 
                    className="max-w-[200px] cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('description')}
                  >
                    <span className="flex items-center">
                      {t("transaction.description")}
                      <SortIcon column="description" />
                    </span>
                  </TableHead>
                  <TableHead 
                    className="max-w-[180px] cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('counterparty')}
                  >
                    <span className="flex items-center">
                      {t("transaction.counterparty")}
                      <SortIcon column="counterparty" />
                    </span>
                  </TableHead>
                  <TableHead 
                    className="w-[70px] cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('vs')}
                  >
                    <span className="flex items-center">
                      {t("transaction.variableSymbol", "VS")}
                      <SortIcon column="vs" />
                    </span>
                  </TableHead>
                  <TableHead 
                    className="w-[160px] cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('category')}
                  >
                    <span className="flex items-center">
                      {t("categorization.category", "Category")}
                      <SortIcon column="category" />
                    </span>
                  </TableHead>
                  <TableHead 
                    className="w-[110px] text-right cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('amount')}
                  >
                    <span className="flex items-center justify-end">
                      {t("transaction.amount")}
                      <SortIcon column="amount" />
                    </span>
                  </TableHead>
                  <TableHead className="w-[60px] text-right">
                    {tCommon("labels.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{formatDate(tx.bookingDate)}</TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="flex items-start gap-2">
                        {tx.type === "credit" ? (
                          <ArrowDownLeft className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                        )}
                        <span className="break-words whitespace-normal">{tx.description || "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <div className="truncate">
                        <div className="truncate">{tx.counterpartyName || "-"}</div>
                        {tx.counterpartyIban && (
                          <div className="text-xs text-muted-foreground truncate">
                            {isCzechIBAN(tx.counterpartyIban) 
                              ? ibanToBBAN(tx.counterpartyIban) 
                              : formatAccountNumber(tx.counterpartyIban)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {tx.variableSymbol || "-"}
                    </TableCell>
                    <TableCell>
                      <CategorySelector
                        currentCategoryId={getEffectiveCategory(tx)}
                        categorizationResult={categorizationResults.get(tx.id)}
                        counterpartyName={tx.counterpartyName}
                        counterpartyIban={tx.counterpartyIban}
                        variableSymbol={tx.variableSymbol}
                        categories={categories}
                        onCategoryChange={(catId) => handleCategoryChange(tx.id, catId)}
                        onDeclineSuggestion={() => {
                          setCategorizationResults(prev => {
                            const updated = new Map(prev);
                            updated.delete(tx.id);
                            return updated;
                          });
                        }}
                        compact
                      />
                    </TableCell>
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
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteTx(tx.id)}
                        title={tCommon("buttons.delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Account Dialog */}
      <BankAccountFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSubmit={handleEditSubmit}
        account={account}
        institutions={institutions}
        isLoading={updateAccount.isPending}
        initialZones={zones?.map(z => ({
          id: z.id,
          fromAmount: z.fromAmount,
          toAmount: z.toAmount || "",
          interestRate: z.interestRate,
        }))}
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
