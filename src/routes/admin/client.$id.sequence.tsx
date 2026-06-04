import { createFileRoute } from "@tanstack/react-router";
import { useClientRoute } from "@/components/admin/ClientRouteContext";
import { SequenceBuilder } from "@/components/admin/SequenceBuilder";

export const Route = createFileRoute("/admin/client/$id/sequence")({
  head: ({ params }) => ({
    meta: [{ title: `Halton/Works — Automated Sequence ${params.id}` }],
  }),
  component: ClientSequencePage,
});

function ClientSequencePage() {
  const client = useClientRoute();
  const clientId = client.id ?? "";

  if (!clientId) {
    return (
      <p className="font-mono text-[11px] tracking-[0.12em] text-ink-soft uppercase">
        Client context unavailable.
      </p>
    );
  }

  return (
    <SequenceBuilder
      clientId={clientId}
      clientName={client.company_name as string | null | undefined}
    />
  );
}
