import { createFileRoute } from "@tanstack/react-router";
import { useClientRoute } from "@/components/admin/ClientRouteContext";
import { WorkspaceWorkflowBuilder } from "@/components/admin/WorkspaceWorkflowBuilder";

export const Route = createFileRoute("/admin/client/$id/workflow")({
  head: ({ params }) => ({
    meta: [{ title: `Halton/Works — SOP Builder ${params.id}` }],
  }),
  component: ClientWorkflowPage,
});

function ClientWorkflowPage() {
  const client = useClientRoute();

  if (!client.id) {
    return (
      <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
        CLIENT_CONTEXT_UNAVAILABLE
      </p>
    );
  }

  return <WorkspaceWorkflowBuilder clientId={client.id} />;
}
