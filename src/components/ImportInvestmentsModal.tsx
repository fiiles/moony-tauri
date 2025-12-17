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
import { Upload, FileText, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
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
    const [defaultCurrency, setDefaultCurrency] = useState("USD"); // Default currency
    const fileInputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();

    const importMutation = useMutation({
        mutationFn: async (transactions: any[]) => {
            return investmentsApi.importTransactions(transactions, defaultCurrency);
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["investments"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            setSuccessCount(data.success);
            setImportErrors(data.errors || []);
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
                const headerKeywords = ["ticker", "symbol", "date", "datum", "price", "cena", "quantity", "množství", "type", "typ", "fee", "poplatek"];
                const hasHeader = headerKeywords.some(k => firstLine.toLowerCase().includes(k));

                let headers: string[] = [];
                let startIndex = 0;

                if (hasHeader) {
                    headers = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
                    startIndex = 1;
                } else {
                    // Default schema if no header: date, type, currency, ticker, quantity, price, fee
                    headers = ["Date", "Type", "Currency", "Ticker", "Quantity", "Price", "Fee"];
                    startIndex = 0;
                }

                const data = [];
                for (let i = startIndex; i < lines.length; i++) {
                    const line = lines[i];
                    // Handle quoted values basic implementation
                    const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));

                    if (values.length < headers.length) continue; // Skip incomplete lines

                    const row: Record<string, string> = {};
                    headers.forEach((h, index) => {
                        if (index < values.length) {
                            row[h] = values[index];
                        }
                    });
                    data.push(row);
                }

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
                    <DialogDescription>
                        Format: Date, Type, Currency, Ticker, Quantity, Price, Fee
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center gap-4 py-2">
                    <label className="text-sm font-medium">Default Currency:</label>
                    <select
                        className="flex h-10 w-[100px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                        value={defaultCurrency}
                        onChange={(e) => setDefaultCurrency(e.target.value)}
                    >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="CZK">CZK</option>
                    </select>
                </div>

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
                        <div className="flex flex-col gap-4 items-center justify-center p-8">
                            <CheckCircle className="h-16 w-16 text-green-500" />
                            <h3 className="text-xl font-bold">Import Complete</h3>
                            <p className="text-muted-foreground">Successfully imported {successCount} transactions.</p>

                            {importErrors.length > 0 && (
                                <Alert variant="destructive" className="mt-4 w-full text-left">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>{importErrors.length} Failed Rows</AlertTitle>
                                    <AlertDescription className="max-h-40 overflow-y-auto mt-2">
                                        <ul className="list-disc pl-4 text-xs space-y-1">
                                            {importErrors.map((e, i) => <li key={i}>{e}</li>)}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            )}

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
