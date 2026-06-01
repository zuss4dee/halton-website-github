import { createFileRoute } from "@tanstack/react-router";
import { ClientWorkspace } from "@/components/admin/ClientWorkspace";
import { useClientRoute } from "@/components/admin/ClientRouteContext";

export const Route = createFileRoute("/admin/client/$id/orchestration")({
  head: ({ params }) => ({
    meta: [{ title: `Halton/Works — Orchestration ${params.id}` }],
  }),
  component: ClientOrchestrationPage,
});

function ClientOrchestrationPage() {
  const client = useClientRoute();
  return <ClientWorkspace client={client} />;
}
