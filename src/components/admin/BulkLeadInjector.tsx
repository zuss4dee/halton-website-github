import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { BulkImportStatus } from "@/components/admin/ImportStatusBanner";
import { DeleteLeadDialog } from "@/components/admin/DeleteLeadDialog";
import {
  clearPendingApprovalQueue,
  countPendingApprovalQueue,
} from "@/lib/admin/clearApprovalQueue";
import { parseBulkLeadCsv, type BulkLeadRow } from "@/lib/admin/bulkLeadCsv";
import {
  fetchActiveWorkflowGraph,
  invokeOutboundForLead,
} from "@/lib/admin/bulkWorkflowRun";

type BulkLeadInjectorProps = {
  clientId: string;
  onImportStatusChange?: (status: BulkImportStatus | null) => void;
  onProcessingComplete?: () => void;
  onQueueCleared?: () => void;
};

type ProcessSummary = {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ email: string; message: string }>;
};

export function BulkLeadInjector({
  clientId,
  onImportStatusChange,
  onProcessingComplete,
  onQueueCleared,
}: BulkLeadInjectorProps) {
  const [parsedLeads, setParsedLeads] = useState<BulkLeadRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<ProcessSummary | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [isClearing, setIsClearing] = useState(false);
  const lastQueueRefreshRef = useRef(0);

  const workspaceClientId = clientId.trim();
  const [pasteText, setPasteText] = useState("");

  const publishImportStatus = useCallback(
    (status: BulkImportStatus | null) => {
      onImportStatusChange?.(status);
    },
    [onImportStatusChange],
  );

  const maybeRefreshQueue = useCallback(() => {
    const now = Date.now();
    if (now - lastQueueRefreshRef.current < 2500) return;
    lastQueueRefreshRef.current = now;
    onProcessingComplete?.();
  }, [onProcessingComplete]);

  const ingestCsvText = useCallback(
    (text: string, sourceLabel: string) => {
      if (isProcessing) return;

      setParseError(null);
      setSummary(null);
      publishImportStatus(null);

      try {
        const leads = parseBulkLeadCsv(text);
        if (leads.length === 0) {
          setParseError("No valid rows found. Include a header row and at least one email.");
          setParsedLeads([]);
          setFileName(null);
          return;
        }
        setParsedLeads(leads);
        setFileName(sourceLabel);
      } catch (error) {
        setParseError(error instanceof Error ? error.message : "Failed to parse CSV.");
        setParsedLeads([]);
        setFileName(null);
      }
    },
    [isProcessing, publishImportStatus],
  );

  const ingestFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        setParseError("Only .csv files are supported.");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === "string" ? reader.result : "";
        ingestCsvText(text, file.name);
      };
      reader.onerror = () => {
        setParseError("Could not read file.");
      };
      reader.readAsText(file);
    },
    [ingestCsvText],
  );

  const handleParsePaste = () => {
    if (!pasteText.trim()) {
      setParseError("Paste CSV text first.");
      return;
    }
    ingestCsvText(pasteText, "pasted.csv");
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) ingestFile(file);
    event.target.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (isProcessing) return;
    const file = event.dataTransfer.files?.[0];
    if (file) ingestFile(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (!isProcessing) setIsDragging(true);
  };

  const handleProcessLeads = async () => {
    if (!workspaceClientId || parsedLeads.length === 0 || isProcessing) return;

    const total = parsedLeads.length;
    const activeFileName = fileName;

    setIsProcessing(true);
    setSummary(null);
    setParseError(null);
    lastQueueRefreshRef.current = 0;

    publishImportStatus({
      phase: "processing",
      current: 0,
      total,
      fileName: activeFileName,
    });

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    try {
      const graph = await fetchActiveWorkflowGraph(workspaceClientId);
      if (!graph) {
        const message =
          "No active workflow found. Save and activate a SOP in the Workflow Builder first.";
        setParseError(message);
        publishImportStatus({
          phase: "error",
          current: 0,
          total,
          fileName: activeFileName,
          errorMessage: message,
        });
        return;
      }

      const errors: ProcessSummary["errors"] = [];
      let succeeded = 0;

      for (let index = 0; index < parsedLeads.length; index++) {
        const lead = parsedLeads[index];
        const current = index + 1;

        publishImportStatus({
          phase: "processing",
          current,
          total,
          fileName: activeFileName,
        });

        const result = await invokeOutboundForLead(workspaceClientId, lead, graph);
        if (result.success) {
          succeeded += 1;
          maybeRefreshQueue();
        } else {
          errors.push({
            email: lead.email,
            message: result.error ?? "Unknown error",
          });
        }
      }

      const nextSummary = {
        total: parsedLeads.length,
        succeeded,
        failed: parsedLeads.length - succeeded,
        errors,
      };

      setSummary(nextSummary);
      publishImportStatus({
        phase: "done",
        current: total,
        total,
        fileName: activeFileName,
        succeeded,
        failed: nextSummary.failed,
        errors,
      });

      onProcessingComplete?.();

      if (nextSummary.failed === 0) {
        toast.success(`Imported ${succeeded}/${total} leads into Pending Approval.`);
      } else {
        toast.error(`Imported ${succeeded}/${total} leads · ${nextSummary.failed} failed.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed.";
      setParseError(message);
      publishImportStatus({
        phase: "error",
        current: 0,
        total,
        fileName: activeFileName,
        errorMessage: message,
      });
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenClearDialog = async () => {
    if (!workspaceClientId || isProcessing) return;

    try {
      const count = await countPendingApprovalQueue(workspaceClientId);
      if (count === 0) {
        toast.info("Pending approval queue is already empty.");
        return;
      }
      setPendingQueueCount(count);
      setClearDialogOpen(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not count pending queue leads.",
      );
    }
  };

  const handleClearPendingQueue = async () => {
    if (!workspaceClientId) return;

    setIsClearing(true);
    try {
      const result = await clearPendingApprovalQueue(workspaceClientId);

      if (!result.ok) {
        throw new Error(result.error);
      }

      if (result.deleted === 0) {
        toast.info("Pending approval queue is already empty.");
      } else {
        toast.success(
          `Cleared ${result.deleted} lead${result.deleted === 1 ? "" : "s"} from pending approval.`,
        );
      }

      setParsedLeads([]);
      setFileName(null);
      setPasteText("");
      setSummary(null);
      setParseError(null);
      publishImportStatus(null);
      onQueueCleared?.();
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <section className="w-full">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Add leads</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Drop a CSV file or paste one lead row or many — same format either way. Parse first,
            then inject drafts into Pending Approval.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleOpenClearDialog()}
          disabled={isProcessing || isClearing}
          className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-800 transition-colors hover:border-red-300 hover:bg-red-100 disabled:opacity-40"
        >
          Clear pending queue
        </button>
      </div>

      <DeleteLeadDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        selectedCount={pendingQueueCount}
        onConfirm={handleClearPendingQueue}
      />

      <label
        onDragLeave={() => setIsDragging(false)}
        className={`relative flex min-h-[140px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
          isDragging
            ? "border-gray-300 bg-gray-100"
            : "border-gray-200 bg-gray-50 hover:border-gray-300"
        } ${isProcessing ? "pointer-events-none opacity-50" : ""}`}
      >
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={isProcessing}
          onChange={handleFileChange}
          onDragOver={handleDragOver}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className="absolute inset-0 z-[1] h-full w-full cursor-pointer opacity-0"
          aria-label="Upload CSV file"
        />
        <div className="pointer-events-none relative z-0 flex w-full flex-col items-center">
          <span className="text-sm text-gray-500">Drop CSV here or click to browse</span>
          <p className="mt-2 max-w-md text-sm text-gray-500">
            Standard CSV — no Apollo export required. Required:{" "}
            <code className="text-gray-700">email</code>. Recommended:{" "}
            <code className="text-gray-700">first_name</code>,{" "}
            <code className="text-gray-700">company</code>,{" "}
            <code className="text-gray-700">title</code>,{" "}
            <code className="text-gray-700">website</code> (for company research).
          </p>
          {fileName ? (
            <p className="mt-3 text-sm font-medium text-gray-700">
              Loaded: {fileName} ({parsedLeads.length} rows)
            </p>
          ) : null}
        </div>
      </label>

      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm font-medium text-gray-700">Or paste CSV</p>
        <p className="mt-1 text-xs text-gray-500">
          One lead or many — include the header row, then your row(s). Optional:{" "}
          <code className="text-gray-700">website</code>,{" "}
          <code className="text-gray-700">research_url</code>,{" "}
          <code className="text-gray-700">linkedin_url</code>.
        </p>
        <textarea
          value={pasteText}
          onChange={(event) => setPasteText(event.target.value)}
          disabled={isProcessing}
          rows={5}
          spellCheck={false}
          placeholder={`first_name,last_name,email,company,title,website\nDamilare,Adeosun,adedamilare1@gmail.com,Echt AI,CEO,https://echt.ai`}
          className="mt-3 w-full resize-y rounded-md border border-gray-200 px-3 py-2 font-mono text-xs text-gray-800 focus:border-gray-400 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleParsePaste}
          disabled={isProcessing || !pasteText.trim()}
          className="mt-3 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40"
        >
          Parse pasted CSV
        </button>
      </div>

      {parseError ? <p className="mt-3 text-sm text-red-600">{parseError}</p> : null}

      {parsedLeads.length > 0 && !isProcessing && !summary ? (
        <button
          type="button"
          onClick={() => void handleProcessLeads()}
          disabled={!workspaceClientId}
          className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
        >
          {parsedLeads.length === 1 ? "Inject 1 Lead" : `Inject ${parsedLeads.length} Leads`}
        </button>
      ) : null}

      {parsedLeads.length > 0 && summary && !isProcessing ? (
        <button
          type="button"
          onClick={() => void handleProcessLeads()}
          disabled={!workspaceClientId}
          className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
        >
          Re-run import for {parsedLeads.length} parsed lead
          {parsedLeads.length === 1 ? "" : "s"}
        </button>
      ) : null}
    </section>
  );
}
