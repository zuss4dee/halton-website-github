import type { KeyboardEvent, MouseEvent } from "react";
import type { AgentLogRow } from "@/lib/admin/agentTelemetry";
import type { MasterCommandExecutePhase } from "@/lib/admin/masterCommandUi";

type MasterAgentCommandProps = {
  command: string;
  onCommandChange: (value: string) => void;
  onExecuteCommand: () => Promise<void>;
  isExecuting: boolean;
  executePhase: MasterCommandExecutePhase;
  executionId: string | null;
  telemetryLogs: AgentLogRow[];
  formatTelemetryLine: (log: AgentLogRow) => string;
};

function executeButtonLabel(isExecuting: boolean, phase: MasterCommandExecutePhase): string {
  if (!isExecuting) return "EXECUTE_COMMAND";
  if (phase === "parsing") return "PARSING_INTENT...";
  if (phase === "routing") return "STREAMING_TELEMETRY...";
  return "EXECUTE_COMMAND";
}

export function MasterAgentCommand({
  command,
  onCommandChange,
  onExecuteCommand,
  isExecuting,
  executePhase,
  executionId,
  telemetryLogs,
  formatTelemetryLine,
}: MasterAgentCommandProps) {
  function handleExecute() {
    if (!command.trim() || isExecuting) return;

    void onExecuteCommand().catch((error: unknown) => {
      console.error("MASTER AGENT UI EXECUTION FAILED:", error);
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    handleExecute();
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    handleExecute();
  }

  const showTerminal = isExecuting || telemetryLogs.length > 0;

  return (
    <section className="border border-hairline bg-paper p-6 md:p-10">
      <label htmlFor="master-agent-command" className="eyebrow block mb-6">
        Master Agent Command
      </label>
      <textarea
        id="master-agent-command"
        value={command}
        onChange={(e) => onCommandChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Deploy enrichment agents for Vertex Systems and route qualified meetings to the Zurich calendar…"
        rows={6}
        disabled={isExecuting}
        className="w-full resize-y border border-hairline bg-transparent px-4 py-4 font-sans text-base md:text-lg text-ink placeholder:text-ink-soft/60 focus:outline-none focus:border-ink disabled:opacity-60"
      />
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-soft max-w-xl leading-relaxed">
          Natural language instructions are parsed and dispatched to your agent fleet. Changes
          propagate to active workspaces on execute.
        </p>
        <button
          type="button"
          onClick={handleClick}
          disabled={!command.trim() || isExecuting}
          className="cta group shrink-0 rounded-none border border-hairline disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none font-mono text-xs tracking-widest uppercase"
        >
          <span className="dot" />
          <span>{executeButtonLabel(isExecuting, executePhase)}</span>
        </button>
      </div>

      {showTerminal && (
        <div className="mt-6 border border-gray-800 bg-black p-3 font-mono text-xs leading-relaxed text-gray-300">
          <div className="mb-2 border-b border-gray-800 pb-2 text-[10px] tracking-[0.2em] uppercase text-gray-500">
            AGENT_TELEMETRY
            {executionId ? ` // ${executionId}` : ""}
          </div>
          <div className="space-y-1">
            {telemetryLogs.length === 0 && isExecuting && (
              <div className="animate-pulse text-gray-500">&gt; [SYSTEM] AWAITING_TELEMETRY...</div>
            )}
            {telemetryLogs.map((log) => (
              <div key={log.id ?? `${log.event_type}-${log.created_at}`} className="whitespace-pre-wrap">
                {formatTelemetryLine(log)}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
