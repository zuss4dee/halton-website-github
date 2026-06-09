import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { AddLeadSheet } from "@/components/admin/AddLeadSheet";
import { BulkLeadInjector } from "@/components/admin/BulkLeadInjector";
import { HumanReviewQueue } from "@/components/admin/WorkspaceOutboundQueue";

type WorkspaceOutboundPageProps = {
  clientId: string;
};

export function WorkspaceOutboundPage({ clientId }: WorkspaceOutboundPageProps) {
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);
  const [addLeadOpen, setAddLeadOpen] = useState(false);

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
        <h1 className="text-3xl font-bold text-gray-900">Approve &amp; Send</h1>
        <p className="mt-2 text-sm text-gray-500">
          Review pending drafts and approve outbound emails for sending.
        </p>
      </header>

      <BulkLeadInjector
        clientId={clientId}
        onProcessingComplete={() => setQueueRefreshKey((key) => key + 1)}
      />

      <AddLeadSheet
        clientId={clientId}
        open={addLeadOpen}
        onOpenChange={setAddLeadOpen}
        onSuccess={() => setQueueRefreshKey((key) => key + 1)}
      />

      <HumanReviewQueue
        clientId={clientId}
        refreshKey={queueRefreshKey}
        embedded
        onAddLead={() => setAddLeadOpen(true)}
      />
    </div>
  );
}
