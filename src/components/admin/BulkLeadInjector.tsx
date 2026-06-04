import { useCallback, useState } from "react";
import { parseBulkLeadCsv, type BulkLeadRow } from "@/lib/admin/bulkLeadCsv";
import {
  fetchActiveWorkflowGraph,
  invokeOutboundForLead,
} from "@/lib/admin/bulkWorkflowRun";

type BulkLeadInjectorProps = {
  clientId: string;
  onProcessingComplete?: () => void;
};

type ProcessSummary = {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ email: string; message: string }>;
};

export function BulkLeadInjector({ clientId, onProcessingComplete }: BulkLeadInjectorProps) {
  const [parsedLeads, setParsedLeads] = useState<BulkLeadRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [summary, setSummary] = useState<ProcessSummary | null>(null);

  const workspaceClientId = clientId.trim();

  const ingestFile = useCallback((file: File) => {
    setParseError(null);
    setSummary(null);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseError("Only .csv files are supported.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = typeof reader.result === "string" ? reader.result : "";
        const leads = parseBulkLeadCsv(text);
        if (leads.length === 0) {
          setParseError("No valid rows found. Ensure headers include email.");
          setParsedLeads([]);
          setFileName(null);
          return;
        }
        setParsedLeads(leads);
        setFileName(file.name);
      } catch (error) {
        setParseError(error instanceof Error ? error.message : "Failed to parse CSV.");
        setParsedLeads([]);
        setFileName(null);
      }
    };
    reader.onerror = () => {
      setParseError("Could not read file.");
    };
    reader.readAsText(file);
  }, []);

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

    setIsProcessing(true);
    setSummary(null);
    setProgress({ current: 0, total: parsedLeads.length });

    const graph = await fetchActiveWorkflowGraph(workspaceClientId);
    if (!graph) {
      setParseError("No active workflow found. Save and activate a SOP in the Workflow Builder first.");
      setIsProcessing(false);
      return;
    }

    const errors: ProcessSummary["errors"] = [];
    let succeeded = 0;

    for (let index = 0; index < parsedLeads.length; index++) {
      const lead = parsedLeads[index];
      setProgress({ current: index + 1, total: parsedLeads.length });

      const result = await invokeOutboundForLead(workspaceClientId, lead, graph);
      if (result.success) {
        succeeded += 1;
      } else {
        errors.push({
          email: lead.email,
          message: result.error ?? "Unknown error",
        });
      }
    }

    setSummary({
      total: parsedLeads.length,
      succeeded,
      failed: parsedLeads.length - succeeded,
      errors,
    });
    setIsProcessing(false);
    onProcessingComplete?.();
  };

  return (
    <section className="w-full">
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
          <span className="text-sm text-gray-500">
            Drop CSV here or click to browse
          </span>
          <p className="mt-2 text-sm text-gray-500">
            Headers: first_name, last_name, email, company, title
          </p>
          {fileName ? (
            <p className="mt-3 text-sm font-medium text-gray-700">
              Loaded: {fileName} ({parsedLeads.length} rows)
            </p>
          ) : null}
        </div>
      </label>

      {parseError ? (
        <p className="mt-3 text-sm text-red-600">{parseError}</p>
      ) : null}

      {parsedLeads.length > 0 && !isProcessing ? (
        <button
          type="button"
          onClick={() => void handleProcessLeads()}
          disabled={!workspaceClientId}
          className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
        >
          Inject {parsedLeads.length} Leads
        </button>
      ) : null}

      {isProcessing ? (
        <p className="mt-4 text-sm text-gray-600">
          Processing {progress.current} / {progress.total} leads…
        </p>
      ) : null}

      {summary ? (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
          <p className="font-medium text-gray-900">
            Complete: {summary.succeeded}/{summary.total} succeeded
            {summary.failed > 0 ? ` · ${summary.failed} failed` : ""}
          </p>
          {summary.errors.length > 0 ? (
            <ul className="mt-2 max-h-24 space-y-1 overflow-y-auto text-red-600">
              {summary.errors.slice(0, 5).map((entry) => (
                <li key={entry.email}>
                  {entry.email}: {entry.message}
                </li>
              ))}
              {summary.errors.length > 5 ? (
                <li>…and {summary.errors.length - 5} more</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
