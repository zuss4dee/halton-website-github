import { useCallback, useEffect, useState } from "react";
import {
  AdminDataTable,
  AdminPageHeader,
  formatAdminDate,
} from "@/components/admin/AdminBrutalist";
import { fetchUnifiedInboxData, type UnifiedInboxRow } from "@/lib/admin/unifiedInboxData";

export function AdminUnifiedInbox() {
  const [rows, setRows] = useState<UnifiedInboxRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const payload = await fetchUnifiedInboxData();
    setRows(payload.rows);
    setError(payload.error);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-10">
      <AdminPageHeader
        code="01 // UNIFIED_INBOX"
        title="Unified Inbox"
        description="Cross-tenant reply signals · status replied · all workspaces"
      />

      {error ? (
        <p className="font-mono text-[10px] tracking-[0.14em] text-red-700 uppercase">
          Error // {error}
        </p>
      ) : null}

      <AdminDataTable<UnifiedInboxRow>
        recordLabel="Reply Queue"
        columns={[
          {
            key: "client",
            header: "Client Name",
            render: (row) => (
              <span className="text-sm tracking-[0.04em] uppercase">{row.clientName}</span>
            ),
          },
          {
            key: "lead",
            header: "Lead Name",
            render: (row) => (
              <span className="text-sm tracking-[0.04em] uppercase">{row.leadName}</span>
            ),
          },
          {
            key: "date",
            header: "Date",
            align: "right",
            render: (row) => (
              <span className="text-[10px] tracking-[0.1em] text-ink/55 uppercase tabular-nums">
                {formatAdminDate(row.activityDate)}
              </span>
            ),
          },
        ]}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyMessage="No replied leads across tenants."
      />
    </section>
  );
}
