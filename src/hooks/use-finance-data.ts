import { useQuery } from "@tanstack/react-query";
import { Instrument, Purchase, SavingsAccount, Bond } from "@shared/schema";

export function useInstruments() {
    return useQuery<Instrument[]>({
        queryKey: ["/api/instruments"],
    });
}

export function usePurchases() {
    return useQuery<Purchase[]>({
        queryKey: ["/api/purchases"],
    });
}

export function useSavingsAccounts() {
    return useQuery<SavingsAccount[]>({
        queryKey: ["/api/savings-accounts"],
    });
}

export function useBonds() {
    return useQuery<Bond[]>({
        queryKey: ["/api/bonds"],
    });
}

export function useNetWorthHistory() {
    return useQuery<{ date: string; value: number }[]>({
        queryKey: ["/api/history/net-worth"],
    });
}
