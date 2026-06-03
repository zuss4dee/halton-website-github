import { createFileRoute } from "@tanstack/react-router";
import { getSystemHealthReport } from "@/lib/systemHealthServer";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const report = await getSystemHealthReport();
          return Response.json(report);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Health check failed";
          console.error("[api/health]", message);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
