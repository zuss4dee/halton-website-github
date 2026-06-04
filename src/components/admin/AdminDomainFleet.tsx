import { useCallback, useEffect, useState } from "react";
import { AdminDataTable, AdminPageHeader } from "@/components/admin/AdminBrutalist";
import { fetchDomainFleetData, type DomainFleetRow } from "@/lib/admin/domainFleetData";

export function AdminDomainFleet() {
  const [rows, setRows] = useState<DomainFleetRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const payload = await fetchDomainFleetData();
    setRows(payload.rows);
    setError(payload.error);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const assignedCount = rows.filter((r) => r.domain !== "—").length;

  return (
    <section className="space-y-10">
      <AdminPageHeader
        code="02 // DOMAIN_FLEET"
        title="Domain Fleet"
        description="Sending domains from clients.sending_domain · no dedicated domains table"
        trailing={
          !isLoading ? (
            <span className="font-mono text-[10px] tracking-[0.14em] text-ink/40 uppercase tabular-nums">
              {assignedCount} / {rows.length} provisioned
            </span>
          ) : null
        }
      />

      {error ? (
        <p className="font-mono text-[10px] tracking-[0.14em] text-red-700 uppercase">
          Error // {error}
        </p>
      ) : null}

      <AdminDataTable<DomainFleetRow>
        recordLabel="Domain Registry"
        columns={[
          {
            key: "domain",
            header: "Domain",
            render: (row) => (
              <span className="text-sm tracking-[0.04em] uppercase">{row.domain}</span>
            ),
          },
          {
            key: "client",
            header: "Linked Client",
            render: (row) => (
              <span className="text-sm tracking-[0.04em] uppercase">{row.linkedClient}</span>
            ),
          },
          {
            key: "status",
            header: "Status",
            align: "right",
            render: (row) => (
              <span className="text-[10px] tracking-[0.12em] text-ink/55 uppercase">
                {row.status}
              </span>
            ),
          },
        ]}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyMessage="No tenants onboarded · domains appear after client setup."
      />
    </section>
  );
}
