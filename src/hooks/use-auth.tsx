/**
 * Auth Hook - Tauri Version
 * Supports 2-phase setup, unlock, lock, and recovery flows using Tauri invoke
 * 
 * 2-Phase Flows:
 * - Setup: prepareSetup() → show recovery key → confirmSetup() → account created
 * - Recovery: prepareRecover() → show new recovery key → confirmRecover() → password changed
 */
import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { authApi } from "../lib/tauri-api";
import { queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AppStatus = "needs_setup" | "locked" | "unlocked";

// Pending setup data (stored between prepare and confirm phases)
interface PendingSetup {
    name: string;
    surname: string;
    email: string;
    password: string;
    masterKeyHex: string;
    recoveryKey: string;
    salt: number[];
    language?: string;
}

// Pending recovery data (stored between prepare and confirm phases)
interface PendingRecover {
    oldRecoveryKey: string;
    newPassword: string;
    newRecoveryKey: string;
}

type AuthContextType = {
    user: any | null;
    appStatus: AppStatus;
    isLoading: boolean;
    error: Error | null;
    setupMutation: any;
    unlockMutation: any;
    lockMutation: any;
    recoverMutation: any;
    confirmSetupMutation: any;
    confirmRecoveryMutation: any;
    recoveryKey: string | null;
    clearRecoveryKey: () => void;
    pendingSetup: PendingSetup | null;
    pendingRecover: PendingRecover | null;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const { toast } = useToast();
    const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
    const [pendingSetup, setPendingSetup] = useState<PendingSetup | null>(null);
    const [pendingRecover, setPendingRecover] = useState<PendingRecover | null>(null);
    const [appStatus, setAppStatus] = useState<AppStatus>("locked");
    const [isCheckingStatus, setIsCheckingStatus] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Fetch user profile automatically when unlocked
    const { data: user = null, isLoading: isProfileLoading } = useQuery({
        queryKey: ["user-profile"],
        queryFn: () => authApi.getProfile(),
        enabled: appStatus === "unlocked",
        staleTime: Infinity, // Keep data fresh unless invalidated
    });

    const isLoading = isCheckingStatus || (appStatus === "unlocked" && isProfileLoading && !user);

    // Check initial app status
    useEffect(() => {
        const checkStatus = async () => {
            try {
                setIsCheckingStatus(true);
                const hasSetup = await authApi.checkSetup();

                if (!hasSetup) {
                    setAppStatus("needs_setup");
                } else {
                    // Check if authenticated
                    const isAuth = await authApi.isAuthenticated();
                    if (isAuth) {
                        setAppStatus("unlocked");
                    } else {
                        setAppStatus("locked");
                    }
                }
            } catch (err) {
                console.error("Failed to check app status:", err);
                setAppStatus("locked");
            } finally {
                setIsCheckingStatus(false);
            }
        };

        checkStatus();
    }, []);

    // Phase 1: Prepare setup - generates keys, shows recovery key, but doesn't create account
    const setupMutation = useMutation({
        mutationFn: async (data: { name: string; surname: string; email?: string; password: string; language?: string }) => {
            // Call prepare_setup to get keys
            const prepared = await authApi.prepareSetup();
            return {
                ...data,
                email: data.email || "",
                ...prepared,
            };
        },
        onSuccess: (result) => {
            // Store pending setup data
            setPendingSetup({
                name: result.name,
                surname: result.surname,
                email: result.email,
                password: result.password,
                masterKeyHex: result.masterKeyHex,
                recoveryKey: result.recoveryKey,
                salt: result.salt,
                language: result.language,
            });
            // Show recovery key modal
            setRecoveryKey(result.recoveryKey);
            toast({
                title: "Almost done!",
                description: "Please save your recovery key before continuing.",
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Setup failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Phase 2: Confirm setup - actually creates the account
    const confirmSetupMutation = useMutation({
        mutationFn: async () => {
            if (!pendingSetup) {
                throw new Error("No pending setup to confirm");
            }
            // Now actually create the account
            const profile = await authApi.confirmSetup(pendingSetup);
            return profile;
        },
        onSuccess: (profile) => {
            queryClient.setQueryData(["user-profile"], profile);
            setAppStatus("unlocked");
            setPendingSetup(null);
            // Recovery key will be cleared by auth-page when user dismisses modal
            toast({
                title: "Setup complete!",
                description: "Your account has been created successfully.",
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Setup failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Unlock mutation (login with password)
    const unlockMutation = useMutation({
        mutationFn: async (data: { password: string }) => {
            const profile = await authApi.unlock(data.password);
            return profile;
        },
        onSuccess: (profile: any) => {
            queryClient.setQueryData(["user-profile"], profile);
            setAppStatus("unlocked");
        },
        onError: (error: Error) => {
            toast({
                title: "Unlock failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Lock mutation (logout)
    const lockMutation = useMutation({
        mutationFn: async () => {
            await authApi.logout();
        },
        onSuccess: () => {
            queryClient.clear();
            setAppStatus("locked");
        },
        onError: (error: Error) => {
            toast({
                title: "Lock failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Phase 1: Prepare recovery - verifies old recovery key, generates new one
    const recoverMutation = useMutation({
        mutationFn: async (data: { recoveryKey: string; newPassword: string }) => {
            // Call prepare_recover to verify and get new recovery key
            const result = await authApi.prepareRecover(data);
            return { ...data, newRecoveryKey: result.recoveryKey };
        },
        onSuccess: (result) => {
            // Store pending recovery data
            setPendingRecover({
                oldRecoveryKey: result.recoveryKey,
                newPassword: result.newPassword,
                newRecoveryKey: result.newRecoveryKey,
            });
            // Show new recovery key modal
            setRecoveryKey(result.newRecoveryKey);
            toast({
                title: "Recovery key verified!",
                description: "Please save your new recovery key before continuing.",
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Recovery failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Phase 2: Confirm recovery - actually changes password and recovery key
    const confirmRecoveryMutation = useMutation({
        mutationFn: async () => {
            if (!pendingRecover) {
                throw new Error("No pending recovery to confirm");
            }
            // Now actually change the password
            const profile = await authApi.confirmRecover(pendingRecover);
            return profile;
        },
        onSuccess: (profile) => {
            queryClient.setQueryData(["user-profile"], profile);
            setAppStatus("unlocked");
            setPendingRecover(null);
            // Recovery key will be cleared by auth-page
            toast({
                title: "Password reset successful!",
                description: "Your password has been changed.",
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Recovery failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const clearRecoveryKey = () => {
        setRecoveryKey(null);
        // If user cancels during setup before confirming, clear pending setup
        if (pendingSetup && appStatus === "needs_setup") {
            setPendingSetup(null);
        }
        // If user cancels during recovery before confirming, clear pending recover
        if (pendingRecover && appStatus === "locked") {
            setPendingRecover(null);
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                appStatus,
                isLoading,
                error,
                setupMutation,
                unlockMutation,
                lockMutation,
                recoverMutation,
                confirmSetupMutation,
                confirmRecoveryMutation,
                recoveryKey,
                clearRecoveryKey,
                pendingSetup,
                pendingRecover,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
