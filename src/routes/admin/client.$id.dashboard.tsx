import { createFileRoute, redirect } from "@tanstack/react-router";

/** Analytics lives on the client workspace index. */
export const Route = createFileRoute("/admin/client/$id/dashboard")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/admin/client/$id",
      params: { id: params.id },
    });
  },
  component: () => null,
});
