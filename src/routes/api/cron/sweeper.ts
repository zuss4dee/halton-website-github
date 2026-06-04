import { createFileRoute } from "@tanstack/react-router";
import { runCronSweeper, verifyCronSecret } from "@/lib/cron/sweeper";

async function handleSweeper(request: Request): Promise<Response> {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runCronSweeper();

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json(
      {
        ok: true,
        swept: result.swept,
        failed: result.failed,
        dueCount: result.dueCount,
        followUpDays: result.followUpDays,
        leadIds: result.leadIds,
        ...(result.errors.length > 0 ? { errors: result.errors } : {}),
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron sweeper failed.";
    console.error("[api/cron/sweeper]", message);
    return Response.json({ error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/cron/sweeper")({
  server: {
    handlers: {
      GET: async ({ request }) => handleSweeper(request),
      POST: async ({ request }) => handleSweeper(request),
    },
  },
});
