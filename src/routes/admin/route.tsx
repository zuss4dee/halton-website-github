import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminSession } from "@/lib/auth/routeGuard";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    await requireAdminSession();
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
