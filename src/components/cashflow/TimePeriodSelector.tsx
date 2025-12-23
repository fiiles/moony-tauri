import { Button } from "@/components/ui/button";

const periods = ['30D', '90D', 'YTD', '1Y', '5Y', 'All'] as const;
export type Period = typeof periods[number];

interface TimePeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
}

export default function TimePeriodSelector({ value, onChange }: TimePeriodSelectorProps) {
  return (
    <div className="flex gap-1 p-1 bg-card border rounded-lg">
      {periods.map((period) => (
        <Button
          key={period}
          variant="ghost"
          size="sm"
          className={`h-8 px-3 ${value === period
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : ''
            }`}
          onClick={() => onChange(period)}
          data-testid={`button-period-${period.toLowerCase()}`}
        >
          {period}
        </Button>
      ))}
    </div>
  );
}
