import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Upload,
    FileText,
    AlertCircle,
    CheckCircle,
    Loader2,
    Download,
    Search,
    ChevronDown,
    Eye,
    EyeOff,
    TriangleAlert,
} from "lucide-react";
import { investmentsApi, priceApi } from "@/lib/tauri-api";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "select" | "mapping" | "ticker-review" | "importing" | "done";

type ColumnMap = {
    date: string;
    type: string;
    ticker: string;
    quantity: string;
    price: string;
    currency: string; // empty string = not mapped, use defaultCurrency
};

type TickerStatus = "pending" | "searching" | "found" | "not_found" | "failed";

type TickerEntry = {
    originalTicker: string;
    resolvedTicker: string;
    name: string;
    status: TickerStatus;
};

type TickerMap = Record<string, TickerEntry>;

type SearchResult = { symbol: string; shortname: string; exchange: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const YAHOO_EXCHANGE_SUFFIXES = [
    { exchange: "US (NYSE / NASDAQ)", suffix: "—", example: "AAPL" },
    { exchange: "Germany (XETRA)", suffix: ".DE", example: "EUNL.DE" },
    { exchange: "London (LSE)", suffix: ".L", example: "EWG.L" },
    { exchange: "Paris (Euronext)", suffix: ".PA", example: "AIR.PA" },
    { exchange: "Amsterdam", suffix: ".AS", example: "ASML.AS" },
    { exchange: "Milan", suffix: ".MI", example: "ENI.MI" },
    { exchange: "Swiss Exchange", suffix: ".SW", example: "NESN.SW" },
    { exchange: "Prague (PSE)", suffix: ".PR", example: "CEZ.PR" },
    { exchange: "Hong Kong", suffix: ".HK", example: "0700.HK" },
    { exchange: "Tokyo", suffix: ".T", example: "7203.T" },
    { exchange: "Toronto", suffix: ".TO", example: "RY.TO" },
    { exchange: "Australia (ASX)", suffix: ".AX", example: "CBA.AX" },
];

const DATE_FORMATS = [
    { label: "YYYY-MM-DD  (e.g. 2024-01-15)", value: "%Y-%m-%d" },
    { label: "DD.MM.YYYY  (e.g. 15.01.2024)", value: "%d.%m.%Y" },
    { label: "DD/MM/YYYY  (e.g. 15/01/2024)", value: "%d/%m/%Y" },
    { label: "MM/DD/YYYY  (e.g. 01/15/2024)", value: "%m/%d/%Y" },
];

const CSV_COLUMNS = [
    { key: "Date",     required: true,  examples: "2024-01-15, 15.01.2024, 15/01/2024" },
    { key: "Type",     required: true,  examples: "buy, sell" },
    { key: "Ticker",   required: true,  examples: "AAPL, EUNL.DE, EWG.L" },
    { key: "Quantity", required: true,  examples: "10, 0.5" },
    { key: "Price",    required: true,  examples: "180.50" },
    { key: "Currency", required: false, examples: "USD, EUR, CZK, GBP" },
];

const EMPTY_COLUMN_MAP: ColumnMap = { date: "", type: "", ticker: "", quantity: "", price: "", currency: "" };
const ZERO_CONFIDENCE: Record<keyof ColumnMap, number> = { date: 0, type: 0, ticker: 0, quantity: 0, price: 0, currency: 0 };

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function splitCsvLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuote = !inQuote;
        } else if (ch === delimiter && !inQuote) {
            result.push(current.trim().replace(/^"|"$/g, ""));
            current = "";
        } else {
            current += ch;
        }
    }
    result.push(current.trim().replace(/^"|"$/g, ""));
    return result;
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) throw new Error("CSV file is empty");

    const delimiter = lines[0].includes(";") ? ";" : ",";
    const headers = splitCsvLine(lines[0], delimiter);

    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const values = splitCsvLine(lines[i], delimiter);
        if (values.length === 0) continue;
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = idx < values.length ? values[idx] : ""; });
        rows.push(row);
    }

    if (rows.length === 0) throw new Error("No data rows found");
    return { headers, rows };
}

function suggestColumnMap(headers: string[]): {
    map: ColumnMap;
    confidence: Record<keyof ColumnMap, number>;
} {
    const lower = headers.map(h => h.toLowerCase().trim());

    const findBest = (candidates: string[]): { col: string; conf: number } => {
        for (const c of candidates) {
            const idx = lower.findIndex(h => h === c);
            if (idx !== -1) return { col: headers[idx], conf: 0.95 };
        }
        for (const c of candidates) {
            const idx = lower.findIndex(h => h.includes(c) || c.includes(h));
            if (idx !== -1) return { col: headers[idx], conf: 0.7 };
        }
        return { col: "", conf: 0 };
    };

    const date     = findBest(["date", "datum", "trade date", "transaction date", "settlement date"]);
    const type     = findBest(["type", "typ", "transaction type", "action", "side", "operation"]);
    const ticker   = findBest(["ticker", "symbol", "isin", "instrument"]);
    const quantity = findBest(["quantity", "množství", "qty", "shares", "units", "počet", "amount"]);
    const price    = findBest(["price", "cena", "unit price", "price per unit", "rate", "cost"]);
    const currency = findBest(["currency", "měna", "mena", "cur", "ccy"]);

    return {
        map: { date: date.col, type: type.col, ticker: ticker.col, quantity: quantity.col, price: price.col, currency: currency.col },
        confidence: { date: date.conf, type: type.conf, ticker: ticker.conf, quantity: quantity.conf, price: price.conf, currency: currency.conf },
    };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportInvestmentsModal() {
    const { t } = useTranslation("stocks");
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<Step>("select");

    // File + raw CSV
    const [file, setFile] = useState<File | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
    const [parseError, setParseError] = useState<string | null>(null);

    // Column mapping
    const [columnMap, setColumnMap] = useState<ColumnMap>(EMPTY_COLUMN_MAP);
    const [columnConfidence, setColumnConfidence] = useState<Record<keyof ColumnMap, number>>(ZERO_CONFIDENCE);
    const [defaultCurrency, setDefaultCurrency] = useState("USD");
    const [dateFormat, setDateFormat] = useState("%Y-%m-%d");
    const [showCsvPreview, setShowCsvPreview] = useState(false);

    // Ticker review
    const [tickerMap, setTickerMap] = useState<TickerMap>({});
    const [verifyProgress, setVerifyProgress] = useState({ done: 0, total: 0 });
    const verifyAbortRef = useRef(false);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [showPickerDialog, setShowPickerDialog] = useState(false);
    const [activeSearchKey, setActiveSearchKey] = useState<string | null>(null);

    // Import result
    const [importResult, setImportResult] = useState<{ success: number; errors: string[]; imported: string[] } | null>(null);
    const [showDelayedSubtitle, setShowDelayedSubtitle] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();

    // Delayed subtitle during importing
    useEffect(() => {
        if (step !== "importing") { setShowDelayedSubtitle(false); return; }
        const timer = setTimeout(() => setShowDelayedSubtitle(true), 5000);
        return () => clearTimeout(timer);
    }, [step]);

    // ── Example CSV download ───────────────────────────────────────────────────

    const exampleCSVContent = `Date,Type,Ticker,Quantity,Price,Currency
2024-01-15,buy,AAPL,10,180.50,USD
2024-02-20,buy,MSFT,5,395.00,USD
2024-03-10,sell,AAPL,3,185.25,USD
2024-04-05,buy,EUNL.DE,2,95.50,EUR`;

    const downloadExampleCSV = async () => {
        try {
            const { save } = await import("@tauri-apps/plugin-dialog");
            const { writeTextFile } = await import("@tauri-apps/plugin-fs");
            const filePath = await save({ defaultPath: "example-transactions.csv", filters: [{ name: "CSV", extensions: ["csv"] }] });
            if (filePath) await writeTextFile(filePath, exampleCSVContent);
        } catch (err) { console.error("Failed to save CSV:", err); }
    };

    // ── File parsing ───────────────────────────────────────────────────────────

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;
        setFile(selected);
        setParseError(null);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const { headers: h, rows } = parseCSV(evt.target?.result as string);
                setHeaders(h);
                setRawRows(rows);
                const { map, confidence } = suggestColumnMap(h);
                setColumnMap(map);
                setColumnConfidence(confidence);
                setStep("mapping");
            } catch (err: unknown) {
                setParseError("Failed to parse CSV: " + (err instanceof Error ? err.message : "Unknown error"));
            }
        };
        reader.readAsText(selected);
    };

    const handleReset = () => {
        verifyAbortRef.current = true;
        setFile(null);
        setHeaders([]);
        setRawRows([]);
        setParseError(null);
        setColumnMap(EMPTY_COLUMN_MAP);
        setColumnConfidence(ZERO_CONFIDENCE);
        setDefaultCurrency("USD");
        setDateFormat("%Y-%m-%d");
        setShowCsvPreview(false);
        setTickerMap({});
        setVerifyProgress({ done: 0, total: 0 });
        setImportResult(null);
        setStep("select");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleClose = () => { handleReset(); setOpen(false); };

    // ── Confidence badge ───────────────────────────────────────────────────────

    const getConfidenceBadge = (field: keyof ColumnMap) => {
        const conf = columnConfidence[field];
        if (conf >= 0.9) return <Badge variant="default" className="ml-1 bg-green-600 text-xs px-1">✓ {Math.round(conf * 100)}%</Badge>;
        if (conf >= 0.7) return <Badge variant="secondary" className="ml-1 text-xs px-1">~{Math.round(conf * 100)}%</Badge>;
        return null;
    };

    const isMappingValid = !!(columnMap.date && columnMap.type && columnMap.ticker && columnMap.quantity && columnMap.price);

    // ── Ticker verification ────────────────────────────────────────────────────

    const startVerification = async (tickers: string[], currentMap: TickerMap) => {
        for (let i = 0; i < tickers.length; i++) {
            if (verifyAbortRef.current) break;
            const origKey = tickers[i];
            setTickerMap(prev => ({ ...prev, [origKey]: { ...prev[origKey], status: "searching" } }));
            setVerifyProgress({ done: i, total: tickers.length });

            try {
                const searchQuery = currentMap[origKey]?.resolvedTicker || origKey;
                const results = await priceApi.searchStockTickers(searchQuery);
                if (results.length > 0) {
                    const best = results.find(r => r.symbol.toUpperCase() === searchQuery.toUpperCase()) ?? results[0];
                    setTickerMap(prev => ({
                        ...prev,
                        [origKey]: { ...prev[origKey], resolvedTicker: best.symbol, name: best.shortname || "", status: "found" },
                    }));
                } else {
                    setTickerMap(prev => ({ ...prev, [origKey]: { ...prev[origKey], status: "not_found" } }));
                }
            } catch {
                setTickerMap(prev => ({ ...prev, [origKey]: { ...prev[origKey], status: "failed" } }));
            }

            if (i < tickers.length - 1) await delay(300);
        }
        setVerifyProgress(prev => ({ ...prev, done: tickers.length }));
    };

    const enterTickerReview = () => {
        const uniqueTickers = [...new Set(
            rawRows.map(row => row[columnMap.ticker] || "").filter(Boolean)
        )];
        const initial: TickerMap = {};
        uniqueTickers.forEach(ticker => {
            initial[ticker] = { originalTicker: ticker, resolvedTicker: ticker, name: "", status: "pending" };
        });
        setTickerMap(initial);
        setVerifyProgress({ done: 0, total: uniqueTickers.length });
        verifyAbortRef.current = false;
        setStep("ticker-review");
        startVerification(uniqueTickers, initial);
    };

    const retryFailed = () => {
        const failedKeys = Object.keys(tickerMap).filter(k => tickerMap[k].status === "failed");
        if (failedKeys.length === 0) return;
        verifyAbortRef.current = false;
        setVerifyProgress({ done: 0, total: failedKeys.length });
        startVerification(failedKeys, tickerMap);
    };

    const searchForTicker = async (originalKey: string) => {
        const entry = tickerMap[originalKey];
        if (!entry || entry.status === "searching") return;
        setActiveSearchKey(originalKey);
        setTickerMap(prev => ({ ...prev, [originalKey]: { ...prev[originalKey], status: "searching" } }));
        try {
            const results = await priceApi.searchStockTickers(entry.resolvedTicker);
            if (results.length === 0) {
                setTickerMap(prev => ({ ...prev, [originalKey]: { ...prev[originalKey], status: "not_found" } }));
                setActiveSearchKey(null);
            } else if (results.length === 1) {
                setTickerMap(prev => ({
                    ...prev,
                    [originalKey]: { ...prev[originalKey], resolvedTicker: results[0].symbol, name: results[0].shortname || "", status: "found" },
                }));
                setActiveSearchKey(null);
            } else {
                setSearchResults(results);
                setShowPickerDialog(true);
                // status stays "searching" until user picks from dialog
            }
        } catch {
            setTickerMap(prev => ({ ...prev, [originalKey]: { ...prev[originalKey], status: "failed" } }));
            setActiveSearchKey(null);
        }
    };

    const selectFromPicker = (result: SearchResult) => {
        if (!activeSearchKey) return;
        setTickerMap(prev => ({
            ...prev,
            [activeSearchKey]: { ...prev[activeSearchKey], resolvedTicker: result.symbol, name: result.shortname || "", status: "found" },
        }));
        setShowPickerDialog(false);
        setSearchResults([]);
        setActiveSearchKey(null);
    };

    const cancelPicker = () => {
        if (activeSearchKey) {
            setTickerMap(prev => ({ ...prev, [activeSearchKey]: { ...prev[activeSearchKey], status: "not_found" } }));
        }
        setShowPickerDialog(false);
        setSearchResults([]);
        setActiveSearchKey(null);
    };

    const isTickerReviewValid =
        Object.values(tickerMap).length > 0 &&
        Object.values(tickerMap).every(e =>
            e.status !== "pending" &&
            e.status !== "searching" &&
            (e.status === "found" || e.name.trim().length > 0)
        );

    // ── Row transform + import ─────────────────────────────────────────────────
    // (Added in Task 5)

    // ═══════════════════════════════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════════════════════════════

    return (
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) handleReset(); }}>
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
                        {step === "select"        && t("import.description")}
                        {step === "mapping"       && t("import.mapping.description")}
                        {step === "ticker-review" && t("import.tickerReview.description")}
                        {step === "importing"     && t("import.status.processing")}
                        {step === "done"          && t("import.complete")}
                    </DialogDescription>
                </DialogHeader>

                {/* ── Step 1: Select File ───────────────────────────────────── */}
                {step === "select" && (
                    <div className="space-y-4">
                        {/* CSV format table */}
                        <div className="border rounded-lg overflow-hidden">
                            <div className="bg-muted px-3 py-2 text-sm font-medium">{t("import.csvFormatTitle")}</div>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs w-28">Column</TableHead>
                                        <TableHead className="text-xs w-24">Required</TableHead>
                                        <TableHead className="text-xs">Example values</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {CSV_COLUMNS.map(col => (
                                        <TableRow key={col.key}>
                                            <TableCell className="font-mono text-xs font-medium">{col.key}</TableCell>
                                            <TableCell className="text-xs">{col.required ? "✓" : "optional"}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{col.examples}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <p className="text-xs text-muted-foreground">{t("import.columnMappingHint")}</p>
                        <p className="text-xs text-muted-foreground">{t("import.nameAutoLoaded")}</p>

                        {/* Ticker format collapsible */}
                        <Collapsible>
                            <CollapsibleTrigger className="flex items-center gap-1 text-sm text-primary hover:underline">
                                <ChevronDown className="h-3 w-3" />
                                {t("import.tickerFormatHint")}
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2">
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-xs">Exchange</TableHead>
                                                <TableHead className="text-xs w-20">Suffix</TableHead>
                                                <TableHead className="text-xs w-28">Example</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {YAHOO_EXCHANGE_SUFFIXES.map(row => (
                                                <TableRow key={row.example}>
                                                    <TableCell className="text-xs">{row.exchange}</TableCell>
                                                    <TableCell className="font-mono text-xs">{row.suffix}</TableCell>
                                                    <TableCell className="font-mono text-xs">{row.example}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>

                        {parseError && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>{t("import.error")}</AlertTitle>
                                <AlertDescription>{parseError}</AlertDescription>
                            </Alert>
                        )}

                        {/* Drop zone */}
                        <div
                            className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                            <p className="text-base font-medium">{t("import.clickToUpload")}</p>
                            <p className="text-sm text-muted-foreground mt-1">{t("import.dragAndDrop")}</p>
                            <Input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                        </div>

                        <button type="button" onClick={downloadExampleCSV} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            <Download className="h-3 w-3" />
                            {t("import.downloadTemplate")}
                        </button>
                    </div>
                )}

                {/* ── Step 2: Column Mapping ───────────────────────────────────────── */}
                {step === "mapping" && (
                    <div className="space-y-6">
                        {/* File info bar */}
                        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                            <FileText className="h-5 w-5 shrink-0" />
                            <span className="font-medium truncate">{file?.name}</span>
                            <span className="text-muted-foreground shrink-0">({rawRows.length} {t("import.mapping.rows")})</span>
                            <Button variant="ghost" size="sm" onClick={() => setStep("select")} className="ml-auto shrink-0">
                                {t("import.mapping.changeFile")}
                            </Button>
                        </div>

                        {/* Required columns */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-medium">{t("import.mapping.requiredSection")}</h4>
                            <div className="grid grid-cols-2 gap-4">
                                {/* Date + format selector */}
                                <div className="space-y-2">
                                    <div className="flex items-center text-sm font-medium">
                                        {t("import.mapping.dateColumn")} *{getConfidenceBadge("date")}
                                    </div>
                                    <Select value={columnMap.date} onValueChange={(v) => setColumnMap(prev => ({ ...prev, date: v }))}>
                                        <SelectTrigger><SelectValue placeholder={t("import.mapping.selectColumn")} /></SelectTrigger>
                                        <SelectContent>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Select value={dateFormat} onValueChange={setDateFormat}>
                                        <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                                        <SelectContent>{DATE_FORMATS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>

                                {/* Type */}
                                <div className="space-y-2">
                                    <div className="flex items-center text-sm font-medium">
                                        {t("import.mapping.typeColumn")} *{getConfidenceBadge("type")}
                                    </div>
                                    <Select value={columnMap.type} onValueChange={(v) => setColumnMap(prev => ({ ...prev, type: v }))}>
                                        <SelectTrigger><SelectValue placeholder={t("import.mapping.selectColumn")} /></SelectTrigger>
                                        <SelectContent>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>

                                {/* Ticker */}
                                <div className="space-y-2">
                                    <div className="flex items-center text-sm font-medium">
                                        {t("import.mapping.tickerColumn")} *{getConfidenceBadge("ticker")}
                                    </div>
                                    <Select value={columnMap.ticker} onValueChange={(v) => setColumnMap(prev => ({ ...prev, ticker: v }))}>
                                        <SelectTrigger><SelectValue placeholder={t("import.mapping.selectColumn")} /></SelectTrigger>
                                        <SelectContent>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>

                                {/* Quantity */}
                                <div className="space-y-2">
                                    <div className="flex items-center text-sm font-medium">
                                        {t("import.mapping.quantityColumn")} *{getConfidenceBadge("quantity")}
                                    </div>
                                    <Select value={columnMap.quantity} onValueChange={(v) => setColumnMap(prev => ({ ...prev, quantity: v }))}>
                                        <SelectTrigger><SelectValue placeholder={t("import.mapping.selectColumn")} /></SelectTrigger>
                                        <SelectContent>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>

                                {/* Price */}
                                <div className="space-y-2">
                                    <div className="flex items-center text-sm font-medium">
                                        {t("import.mapping.priceColumn")} *{getConfidenceBadge("price")}
                                    </div>
                                    <Select value={columnMap.price} onValueChange={(v) => setColumnMap(prev => ({ ...prev, price: v }))}>
                                        <SelectTrigger><SelectValue placeholder={t("import.mapping.selectColumn")} /></SelectTrigger>
                                        <SelectContent>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Optional columns */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-medium">{t("import.mapping.optionalSection")}</h4>
                            <div className="grid grid-cols-2 gap-4">
                                {/* Currency */}
                                <div className="space-y-2">
                                    <div className="flex items-center text-sm font-medium">
                                        {t("import.mapping.currencyColumn")}{getConfidenceBadge("currency")}
                                    </div>
                                    <Select value={columnMap.currency || "__none__"} onValueChange={(v) => setColumnMap(prev => ({ ...prev, currency: v === "__none__" ? "" : v }))}>
                                        <SelectTrigger><SelectValue placeholder={t("import.mapping.selectColumn")} /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">—</SelectItem>
                                            {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Default currency — shown only when currency column not mapped */}
                                {!columnMap.currency && (
                                    <div className="space-y-2">
                                        <div className="text-sm font-medium">{t("import.mapping.defaultCurrency")}</div>
                                        <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {["USD", "EUR", "CZK", "GBP"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* CSV preview toggle */}
                        <div className="border rounded-lg">
                            <Button variant="ghost" className="w-full flex items-center justify-between p-3" onClick={() => setShowCsvPreview(p => !p)}>
                                <span className="flex items-center gap-2">
                                    {showCsvPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    {t("import.mapping.previewData")}
                                </span>
                                <span className="text-muted-foreground text-sm">
                                    {headers.length} {t("import.mapping.columns")}, {rawRows.length} {t("import.mapping.rows")}
                                </span>
                            </Button>
                            {showCsvPreview && (
                                <div className="overflow-x-auto max-h-48 border-t">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>{headers.map(h => <TableHead key={h} className="whitespace-nowrap text-xs">{h}</TableHead>)}</TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {rawRows.slice(0, 5).map((row, i) => (
                                                <TableRow key={i}>
                                                    {headers.map(h => <TableCell key={h} className="whitespace-nowrap text-xs max-w-[150px] truncate">{row[h]}</TableCell>)}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Step 3: Ticker Review ────────────────────────────────────────── */}
                {step === "ticker-review" && (
                    <div className="space-y-4">
                        {/* Progress */}
                        {verifyProgress.done < verifyProgress.total && (
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">
                                    {t("import.tickerReview.verifying", { done: verifyProgress.done, total: verifyProgress.total })}
                                </p>
                                <div className="w-full bg-muted rounded-full h-2">
                                    <div
                                        className="bg-primary h-2 rounded-full transition-all"
                                        style={{ width: `${verifyProgress.total > 0 ? (verifyProgress.done / verifyProgress.total) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        )}
                        {verifyProgress.done > 0 && verifyProgress.done === verifyProgress.total && (
                            <p className="text-sm text-muted-foreground">{t("import.tickerReview.allVerified")}</p>
                        )}

                        {/* Retry failed */}
                        {Object.values(tickerMap).some(e => e.status === "failed") && (
                            <Button variant="outline" size="sm" onClick={retryFailed}>
                                {t("import.tickerReview.retryFailed")}
                            </Button>
                        )}

                        {/* Ticker rows */}
                        <div className="space-y-2">
                            {Object.entries(tickerMap).map(([origKey, entry]) => (
                                <div key={origKey} className="flex items-start gap-3 p-3 border rounded-lg">
                                    {/* Status icon */}
                                    <div className="mt-6 w-5 shrink-0">
                                        {entry.status === "pending"    && <div className="h-4 w-4 rounded-full bg-muted" />}
                                        {entry.status === "searching"  && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                        {entry.status === "found"      && <CheckCircle className="h-4 w-4 text-green-500" />}
                                        {entry.status === "not_found"  && <AlertCircle className="h-4 w-4 text-red-500" />}
                                        {entry.status === "failed"     && <TriangleAlert className="h-4 w-4 text-yellow-500" />}
                                    </div>

                                    {/* Ticker input + search button */}
                                    <div className="flex-1 space-y-1 min-w-0">
                                        <p className="text-xs text-muted-foreground">{t("import.tickerReview.tickerLabel")}</p>
                                        <div className="flex gap-1">
                                            <Input
                                                value={entry.resolvedTicker}
                                                onChange={(e) => setTickerMap(prev => ({ ...prev, [origKey]: { ...prev[origKey], resolvedTicker: e.target.value } }))}
                                                className="h-8 text-sm font-mono"
                                            />
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8 shrink-0"
                                                onClick={() => searchForTicker(origKey)}
                                                disabled={entry.status === "searching" || !entry.resolvedTicker.trim()}
                                            >
                                                {entry.status === "searching"
                                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                                    : <Search className="h-3 w-3" />}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Name input */}
                                    <div className="flex-1 space-y-1 min-w-0">
                                        <p className="text-xs text-muted-foreground">{t("import.tickerReview.nameLabel")}</p>
                                        <Input
                                            value={entry.name}
                                            onChange={(e) => setTickerMap(prev => ({ ...prev, [origKey]: { ...prev[origKey], name: e.target.value } }))}
                                            className={`h-8 text-sm ${
                                                (entry.status === "not_found" || entry.status === "failed") && !entry.name.trim()
                                                    ? entry.status === "not_found" ? "border-red-500" : "border-yellow-500"
                                                    : ""
                                            }`}
                                            placeholder={
                                                entry.status === "not_found" || entry.status === "failed"
                                                    ? t("import.tickerReview.nameRequired")
                                                    : ""
                                            }
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Steps 4-5: added in Task 5 */}

                {/* Ticker picker dialog */}
                <AlertDialog open={showPickerDialog} onOpenChange={(v) => { if (!v) cancelPicker(); }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t("modal.add.selectTicker")}</AlertDialogTitle>
                            <AlertDialogDescription>{t("modal.add.multipleResults")}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                            {searchResults.map(result => (
                                <button
                                    key={result.symbol}
                                    onClick={() => selectFromPicker(result)}
                                    className="w-full text-left p-3 rounded border hover:bg-accent transition-colors"
                                >
                                    <div className="font-semibold">{result.symbol}</div>
                                    <div className="text-sm text-muted-foreground">{result.shortname} • {result.exchange}</div>
                                </button>
                            ))}
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={cancelPicker}>{t("import.cancel")}</AlertDialogCancel>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <DialogFooter>
                    {step === "select" && (
                        <Button variant="outline" onClick={handleClose}>{t("import.cancel")}</Button>
                    )}
                    {step === "mapping" && (
                        <>
                            <Button variant="outline" onClick={() => setStep("select")}>{t("import.cancel")}</Button>
                            <Button onClick={enterTickerReview} disabled={!isMappingValid}>
                                {t("import.mapping.next")}
                            </Button>
                        </>
                    )}
                    {step === "ticker-review" && (
                        <>
                            <Button variant="outline" onClick={() => { verifyAbortRef.current = true; setStep("mapping"); }}>
                                {t("import.cancel")}
                            </Button>
                            <Button onClick={() => { /* handleImport added in Task 5 */ }} disabled={!isTickerReviewValid}>
                                {t("import.importRecords", { count: rawRows.length })}
                            </Button>
                        </>
                    )}
                    {/* Steps 4-5 footer buttons: added in Task 5 */}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
