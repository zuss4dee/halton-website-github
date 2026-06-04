import { createFileRoute } from "@tanstack/react-router";
import { AdminCommandCenter } from "@/components/admin/AdminCommandCenter";

type AdminIndexSearch = {
  onboard?: true;
};

export const Route = createFileRoute("/admin/")({
  validateSearch: (search: Record<string, unknown>): AdminIndexSearch => {
    if (
      search.onboard === true ||
      search.onboard === "1" ||
      search.onboard === "true"
    ) {
      return { onboard: true };
    }
    return {};
  },
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
  const { onboard } = Route.useSearch();
  return <AdminCommandCenter initialOnboardOpen={Boolean(onboard)} />;
}
