import { Link } from "@tanstack/react-router";
import { AgentRoster } from "@/components/admin/AgentRoster";
import { TerminalChat } from "@/components/admin/TerminalChat";
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
        <Link
          to="/admin/client/$id"
          params={{ id: clientId }}
          className="mb-6 inline-block text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          ← Return to analytics
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Active Agents</h1>
        <p className="mt-2 text-sm text-gray-500">
          Manage agents and monitor live execution logs.
        </p>
      </header>

      <AgentRoster clientId={clientId} agents={agents} isLoading={isAgentsLoading} />

      <TerminalChat clientId={clientId} agents={agents} />
    </div>
  );
}
