import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClientRouteProvider } from "@/components/admin/ClientRouteContext";
import type { ClientRow } from "@/lib/admin/clientsRepository";
import { supabase } from "@/lib/supabase";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/admin/client/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Halton/Works — Workspace ${params.id}` },
      {
        name: "description",
        content: `Client workspace for ${params.id}.`,
      },
    ],
  }),
  component: ClientWorkspaceLayout,
});

function ClientWorkspaceLayout() {
  const { id } = Route.useParams();
  const [client, setClient] = useState<ClientRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchClient = async () => {
      setIsLoading(true);

      const isUuid = UUID_PATTERN.test(id);
      const query = supabase.from("clients").select("*");

      const { data, error } = isUuid
        ? await query.eq("id", id).single()
        : await query.eq("slug", id).single();

      if (cancelled) return;

      if (error) {
        console.error("SUPABASE ERROR:", error);
        setClient(null);
      } else {
        setClient(data);
      }

      setIsLoading(false);
    };

    void fetchClient();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (isLoading) {
    return (
      <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
        LOADING_WORKSPACE...
      </p>
    );
  }

  if (!client?.id) {
    return (
      <div className="max-w-lg">
        <div className="eyebrow mb-4">— Not found</div>
        <h1 className="mb-6 font-display text-3xl leading-[0.95] tracking-[-0.035em]">
          Workspace unavailable
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-ink-soft">
          No client workspace matches <span className="font-mono text-ink">{id}</span>.
        </p>
        <Link
          to="/admin"
          className="font-mono text-[11px] tracking-[0.16em] uppercase text-ink-soft transition-colors hover:text-ink"
        >
          &lt; RETURN_TO_GLOBAL_LOBBY
        </Link>
      </div>
    );
  }

  return (
    <ClientRouteProvider client={client}>
      <Outlet />
    </ClientRouteProvider>
  );
}
