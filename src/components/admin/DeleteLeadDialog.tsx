import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeleteLeadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName?: string;
  selectedCount?: number;
  onConfirm: () => Promise<void>;
};

export function DeleteLeadDialog({
  open,
  onOpenChange,
  leadName,
  selectedCount = 1,
  onConfirm,
}: DeleteLeadDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setIsDeleting(false);
      setError(null);
    }
  }, [open]);

  const handleConfirm = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      await onConfirm();
      onOpenChange(false);
    } catch (confirmError) {
      setError(
        confirmError instanceof Error ? confirmError.message : "Failed to delete lead.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const isBatch = selectedCount > 1;
  const displayName = leadName?.trim() || "this lead";
  const description = isBatch
    ? `Are you sure you want to delete ${selectedCount.toLocaleString()} leads? This action cannot be undone.`
    : `Are you sure you want to delete ${displayName}? This action cannot be undone.`;

  return (
    <Dialog open={open} onOpenChange={(next) => !isDeleting && onOpenChange(next)}>
      <DialogContent className="max-w-md gap-0 rounded-none border border-hairline bg-paper p-0 text-ink shadow-none sm:rounded-none [&>button]:text-ink/50 [&>button]:hover:text-ink">
        <DialogHeader className="border-b border-hairline px-6 py-5 text-left">
          <DialogTitle className="font-display text-2xl leading-[0.95] tracking-[-0.04em] text-ink uppercase">
            {isBatch ? "Delete Leads" : "Delete Lead"}
          </DialogTitle>
          <DialogDescription className="mt-3 font-mono text-[11px] leading-relaxed tracking-[0.06em] text-ink-soft">
            {description}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="px-6 pt-4 font-mono text-[11px] tracking-[0.06em] text-[#c03939]">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-hairline px-6 py-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="border border-hairline px-5 py-3 font-mono text-[10px] tracking-[0.18em] uppercase text-ink transition-colors hover:bg-ink/[0.04] disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isDeleting}
            className="inline-flex items-center justify-center gap-2 border border-[#c03939] px-5 py-3 font-mono text-[10px] tracking-[0.18em] uppercase text-[#c03939] transition-colors hover:bg-[#c03939] hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Deleting…
              </>
            ) : isBatch ? (
              `Delete ${selectedCount.toLocaleString()} leads`
            ) : (
              "Delete lead"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
