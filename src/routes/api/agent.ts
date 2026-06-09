import { createFileRoute } from "@tanstack/react-router";

import { executeCEOCommand } from "@/lib/ai/agentRuntime";

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: {
          command?: string;
          clientId?: string;
          replyContext?: {
            logId: string;
            agentLabel: string;
            eventType: string;
            quotedText: string;
            createdAt?: string;
          };
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid JSON body." }, { status: 400 });
        }

        const command = body.command?.trim();
        const clientId = body.clientId?.trim();

        if (!command) {
          return Response.json({ error: "Missing command." }, { status: 400 });
        }

        if (!clientId) {
          return Response.json({ error: "Missing clientId." }, { status: 400 });
        }

        const encoder = new TextEncoder();

        const stream = new ReadableStream({
          async start(controller) {
            try {
              const result = await executeCEOCommand(
                command,
                clientId,
                (executionId) => {
                  controller.enqueue(
                    encoder.encode(`${JSON.stringify({ executionId })}\n`),
                  );
                },
                body.replyContext,
              );

              controller.enqueue(encoder.encode(`${JSON.stringify({ text: result.text })}\n`));
              controller.close();
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "CEO execution failed.";
              controller.enqueue(encoder.encode(`${JSON.stringify({ error: message })}\n`));
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "application/x-ndjson",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
