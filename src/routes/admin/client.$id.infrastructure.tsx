import { createFileRoute } from "@tanstack/react-router";
import { useClientRoute } from "@/components/admin/ClientRouteContext";
import { WorkspaceInfrastructure } from "@/components/admin/WorkspaceInfrastructure";

export const Route = createFileRoute("/admin/client/$id/infrastructure")({
  head: ({ params }) => ({
    meta: [{ title: `Halton/Works — Infrastructure ${params.id}` }],
  }),
  component: ClientInfrastructurePage,
});

function ClientInfrastructurePage() {
  const client = useClientRoute();

  if (!client.id) {
    return (
      <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
        CLIENT_CONTEXT_UNAVAILABLE
      </p>
    );
  }

  return <WorkspaceInfrastructure clientId={client.id} />;
}
