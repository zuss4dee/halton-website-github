import { createFileRoute } from "@tanstack/react-router";
import { buildDomainFleetSnapshot } from "@/lib/admin/domainFleetService";
import { requireAdminApiSession } from "@/lib/auth/requireAdminApi";

export const Route = createFileRoute("/api/admin/domains")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAdminApiSession(request);
        if (auth.unauthorizedResponse) {
          return auth.unauthorizedResponse;
        }

        try {
          const result = await buildDomainFleetSnapshot();

          if (!result.ok) {
            return Response.json({ error: result.error }, { status: result.status });
          }

          return Response.json(
            {
              ok: true,
              rows: result.rows,
              checkedAt: result.checkedAt,
            },
            { status: 200 },
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Domain fleet snapshot failed.";
          console.error("[api/admin/domains]", message);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
