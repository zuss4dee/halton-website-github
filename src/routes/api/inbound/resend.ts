import { createFileRoute } from "@tanstack/react-router";
import {
  handleResendInbound,
  parseResendInboundPayload,
} from "@/lib/inbound/resendInbound";

export const Route = createFileRoute("/api/inbound/resend")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown;

        try {
          payload = await request.json();
        } catch {
          console.warn("[api/inbound/resend] Invalid JSON body");
          return Response.json({ received: true, matched: false }, { status: 200 });
        }

        try {
          const parsed = parseResendInboundPayload(payload);
          const result = await handleResendInbound(parsed);
          return Response.json(result, { status: 200 });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Inbound webhook failed.";
          console.error("[api/inbound/resend]", message);
          return Response.json({ received: true, matched: false }, { status: 200 });
        }
      },
    },
  },
});
