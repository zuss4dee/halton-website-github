import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type WorkflowExecutionLogEntry = {
  nodeId: string;
  type: string;
  status: string;
};

export type WorkflowRunResult = {
  success?: boolean;
  context?: Record<string, unknown>;
  executionLog?: WorkflowExecutionLogEntry[];
  sortedNodeIds?: string[];
  safemode?: Record<string, unknown>;
  error?: string;
};

type WorkflowExecutionModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: WorkflowRunResult | null;
  error: string | null;
};

function statusClass(status: string) {
  if (status === "ok") return "text-emerald-400";
  if (status === "error") return "text-red-400";
  return "text-amber-400";
}

export function WorkflowExecutionModal({
  open,
  onOpenChange,
  result,
  error,
}: WorkflowExecutionModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl gap-0 overflow-hidden rounded-none border border-gray-700 bg-black p-0 font-mono text-gray-200 shadow-2xl sm:rounded-none [&>button]:text-gray-400 [&>button]:hover:text-gray-200">
        <DialogHeader className="border-b border-gray-800 px-5 py-4 text-left">
          <DialogTitle className="text-[11px] font-normal tracking-[0.18em] text-gray-300 uppercase">
            [ EXECUTION_LOG ] — DAG RUN COMPLETE
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(85vh-4rem)] space-y-5 overflow-y-auto px-5 py-4">
          {error ? (
            <p className="text-[11px] tracking-[0.1em] text-red-400 uppercase">{error}</p>
          ) : null}

          {result?.executionLog?.length ? (
            <section>
              <h3 className="mb-2 text-[10px] tracking-[0.14em] text-gray-500 uppercase">
                Step timeline
              </h3>
              <ul className="space-y-2 border border-gray-800 bg-gray-950 p-3">
                {result.executionLog.map((entry) => (
                  <li
                    key={`${entry.nodeId}-${entry.type}`}
                    className="flex items-center justify-between gap-3 text-[11px]"
                  >
                    <span className="text-gray-300">
                      {entry.nodeId}{" "}
                      <span className="text-gray-600">({entry.type})</span>
                    </span>
                    <span className={`tracking-[0.12em] uppercase ${statusClass(entry.status)}`}>
                      {entry.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {result?.context ? (
            <section>
              <h3 className="mb-2 text-[10px] tracking-[0.14em] text-gray-500 uppercase">
                Context output
              </h3>
              <pre className="overflow-x-auto border border-gray-800 bg-gray-950 p-3 text-[10px] leading-relaxed text-emerald-300/90">
                {JSON.stringify(result.context, null, 2)}
              </pre>
            </section>
          ) : null}

          {result && !result.context && !result.executionLog?.length && !error ? (
            <pre className="overflow-x-auto border border-gray-800 bg-gray-950 p-3 text-[10px] leading-relaxed text-gray-400">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
