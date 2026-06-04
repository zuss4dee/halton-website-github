import { createFileRoute } from "@tanstack/react-router";
import { useClientRoute } from "@/components/admin/ClientRouteContext";
import { WorkspaceCommandDashboard } from "@/components/admin/WorkspaceCommandDashboard";

export const Route = createFileRoute("/admin/client/$id/dashboard")({
  head: ({ params }) => ({
    meta: [{ title: `Halton/Works — Analytics ${params.id}` }],
  }),
  component: ClientAnalyticsPage,
});

function ClientAnalyticsPage() {
  const client = useClientRoute();

  if (!client.id) {
    return (
      <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
        CLIENT_CONTEXT_UNAVAILABLE
      </p>
    );
  }

  return (
    <WorkspaceCommandDashboard
      clientId={client.id}
      companyName={client.company_name ?? undefined}
    />
  );
}
