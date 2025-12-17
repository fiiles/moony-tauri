import { useQuery } from "@tanstack/react-query";
import { loansApi } from "@/lib/tauri-api";
import { convertToCzK, type CurrencyCode } from "@shared/currencies";

export function useLoans() {
    const { data: loans = [], isLoading } = useQuery({
        queryKey: ["loans"],
        queryFn: () => loansApi.getAll(),
    });

    // Calculate metrics in CZK
    const totalPrincipal = loans.reduce(
        (sum, loan: any) => {
            const principal = parseFloat(loan.principal || "0");
            const currency = loan.currency || "CZK";
            return sum + convertToCzK(principal, currency as CurrencyCode);
        },
        0
    );

    const totalMonthlyPayment = loans.reduce(
        (sum, loan: any) => {
            const payment = parseFloat(loan.monthlyPayment || "0");
            const currency = loan.currency || "CZK";
            return sum + convertToCzK(payment, currency as CurrencyCode);
        },
        0
    );

    const averageInterestRate = loans.length > 0
        ? loans.reduce((sum, loan: any) => sum + parseFloat(loan.interestRate || "0"), 0) / loans.length
        : 0;

    return {
        loans,
        isLoading,
        metrics: {
            totalPrincipal,
            totalMonthlyPayment,
            averageInterestRate,
            count: loans.length,
        },
    };
}
