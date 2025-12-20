/**
 * Welcome Modal
 * Shown to first-time users before registration to explain the app
 * and emphasize data privacy/security features.
 */
import { Shield, Key, Check, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES, type SupportedLanguage } from "@/i18n/index";


interface WelcomeModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    language: SupportedLanguage;
    onLanguageChange: (lang: SupportedLanguage) => void;
}

export function WelcomeModal({ open, onOpenChange, language, onLanguageChange }: WelcomeModalProps) {
    const { t } = useTranslation("auth");

    const privacyPoints = ["encryption", "localOnly", "noCloud", "noThirdParty"];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg bg-gradient-to-b from-background to-muted/30 border-border/50">
                {/* Language Picker - Top Right */}
                <div className="absolute top-4 right-10">
                    <Select value={language} onValueChange={(v) => onLanguageChange(v as SupportedLanguage)}>
                        <SelectTrigger className="w-[120px] h-8 text-xs gap-1">
                            <Globe className="h-3 w-3 opacity-70" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {SUPPORTED_LANGUAGES.map((lang) => (
                                <SelectItem key={lang} value={lang}>
                                    {LANGUAGE_NAMES[lang].native}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <DialogHeader className="pb-2">
                    <div className="flex items-center gap-3">
                        <div className="flex aspect-square size-12 shrink-0 items-center justify-center rounded-lg overflow-hidden">
                            <img src="/moony-icon.png" alt="Moony" className="size-12" />
                        </div>
                        <div className="grid flex-1 text-left leading-tight">
                            <DialogTitle className="text-xl font-bold">
                                {t("welcomeModal.title")}
                            </DialogTitle>
                            <DialogDescription className="text-sm">
                                {t("welcomeModal.subtitle")}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* App Description */}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {t("welcomeModal.description")}
                    </p>

                    {/* Privacy/Security Card */}
                    <div className="rounded-lg border bg-card/50 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-green-500" />
                            <h3 className="font-semibold text-foreground">
                                {t("welcomeModal.privacyTitle")}
                            </h3>
                        </div>
                        
                        <ul className="space-y-2">
                            {privacyPoints.map((key) => (
                                <li key={key} className="flex items-start gap-2 text-sm">
                                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                    <span className="text-muted-foreground">
                                        {t(`welcomeModal.privacyPoints.${key}`)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Security Note */}
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <Key className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                            {t("welcomeModal.securityNote")}
                        </p>
                    </div>

                    {/* Get Started Button */}
                    <Button 
                        onClick={() => onOpenChange(false)} 
                        className="w-full"
                        size="lg"
                    >
                        {t("welcomeModal.getStarted")}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
