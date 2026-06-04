import { createFileRoute, redirect } from "@tanstack/react-router";
import { ClientWorkspacePortal } from "@/components/workspace/ClientWorkspacePortal";
import { guardWorkspaceClientRoute } from "@/lib/auth/routeGuard";

export const Route = createFileRoute("/workspace/$clientId")({
  beforeLoad: async ({ params }) => {
    const clientId = params.clientId?.trim();
    if (!clientId) {
      throw redirect({ to: "/login" });
    }
    await guardWorkspaceClientRoute(clientId);
  },
  head: ({ params }) => ({
    meta: [
      {
        title: `Halton/Works — Workspace ${params.clientId}`,
      },
      {
        name: "description",
        content: "Client workspace telemetry and live inbound lead signals.",
      },
    ],
  }),
  component: WorkspaceClientPage,
});

function WorkspaceClientPage() {
  const { clientId } = Route.useParams();
  return <ClientWorkspacePortal clientId={clientId} />;
}
