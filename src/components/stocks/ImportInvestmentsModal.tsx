import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, AlertCircle, CheckCircle, Loader2, Download } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { investmentsApi, priceApi } from "@/lib/tauri-api";

type Step = "select" | "preview" | "importing" | "done";

export function ImportInvestmentsModal() {
    const { t } = useTranslation("stocks");
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<Step>("select");
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [successCount, setSuccessCount] = useState<number | null>(null);
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [importedItems, setImportedItems] = useState<string[]>([]);
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
    const [importStatus, setImportStatus] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();

    const exampleCSVContent = `Date,Type,Ticker,Name,Quantity,Price,Currency
2024-01-15,buy,AAPL,Apple Inc.,10,180.50,USD
2024-02-20,buy,MSFT,Microsoft Corporation,5,395.00,USD
2024-03-10,sell,AAPL,Apple Inc.,3,185.25,USD
2024-04-05,buy,GOOGL,Alphabet Inc.,2,155.75,USD
2024-05-15,buy,NVDA,NVIDIA Corporation,8,850.00,USD`;

    const downloadExampleCSV = async () => {
        try {
            const { save } = await import("@tauri-apps/plugin-dialog");
            const { writeTextFile } = await import("@tauri-apps/plugin-fs");

            const filePath = await save({
                defaultPath: "example-transactions.csv",
                filters: [{ name: "CSV", extensions: ["csv"] }]
            });

            if (filePath) {
                await writeTextFile(filePath, exampleCSVContent);
            }
        } catch (error) {
            console.error("Failed to save CSV:", error);
        }
    };

    const importMutation = useMutation({
        mutationFn: async (transactions: Record<string, string>[]) => {
            setStep("importing");
            setImportProgress({ current: 0, total: transactions.length });
            setImportStatus(t("import.status.lookingUpNames"));
            
            // The backend will look up names, then process transactions
            // We show a status message to indicate the phase
            const result = await investmentsApi.importTransactions(transactions, "USD");
            
            setImportProgress({ current: transactions.length, total: transactions.length });
            return result;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["investments"] });
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            setSuccessCount(data.success);
            setImportErrors(data.errors || []);
            setImportedItems(data.imported || []);
            setParsedData([]);
            setFile(null);
            
            // Show status for price/dividend refresh
            setImportStatus(t("import.status.refreshingPrices"));
            
            // Refresh prices and dividends for imported stocks (runs in background)
            priceApi.refreshStockPrices().then(() => {
                queryClient.invalidateQueries({ queryKey: ["investments"] });
                queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
                setImportStatus(t("import.status.refreshingDividends"));
                return priceApi.refreshDividends();
            }).then(() => {
                queryClient.invalidateQueries({ queryKey: ["investments"] });
                queryClient.invalidateQueries({ queryKey: ["dividend-summary"] });
                setImportStatus("");
                setStep("done");
            }).catch((err: Error) => {
                console.error("Background refresh error:", err);
                setImportStatus("");
                setStep("done");
            });
        },
        onError: (err) => {
            console.error("Import mutation error:", err);
            setError(err.message);
            setStep("preview");
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setError(null);
            setSuccessCount(null);
            setImportErrors([]);
            parseCSV(selectedFile);
        }
    };

    const parseCSV = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const lines = text.split(/\r?\n/).filter(line => line.trim());
                if (lines.length === 0) {
                    throw new Error("CSV file is empty");
                }

                // Simple auto-detect delimiter
                const firstLine = lines[0];
                const delimiter = firstLine.includes(";") ? ";" : ",";

                // Check if first line is a header
                // Heuristic: check if it contains typical header names (english or czech)
                const headerKeywords = ["ticker", "symbol", "date", "datum", "price", "cena", "quantity", "množství", "type", "typ", "currency", "měna"];
                const hasHeader = headerKeywords.some(k => firstLine.toLowerCase().includes(k));

                // Helper to split CSV line respecting quotes
                const splitLine = (line: string, delim: string) => {
                    const result = [];
                    let current = '';
                    let inQuote = false;
                    for (let i = 0; i < line.length; i++) {
                        const char = line[i];
                        if (char === '"') {
                            inQuote = !inQuote;
                        }

                        if (char === delim && !inQuote) {
                            result.push(current);
                            current = '';
                        } else {
                            current += char;
                        }
                    }
                    result.push(current);
                    return result;
                };

                let headers: string[] = [];
                let startIndex = 0;

                if (hasHeader) {
                    const normalizeHeader = (h: string) => {
                        h = h.toLowerCase();
                        if (["date", "datum"].includes(h)) return "Date";
                        if (["type", "typ"].includes(h)) return "Type";
                        if (["ticker", "symbol"].includes(h)) return "Ticker";
                        if (["name", "company_name", "company", "název", "nazev"].includes(h)) return "Name";
                        if (["quantity", "množství", "pocet", "amount"].includes(h)) return "Quantity";
                        if (["price", "cena", "price_per_unit", "cost"].includes(h)) return "Price";
                        if (["currency", "měna", "mena"].includes(h)) return "Currency";
                        return h.charAt(0).toUpperCase() + h.slice(1);
                    };
                    headers = splitLine(firstLine, delimiter).map(h => normalizeHeader(h.trim().replace(/^"|"$/g, '')));
                    startIndex = 1;
                } else {
                    // Default schema if no header: Date, Type, Ticker, Quantity, Price, Currency
                    headers = ["Date", "Type", "Ticker", "Quantity", "Price", "Currency"];
                }

                const data: Record<string, string>[] = [];
                // Process lines
                lines.slice(startIndex).forEach((line) => {
                    if (!line.trim()) return; // Skip empty lines

                    const values = splitLine(line, delimiter).map(v => v.trim().replace(/^"|"$/g, ''));

                    if (values.length === 0) return;

                    // Fix for European number format (e.g. 109,45) splitting into two columns if delimiter is comma
                    if (values.length === headers.length + 1 && delimiter === ',') {
                        const priceIdx = headers.indexOf("Price");
                        if (priceIdx !== -1 && values.length > priceIdx + 1) {
                            const p1 = values[priceIdx];
                            const p2 = values[priceIdx + 1];
                            // Check if split looks like a number (digits split by comma)
                            // e.g. p1="109", p2="45"
                            if (/^\d+$/.test(p1) && /^\d+$/.test(p2)) {
                                values.splice(priceIdx, 2, `${p1},${p2}`);
                            }
                        }
                    }

                    const transaction: Record<string, string> = {};
                    headers.forEach((header, index) => {
                        // Only set if we have a value and it matches header range
                        if (index < values.length && values[index] !== undefined) {
                            transaction[header] = values[index];
                        }
                    });
                    data.push(transaction);
                });

                if (data.length === 0) {
                    throw new Error("No valid data rows found");
                }

                setParsedData(data);
                setStep("preview");
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Unknown error";
                setError("Failed to parse CSV: " + message);
                setParsedData([]);
            }
        };
        reader.readAsText(file);
    };

    const handleImport = () => {
        if (parsedData.length > 0) {
            importMutation.mutate(parsedData);
        }
    };

    const handleReset = () => {
        setFile(null);
        setParsedData([]);
        setError(null);
        setSuccessCount(null);
        setImportErrors([]);
        setImportedItems([]);
        setStep("select");
        setImportProgress({ current: 0, total: 0 });
        setImportStatus("");
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleClose = () => {
        handleReset();
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) handleReset();
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" size="icon" title={t("importCSV")}>
                    <Upload className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {t("import.title")}
                    </DialogTitle>
                    <DialogDescription>
                        {step === "select" && t("import.description")}
                        {step === "preview" && t("import.requiredColumns")}
                        {step === "importing" && t("import.importingProgress", { current: importProgress.current, total: importProgress.total })}
                        {step === "done" && t("import.complete")}
                    </DialogDescription>
                </DialogHeader>

                {/* Step 1: Select File */}
                {step === "select" && (
                    <div className="py-8">
                        <div className="space-y-4 mb-6 text-center">
                            <code className="block text-xs bg-muted px-3 py-2 rounded">
                                Date, Type, Ticker, Quantity, Price, Currency
                            </code>
                            <p className="text-xs text-muted-foreground">
                                {t("import.optionalHint")}
                            </p>
                            <button
                                type="button"
                                onClick={downloadExampleCSV}
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                                <Download className="h-3 w-3" />
                                {t("import.downloadTemplate")}
                            </button>
                        </div>
                        <div
                            className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-lg font-medium">{t("import.clickToUpload")}</p>
                            <p className="text-sm text-muted-foreground mt-2">{t("import.dragAndDrop")}</p>
                            <Input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>
                    </div>
                )}

                {/* Step 2: Preview */}
                {step === "preview" && file && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                            <FileText className="h-5 w-5" />
                            <span className="font-medium">{file.name}</span>
                            <span className="text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                            <Button variant="ghost" size="sm" onClick={handleReset} className="ml-auto">
                                {t("import.change")}
                            </Button>
                        </div>

                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>{t("import.error")}</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {parsedData.length > 0 && (
                            <div className="border rounded-lg overflow-hidden">
                                <div className="bg-muted p-3 text-sm font-medium border-b">
                                    {t("import.previewLabel", { shown: Math.min(parsedData.length, 5), total: parsedData.length })}
                                </div>
                                <ScrollArea className="max-h-48">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                {Object.keys(parsedData[0]).slice(0, 6).map((h) => (
                                                    <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {parsedData.slice(0, 5).map((row, i) => (
                                                <TableRow key={i}>
                                                    {Object.values(row).slice(0, 6).map((v, j) => (
                                                        <TableCell key={j} className="whitespace-nowrap max-w-[200px] truncate">{v}</TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 3: Importing */}
                {step === "importing" && (
                    <div className="py-12 text-center">
                        <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
                        <p className="text-lg font-medium">{importStatus || t("import.status.processing")}</p>
                        <p className="text-sm text-muted-foreground mt-2">
                            {t("import.importingProgress", { current: importProgress.current, total: importProgress.total })}
                        </p>
                    </div>
                )}

                {/* Step 4: Done */}
                {step === "done" && successCount !== null && (
                    <div className="py-8 space-y-6">
                        <div className="text-center">
                            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                            <p className="text-2xl font-bold">{t("import.complete")}</p>
                            <p className="text-muted-foreground mt-2">
                                {t("import.processed", { count: successCount + importErrors.length })}
                            </p>
                        </div>

                        <div className={`grid gap-4 ${importedItems.length > 0 && importErrors.length > 0 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                            {importedItems.length > 0 && (
                                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                                    <div className="flex items-center gap-2 mb-3">
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                        <span className="font-medium text-green-800 dark:text-green-200">
                                            {t("import.successful", { count: successCount })}
                                        </span>
                                    </div>
                                    <ScrollArea className="max-h-40">
                                        <ul className="list-disc pl-4 text-xs space-y-1 text-green-700 dark:text-green-300">
                                            {importedItems.map((item, i) => <li key={i}>{item}</li>)}
                                        </ul>
                                    </ScrollArea>
                                </div>
                            )}

                            {importErrors.length > 0 && (
                                <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                                    <div className="flex items-center gap-2 mb-3">
                                        <AlertCircle className="h-5 w-5 text-red-600" />
                                        <span className="font-medium text-red-800 dark:text-red-200">
                                            {t("import.skipped", { count: importErrors.length })}
                                        </span>
                                    </div>
                                    <ScrollArea className="max-h-40">
                                        <ul className="list-disc pl-4 text-xs space-y-1 text-red-700 dark:text-red-300">
                                            {importErrors.map((err, i) => <li key={i}>{err}</li>)}
                                        </ul>
                                    </ScrollArea>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {step === "select" && (
                        <Button variant="outline" onClick={handleClose}>
                            {t("import.cancel")}
                        </Button>
                    )}
                    {step === "preview" && (
                        <>
                            <Button variant="outline" onClick={handleReset}>
                                {t("import.cancel")} 
                            </Button>
                            <Button onClick={handleImport} disabled={parsedData.length === 0 || importMutation.isPending}>
                                {importMutation.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t("import.importingProgress", { current: importProgress.current, total: importProgress.total })}
                                    </>
                                ) : (
                                    t("import.importRecords", { count: parsedData.length })
                                )}
                            </Button>
                        </>
                    )}
                    {step === "done" && (
                        <Button onClick={handleClose}>
                            {t("import.close")}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
