import { createFileRoute, Link } from "@tanstack/react-router";
import { useClientRoute } from "@/components/admin/ClientRouteContext";
import { WorkspaceWorkflowBuilder } from "@/components/admin/WorkspaceWorkflowBuilder";

export const Route = createFileRoute("/admin/client/$id/workflow")({
  head: ({ params }) => ({
    meta: [{ title: `Halton/Works — Campaign Rules ${params.id}` }],
  }),
  component: ClientWorkflowPage,
});

function ClientWorkflowPage() {
  const client = useClientRoute();

  if (!client.id) {
    return <p className="text-sm text-gray-500">Client context unavailable.</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Link
        to="/admin/client/$id/orchestration"
        params={{ id: client.id }}
        className="mb-3 inline-block shrink-0 text-sm text-gray-500 transition-colors hover:text-gray-900"
      >
        ← Return to orchestration
      </Link>

      <WorkspaceWorkflowBuilder clientId={client.id} />
    </div>
  );
}
