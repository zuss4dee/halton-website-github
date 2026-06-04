import { createFileRoute } from "@tanstack/react-router";
import { AdminUnifiedInbox } from "@/components/admin/AdminUnifiedInbox";
import { requireAdminSession } from "@/lib/auth/routeGuard";

export const Route = createFileRoute("/admin/inbox")({
  beforeLoad: async () => {
    await requireAdminSession();
  },
  head: () => ({
    meta: [{ title: "Halton/Works — Unified Inbox" }],
  }),
  component: AdminInboxPage,
});

function AdminInboxPage() {
  return <AdminUnifiedInbox />;
}
