import { useCallback, useEffect, useState } from "react";
import {
  AdminDataTable,
  AdminPageHeader,
  formatAdminDate,
} from "@/components/admin/AdminBrutalist";
import {
  fetchDomainFleetFromApi,
  type DnsStatusLabel,
  type DomainFleetRow,
} from "@/lib/admin/domainFleetData";

function DnsStatusBadge({ status }: { status: DnsStatusLabel }) {
  if (status === "VERIFIED") {
    return (
      <span className="inline-block border-2 border-ink bg-ink px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.2em] text-paper uppercase">
        Verified
      </span>
    );
  }

  if (status === "FAILED") {
    return (
      <span className="inline-block border-2 border-ink bg-ink px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.2em] text-paper uppercase">
        Failed
      </span>
    );
  }

  if (status === "UNASSIGNED") {
    return (
      <span className="inline-block border border-hairline px-2.5 py-1 font-mono text-[10px] tracking-[0.18em] text-ink/40 uppercase">
        Unassigned
      </span>
    );
  }

  return (
    <span className="inline-block border-2 border-ink px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.2em] text-ink uppercase">
      Pending
    </span>
  );
}

export function AdminDomainFleet() {
  const [rows, setRows] = useState<DomainFleetRow[]>([]);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const payload = await fetchDomainFleetFromApi();
    setRows(payload.rows);
    setCheckedAt(payload.checkedAt);
    setError(payload.error);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const verifiedCount = rows.filter((r) => r.dnsStatus === "VERIFIED").length;

  return (
    <section className="space-y-10">
      <AdminPageHeader
        code="02 // DOMAIN_FLEET"
        title="Domain Fleet"
        description="Agency-wide sending infrastructure · Resend DNS × client sending_domain"
        trailing={
          <button
            type="button"
            onClick={() => void load()}
            disabled={isLoading}
            className="shrink-0 border border-ink bg-ink px-4 py-2.5 font-mono text-[10px] tracking-[0.18em] text-paper uppercase transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLoading ? "Pinging…" : "Ping Infrastructure"}
          </button>
        }
      />

      {!isLoading && checkedAt ? (
        <p className="font-mono text-[9px] tracking-[0.16em] text-ink/40 uppercase">
          Last infrastructure ping // {formatAdminDate(checkedAt)}
          {rows.length > 0 ? (
            <span className="tabular-nums">
              {" "}
              · {verifiedCount} verified / {rows.length} clients
            </span>
          ) : null}
        </p>
      ) : null}

      {error ? (
        <p className="font-mono text-[10px] tracking-[0.14em] text-ink uppercase" role="alert">
          Error // {error}
        </p>
      ) : null}

      <AdminDataTable<DomainFleetRow>
        recordLabel="Infrastructure Registry"
        columns={[
          {
            key: "client",
            header: "Client",
            render: (row) => (
              <span className="text-sm tracking-[0.04em] uppercase">{row.client}</span>
            ),
          },
          {
            key: "sending_domain",
            header: "Sending Domain",
            render: (row) => (
              <span className="text-sm tracking-[0.04em] text-ink/80 uppercase">
                {row.sendingDomain}
              </span>
            ),
          },
          {
            key: "dns_status",
            header: "Dns Status",
            render: (row) => <DnsStatusBadge status={row.dnsStatus} />,
          },
          {
            key: "last_checked",
            header: "Last Checked",
            align: "right",
            render: (row) => (
              <span className="text-[10px] tracking-[0.1em] text-ink/55 uppercase tabular-nums">
                {formatAdminDate(row.lastChecked)}
              </span>
            ),
          },
        ]}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyMessage="No clients in registry"
      />
    </section>
  );
}
