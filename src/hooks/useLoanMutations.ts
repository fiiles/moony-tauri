import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { loansApi } from "@/lib/tauri-api";
import { useToast } from "@/hooks/use-toast";

export function useLoanMutations() {
    const { toast } = useToast();

    const createMutation = useMutation({
        mutationFn: (data: any) => loansApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["loans"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            toast({ title: "Loan created" });
        },
        onError: (error: Error) => {
            toast({ title: "Failed to create loan", description: error.message, variant: "destructive" });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }: { id: string;[key: string]: any }) => {
            return loansApi.update(id, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["loans"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            toast({ title: "Loan updated" });
        },
        onError: (error: Error) => {
            toast({ title: "Failed to update loan", description: error.message, variant: "destructive" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => loansApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["loans"] });
            queryClient.invalidateQueries({ queryKey: ["portfolio-metrics"] });
            toast({ title: "Loan deleted" });
        },
        onError: (error: Error) => {
            toast({ title: "Failed to delete loan", description: error.message, variant: "destructive" });
        },
    });

    return {
        createMutation,
        updateMutation,
        deleteMutation,
    };
}
