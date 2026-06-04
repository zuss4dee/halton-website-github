import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout shell only — child routes render the client terminal. */
export const Route = createFileRoute("/workspace")({
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  return <Outlet />;
}
