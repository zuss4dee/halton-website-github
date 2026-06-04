import { createFileRoute, Link } from "@tanstack/react-router";
import { KnowledgeVaultUI } from "@/components/admin/KnowledgeVaultUI";
import { useClientRoute } from "@/components/admin/ClientRouteContext";

export const Route = createFileRoute("/admin/client/$id/vault")({
  head: ({ params }) => ({
    meta: [{ title: `Halton/Works — Client Assets ${params.id}` }],
  }),
  component: ClientVaultPage,
});

function ClientVaultPage() {
  const client = useClientRoute();
  const clientId = client.id ?? "";
  const companyName = client.company_name?.trim() ?? "Unknown Client";

  if (!clientId) {
    return (
      <p className="text-sm text-gray-500">Client context unavailable.</p>
    );
  }

  return (
    <div className="space-y-10">
      <header className="border-b border-gray-200 pb-8 md:pb-10">
        <Link
          to="/admin/client/$id/orchestration"
          params={{ id: clientId }}
          className="mb-6 inline-block text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          ← Return to orchestration
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Client Assets</h1>
        <p className="mt-2 text-sm text-gray-500">
          Manage knowledge base, core offers, and brand voice for {companyName}.
        </p>
      </header>

      <KnowledgeVaultUI clientId={clientId} />
    </div>
  );
}
