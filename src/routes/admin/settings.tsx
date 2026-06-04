import { createFileRoute } from "@tanstack/react-router";
import { AdminSystemConfig } from "@/components/admin/AdminSystemConfig";
import { requireAdminSession } from "@/lib/auth/routeGuard";

export const Route = createFileRoute("/admin/settings")({
  beforeLoad: async () => {
    await requireAdminSession();
  },
  head: () => ({
    meta: [{ title: "Halton/Works — System Config" }],
  }),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  return <AdminSystemConfig />;
}
