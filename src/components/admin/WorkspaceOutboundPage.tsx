import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { BulkLeadInjector } from "@/components/admin/BulkLeadInjector";
import {
  ImportStatusBanner,
  type BulkImportStatus,
} from "@/components/admin/ImportStatusBanner";
import { HumanReviewQueue } from "@/components/admin/WorkspaceOutboundQueue";
import {
  readBulkImportSession,
  writeBulkImportSession,
} from "@/lib/admin/bulkImportSession";

type WorkspaceOutboundPageProps = {
  clientId: string;
};

export function WorkspaceOutboundPage({ clientId }: WorkspaceOutboundPageProps) {
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);
  const [importStatus, setImportStatus] = useState<BulkImportStatus | null>(() =>
    readBulkImportSession(clientId),
  );

  useEffect(() => {
    writeBulkImportSession(clientId, importStatus);
  }, [clientId, importStatus]);

  const bumpQueueRefresh = useCallback(() => {
    setQueueRefreshKey((key) => key + 1);
  }, []);

  const handleImportStatusChange = useCallback((status: BulkImportStatus | null) => {
    setImportStatus(status);
  }, []);

  const dismissImportStatus = useCallback(() => {
    setImportStatus(null);
  }, []);

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

      {importStatus ? (
        <ImportStatusBanner
          status={importStatus}
          onDismiss={importStatus.phase === "processing" ? undefined : dismissImportStatus}
          className="sticky top-3 z-30"
        />
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <BulkLeadInjector
          clientId={clientId}
          onImportStatusChange={handleImportStatusChange}
          onProcessingComplete={bumpQueueRefresh}
          onQueueCleared={bumpQueueRefresh}
        />
      </div>

      {importStatus?.phase === "processing" ? (
        <ImportStatusBanner status={importStatus} className="border-amber-300 bg-amber-50" />
      ) : null}

      <HumanReviewQueue clientId={clientId} refreshKey={queueRefreshKey} embedded />
    </div>
  );
}
