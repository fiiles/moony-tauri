import { Separator } from "@/components/ui/separator";

interface FormSectionProps {
  title: string;
  children: React.ReactNode;
  /** Pass true for the first section — omits the leading separator */
  first?: boolean;
}

export function FormSection({ title, children, first = false }: FormSectionProps) {
  return (
    <div className="space-y-4">
      {!first && <Separator />}
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {children}
    </div>
  );
}
