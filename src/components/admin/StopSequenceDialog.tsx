import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type StopSequenceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName?: string | null;
  onConfirm: () => Promise<void>;
};

export function StopSequenceDialog({
  open,
  onOpenChange,
  clientName,
  onConfirm,
}: StopSequenceDialogProps) {
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setIsStopping(false);
      setError(null);
    }
  }, [open]);

  const handleConfirm = async () => {
    setIsStopping(true);
    setError(null);

    try {
      await onConfirm();
      onOpenChange(false);
    } catch (confirmError) {
      setError(
        confirmError instanceof Error ? confirmError.message : "Failed to stop sequence.",
      );
    } finally {
      setIsStopping(false);
    }
  };

  const label = clientName?.trim() || "this workspace";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 rounded-none border border-hairline bg-paper p-0 text-ink shadow-none sm:rounded-none [&>button]:text-ink/50 [&>button]:hover:text-ink">
        <DialogHeader className="border-b border-hairline px-6 py-5 text-left">
          <p className="font-mono text-[10px] tracking-[0.28em] text-[#c03939] uppercase">
            Irreversible action
          </p>
          <DialogTitle className="mt-2 font-display text-2xl leading-[0.95] tracking-[-0.04em] text-ink uppercase">
            Stop sequence
          </DialogTitle>
          <DialogDescription className="mt-3 font-mono text-[11px] leading-relaxed tracking-[0.06em] text-ink-soft">
            This permanently halts the automated sequence for {label}. Active leads in the
            sequence will not receive further emails. You cannot resume after stopping — only
            rebuild and relaunch a new sequence.
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
            disabled={isStopping}
            className="border border-hairline px-5 py-3 font-mono text-[10px] tracking-[0.18em] uppercase text-ink transition-colors hover:bg-ink/[0.04] disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isStopping}
            className="border border-[#c03939] px-5 py-3 font-mono text-[10px] tracking-[0.18em] uppercase text-[#c03939] transition-colors hover:bg-[#c03939] hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isStopping ? "Stopping…" : "Stop sequence permanently"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
