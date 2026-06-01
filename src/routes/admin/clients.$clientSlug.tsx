import { createFileRoute, redirect } from "@tanstack/react-router";

/** @deprecated Use /admin/client/$id — kept for backwards-compatible links. */
export const Route = createFileRoute("/admin/clients/$clientSlug")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/admin/client/$id",
      params: { id: params.clientSlug },
    });
  },
  component: () => null,
});
