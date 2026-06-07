import { useCallback, useEffect, useState } from "react";
import {
  AdminDataTable,
  AdminPageHeader,
  formatAdminDate,
} from "@/components/admin/AdminBrutalist";
import {
  fetchUnifiedInboxData,
  type UnifiedInboxLead,
} from "@/lib/admin/unifiedInboxData";

export function AdminUnifiedInbox() {
  const [rows, setRows] = useState<UnifiedInboxLead[]>([]);
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
        description="Cross-workspace reply signals · status replied · all workspaces"
      />

      {error ? (
        <p className="font-mono text-[10px] tracking-[0.14em] text-red-700 uppercase">
          Error // {error}
        </p>
      ) : null}

      <AdminDataTable<UnifiedInboxLead>
        recordLabel="Reply Queue"
        columns={[
          {
            key: "workspace",
            header: "Workspace",
            render: (lead) => (
              <span className="text-sm tracking-[0.04em] uppercase">
                {lead.clients?.company_name?.trim() || "—"}
              </span>
            ),
          },
          {
            key: "prospect",
            header: "Prospect",
            render: (lead) => (
              <span className="text-sm tracking-[0.04em] uppercase">
                {lead.target_company?.trim() || lead.prospect_name?.trim() || "—"}
              </span>
            ),
          },
          {
            key: "date",
            header: "Date",
            align: "right",
            render: (lead) => (
              <span className="text-[10px] tracking-[0.1em] text-ink/55 uppercase tabular-nums">
                {formatAdminDate(lead.last_activity ?? lead.created_at ?? null)}
              </span>
            ),
          },
        ]}
        rows={rows}
        rowKey={(lead) => lead.id}
        isLoading={isLoading}
        emptyMessage="No replied leads across workspaces."
      />
    </section>
  );
}
