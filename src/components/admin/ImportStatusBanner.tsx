import { CheckCircle2, Loader2, XCircle } from "lucide-react";

export type BulkImportStatus = {
  phase: "processing" | "done" | "error";
  current: number;
  total: number;
  fileName: string | null;
  succeeded?: number;
  failed?: number;
  errors?: Array<{ email: string; message: string }>;
  errorMessage?: string;
};

type ImportStatusBannerProps = {
  status: BulkImportStatus;
  onDismiss?: () => void;
  className?: string;
};

export function ImportStatusBanner({ status, onDismiss, className = "" }: ImportStatusBannerProps) {
  const isProcessing = status.phase === "processing";
  const isSuccess = status.phase === "done" && (status.failed ?? 0) === 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-lg border px-4 py-4 shadow-sm ${className} ${
        isProcessing
          ? "border-amber-300 bg-amber-50"
          : isSuccess
            ? "border-emerald-300 bg-emerald-50"
            : "border-red-300 bg-red-50"
      }`}
    >
      {isProcessing ? (
        <div className="flex items-start gap-3">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-amber-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-amber-950">
              Importing {status.current}/{status.total} leads
              {status.fileName ? ` · ${status.fileName}` : ""}
            </p>
            <p className="mt-1 text-sm text-amber-900/85">
              Research and drafts are generating one at a time. New rows appear in Pending Approval
              below — this banner stays until the full batch finishes.
            </p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-amber-200/90">
              <div
                className="h-full rounded-full bg-amber-600 transition-all duration-300"
                style={{
                  width:
                    status.total > 0
                      ? `${Math.max(4, Math.round((status.current / status.total) * 100))}%`
                      : "4%",
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {status.phase === "done" ? (
        <div className="flex items-start gap-3">
          {isSuccess ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
          ) : (
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p
              className={`text-base font-semibold ${
                isSuccess ? "text-emerald-950" : "text-red-950"
              }`}
            >
              {isSuccess
                ? `Imported ${status.succeeded ?? 0}/${status.total} leads into Pending Approval`
                : `Imported ${status.succeeded ?? 0}/${status.total} leads · ${status.failed ?? 0} failed`}
            </p>
            <p
              className={`mt-1 text-sm ${
                isSuccess ? "text-emerald-900/85" : "text-red-900/85"
              }`}
            >
              {isSuccess
                ? "All drafts are ready for review in Pending Approval."
                : "Successful rows are in Pending Approval. Fix failed rows and re-import if needed."}
            </p>
            {status.errors && status.errors.length > 0 ? (
              <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto text-xs text-red-800">
                {status.errors.slice(0, 8).map((entry) => (
                  <li key={entry.email}>
                    {entry.email}: {entry.message}
                  </li>
                ))}
                {status.errors.length > 8 ? (
                  <li>…and {status.errors.length - 8} more</li>
                ) : null}
              </ul>
            ) : null}
            {onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                className="mt-3 text-sm font-medium text-gray-600 underline-offset-2 hover:underline"
              >
                Dismiss
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {status.phase === "error" ? (
        <div className="flex items-start gap-3">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-red-950">Import failed</p>
            <p className="mt-1 text-sm text-red-900/85">{status.errorMessage ?? "Unknown error"}</p>
            {onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                className="mt-3 text-sm font-medium text-gray-600 underline-offset-2 hover:underline"
              >
                Dismiss
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
