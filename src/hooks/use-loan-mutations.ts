import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { loansApi } from "@/lib/tauri-api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { translateApiError } from "@/lib/translate-api-error";
import type { InsertLoan } from "@shared/schema";

export function useLoanMutations() {
    const { t } = useTranslation('common');

    const createMutation = useMutation({
        mutationFn: (data: InsertLoan) => loansApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["loans"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            toast(t('status.success'));
        },
        onError: (error: Error) => {
            toast.error(t('status.error'), { description: translateApiError(error, t) });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }: { id: string } & Partial<InsertLoan>) => {
            return loansApi.update(id, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["loans"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            toast(t('status.success'));
        },
        onError: (error: Error) => {
            toast.error(t('status.error'), { description: translateApiError(error, t) });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => loansApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["loans"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            toast(t('status.success'));
        },
        onError: (error: Error) => {
            toast.error(t('status.error'), { description: translateApiError(error, t) });
        },
    });

    return {
        createMutation,
        updateMutation,
        deleteMutation,
    };
}

