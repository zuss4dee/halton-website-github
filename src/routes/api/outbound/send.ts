import { createFileRoute } from "@tanstack/react-router";
import {
  sendOutboundEmail,
  type OutboundSendRequest,
} from "@/lib/outbound/resendSend";

export const Route = createFileRoute("/api/outbound/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: OutboundSendRequest;

        try {
          body = (await request.json()) as OutboundSendRequest;
        } catch {
          return Response.json({ error: "Invalid JSON body." }, { status: 400 });
        }

        try {
          const result = await sendOutboundEmail(body);

          if (!result.ok) {
            return Response.json({ error: result.error }, { status: result.status });
          }

          return Response.json(
            {
              ok: true,
              leadId: result.leadId,
              resendId: result.resendId,
            },
            { status: 200 },
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Outbound send failed.";
          console.error("[api/outbound/send]", message);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
