/**
 * Auth Hook - Tauri Version
 * Supports setup, unlock, lock flows using Tauri invoke
 */
import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { authApi } from "../lib/tauri-api";
import { queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AppStatus = "needs_setup" | "locked" | "unlocked";

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
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const { toast } = useToast();
    const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
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

    // Setup mutation (first-time use)
    const setupMutation = useMutation({
        mutationFn: async (data: { name: string; surname: string; email?: string; password: string }) => {
            const result = await authApi.setup({
                ...data,
                email: data.email || "",
            });
            return result;
        },
        onSuccess: (result: { recoveryKey: string; profile: any }) => {
            queryClient.setQueryData(["user-profile"], result.profile);
            setAppStatus("unlocked");
            setRecoveryKey(result.recoveryKey);
            toast({
                title: "Setup complete!",
                description: "Please save your recovery key safely.",
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

    // Recover mutation (reset password using recovery key)
    const recoverMutation = useMutation({
        mutationFn: async (data: { recoveryKey: string; newPassword: string }) => {
            const result = await authApi.recover(data);
            return result;
        },
        onSuccess: (result: { recoveryKey: string; profile: any }) => {
            queryClient.setQueryData(["user-profile"], result.profile);
            setAppStatus("unlocked");
            setRecoveryKey(result.recoveryKey); // New recovery key
            toast({
                title: "Password reset successful!",
                description: "Please save your new recovery key safely.",
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

    // Confirm setup mutation (used after showing recovery key)
    const confirmSetupMutation = useMutation({
        mutationFn: async () => {
            // Just acknowledge the recovery key was saved
            return true;
        },
        onSuccess: () => {
            // Clear recovery key after confirmation
        },
    });

    // Confirm recovery mutation
    const confirmRecoveryMutation = useMutation({
        mutationFn: async () => {
            return true;
        },
        onSuccess: () => {
            // Clear recovery key after confirmation
        },
    });

    const clearRecoveryKey = () => setRecoveryKey(null);

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
