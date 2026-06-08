import { useCallback, useEffect, useState } from "react";
import {
  AdminDataTable,
  AdminKpiCard,
  AdminPageHeader,
  formatAdminDate,
} from "@/components/admin/AdminBrutalist";
import {
  fetchLeadsCrmMetrics,
  fetchLeadsCrmPage,
  LEADS_CRM_PAGE_SIZE,
  type LeadsCrmMetrics,
} from "@/lib/admin/leadsCrmData";
import {
  resolveCrmStatusBadge,
  resolveLeadCampaignLabel,
  resolveLeadLastActionDate,
  type CrmStatusTone,
} from "@/lib/admin/leadsCrmStatus";
import type { LeadRow } from "@/lib/admin/leadsRepository";

type WorkspaceLeadsCrmProps = {
  clientId: string;
  companyName?: string;
};

const INITIAL_METRICS: LeadsCrmMetrics = {
  totalLeads: 0,
  pendingApprovals: 0,
  activeSends: 0,
  completedOrBounced: 0,
};

const STATUS_BADGE_CLASS: Record<CrmStatusTone, string> = {
  gray: "border border-ink/15 bg-ink/[0.04] text-ink/65",
  blue: "border border-sky-200/80 bg-sky-50 text-sky-900",
  yellow: "border border-amber-200/80 bg-amber-50 text-amber-950",
  green: "border border-emerald-200/80 bg-emerald-50 text-emerald-950",
  red: "border border-red-200/80 bg-red-50 text-red-900",
};

function CrmStatusBadge({ label, tone }: { label: string; tone: CrmStatusTone }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-1 font-mono text-[9px] tracking-[0.18em] uppercase ${STATUS_BADGE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
}

function leadDisplayName(lead: LeadRow): string {
  return lead.prospect_name?.trim() || "Unknown Prospect";
}

function leadDisplayCompany(lead: LeadRow): string {
  return lead.target_company?.trim() || lead.company_name?.trim() || "—";
}

function leadDisplayEmail(lead: LeadRow): string {
  return lead.email?.trim() || "—";
}

export function WorkspaceLeadsCrm({ clientId, companyName }: WorkspaceLeadsCrmProps) {
  const [metrics, setMetrics] = useState<LeadsCrmMetrics>(INITIAL_METRICS);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const [tableLoading, setTableLoading] = useState(true);

  const totalPages = Math.max(1, Math.ceil(totalRows / LEADS_CRM_PAGE_SIZE));
  const pageStart = totalRows === 0 ? 0 : (page - 1) * LEADS_CRM_PAGE_SIZE + 1;
  const pageEnd = Math.min(page * LEADS_CRM_PAGE_SIZE, totalRows);

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    const next = await fetchLeadsCrmMetrics(clientId);
    setMetrics(next);
    setMetricsLoading(false);
  }, [clientId]);

  const loadPage = useCallback(async () => {
    setTableLoading(true);
    const result = await fetchLeadsCrmPage(clientId, page);
    setRows(result.rows);
    setTotalRows(result.total);
    setTableLoading(false);
  }, [clientId, page]);

  useEffect(() => {
    if (totalRows === 0) return;
    const maxPage = Math.max(1, Math.ceil(totalRows / LEADS_CRM_PAGE_SIZE));
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, totalRows]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  return (
    <div className="max-w-[1400px]">
      <AdminPageHeader
        code="Leads CRM"
        title="Workspace Leads"
        description={
          companyName
            ? `Read-only master view of every lead and campaign status for ${companyName}.`
            : "Read-only master view of every lead and campaign status in this workspace."
        }
      />

      <section className="mb-12 grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-4">
        <AdminKpiCard
          label="Total Leads"
          value={metrics.totalLeads.toLocaleString()}
          isLoading={metricsLoading}
        />
        <AdminKpiCard
          label="Pending Approvals"
          value={metrics.pendingApprovals.toLocaleString()}
          isLoading={metricsLoading}
        />
        <AdminKpiCard
          label="Active Sends"
          value={metrics.activeSends.toLocaleString()}
          isLoading={metricsLoading}
        />
        <AdminKpiCard
          label="Completed / Bounced"
          value={metrics.completedOrBounced.toLocaleString()}
          isLoading={metricsLoading}
        />
      </section>

      <AdminDataTable
        recordLabel="Master Lead Registry"
        columns={[
          {
            key: "name",
            header: "Name",
            render: (lead) => (
              <span className="text-ink uppercase">{leadDisplayName(lead)}</span>
            ),
          },
          {
            key: "company",
            header: "Company",
            render: (lead) => (
              <span className="text-ink/75 uppercase">{leadDisplayCompany(lead)}</span>
            ),
          },
          {
            key: "email",
            header: "Email",
            render: (lead) => (
              <span className="text-ink/70 normal-case tracking-normal">{leadDisplayEmail(lead)}</span>
            ),
          },
          {
            key: "campaign",
            header: "Campaign / Sequence",
            render: (lead) => (
              <span className="text-ink/65 normal-case tracking-normal">
                {resolveLeadCampaignLabel(lead)}
              </span>
            ),
          },
          {
            key: "last_action",
            header: "Last Action",
            align: "right",
            render: (lead) => (
              <span className="text-ink/55 tabular-nums">
                {formatAdminDate(resolveLeadLastActionDate(lead))}
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            align: "right",
            render: (lead) => {
              const badge = resolveCrmStatusBadge(lead);
              return <CrmStatusBadge label={badge.label} tone={badge.tone} />;
            },
          },
        ]}
        rows={rows}
        rowKey={(lead) => lead.id}
        isLoading={tableLoading}
        emptyMessage="NO LEADS IN THIS WORKSPACE"
      />

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-[10px] tracking-[0.16em] text-ink/45 uppercase tabular-nums">
          {totalRows === 0
            ? "0 records"
            : `Showing ${pageStart}–${pageEnd} of ${totalRows.toLocaleString()}`}
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={tableLoading || page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="border border-hairline px-3 py-2 font-mono text-[10px] tracking-[0.16em] text-ink uppercase transition-colors hover:bg-ink/[0.04] disabled:cursor-not-allowed disabled:opacity-35"
          >
            Previous
          </button>
          <span className="font-mono text-[10px] tracking-[0.14em] text-ink/50 uppercase tabular-nums">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={tableLoading || page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            className="border border-hairline px-3 py-2 font-mono text-[10px] tracking-[0.16em] text-ink uppercase transition-colors hover:bg-ink/[0.04] disabled:cursor-not-allowed disabled:opacity-35"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
