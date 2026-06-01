import { createFileRoute } from "@tanstack/react-router";
import { useClientRoute } from "@/components/admin/ClientRouteContext";
import { WorkspaceLeadPipeline } from "@/components/admin/WorkspaceLeadPipeline";

export const Route = createFileRoute("/admin/client/$id/leads")({
  head: ({ params }) => ({
    meta: [{ title: `Halton/Works — Lead Pipeline ${params.id}` }],
  }),
  component: ClientLeadsPage,
});

function ClientLeadsPage() {
  const client = useClientRoute();

  if (!client.id) {
    return (
      <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
        CLIENT_CONTEXT_UNAVAILABLE
      </p>
    );
  }

  return <WorkspaceLeadPipeline clientId={client.id} />;
}
