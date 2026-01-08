import { useState } from "react";
import { MenuPreferences } from "@shared/schema";
import { CurrencyCode } from "@shared/currencies";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currencies, useCurrency } from "@/lib/currency";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMutation, useQuery } from "@tanstack/react-query";
import { authApi, priceApi } from "@/lib/tauri-api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, ExternalLink, Copy, Check, ShieldCheck, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/I18nProvider";
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES, type SupportedLanguage } from "@/i18n/index";


const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  surname: z.string().min(1, "Surname is required"),
  email: z.string().email("Invalid email address"),
});

type ProfileData = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type PasswordData = z.infer<typeof passwordSchema>;

// Pending change password data (stored between prepare and confirm phases)
interface PendingPasswordChange {
  currentPassword: string;
  newPassword: string;
  recoveryKey: string;
}

function ChangePasswordForm() {
  const { toast } = useToast();
  const { t } = useTranslation('settings');
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [pendingData, setPendingData] = useState<PendingPasswordChange | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<PasswordData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Phase 1: Prepare - verify current password and get new recovery key
  const prepareMutation = useMutation({
    mutationFn: async (data: PasswordData) => {
      const result = await authApi.prepareChangePassword({
        currentPassword: data.currentPassword,
      });
      return { ...data, recoveryKey: result.recoveryKey };
    },
    onSuccess: (result) => {
      setPendingData({
        currentPassword: result.currentPassword,
        newPassword: result.newPassword,
        recoveryKey: result.recoveryKey,
      });
      setStep('confirm');
    },
    onError: (error: Error) => {
      toast({ title: "Verification failed", description: error.message, variant: "destructive" });
    },
  });

  // Phase 2: Confirm - actually change the password
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!pendingData) throw new Error("No pending password change");
      await authApi.confirmChangePassword({
        currentPassword: pendingData.currentPassword,
        newPassword: pendingData.newPassword,
        recoveryKey: pendingData.recoveryKey,
      });
    },
    onSuccess: () => {
      toast({ title: "Password changed", description: "Your password has been updated successfully. Make sure to keep your new recovery key safe!" });
      setStep('form');
      setPendingData(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Password change failed", description: error.message, variant: "destructive" });
    },
  });

  const handleCancel = () => {
    setStep('form');
    setPendingData(null);
    setCopied(false);
  };

  const copyRecoveryKey = async () => {
    if (pendingData?.recoveryKey) {
      await navigator.clipboard.writeText(pendingData.recoveryKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => prepareMutation.mutate(data))} className="space-y-4">
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('password.current')}</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('password.new')}</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('password.confirm')}</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button type="submit" disabled={prepareMutation.isPending}>
            {prepareMutation.isPending ? t('password.updating') : t('password.update')}
          </Button>
        </form>
      </Form>

      {/* Recovery Key Confirmation Modal */}
      <Dialog open={step === 'confirm'} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-500" />
              Save Your New Recovery Key
            </DialogTitle>
            <DialogDescription>
              Your password will be changed and a new recovery key will be generated.
              <span className="block mt-2 text-destructive font-medium">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                Your old recovery key will no longer work!
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg font-mono text-center text-lg tracking-wider break-all">
              {pendingData?.recoveryKey}
            </div>
            <Button onClick={copyRecoveryKey} className="w-full" variant="outline">
              {copied ? (
                <><Check className="mr-2 h-4 w-4" /> Copied!</>
              ) : (
                <><Copy className="mr-2 h-4 w-4" /> Copy to Clipboard</>
              )}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCancel}
                className="flex-1"
                disabled={confirmMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
                className="flex-1"
              >
                {confirmMutation.isPending ? "Saving..." : "I've Saved My Recovery Key"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Make sure you've written down or copied your recovery key before confirming.
              The password change will only happen after you click the button above.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


function ApiKeysCard({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const { t } = useTranslation('settings');
  const [showCoingecko, setShowCoingecko] = useState(false);
  // Track user edits separately - undefined means user hasn't edited yet
  const [editedCoingeckoKey, setEditedCoingeckoKey] = useState<string | undefined>(undefined);

  const { data: apiKeys } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => priceApi.getApiKeys(),
  });

  // Use edited value if user has made changes, otherwise use fetched value
  const coingeckoKey = editedCoingeckoKey ?? apiKeys?.coingecko ?? "";

  const saveApiKeysMutation = useMutation({
    mutationFn: async () => {
      await priceApi.setApiKeys({
        coingecko: coingeckoKey || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast({ title: t('apiKeys.saved'), description: t('apiKeys.savedDescription') });
    },
    onError: (error: Error) => {
      toast({ title: t('toast.updateFailed'), description: error.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('apiKeys.title')}</CardTitle>
        <CardDescription>
          {t('apiKeys.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* CoinGecko API Key - For crypto prices */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t('apiKeys.coingecko.label')}
            <a
              href="https://www.coingecko.com/en/api"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-primary text-xs hover:underline inline-flex items-center gap-1"
            >
              {t('apiKeys.coingecko.getDemoKey')} <ExternalLink className="h-3 w-3" />
            </a>
          </label>
          <div className="flex gap-2">
            <Input
              type={showCoingecko ? "text" : "password"}
              value={coingeckoKey}
              onChange={(e) => setEditedCoingeckoKey(e.target.value)}
              placeholder={t('apiKeys.coingecko.placeholder')}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowCoingecko(!showCoingecko)}
            >
              {showCoingecko ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('apiKeys.coingecko.hint')}</p>
        </div>

        <Button
          onClick={() => saveApiKeysMutation.mutate()}
          disabled={saveApiKeysMutation.isPending}
        >
          {saveApiKeysMutation.isPending ? t('apiKeys.saving') : t('apiKeys.save')}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const { language, setLanguage } = useLanguage();
  const { currencyCode, setCurrency } = useCurrency();
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      surname: user?.surname || "",
      email: user?.email || "",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<ProfileData & { currency?: string; language?: string; excludePersonalRealEstate?: boolean; menuPreferences?: MenuPreferences }>) => {
      await authApi.updateProfile(data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      // Invalidate portfolio metrics if excludePersonalRealEstate changed
      if (variables && 'excludePersonalRealEstate' in variables) {
        queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
        queryClient.invalidateQueries({ queryKey: ["portfolio-history"] });
      }
      toast({ title: "Profile updated", description: "Your profile details have been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });


  const updateMenuMutation = useMutation({
    mutationFn: async (menuPreferences: MenuPreferences) => {
      await authApi.updateProfile({ menuPreferences });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast({ title: "Preferences updated", description: "Menu visibility settings saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      await authApi.deleteAccount();
    },
    onSuccess: () => {
      window.location.reload();
    },
    onError: (error: Error) => {
      toast({ title: "Deletion failed", description: error.message, variant: "destructive" });
    },
  });

  const menuItems = [
    { key: "savings", label: t('menuItems.savings') },
    { key: "loans", label: t('menuItems.loans') },
    { key: "insurance", label: t('menuItems.insurance') },
    { key: "investments", label: t('menuItems.investments') },
    { key: "crypto", label: t('menuItems.crypto') },
    { key: "bonds", label: t('menuItems.bonds') },
    { key: "realEstate", label: t('menuItems.realEstate') },
    { key: "otherAssets", label: t('menuItems.otherAssets') },
  ];

  const handleMenuToggle = (key: string, checked: boolean) => {
    if (!user?.menuPreferences) return;
    const newPreferences = { ...user.menuPreferences, [key]: checked };
    updateMenuMutation.mutate(newPreferences);
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">{t('title')}</h2>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.title')}</CardTitle>
          <CardDescription>{t('profile.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => updateProfileMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('profile.name')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="surname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('profile.surname')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('profile.email')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? t('profile.saving') : t('profile.save')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>{t('password.title')}</CardTitle>
          <CardDescription>{t('password.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      {/* API Keys */}
      <ApiKeysCard toast={toast} />

      {/* Currency Settings */}

      <Card>
        <CardHeader>
          <CardTitle>{t('currency.title')}</CardTitle>
          <CardDescription>{t('currency.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={currencyCode}
            onValueChange={(value: string) => {
              setCurrency(value as CurrencyCode);
              updateProfileMutation.mutate({ currency: value });
            }}
            className="flex flex-col gap-2"
          >
            {currencies.map((c) => (
              <div key={c.code} className="flex items-center space-x-3 p-2 rounded hover:bg-accent cursor-pointer" onClick={() => {
                setCurrency(c.code as CurrencyCode);
                updateProfileMutation.mutate({ currency: c.code });
              }}>
                <RadioGroupItem value={c.code} id={c.code} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{c.label}</div>
                  <div className="text-xs text-muted-foreground">
                    Example: {c.position === "before" ? `${c.symbol}1,234.56` : `1,234.56 ${c.symbol}`}
                  </div>
                </div>
              </div>
            ))}
          </RadioGroup>
        </CardContent>

      </Card>

      {/* Language Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings:language.title')}</CardTitle>
          <CardDescription>{t('settings:language.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={language}
            onValueChange={(value: string) => {
              setLanguage(value as SupportedLanguage);
              updateProfileMutation.mutate({ language: value });
            }}
            className="flex flex-col gap-2"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <div key={lang} className="flex items-center space-x-3 p-2 rounded hover:bg-accent cursor-pointer" onClick={() => {
                setLanguage(lang);
                updateProfileMutation.mutate({ language: lang });
              }}>
                <RadioGroupItem value={lang} id={`lang-${lang}`} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{LANGUAGE_NAMES[lang].native}</div>
                  <div className="text-xs text-muted-foreground">{LANGUAGE_NAMES[lang].english}</div>
                </div>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Menu Visibility */}
      <Card>
        <CardHeader>
          <CardTitle>{t('menuVisibility.title')}</CardTitle>
          <CardDescription>{t('menuVisibility.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {menuItems.map((item) => (
              <div key={item.key} className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm font-medium">{item.label}</span>
                <Switch
                  checked={user?.menuPreferences?.[item.key as keyof typeof user.menuPreferences] ?? true}
                  onCheckedChange={(checked) => handleMenuToggle(item.key, checked)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboardPreferences.title')}</CardTitle>
          <CardDescription>{t('dashboardPreferences.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-2 border rounded">
            <div>
              <span className="text-sm font-medium">{t('dashboardPreferences.excludeRealEstate')}</span>
              <p className="text-xs text-muted-foreground">{t('dashboardPreferences.excludeRealEstateHint')}</p>
            </div>
            <Switch
              checked={user?.excludePersonalRealEstate ?? false}
              onCheckedChange={(checked) => {
                updateProfileMutation.mutate({ excludePersonalRealEstate: checked });
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">{t('dangerZone.title')}</CardTitle>
          <CardDescription>{t('dangerZone.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">{t('dangerZone.deleteAccount')}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('dangerZone.confirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('dangerZone.confirmDescription')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tc('buttons.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteAccountMutation.mutate()}
                >
                  {deleteAccountMutation.isPending ? t('dangerZone.deleting') : t('dangerZone.deleteAccount')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
