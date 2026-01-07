import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Upload, FileText, CheckCircle, Loader2, Eye, EyeOff, ChevronDown,
  AlertCircle, Columns, Settings2, HelpCircle,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { bankAccountsApi } from "@/lib/tauri-api";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import type { BankCsvPreset, CsvPreviewResult, CsvImportConfigInput } from "@shared/schema";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  institutionId?: string | null;
}

type Step = "select" | "preview" | "import" | "done";

export function CsvImportDialog({
  open,
  onOpenChange,
  accountId,
  institutionId,
}: CsvImportDialogProps) {
  const { t } = useTranslation("bank_accounts");
  const { t: tc } = useTranslation("common");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("select");
  const [filePath, setFilePath] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [preview, setPreview] = useState<CsvPreviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    errors: number;
    errorList?: string[];
  } | null>(null);

  // Column mappings
  const [dateColumn, setDateColumn] = useState<string>("");
  const [amountColumn, setAmountColumn] = useState<string>("");
  const [descriptionColumns, setDescriptionColumns] = useState<string[]>([]);
  const [counterpartyColumn, setCounterpartyColumn] = useState<string>("");
  const [counterpartyIbanColumn, setCounterpartyIbanColumn] = useState<string>("");
  const [currencyColumn, setCurrencyColumn] = useState<string>("");
  const [variableSymbolColumn, setVariableSymbolColumn] = useState<string>("");
  const [dateFormat, setDateFormat] = useState<string>("%d.%m.%Y");
  const [delimiter, setDelimiter] = useState<string>(",");
  const [showPreview, setShowPreview] = useState(false);

  // Fetch preset for institution
  const { data: preset } = useQuery({
    queryKey: ["csv-preset", institutionId],
    queryFn: () =>
      institutionId ? bankAccountsApi.getCsvPresetByInstitution(institutionId) : null,
    enabled: !!institutionId && open,
  });

  // Apply preset when it loads
  const applyPreset = (preset: BankCsvPreset) => {
    setDelimiter(preset.delimiter);
    setDateFormat(preset.dateFormat);
    setDateColumn(preset.dateColumn);
    setAmountColumn(preset.amountColumn);
    setDescriptionColumns(preset.descriptionColumn ? [preset.descriptionColumn] : []);
    setCounterpartyColumn(preset.counterpartyColumn || "");
    setVariableSymbolColumn(preset.variableSymbolColumn || "");
  };

  const handleSelectFile = async () => {
    try {
      const selected = await openFileDialog({
        multiple: false,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (selected) {
        setFilePath(selected);
        setFileName(selected.split("/").pop() || selected);
        
        // Auto-apply preset if available
        if (preset) {
          applyPreset(preset);
        }
        
        // Parse preview - always auto-detect delimiter since CSV formats can vary
        setIsLoading(true);
        try {
          const result = await bankAccountsApi.parseCsvFile(
            selected,
            undefined,  // Always auto-detect - bank formats may have changed
            0
          );
          setPreview(result);
          if (result.delimiter) {
            setDelimiter(result.delimiter);
          }
          
          // Always apply suggested mappings from auto-detection
          if (result.suggestedMappings) {
            if (result.suggestedMappings.date) {
              setDateColumn(result.suggestedMappings.date[0]);
            }
            if (result.suggestedMappings.amount) {
              setAmountColumn(result.suggestedMappings.amount[0]);
            }
            if (result.suggestedMappings.description) {
              setDescriptionColumns([result.suggestedMappings.description[0]]);
            }
            if (result.suggestedMappings.counterparty) {
              setCounterpartyColumn(result.suggestedMappings.counterparty[0]);
            }
            if (result.suggestedMappings.variable_symbol) {
              setVariableSymbolColumn(result.suggestedMappings.variable_symbol[0]);
            }
            if (result.suggestedMappings.currency) {
              setCurrencyColumn(result.suggestedMappings.currency[0]);
            }
            if (result.suggestedMappings.counterparty_iban) {
              setCounterpartyIbanColumn(result.suggestedMappings.counterparty_iban[0]);
            }
          }
          
          setStep("preview");
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          toast({
            title: tc("status.error"),
            description: errorMessage,
            variant: "destructive",
          });
        }
        setIsLoading(false);
      }
    } catch (e) {
      console.error("Error selecting file:", e);
    }
  };

  const handleImport = async () => {
    if (!filePath || !dateColumn || !amountColumn) return;

    setIsLoading(true);
    setStep("import");

    try {
      const config: CsvImportConfigInput = {
        delimiter,
        skipRows: 0,
        dateColumn,
        dateFormat: dateFormat || "%d.%m.%Y",
        amountColumn,
        descriptionColumns: descriptionColumns.length > 0 ? descriptionColumns : null,
        counterpartyColumn: counterpartyColumn || null,
        counterpartyIbanColumn: counterpartyIbanColumn || null,
        currencyColumn: currencyColumn || null,
        variableSymbolColumn: variableSymbolColumn || null,
      };

      const result = await bankAccountsApi.importCsvTransactions(
        accountId,
        filePath,
        config
      );

      setImportResult({
        imported: result.importedCount,
        errors: result.errorCount,
        errorList: result.errors,
      });

      queryClient.invalidateQueries({ queryKey: ["bank-transactions", accountId] });
      queryClient.invalidateQueries({ queryKey: ["import-batches", accountId] });
      setStep("done");
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      toast({
        title: tc("status.error"),
        description: errorMessage,
        variant: "destructive",
      });
      setStep("preview");
    }

    setIsLoading(false);
  };

  const handleClose = () => {
    setStep("select");
    setFilePath("");
    setFileName("");
    setPreview(null);
    setImportResult(null);
    // Reset column mappings
    setDateColumn("");
    setAmountColumn("");
    setDescriptionColumns([]);
    setCounterpartyColumn("");
    setCounterpartyIbanColumn("");
    setCurrencyColumn("");
    setVariableSymbolColumn("");
    setShowPreview(false);
    onOpenChange(false);
  };

  const getConfidenceBadge = (field: string) => {
    if (!preview?.suggestedMappings || !preview.suggestedMappings[field]) return null;
    const confidence = preview.suggestedMappings[field][1];
    if (confidence >= 0.9) {
      return <Badge variant="default" className="ml-2 bg-green-600">✓ {Math.round(confidence * 100)}%</Badge>;
    } else if (confidence >= 0.7) {
      return <Badge variant="secondary" className="ml-2">~{Math.round(confidence * 100)}%</Badge>;
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t("csvImport.title", "Import Transactions from CSV")}
          </DialogTitle>
          <DialogDescription>
            {step === "select" && t("csvImport.selectFile", "Select a CSV file exported from your bank")}
            {step === "preview" && t("csvImport.mapColumns", "Map CSV columns to transaction fields")}
            {step === "import" && t("csvImport.importing", "Importing transactions...")}
            {step === "done" && t("csvImport.complete", "Import complete!")}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Select File */}
        {step === "select" && (
          <div className="py-8">
            <div
              className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={handleSelectFile}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">{t("csvImport.clickToSelect", "Click to select CSV file")}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {preset
                  ? t("csvImport.presetDetected", `Preset detected: ${preset.bankName}`)
                  : t("csvImport.autoDetect", "Column headers will be auto-detected")}
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Preview & Column Mapping */}
        {step === "preview" && preview && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <FileText className="h-5 w-5" />
              <span className="font-medium">{fileName}</span>
              <span className="text-muted-foreground">({preview.totalRows} {t("csvImport.rows", "rows")})</span>
            </div>

            {/* Column Mapping */}
            <div className="form-section-accent">
              <h3 className="form-section-header-icon">
                <Columns />
                {t("csvImport.requiredColumns", "Required Columns")}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>
                    {t("csvImport.dateColumn", "Date Column")} *
                    {getConfidenceBadge("date")}
                  </Label>
                  <Select value={dateColumn} onValueChange={setDateColumn}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("csvImport.selectColumn", "Select column")} />
                    </SelectTrigger>
                    <SelectContent>
                      {preview.headers.filter(h => h.trim().length > 0).map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>
                    {t("csvImport.amountColumn", "Amount Column")} *
                    {getConfidenceBadge("amount")}
                  </Label>
                  <Select value={amountColumn} onValueChange={setAmountColumn}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("csvImport.selectColumn", "Select column")} />
                    </SelectTrigger>
                    <SelectContent>
                      {preview.headers.filter(h => h.trim().length > 0).map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="form-section-accent">
              <h3 className="form-section-header-icon">
                <Settings2 />
                {t("csvImport.optionalColumns", "Optional Columns")}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="flex items-center gap-1">
                    {t("csvImport.descriptionColumns", "Description Columns")}
                    {getConfidenceBadge("description")}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[250px]">
                          <p>{t("csvImport.descriptionColumnsHelp", "Select all available descriptive fields (e.g., message, note, purpose) for better automatic categorization.")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal h-10 text-left overflow-hidden">
                        <span className="truncate flex-1 min-w-0">
                          {descriptionColumns.length === 0 
                            ? t("csvImport.selectColumns", "Select columns...")
                            : descriptionColumns.length === 1
                              ? descriptionColumns[0]
                              : `${descriptionColumns[0]} +${descriptionColumns.length - 1}`}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                      <div 
                        className="max-h-[200px] overflow-y-auto p-2"
                        onWheel={(e) => e.stopPropagation()}
                      >
                          {preview.headers.filter(h => h.trim().length > 0).map((h) => (
                            <label key={h} className="flex items-center gap-3 text-sm cursor-pointer hover:bg-muted p-2 rounded">
                              <Checkbox
                                checked={descriptionColumns.includes(h)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setDescriptionColumns([...descriptionColumns, h]);
                                  } else {
                                    setDescriptionColumns(descriptionColumns.filter(c => c !== h));
                                  }
                                }}
                              />
                              {h}
                            </label>
                          ))}
                        </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid gap-2">
                  <Label>
                    {t("csvImport.counterpartyColumn", "Counterparty Column")}
                    {getConfidenceBadge("counterparty")}
                  </Label>
                  <Select value={counterpartyColumn || "__none__"} onValueChange={(v) => setCounterpartyColumn(v === "__none__" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("csvImport.optional", "Optional")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {preview.headers.filter(h => h.trim().length > 0).map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>
                    {t("csvImport.variableSymbol", "Variable Symbol (VS)")}
                    {getConfidenceBadge("variable_symbol")}
                  </Label>
                  <Select value={variableSymbolColumn || "__none__"} onValueChange={(v) => setVariableSymbolColumn(v === "__none__" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("csvImport.optional", "Optional")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {preview.headers.filter(h => h.trim().length > 0).map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>
                    {t("csvImport.currencyColumn", "Currency Column")}
                    {getConfidenceBadge("currency")}
                  </Label>
                  <Select value={currencyColumn || "__none__"} onValueChange={(v) => setCurrencyColumn(v === "__none__" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("csvImport.optional", "Optional")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {preview.headers.filter(h => h.trim().length > 0).map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>
                    {t("csvImport.counterpartyIbanColumn", "Counterparty Account (IBAN)")}
                    {getConfidenceBadge("counterparty_iban")}
                  </Label>
                  <Select value={counterpartyIbanColumn || "__none__"} onValueChange={(v) => setCounterpartyIbanColumn(v === "__none__" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("csvImport.optional", "Optional")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {preview.headers.filter(h => h.trim().length > 0).map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* CSV Preview - toggleable */}
            <div className="border rounded-lg">
              <Button
                variant="ghost"
                className="w-full flex items-center justify-between p-3"
                onClick={() => setShowPreview(!showPreview)}
              >
                <span className="flex items-center gap-2">
                  {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {t("csvImport.previewData", "Preview CSV Data")}
                </span>
                <span className="text-muted-foreground text-sm">
                  {preview.headers.length} {t("csvImport.columns", "columns")}, {preview.totalRows} {t("csvImport.rows", "rows")}
                </span>
              </Button>
              {showPreview && (
                <div className="overflow-x-auto max-h-48 border-t">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {preview.headers.map((h) => (
                          <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.sampleRows.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>
                          {row.map((cell, j) => (
                            <TableCell key={j} className="whitespace-nowrap max-w-[200px] truncate">
                              {cell}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Importing */}
        {step === "import" && (
          <div className="py-12 text-center">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
            <p className="text-lg">{t("csvImport.processing", "Processing transactions...")}</p>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && importResult && (
          <div className="py-8 space-y-6">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
              <p className="text-2xl font-bold">{t("csvImport.success", "Import Complete!")}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <p className="text-3xl font-bold text-green-600">{importResult.imported}</p>
                <p className="text-sm text-muted-foreground">{t("csvImport.imported", "Imported")}</p>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                <p className="text-3xl font-bold text-red-600">{importResult.errors}</p>
                <p className="text-sm text-muted-foreground">{t("csvImport.errors", "Errors")}</p>
              </div>
            </div>


            {/* Error Details */}
            {importResult.errors > 0 && importResult.errorList && importResult.errorList.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center justify-center w-full mt-4 text-sm text-red-600 hover:text-red-700">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Show Error Details
                  <ChevronDown className="h-4 w-4 ml-1" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="bg-red-50 dark:bg-red-950/30 rounded-md p-4 max-h-48 overflow-y-auto text-sm text-red-700 dark:text-red-400 font-mono">
                    <ul className="space-y-1">
                      {importResult.errorList.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "select" && (
            <Button variant="outline" onClick={handleClose}>
              {tc("buttons.cancel")}
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("select")}>
                {tc("buttons.back")}
              </Button>
              <Button
                onClick={handleImport}
                disabled={!dateColumn || !amountColumn || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("csvImport.importButton", `Import ${preview?.totalRows || 0} Transactions`)}
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={handleClose}>
              {tc("buttons.close")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
