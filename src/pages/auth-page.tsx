/**
 * Auth Page - Single User Version
 * Supports setup, unlock, and recover flows with language picker
 */
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { setupSchema, unlockSchema, recoverSchema } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { ShieldCheck, Copy, Check, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES, type SupportedLanguage } from "@/i18n/index";
import { WelcomeModal } from "@/components/auth/WelcomeModal";

// Language picker component for top-right corner
function LanguagePicker({ 
    language, 
    onLanguageChange 
}: { 
    language: SupportedLanguage; 
    onLanguageChange: (lang: SupportedLanguage) => void;
}) {
    return (
        <div className="absolute top-4 right-4 z-10">
            <Select value={language} onValueChange={(v) => onLanguageChange(v as SupportedLanguage)}>
                <SelectTrigger className="w-[140px] gap-2 bg-white text-gray-900 border-gray-200 hover:bg-gray-50">
                    <Globe className="h-4 w-4 opacity-70" />
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
    );
}

export default function AuthPage() {
    const { user, appStatus, setupMutation, unlockMutation, recoverMutation, confirmSetupMutation, confirmRecoveryMutation, recoveryKey, clearRecoveryKey } = useAuth();
    const [, setLocation] = useLocation();
    const [activeTab, setActiveTab] = useState<"unlock" | "recover">("unlock");
    const [copied, setCopied] = useState(false);
    const { t, i18n } = useTranslation('auth');
    const [showWelcome, setShowWelcome] = useState(true);

    // Language state - use localStorage value if available, otherwise default to 'en'
    const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(() => {
        const stored = localStorage.getItem('moony-language');
        if (stored && SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) {
            return stored as SupportedLanguage;
        }
        return 'en';
    });

    // Handle language change
    const handleLanguageChange = (lang: SupportedLanguage) => {
        setSelectedLanguage(lang);
        i18n.changeLanguage(lang);
        localStorage.setItem('moony-language', lang);
    };

    useEffect(() => {
        // Only redirect if unlocked AND no recovery key pending confirmation
        if (user && appStatus === "unlocked" && !recoveryKey) {
            setLocation("/");
        }
    }, [user, appStatus, setLocation, recoveryKey]);

    // Setup form (first-time use)
    const setupForm = useForm<z.infer<typeof setupSchema>>({
        resolver: zodResolver(setupSchema),
        defaultValues: {
            password: "",
            confirmPassword: "",
            name: "",
            surname: "",
            email: "",
        },
    });

    // Unlock form (login with password)
    const unlockForm = useForm<z.infer<typeof unlockSchema>>({
        resolver: zodResolver(unlockSchema),
        defaultValues: {
            password: "",
        },
    });

    // Recover form (reset with recovery key)
    const recoverForm = useForm<z.infer<typeof recoverSchema>>({
        resolver: zodResolver(recoverSchema),
        defaultValues: {
            recoveryKey: "",
            newPassword: "",
            confirmPassword: "",
        },
    });

    const copyRecoveryKey = async () => {
        if (recoveryKey) {
            await navigator.clipboard.writeText(recoveryKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Show setup page if first time
    if (appStatus === "needs_setup") {
        return (
            <div className="min-h-screen relative">
                <WelcomeModal 
                    open={showWelcome} 
                    onOpenChange={setShowWelcome}
                    language={selectedLanguage}
                    onLanguageChange={handleLanguageChange}
                />
                <LanguagePicker 
                    language={selectedLanguage} 
                    onLanguageChange={handleLanguageChange} 
                />
                <div className="flex items-center justify-center p-8 bg-background min-h-screen">
                    <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
                        <CardHeader className="space-y-1">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-6 w-6 text-primary" />
                                <CardTitle className="text-2xl font-bold">{t('register.title')}</CardTitle>
                            </div>
                            <CardDescription>
                                {t('register.description')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...setupForm}>
                                <form
                                    onSubmit={setupForm.handleSubmit((data) => 
                                        setupMutation.mutate({ ...data, language: selectedLanguage })
                                    )}
                                    className="space-y-4"
                                >
                                    <FormField
                                        control={setupForm.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('register.name')}</FormLabel>
                                                <FormControl>
                                                    <Input placeholder={t('register.namePlaceholder')} {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={setupForm.control}
                                        name="surname"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('register.surname')}</FormLabel>
                                                <FormControl>
                                                    <Input placeholder={t('register.surnamePlaceholder')} {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={setupForm.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('register.email')}</FormLabel>
                                                <FormControl>
                                                    <Input type="email" placeholder={t('register.emailPlaceholder')} {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={setupForm.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('register.password')}</FormLabel>
                                                <FormControl>
                                                    <Input type="password" placeholder={t('register.passwordPlaceholder')} {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={setupForm.control}
                                        name="confirmPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('register.confirmPassword')}</FormLabel>
                                                <FormControl>
                                                    <Input type="password" placeholder={t('register.confirmPasswordPlaceholder')} {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={setupMutation.isPending}
                                    >
                                        {setupMutation.isPending ? t('register.settingUp') : t('register.getStarted')}
                                    </Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </div>

                {/* Recovery Key Modal - 2-Phase Setup */}
                <Dialog open={!!recoveryKey} onOpenChange={(open) => !open && clearRecoveryKey()}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-green-500" />
                                {t('recoveryKeyModal.title')}
                            </DialogTitle>
                            <DialogDescription>
                                {t('recoveryKeyModal.description')}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="p-4 bg-muted rounded-lg font-mono text-center text-lg tracking-wider break-all">
                                {recoveryKey}
                            </div>
                            <Button onClick={copyRecoveryKey} className="w-full" variant="outline">
                                {copied ? (
                                    <><Check className="mr-2 h-4 w-4" /> {t('recoveryKeyModal.copied')}</>
                                ) : (
                                    <><Copy className="mr-2 h-4 w-4" /> {t('recoveryKeyModal.copyKey')}</>
                                )}
                            </Button>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={clearRecoveryKey}
                                    className="flex-1"
                                    disabled={confirmSetupMutation.isPending}
                                >
                                    {t('common:buttons.cancel', 'Cancel')}
                                </Button>
                                <Button
                                    onClick={() => {
                                        confirmSetupMutation.mutate(undefined, { onSuccess: () => clearRecoveryKey() });
                                    }}
                                    disabled={confirmSetupMutation.isPending}
                                    className="flex-1"
                                >
                                    {confirmSetupMutation.isPending ? t('register.settingUp') : t('recoveryKeyModal.confirm')}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground text-center">
                                {t('recoveryKeyModal.confirmHint')}
                            </p>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    // Show unlock/recover page for returning users
    return (
        <div className="min-h-screen relative">
            <LanguagePicker 
                language={selectedLanguage} 
                onLanguageChange={handleLanguageChange} 
            />
            <div className="flex items-center justify-center p-8 bg-background min-h-screen">
                <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
                    <CardHeader className="space-y-1">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-6 w-6 text-primary" />
                            <CardTitle className="text-2xl font-bold">{t('login.title')}</CardTitle>
                        </div>
                        <CardDescription>
                            {t('login.description')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-4">
                                <TabsTrigger value="unlock">{t('tabs.login')}</TabsTrigger>
                                <TabsTrigger value="recover">{t('tabs.recover')}</TabsTrigger>
                            </TabsList>

                            <TabsContent value="unlock">
                                <Form {...unlockForm}>
                                    <form
                                        onSubmit={unlockForm.handleSubmit((data) => unlockMutation.mutate(data))}
                                        className="space-y-4"
                                    >
                                        <FormField
                                            control={unlockForm.control}
                                            name="password"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{t('login.password')}</FormLabel>
                                                    <FormControl>
                                                        <Input type="password" placeholder={t('login.passwordPlaceholder')} {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <Button
                                            type="submit"
                                            className="w-full"
                                            disabled={unlockMutation.isPending}
                                        >
                                            {unlockMutation.isPending ? t('login.unlocking') : t('login.unlock')}
                                        </Button>
                                        <div className="text-center">
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab("recover")}
                                                className="text-sm text-muted-foreground hover:text-primary hover:underline"
                                            >
                                                {t('login.forgotPassword')} {t('login.useRecoveryKey')}
                                            </button>
                                        </div>
                                    </form>
                                </Form>
                            </TabsContent>

                            <TabsContent value="recover">
                                <Form {...recoverForm}>
                                    <form
                                        onSubmit={recoverForm.handleSubmit((data) => recoverMutation.mutate(data))}
                                        className="space-y-4"
                                    >
                                        <FormField
                                            control={recoverForm.control}
                                            name="recoveryKey"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{t('recover.recoveryKey')}</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder={t('recover.recoveryKeyPlaceholder')} {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={recoverForm.control}
                                            name="newPassword"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{t('recover.newPassword')}</FormLabel>
                                                    <FormControl>
                                                        <Input type="password" placeholder={t('recover.newPasswordPlaceholder')} {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={recoverForm.control}
                                            name="confirmPassword"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{t('recover.confirmPassword')}</FormLabel>
                                                    <FormControl>
                                                        <Input type="password" placeholder={t('recover.confirmPasswordPlaceholder')} {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <Button
                                            type="submit"
                                            className="w-full"
                                            disabled={recoverMutation.isPending}
                                        >
                                            {recoverMutation.isPending ? t('recover.recovering') : t('recover.recoverAccount')}
                                        </Button>
                                    </form>
                                </Form>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>

            {/* Recovery Key Modal for after password reset */}
            <Dialog open={!!recoveryKey} onOpenChange={(open) => !open && clearRecoveryKey()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-green-500" />
                            {t('recoveryKeyModal.title')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('recoveryKeyModal.description')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="p-4 bg-muted rounded-lg font-mono text-center text-lg tracking-wider break-all">
                            {recoveryKey}
                        </div>
                        <Button onClick={copyRecoveryKey} className="w-full" variant="outline">
                            {copied ? (
                                <><Check className="mr-2 h-4 w-4" /> {t('recoveryKeyModal.copied')}</>
                            ) : (
                                <><Copy className="mr-2 h-4 w-4" /> {t('recoveryKeyModal.copyKey')}</>
                            )}
                        </Button>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={clearRecoveryKey}
                                className="flex-1"
                                disabled={confirmRecoveryMutation.isPending}
                            >
                                {t('common:buttons.cancel', 'Cancel')}
                            </Button>
                            <Button
                                onClick={() => {
                                    confirmRecoveryMutation.mutate(undefined, { onSuccess: () => clearRecoveryKey() });
                                }}
                                disabled={confirmRecoveryMutation.isPending}
                                className="flex-1"
                            >
                                {confirmRecoveryMutation.isPending ? t('recover.recovering') : t('recoveryKeyModal.confirm')}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                            {t('recoveryKeyModal.confirmHint')}
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
