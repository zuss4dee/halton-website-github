import type { AgentLogRow } from "@/lib/admin/agentTelemetry";
import type { MasterCommandExecutePhase } from "@/lib/admin/masterCommandUi";
import { MasterAgentCommand } from "./MasterAgentCommand";
import { ActiveWorkspacesTable } from "./ActiveWorkspacesTable";
import type { WorkspaceListItem } from "@/lib/admin/clientsRepository";

type AdminGlobalDashboardProps = {
  workspaces: WorkspaceListItem[];
  isLoading: boolean;
  command: string;
  onCommandChange: (value: string) => void;
  onExecuteCommand: () => Promise<void>;
  isExecutingCommand: boolean;
  executePhase: MasterCommandExecutePhase;
  executionId: string | null;
  telemetryLogs: AgentLogRow[];
  formatTelemetryLine: (log: AgentLogRow) => string;
};

export function AdminGlobalDashboard({
  workspaces,
  isLoading,
  command,
  onCommandChange,
  onExecuteCommand,
  isExecutingCommand,
  executePhase,
  executionId,
  telemetryLogs,
  formatTelemetryLine,
}: AdminGlobalDashboardProps) {
  return (
    <>
      <header className="mb-12 md:mb-16 border-b border-hairline pb-8">
        <div className="eyebrow mb-4">Index 000 — Command Center</div>
        <h1 className="font-display text-[clamp(2rem,6vw,4.5rem)] leading-[0.9] tracking-[-0.04em] text-balance">
          Deploy. Observe. Scale.
        </h1>
        <p className="mt-6 max-w-2xl text-base text-ink-soft leading-relaxed">
          Orchestrate AI agents across client workspaces, monitor pipeline infrastructure, and issue
          fleet-wide directives from a single control surface.
        </p>
      </header>

      <div className="space-y-16 md:space-y-20">
        <MasterAgentCommand
          command={command}
          onCommandChange={onCommandChange}
          onExecuteCommand={onExecuteCommand}
          isExecuting={isExecutingCommand}
          executePhase={executePhase}
          executionId={executionId}
          telemetryLogs={telemetryLogs}
          formatTelemetryLine={formatTelemetryLine}
        />
        <ActiveWorkspacesTable workspaces={workspaces} isLoading={isLoading} />
      </div>
    </>
  );
}
