import { createFileRoute, Link } from "@tanstack/react-router";
import { CredentialsVaultUI } from "@/components/admin/CredentialsVaultUI";
import { useClientRoute } from "@/components/admin/ClientRouteContext";

export const Route = createFileRoute("/admin/client/$id/credentials")({
  head: ({ params }) => ({
    meta: [{ title: `Halton/Works — API Credentials ${params.id}` }],
  }),
  component: ClientCredentialsPage,
});

function ClientCredentialsPage() {
  const client = useClientRoute();
  const clientId = client.id ?? "";
  const companyName = client.company_name?.trim() ?? "Unknown Client";

  if (!clientId) {
    return <p className="text-sm text-gray-500">Client context unavailable.</p>;
  }

  return (
    <div className="space-y-8">
      <header className="border-b border-gray-200 pb-8">
        <Link
          to="/admin/client/$id/orchestration"
          params={{ id: clientId }}
          className="mb-6 inline-block text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          ← Return to orchestration
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">API Credentials</h1>
        <p className="mt-2 text-sm text-gray-500">
          Manage secure integrations and API keys for {companyName}.
        </p>
      </header>

      <CredentialsVaultUI workspaceClientId={clientId} />
    </div>
  );
}
