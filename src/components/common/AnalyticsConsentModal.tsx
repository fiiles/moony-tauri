import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield, Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { setConsent, markConsentAsked, needsConsentPrompt } from "@/lib/analytics";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export function AnalyticsConsentModal() {
    const { t } = useTranslation("common");
    const { user } = useAuth();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        // Only show if user is logged in AND we need to ask for consent
        if (user && needsConsentPrompt()) {
            // Small delay to not conflict with other startup modals
            const timer = setTimeout(() => setOpen(true), 1000);
            return () => clearTimeout(timer);
        }
    }, [user]);

    const handleConsent = (granted: boolean) => {
        setConsent(granted);
        markConsentAsked();
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        {t("analytics.consentTitle")}
                    </DialogTitle>
                    <DialogDescription>
                        {t("analytics.consentDescription")}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="text-sm text-muted-foreground space-y-2">
                        <p>{t("analytics.dataCollected")}:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>{t("analytics.dataPoints.screens")}</li>
                            <li>{t("analytics.dataPoints.device")}</li>
                        </ul>
                    </div>

                    <div className="bg-muted/50 p-3 rounded-md text-xs text-muted-foreground">
                        <strong>{t("analytics.privacyNote")}:</strong> {t("analytics.privacyDetail")}
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => handleConsent(false)}>
                        <X className="mr-2 h-4 w-4" />
                        {t("analytics.decline")}
                    </Button>
                    <Button onClick={() => handleConsent(true)}>
                        <Check className="mr-2 h-4 w-4" />
                        {t("analytics.allow")}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
