import { cn } from "@/lib/utils";

type AttentionDotProps = {
  className?: string;
};

/** Minimal notification marker for nav items that need review. */
export function AttentionDot({ className }: AttentionDotProps) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#e04545] shadow-[0_0_0_1px_rgba(224,69,69,0.35)]",
        className,
      )}
      aria-hidden
    />
  );
}
