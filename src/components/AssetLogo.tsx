
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInstrumentIcon } from "@/utils/investments";
import { cn } from "@/lib/utils";

interface AssetLogoProps {
    ticker: string;
    type: "stock" | "crypto";
    className?: string;
}

export function AssetLogo({ ticker, type, className }: AssetLogoProps) {
    const logoUrl =
        type === "stock"
            ? `https://financialmodelingprep.com/image-stock/${ticker}.png`
            : `https://assets.coincap.io/assets/icons/${ticker.toLowerCase()}@2x.png`;

    const fallbackBg =
        type === "stock"
            ? getInstrumentIcon(ticker)
            : "bg-orange-100 text-orange-600";

    const initials =
        type === "stock" ? ticker.substring(0, 2) : ticker.substring(0, 3);

    return (
        <Avatar className={cn("h-10 w-10 bg-white", className)}>
            <AvatarImage src={logoUrl} alt={ticker} className="object-contain p-1" />
            <AvatarFallback
                className={cn(
                    "font-bold text-sm",
                    fallbackBg,
                    type === "stock" && "text-white"
                )}
            >
                {initials}
            </AvatarFallback>
        </Avatar>
    );
}
