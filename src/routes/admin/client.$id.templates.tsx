import { createFileRoute } from "@tanstack/react-router";
import { EmailTemplatesUI } from "@/components/admin/EmailTemplatesUI";
import { useClientRoute } from "@/components/admin/ClientRouteContext";

export const Route = createFileRoute("/admin/client/$id/templates")({
  head: ({ params }) => ({
    meta: [{ title: `Halton/Works — Email Templates ${params.id}` }],
  }),
  component: ClientTemplatesPage,
});

function ClientTemplatesPage() {
  const client = useClientRoute();
  const clientId = client.id ?? "";

  if (!clientId) {
    return <p className="text-sm text-gray-500">Client context unavailable.</p>;
  }

  return <EmailTemplatesUI clientId={clientId} />;
}
