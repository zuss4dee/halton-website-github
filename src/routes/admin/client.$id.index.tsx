import { createFileRoute } from "@tanstack/react-router";
import { ClientManageCampaignsHub } from "@/components/admin/ClientManageCampaignsHub";

export const Route = createFileRoute("/admin/client/$id/")({
  head: ({ params }) => ({
    meta: [
      {
        title: `Halton/Works — Manage Campaigns ${params.id}`,
      },
    ],
  }),
  component: ClientManageCampaignsPage,
});

function ClientManageCampaignsPage() {
  return <ClientManageCampaignsHub />;
}
