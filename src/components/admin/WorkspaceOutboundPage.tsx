import { useState } from "react";
import { BulkLeadInjector } from "@/components/admin/BulkLeadInjector";
import { HumanReviewQueue } from "@/components/admin/WorkspaceOutboundQueue";

type WorkspaceOutboundPageProps = {
  clientId: string;
};

export function WorkspaceOutboundPage({ clientId }: WorkspaceOutboundPageProps) {
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);

  return (
    <div className="space-y-8">
      <section className="max-w-lg">
        <p className="mb-3 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
          Bulk inject
        </p>
        <BulkLeadInjector
          clientId={clientId}
          onProcessingComplete={() => setQueueRefreshKey((key) => key + 1)}
        />
      </section>

      <HumanReviewQueue clientId={clientId} refreshKey={queueRefreshKey} />
    </div>
  );
}
