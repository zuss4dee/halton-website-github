import { createFileRoute, redirect } from "@tanstack/react-router";

/** @deprecated Use /admin/vault */
export const Route = createFileRoute("/admin/infrastructure")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/vault" });
  },
  component: () => null,
});
