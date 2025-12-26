import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useTranslation } from "react-i18next";

interface ExportButtonProps {
  exportFn: () => Promise<{ csv: string; filename: string; count: number }>;
  /** Tooltip text for the button */
  title?: string;
}

/**
 * Reusable export button component that exports data to CSV.
 * Displayed as an icon button matching the import button style.
 */
export function ExportButton({ exportFn, title }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation('common');

  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      // Get CSV data from backend
      const result = await exportFn();
      
      if (result.count === 0) {
        toast({
          title: t('export.noData'),
          description: t('export.noDataDescription'),
        });
        return;
      }
      
      // Open save dialog
      const filePath = await save({
        defaultPath: result.filename,
        filters: [{ name: "CSV", extensions: ["csv"] }]
      });
      
      if (filePath) {
        // Add UTF-8 BOM for proper encoding detection in Excel
        const BOM = '\uFEFF';
        await writeTextFile(filePath, BOM + result.csv);
        
        toast({
          title: t('export.success'),
          description: t('export.successDescription', { count: result.count }),
        });
      }
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        title: t('export.failed'),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleExport}
      disabled={isExporting}
      title={title || t('export.button')}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
    </Button>
  );
}
