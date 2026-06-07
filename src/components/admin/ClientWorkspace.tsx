import { Link } from "@tanstack/react-router";
import { AgentRoster } from "@/components/admin/AgentRoster";
import { TerminalChat } from "@/components/admin/TerminalChat";
import { ViewOrgChartButton } from "@/components/workspace/ViewOrgChartButton";
import type { ClientRow } from "@/lib/admin/clientsRepository";
import { useAgentRoster } from "@/lib/admin/useAgentRoster";

type ClientWorkspaceProps = {
  client: ClientRow;
};

export function ClientWorkspace({ client }: ClientWorkspaceProps) {
  const clientId = client.id ?? "";
  const { agents, isLoading: isAgentsLoading } = useAgentRoster(clientId);

  return (
    <div className="space-y-10">
      <header className="border-b border-gray-200 pb-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/admin/client/$id"
            params={{ id: clientId }}
            className="inline-block text-sm text-gray-500 transition-colors hover:text-gray-900"
          >
            ← Return to analytics
          </Link>
          <ViewOrgChartButton clientId={clientId} variant="neutral" />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Active Agents</h1>
            <p className="mt-2 text-sm text-gray-500">
              Manage agents and monitor live execution logs.
            </p>
          </div>
        </div>
      </header>

      <AgentRoster clientId={clientId} agents={agents} isLoading={isAgentsLoading} />

      <TerminalChat clientId={clientId} agents={agents} />
    </div>
  );
}
