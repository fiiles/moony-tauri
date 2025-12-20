import { Card } from "@/components/ui/card";
import { ReactNode } from "react";

interface SummaryCardProps {
    title: string;
    value: string | number;
    icon?: ReactNode;
    subtitle?: string;
    valueClassName?: string;
    className?: string;
    formatter?: (val: number) => string;
}

export function SummaryCard({ title, value, icon, subtitle, valueClassName = "", className = "", formatter }: SummaryCardProps) {
    const displayValue = typeof value === 'number' && formatter ? formatter(value) : value;

    return (
        <Card className="p-6 border shadow-sm card-hover">
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    {icon && (
                        <div className="icon-container">
                            {icon}
                        </div>
                    )}
                </div>
                <p className={`text-2xl font-bold tracking-tight data-value ${valueClassName} ${className}`}>
                    {displayValue}
                </p>
                {subtitle && (
                    <p className="text-xs text-muted-foreground">{subtitle}</p>
                )}
            </div>
        </Card>
    );
}

