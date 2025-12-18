/**
 * Auth Page - Single User Version
 * Supports setup, unlock, and recover flows
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
import { ShieldCheck, Copy, Check } from "lucide-react";

export default function AuthPage() {
    const { user, appStatus, setupMutation, unlockMutation, recoverMutation, confirmSetupMutation, confirmRecoveryMutation, recoveryKey, clearRecoveryKey } = useAuth();
    const [, setLocation] = useLocation();
    const [activeTab, setActiveTab] = useState<"unlock" | "recover">("unlock");
    const [copied, setCopied] = useState(false);

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
                <div className="flex items-center justify-center p-8 bg-background min-h-screen">
                    <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
                        <CardHeader className="space-y-1">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-6 w-6 text-primary" />
                                <CardTitle className="text-2xl font-bold">Welcome to Moony</CardTitle>
                            </div>
                            <CardDescription>
                                Set up your personal finance manager. Your data will be encrypted with your password.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...setupForm}>
                                <form
                                    onSubmit={setupForm.handleSubmit((data) => setupMutation.mutate(data))}
                                    className="space-y-4"
                                >
                                    <FormField
                                        control={setupForm.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>First Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="John" {...field} />
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
                                                <FormLabel>Last Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Doe" {...field} />
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
                                                <FormLabel>Email (optional)</FormLabel>
                                                <FormControl>
                                                    <Input type="email" placeholder="john@example.com" {...field} />
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
                                                <FormLabel>Password (for encryption)</FormLabel>
                                                <FormControl>
                                                    <Input type="password" placeholder="Minimum 8 characters" {...field} />
                                                </FormControl>
                                                <p className="text-[0.8rem] text-muted-foreground">
                                                    This password will encrypt your database.
                                                </p>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={setupForm.control}
                                        name="confirmPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Confirm Password</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} />
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
                                        {setupMutation.isPending ? "Setting up..." : "Set Up Moony"}
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
                                Save Your Recovery Key
                            </DialogTitle>
                            <DialogDescription>
                                This is the only way to recover your account if you forget your password.
                                Store it in a safe place!
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="p-4 bg-muted rounded-lg font-mono text-center text-lg tracking-wider break-all">
                                {recoveryKey}
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
                                    onClick={clearRecoveryKey}
                                    className="flex-1"
                                    disabled={confirmSetupMutation.isPending}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => {
                                        confirmSetupMutation.mutate(undefined, { onSuccess: () => clearRecoveryKey() });
                                    }}
                                    disabled={confirmSetupMutation.isPending}
                                    className="flex-1"
                                >
                                    {confirmSetupMutation.isPending ? "Creating Account..." : "I've Saved My Recovery Key"}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground text-center">
                                Your account will only be created after you click the button above.
                                If you cancel, no data will be saved.
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
            <div className="flex items-center justify-center p-8 bg-background min-h-screen">
                <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
                    <CardHeader className="space-y-1">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-6 w-6 text-primary" />
                            <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
                        </div>
                        <CardDescription>
                            Unlock your encrypted data with your password
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-4">
                                <TabsTrigger value="unlock">Unlock</TabsTrigger>
                                <TabsTrigger value="recover">Recover</TabsTrigger>
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
                                                    <FormLabel>Password</FormLabel>
                                                    <FormControl>
                                                        <Input type="password" {...field} />
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
                                            {unlockMutation.isPending ? "Unlocking..." : "Unlock"}
                                        </Button>
                                        <div className="text-center">
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab("recover")}
                                                className="text-sm text-muted-foreground hover:text-primary hover:underline"
                                            >
                                                Forgot password? Use recovery key
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
                                                    <FormLabel>Recovery Key</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" {...field} />
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
                                                    <FormLabel>New Password</FormLabel>
                                                    <FormControl>
                                                        <Input type="password" {...field} />
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
                                                    <FormLabel>Confirm New Password</FormLabel>
                                                    <FormControl>
                                                        <Input type="password" {...field} />
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
                                            {recoverMutation.isPending ? "Recovering..." : "Reset Password"}
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
                            New Recovery Key Generated
                        </DialogTitle>
                        <DialogDescription>
                            Save your new recovery key before confirming. Your password will be changed and your old recovery key will no longer work.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="p-4 bg-muted rounded-lg font-mono text-center text-lg tracking-wider break-all">
                            {recoveryKey}
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
                                onClick={clearRecoveryKey}
                                className="flex-1"
                                disabled={confirmRecoveryMutation.isPending}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => {
                                    confirmRecoveryMutation.mutate(undefined, { onSuccess: () => clearRecoveryKey() });
                                }}
                                disabled={confirmRecoveryMutation.isPending}
                                className="flex-1"
                            >
                                {confirmRecoveryMutation.isPending ? "Changing Password..." : "I've Saved My Recovery Key"}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                            Your password will only be changed after you click the button above.
                            If you cancel, your old password and recovery key will remain unchanged.
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
