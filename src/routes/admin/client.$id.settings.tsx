import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceSettings } from "@/components/admin/WorkspaceSettings";

export const Route = createFileRoute("/admin/client/$id/settings")({
  head: ({ params }) => ({
    meta: [{ title: `Halton/Works — Agent Grounding ${params.id}` }],
  }),
  component: WorkspaceSettings,
});
