import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import {
  AdminDataTable,
  AdminKpiCard,
  AdminPageHeader,
  formatAdminDate,
} from "@/components/admin/AdminBrutalist";
import { DeleteLeadDialog } from "@/components/admin/DeleteLeadDialog";
import { EditLeadSheet } from "@/components/admin/EditLeadSheet";
import {
  fetchLeadsCrmMetrics,
  fetchLeadsCrmPage,
  LEADS_CRM_PAGE_SIZE,
  type LeadsCrmMetrics,
} from "@/lib/admin/leadsCrmData";
import { deleteCrmLead, deleteCrmLeadsBatch } from "@/lib/admin/leadsCrmMutations";
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
  const [editLead, setEditLead] = useState<LeadRow | null>(null);
  const [deleteLead, setDeleteLead] = useState<LeadRow | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(() => new Set());
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  const selectedCount = selectedLeadIds.size;

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

  useEffect(() => {
    setSelectedLeadIds(new Set());
  }, [clientId]);

  const toggleLeadSelection = useCallback((leadId: string, selected: boolean) => {
    setSelectedLeadIds((current) => {
      const next = new Set(current);
      if (selected) {
        next.add(leadId);
      } else {
        next.delete(leadId);
      }
      return next;
    });
  }, []);

  const toggleAllVisibleLeads = useCallback(
    (selected: boolean) => {
      setSelectedLeadIds((current) => {
        const next = new Set(current);
        for (const lead of rows) {
          if (selected) {
            next.add(lead.id);
          } else {
            next.delete(lead.id);
          }
        }
        return next;
      });
    },
    [rows],
  );

  const clearSelection = useCallback(() => {
    setSelectedLeadIds(new Set());
  }, []);

  const handleLeadUpdated = useCallback(
    async (updated: LeadRow) => {
      setRows((current) =>
        current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
      );
      await loadMetrics();
    },
    [loadMetrics],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteLead?.id) return;

    setDeletingLeadId(deleteLead.id);
    const result = await deleteCrmLead({
      clientId,
      leadId: deleteLead.id,
    });

    if (!result.ok) {
      setDeletingLeadId(null);
      throw new Error(result.error);
    }

    setRows((current) => current.filter((row) => row.id !== deleteLead.id));
    setTotalRows((current) => Math.max(0, current - 1));
    setDeletingLeadId(null);
    await loadMetrics();
  }, [clientId, deleteLead, loadMetrics]);

  const handleConfirmBatchDelete = useCallback(async () => {
    const leadIds = [...selectedLeadIds];
    if (leadIds.length === 0) return;

    setIsBatchDeleting(true);
    const result = await deleteCrmLeadsBatch({
      clientId,
      leadIds,
    });

    if (!result.ok) {
      setIsBatchDeleting(false);
      throw new Error(result.error);
    }

    const deletedIds = new Set(leadIds);
    setRows((current) => current.filter((row) => !deletedIds.has(row.id)));
    setTotalRows((current) => Math.max(0, current - result.deletedCount));
    setSelectedLeadIds(new Set());
    setIsBatchDeleting(false);
    await loadMetrics();
  }, [clientId, loadMetrics, selectedLeadIds]);

  const selectionBusy = isBatchDeleting || deletingLeadId !== null;

  return (
    <div className="max-w-[1400px]">
      <AdminPageHeader
        code="Leads CRM"
        title="Workspace Leads"
        description={
          companyName
            ? `Master view of every lead and campaign status for ${companyName}.`
            : "Master view of every lead and campaign status in this workspace."
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

      {selectedCount > 0 ? (
        <div className="mb-4 flex flex-col gap-3 border border-hairline bg-ink/[0.02] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[10px] tracking-[0.16em] text-ink/60 uppercase tabular-nums">
            {selectedCount.toLocaleString()} selected
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={selectionBusy}
              onClick={clearSelection}
              className="border border-hairline px-3 py-2 font-mono text-[10px] tracking-[0.16em] text-ink uppercase transition-colors hover:bg-ink/[0.04] disabled:cursor-not-allowed disabled:opacity-35"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={selectionBusy}
              onClick={() => setBatchDeleteOpen(true)}
              className="inline-flex items-center gap-2 border border-[#c03939] px-3 py-2 font-mono text-[10px] tracking-[0.16em] text-[#c03939] uppercase transition-colors hover:bg-[#c03939] hover:text-paper disabled:cursor-not-allowed disabled:opacity-35"
            >
              {isBatchDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  Delete selected
                </>
              )}
            </button>
          </div>
        </div>
      ) : null}

      <AdminDataTable
        recordLabel="Master Lead Registry"
        selection={{
          selectedKeys: selectedLeadIds,
          onToggleRow: toggleLeadSelection,
          onToggleAll: toggleAllVisibleLeads,
          disabled: selectionBusy,
        }}
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
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (lead) => {
              const isDeleting = deletingLeadId === lead.id || isBatchDeleting;
              return (
                <div className="inline-flex items-center justify-end gap-1">
                  <button
                    type="button"
                    aria-label={`Edit ${leadDisplayName(lead)}`}
                    disabled={isDeleting || selectedCount > 0}
                    onClick={() => setEditLead(lead)}
                    className="inline-flex h-8 w-8 items-center justify-center border border-transparent text-ink/55 transition-colors hover:border-hairline hover:bg-ink/[0.04] hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${leadDisplayName(lead)}`}
                    disabled={isDeleting}
                    onClick={() => setDeleteLead(lead)}
                    className="inline-flex h-8 w-8 items-center justify-center border border-transparent text-ink/55 transition-colors hover:border-hairline hover:bg-red-50 hover:text-[#c03939] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                    )}
                  </button>
                </div>
              );
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

      <EditLeadSheet
        clientId={clientId}
        lead={editLead}
        open={editLead !== null}
        onOpenChange={(open) => {
          if (!open) setEditLead(null);
        }}
        onSuccess={handleLeadUpdated}
      />

      <DeleteLeadDialog
        open={deleteLead !== null}
        onOpenChange={(open) => {
          if (!open && !deletingLeadId) setDeleteLead(null);
        }}
        leadName={deleteLead ? leadDisplayName(deleteLead) : undefined}
        selectedCount={1}
        onConfirm={handleConfirmDelete}
      />

      <DeleteLeadDialog
        open={batchDeleteOpen}
        onOpenChange={(open) => {
          if (!open && !isBatchDeleting) setBatchDeleteOpen(false);
        }}
        selectedCount={selectedCount}
        onConfirm={handleConfirmBatchDelete}
      />
    </div>
  );
}
