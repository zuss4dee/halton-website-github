import { createFileRoute } from "@tanstack/react-router";
import { AdminCommandCenter } from "@/components/admin/AdminCommandCenter";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Halton/Works — Command Center" },
      {
        name: "description",
        content: "Platform owner command center for agent deployment and workspace oversight.",
      },
    ],
  }),
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  return <AdminCommandCenter />;
}
