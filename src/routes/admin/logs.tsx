import { createFileRoute } from "@tanstack/react-router";
import { ExecutionLogs } from "@/components/admin/ExecutionLogs";

export const Route = createFileRoute("/admin/logs")({
  head: () => ({
    meta: [
      { title: "Halton/Works — System Logs" },
      {
        name: "description",
        content: "Platform-wide execution and agent telemetry logs.",
      },
    ],
  }),
  component: AdminLogsPage,
});

function AdminLogsPage() {
  return <ExecutionLogs />;
}
