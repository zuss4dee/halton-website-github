import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ADMIN_INPUT_CLASS } from "@/components/admin/AdminBrutalist";
import { deleteWorkspace } from "@/lib/admin/deleteWorkspace";

type DeleteWorkspaceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  workspaceName: string;
};

export function DeleteWorkspaceDialog({
  open,
  onOpenChange,
  clientId,
  workspaceName,
}: DeleteWorkspaceDialogProps) {
  const navigate = useNavigate();
  const [confirmName, setConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedWorkspaceName = workspaceName.trim();
  const nameMatches = confirmName.trim() === trimmedWorkspaceName;
  const canConfirm = nameMatches && !isDeleting;

  useEffect(() => {
    if (!open) {
      setConfirmName("");
      setError(null);
      setIsDeleting(false);
    }
  }, [open]);

  const handleDelete = async () => {
    if (!canConfirm) return;

    setIsDeleting(true);
    setError(null);

    const result = await deleteWorkspace(clientId);

    if (!result.ok) {
      setError(result.error ?? "Deletion failed.");
      setIsDeleting(false);
      return;
    }

    onOpenChange(false);
    await navigate({ to: "/admin" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 rounded-none border border-hairline bg-paper p-0 text-ink shadow-none sm:rounded-none [&>button]:text-ink/50 [&>button]:hover:text-ink">
        <DialogHeader className="border-b border-hairline px-6 py-5 text-left">
          <p className="font-mono text-[10px] tracking-[0.28em] text-[#c03939] uppercase">
            Irreversible action
          </p>
          <DialogTitle className="mt-2 font-display text-2xl leading-[0.95] tracking-[-0.04em] text-ink uppercase">
            Delete workspace
          </DialogTitle>
          <DialogDescription className="mt-3 font-mono text-[11px] leading-relaxed tracking-[0.06em] text-ink-soft">
            This permanently removes{" "}
            <span className="text-ink">{trimmedWorkspaceName}</span> and all associated
            agents, campaigns, leads, credentials, and execution logs. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-6">
          <div>
            <label
              htmlFor="delete-workspace-confirm"
              className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-ink-soft uppercase"
            >
              Type{" "}
              <span className="text-ink">{trimmedWorkspaceName}</span> to confirm
            </label>
            <input
              id="delete-workspace-confirm"
              type="text"
              autoComplete="off"
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
              placeholder={trimmedWorkspaceName}
              className={ADMIN_INPUT_CLASS}
            />
          </div>

          {error ? (
            <p className="font-mono text-[11px] tracking-[0.06em] text-[#c03939]">{error}</p>
          ) : null}
        </div>

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
            onClick={() => void handleDelete()}
            disabled={!canConfirm}
            className="border border-[#c03939] px-5 py-3 font-mono text-[10px] tracking-[0.18em] uppercase text-[#c03939] transition-colors hover:bg-[#c03939] hover:text-paper disabled:cursor-not-allowed disabled:border-hairline disabled:text-ink/30 disabled:hover:bg-transparent"
          >
            {isDeleting ? "Deleting…" : "Delete workspace permanently"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
