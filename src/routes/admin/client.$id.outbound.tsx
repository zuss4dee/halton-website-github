import { createFileRoute } from "@tanstack/react-router";
import { useClientRoute } from "@/components/admin/ClientRouteContext";
import { WorkspaceOutboundQueue } from "@/components/admin/WorkspaceOutboundQueue";

export const Route = createFileRoute("/admin/client/$id/outbound")({
  head: ({ params }) => ({
    meta: [{ title: `Halton/Works — Outbound Queue ${params.id}` }],
  }),
  component: ClientOutboundPage,
});

function ClientOutboundPage() {
  const client = useClientRoute();

  if (!client.id) {
    return (
      <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
        CLIENT_CONTEXT_UNAVAILABLE
      </p>
    );
  }

  return <WorkspaceOutboundQueue clientId={client.id} />;
}
