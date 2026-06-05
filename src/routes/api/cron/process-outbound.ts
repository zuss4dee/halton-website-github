import { createFileRoute } from "@tanstack/react-router";
import { isValidCronRequest } from "@/lib/cron/cronAuth";
import { processOutboundQueue } from "@/lib/cron/processOutbound";

export async function GET({ request }: { request: Request }) {
  if (!isValidCronRequest(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const clientId = new URL(request.url).searchParams.get("clientId")?.trim() || undefined;
    const result = await processOutboundQueue(clientId ? { clientId } : undefined);
    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Cron operational failure";
    console.error("Cron operational failure:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const Route = createFileRoute("/api/cron/process-outbound")({
  server: {
    handlers: {
      GET: async ({ request }) => GET({ request }),
    },
  },
});
