import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireAdminSession } from "@/lib/auth/routeGuard";

type AnalyticsSearch = {
  clientId?: string;
};

/** Legacy URL — analytics is served inside each client workspace. */
export const Route = createFileRoute("/admin/analytics")({
  validateSearch: (search: Record<string, unknown>): AnalyticsSearch => ({
    clientId: typeof search.clientId === "string" ? search.clientId.trim() : undefined,
  }),
  beforeLoad: async ({ search }) => {
    await requireAdminSession();
    if (search.clientId) {
      throw redirect({
        to: "/admin/client/$id",
        params: { id: search.clientId },
      });
    }
    throw redirect({ to: "/admin" });
  },
  component: () => null,
});
