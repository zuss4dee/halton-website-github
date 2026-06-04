import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/workspace")({
  component: WorkspaceRouteLayout,
});

function WorkspaceRouteLayout() {
  return <Outlet />;
}
