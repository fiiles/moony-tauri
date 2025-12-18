import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const viewTypes = ['monthly', 'yearly'] as const;
export type CashflowViewType = typeof viewTypes[number];

interface CashflowViewSelectorProps {
    value: CashflowViewType;
    onChange: (viewType: CashflowViewType) => void;
}

export default function CashflowViewSelector({ value, onChange }: CashflowViewSelectorProps) {
    const { t } = useTranslation('reports');

    return (
        <div className="flex gap-1 p-1 bg-card border rounded-lg">
            {viewTypes.map((viewType) => (
                <Button
                    key={viewType}
                    variant="ghost"
                    size="sm"
                    className={`h-8 px-4 ${value === viewType
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : ''
                        }`}
                    onClick={() => onChange(viewType)}
                    data-testid={`button-view-${viewType}`}
                >
                    {t(`viewType.${viewType}`)}
                </Button>
            ))}
        </div>
    );
}
