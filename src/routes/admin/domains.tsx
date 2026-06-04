import { createFileRoute } from "@tanstack/react-router";
import { AdminDomainFleet } from "@/components/admin/AdminDomainFleet";
import { requireAdminSession } from "@/lib/auth/routeGuard";

export const Route = createFileRoute("/admin/domains")({
  beforeLoad: async () => {
    await requireAdminSession();
  },
  head: () => ({
    meta: [{ title: "Halton/Works — Domain Fleet" }],
  }),
  component: AdminDomainsPage,
});

function AdminDomainsPage() {
  return <AdminDomainFleet />;
}
