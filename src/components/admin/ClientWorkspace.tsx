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
  const companyName = client.company_name?.trim() ?? "Unknown Client";
  const { agents, isLoading: isAgentsLoading } = useAgentRoster(clientId);
  return (
    <div className="space-y-8">
      <header className="border-b border-hairline pb-6">
        <div className="mb-6 flex flex-wrap gap-4">
          <Link
            to="/admin/client/$id"
            params={{ id: clientId }}
            className="font-mono text-[11px] tracking-[0.16em] uppercase text-ink-soft transition-colors hover:text-ink"
          >
            &lt; COMMAND_DASHBOARD
          </Link>
          <Link
            to="/admin"
            className="font-mono text-[11px] tracking-[0.16em] uppercase text-ink-soft transition-colors hover:text-ink"
          >
            &lt; GLOBAL_LOBBY
          </Link>
        </div>
        <div className="eyebrow mb-3">Client Workspace // {clientId}</div>
        <h1 className="font-display text-[clamp(2rem,5vw,4rem)] leading-[0.9] tracking-[-0.04em]">
          {companyName.toUpperCase()}
        </h1>
        <p className="mt-4 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
          ORCHESTRATION_DECK // TENANT_SCOPED
        </p>
      </header>

      <AgentRoster
        clientId={clientId}
        agents={agents}
        isLoading={isAgentsLoading}
      />

      <TerminalChat clientId={clientId} agents={agents} />
    </div>
  );
}
