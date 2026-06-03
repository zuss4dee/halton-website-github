import { createFileRoute } from "@tanstack/react-router";
import { AgentStudioPage } from "@/components/admin/AgentStudioPage";
import { useClientRoute } from "@/components/admin/ClientRouteContext";

export const Route = createFileRoute("/admin/client/$id/agents/$agentId")({
  head: ({ params }) => ({
    meta: [{ title: `Halton/Works — Agent Studio ${params.agentId}` }],
  }),
  component: ClientAgentStudioRoute,
});

function ClientAgentStudioRoute() {
  const client = useClientRoute();
  const { agentId } = Route.useParams();

  if (!client.id) {
    return (
      <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
        CLIENT_CONTEXT_UNAVAILABLE
      </p>
    );
  }

  return <AgentStudioPage clientId={client.id} agentId={agentId} />;
}
