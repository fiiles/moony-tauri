import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { investmentsApi } from "@/lib/tauri-api";

export function ImportInvestmentsModal() {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [successCount, setSuccessCount] = useState<number | null>(null);
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [importedItems, setImportedItems] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();

    const exampleCSVContent = `Date,Type,Ticker,Quantity,Price,Currency
2024-01-15,buy,AAPL,10,180.50,USD
2024-02-20,buy,MSFT,5,395.00,USD
2024-03-10,sell,AAPL,3,185.25,USD
2024-04-05,buy,GOOGL,2,155.75,USD
2024-05-15,buy,NVDA,8,850.00,USD`;

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
        mutationFn: async (transactions: any[]) => {
            return investmentsApi.importTransactions(transactions, "USD");
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
        },
        onError: (err) => {
            console.error("Import mutation error:", err);
            setError(err.message);
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

                const data = [];
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
            } catch (err: any) {
                setError("Failed to parse CSV: " + err.message);
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
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) handleReset();
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Import CSV
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Import Investments</DialogTitle>
                    <DialogDescription className="space-y-2">
                        <span>Import investment transactions from a CSV file. Required columns:</span>
                        <code className="block text-xs bg-muted px-2 py-1 rounded mt-1">
                            Date, Type, Ticker, Quantity, Price, Currency
                        </code>
                        <span className="block text-xs text-muted-foreground mt-1">
                            Date formats: YYYY-MM-DD, DD.MM.YYYY, or DD/MM/YYYY. Type: buy or sell.
                        </span>
                        <button
                            type="button"
                            onClick={downloadExampleCSV}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                        >
                            <Download className="h-3 w-3" />
                            Download example CSV template
                        </button>
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
                    {!file && !successCount && (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 text-center hover:bg-muted/50 cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}>
                            <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium">Click to upload CSV</h3>
                            <p className="text-sm text-muted-foreground mt-2">or drag and drop here</p>
                            <Input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>
                    )}

                    {file && !successCount && (
                        <div className="flex flex-col gap-4 h-full">
                            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                                <div className="flex items-center gap-3">
                                    <FileText className="h-8 w-8 text-primary" />
                                    <div>
                                        <p className="font-medium">{file.name}</p>
                                        <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={handleReset}>Change</Button>
                            </div>

                            {error && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Error</AlertTitle>
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            {parsedData.length > 0 && (
                                <div className="flex-1 border rounded-md overflow-hidden flex flex-col">
                                    <div className="bg-muted p-2 text-xs font-mono border-b">
                                        Previewing first {Math.min(parsedData.length, 5)} of {parsedData.length} records
                                    </div>
                                    <ScrollArea className="flex-1">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    {Object.keys(parsedData[0]).slice(0, 6).map((h) => (
                                                        <TableHead key={h}>{h}</TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {parsedData.slice(0, 5).map((row, i) => (
                                                    <TableRow key={i}>
                                                        {Object.values(row).slice(0, 6).map((v: any, j) => (
                                                            <TableCell key={j}>{v}</TableCell>
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

                    {successCount !== null && (
                        <div className="flex flex-col gap-4 items-center justify-center p-8 w-full">
                            <CheckCircle className="h-16 w-16 text-green-500" />
                            <h3 className="text-xl font-bold">Import Complete</h3>
                            <p className="text-muted-foreground">Processed {successCount + importErrors.length} rows.</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                {importedItems.length > 0 && (
                                    <Alert className="w-full text-left border-green-200 bg-green-50">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <AlertTitle className="text-green-800">{successCount} Successful</AlertTitle>
                                        <AlertDescription className="max-h-60 overflow-y-auto mt-2">
                                            <ul className="list-disc pl-4 text-xs space-y-1 text-green-700">
                                                {importedItems.map((e, i) => <li key={i}>{e}</li>)}
                                            </ul>
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {importErrors.length > 0 && (
                                    <Alert variant="destructive" className="w-full text-left">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>{importErrors.length} Failed</AlertTitle>
                                        <AlertDescription className="max-h-60 overflow-y-auto mt-2">
                                            <ul className="list-disc pl-4 text-xs space-y-1">
                                                {importErrors.map((e, i) => <li key={i}>{e}</li>)}
                                            </ul>
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>

                            <Button onClick={() => setOpen(false)} className="mt-4">Close</Button>
                        </div>
                    )}
                </div>

                {file && !successCount && (
                    <DialogFooter>
                        <Button variant="outline" onClick={handleReset}>Cancel</Button>
                        <Button onClick={handleImport} disabled={parsedData.length === 0 || importMutation.isPending}>
                            {importMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Import {parsedData.length} Records
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
