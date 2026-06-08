import { createFileRoute } from "@tanstack/react-router";
import { useClientRoute } from "@/components/admin/ClientRouteContext";
import { WorkspaceLeadsCrm } from "@/components/admin/WorkspaceLeadsCrm";

export const Route = createFileRoute("/admin/client/$id/leads")({
  head: ({ params }) => ({
    meta: [{ title: `Halton/Works — Leads CRM ${params.id}` }],
  }),
  component: ClientLeadsCrmPage,
});

function ClientLeadsCrmPage() {
  const client = useClientRoute();

  if (!client.id) {
    return (
      <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
        CLIENT_CONTEXT_UNAVAILABLE
      </p>
    );
  }

  return (
    <WorkspaceLeadsCrm
      clientId={client.id}
      companyName={client.company_name ?? undefined}
    />
  );
}
