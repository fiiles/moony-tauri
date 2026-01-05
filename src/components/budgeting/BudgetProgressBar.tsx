import { cn } from "@/lib/utils";

interface BudgetProgressBarProps {
  spent: number;
  budget: number;
  showLabels?: boolean;
  className?: string;
}

/**
 * Visual progress bar showing budget utilization
 * - Green (0-80%): On track
 * - Yellow (80-100%): Approaching limit
 * - Red (>100%): Over budget
 */
export default function BudgetProgressBar({
  spent,
  budget,
  showLabels = true,
  className,
}: BudgetProgressBarProps) {
  const percentage = budget > 0 ? (spent / budget) * 100 : 0;
  const cappedPercentage = Math.min(percentage, 100);
  
  // Determine color based on percentage
  const getBarColor = () => {
    if (percentage > 100) return "bg-red-500";
    if (percentage > 80) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getTextColor = () => {
    if (percentage > 100) return "text-red-600 dark:text-red-400";
    if (percentage > 80) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Progress bar container */}
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            getBarColor()
          )}
          style={{ width: `${cappedPercentage}%` }}
        />
      </div>
      
      {/* Labels */}
      {showLabels && (
        <div className="flex justify-between mt-1 text-xs">
          <span className={cn("font-medium", getTextColor())}>
            {percentage.toFixed(0)}%
          </span>
          {percentage > 100 && (
            <span className="text-red-600 dark:text-red-400 font-medium">
              Over by {(percentage - 100).toFixed(0)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
