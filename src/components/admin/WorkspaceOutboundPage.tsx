import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { BulkLeadInjector } from "@/components/admin/BulkLeadInjector";
import { HumanReviewQueue } from "@/components/admin/WorkspaceOutboundQueue";

type WorkspaceOutboundPageProps = {
  clientId: string;
};

export function WorkspaceOutboundPage({ clientId }: WorkspaceOutboundPageProps) {
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);

  return (
    <div className="space-y-10">
      <header className="border-b border-gray-200 pb-8 md:pb-10">
        <Link
          to="/admin/client/$id/orchestration"
          params={{ id: clientId }}
          className="mb-6 inline-block text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          ← Return to orchestration
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Active Pipeline</h1>
        <p className="mt-2 text-sm text-gray-500">
          Review and approve generated outbound sequences.
        </p>
      </header>

      <BulkLeadInjector
        clientId={clientId}
        onProcessingComplete={() => setQueueRefreshKey((key) => key + 1)}
      />

      <HumanReviewQueue clientId={clientId} refreshKey={queueRefreshKey} embedded />
    </div>
  );
}
