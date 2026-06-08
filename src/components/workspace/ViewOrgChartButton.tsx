import { useState } from "react";
import { OrgChartDialog } from "@/components/workspace/OrgChartDialog";
import { cn } from "@/lib/utils";

type ViewOrgChartButtonProps = {
  clientId: string;
  className?: string;
  variant?: "brutalist" | "neutral" | "sidebar";
  label?: string;
};

const variantClassName = {
  brutalist:
    "shrink-0 border border-hairline bg-transparent px-4 py-2 text-ink hover:border-ink hover:bg-ink/[0.03]",
  neutral:
    "shrink-0 border border-gray-300 bg-transparent px-4 py-2 text-gray-700 hover:border-gray-900 hover:bg-gray-50",
  sidebar:
    "block w-full px-3 py-2.5 text-left text-ink-soft hover:bg-ink/[0.06] hover:text-ink data-[active=true]:bg-ink data-[active=true]:text-paper",
} as const;

export function ViewOrgChartButton({
  clientId,
  className,
  variant = "brutalist",
  label = "View Org Chart",
}: ViewOrgChartButtonProps) {
  const [open, setOpen] = useState(false);

  if (!clientId.trim()) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-active={variant === "sidebar" && open ? true : undefined}
        aria-expanded={variant === "sidebar" ? open : undefined}
        className={cn(
          "font-mono text-[10px] tracking-[0.18em] uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
          variantClassName[variant],
          className,
        )}
      >
        {label}
      </button>
      {open ? (
        <OrgChartDialog clientId={clientId} open={open} onOpenChange={setOpen} />
      ) : null}
    </>
  );
}
