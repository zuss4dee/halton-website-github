import { createFileRoute } from "@tanstack/react-router";
import { onboardClient, type OnboardClientPayload } from "@/lib/admin/onboardClient";
import { requireAdminApiSession } from "@/lib/auth/requireAdminApi";

export const Route = createFileRoute("/api/admin/onboard-client")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminApiSession(request);
        if (auth.unauthorizedResponse) {
          return auth.unauthorizedResponse;
        }

        let body: OnboardClientPayload;
        try {
          body = (await request.json()) as OnboardClientPayload;
        } catch {
          return Response.json({ error: "Invalid JSON body." }, { status: 400 });
        }

        try {
          const result = await onboardClient(body);
          if (!result.ok) {
            return Response.json({ error: result.error }, { status: result.status });
          }

          return Response.json(
            {
              ok: true,
              clientId: result.clientId,
              authUserId: result.authUserId,
            },
            { status: 201 },
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Client onboarding failed.";
          console.error("[api/admin/onboard-client]", message);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
