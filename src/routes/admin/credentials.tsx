import { createFileRoute } from "@tanstack/react-router";
import { CredentialsVaultUI } from "@/components/admin/CredentialsVaultUI";

export const Route = createFileRoute("/admin/credentials")({
  head: () => ({
    meta: [
      { title: "Halton/Works — API Credentials" },
      {
        name: "description",
        content: "Manage global and client-scoped API credentials.",
      },
    ],
  }),
  component: AdminCredentialsPage,
});

function AdminCredentialsPage() {
  return (
    <div className="space-y-8">
      <header className="border-b border-gray-200 pb-8 md:pb-10">
        <h1 className="text-3xl font-bold text-gray-900">API Credentials</h1>
        <p className="mt-2 text-sm text-gray-500">
          Manage secure integrations and API keys across all workspaces.
        </p>
      </header>

      <CredentialsVaultUI />
    </div>
  );
}
