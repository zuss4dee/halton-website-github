import { createFileRoute, Link } from "@tanstack/react-router";
import { KnowledgeVaultUI } from "@/components/admin/KnowledgeVaultUI";
import { useClientRoute } from "@/components/admin/ClientRouteContext";

export const Route = createFileRoute("/admin/client/$id/vault")({
  head: ({ params }) => ({
    meta: [{ title: `Halton/Works — Knowledge Vault ${params.id}` }],
  }),
  component: ClientVaultPage,
});

function ClientVaultPage() {
  const client = useClientRoute();
  const clientId = client.id ?? "";
  const companyName = client.company_name?.trim() ?? "Unknown Client";

  if (!clientId) {
    return (
      <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
        CLIENT_CONTEXT_UNAVAILABLE
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <header className="border-b border-hairline pb-6">
        <Link
          to="/admin/client/$id/orchestration"
          params={{ id: clientId }}
          className="mb-6 inline-block font-mono text-[11px] tracking-[0.16em] uppercase text-ink-soft transition-colors hover:text-ink"
        >
          &lt; ORCHESTRATION
        </Link>
        <div className="eyebrow mb-3">02 // Knowledge Vault</div>
        <h1 className="font-display text-[clamp(2rem,5vw,4rem)] leading-[0.9] tracking-[-0.04em]">
          {companyName.toUpperCase()}
        </h1>
        <p className="mt-4 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
          CLIENT_CONTEXT // WORKSPACE_SCOPED
        </p>
      </header>

      <KnowledgeVaultUI clientId={clientId} />
    </div>
  );
}
