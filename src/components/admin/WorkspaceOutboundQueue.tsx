import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AttentionDot } from "@/components/admin/AttentionDot";
import {
  LEAD_CAMPAIGN_STATUS,
  LEAD_QUEUE_STATUS,
  HUMAN_REVIEW_QUEUE_STATUSES,
  type LeadRow,
} from "@/lib/admin/leadsRepository";
import { AddLeadTrigger } from "@/components/admin/AddLeadSheet";
import { sendApprovedLeadEmail } from "@/lib/admin/outboundSend";
import { resolveWorkspaceClientId } from "@/lib/admin/resolveWorkspaceClientId";
import { useWorkspaceAttention } from "@/lib/admin/useWorkspaceAttention";
import { invalidateWorkspaceAttention } from "@/lib/admin/workspaceAttentionEvents";
import { supabase } from "@/lib/supabase";

type WorkspaceOutboundQueueProps = {
  clientId: string;
  refreshKey?: number;
  embedded?: boolean;
  onAddLead?: () => void;
};

/** Alias for workspace human review queue & outbox */
export type HumanReviewQueueProps = WorkspaceOutboundQueueProps;
export function HumanReviewQueue(props: WorkspaceOutboundQueueProps) {
  return <WorkspaceOutboundQueue {...props} />;
}

type QueueTab = "active" | "pending" | "sent";

const LIST_PAGE_SIZE = 10;

function formatSentLabel(value: string | null | undefined, fallback?: string | null) {
  const raw = value ?? fallback;
  if (!raw) return "—";

  try {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "—";

    const month = date.toLocaleString("en-US", { month: "long" });
    const day = date.getDate();
    const time = date.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    return `${month} ${day} at ${time}`;
  } catch {
    return "—";
  }
}

function QueueTabButton({
  active,
  label,
  onClick,
  attention = false,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  attention?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={attention ? `${label} — needs attention` : undefined}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-gray-900 text-white"
          : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"
      }`}
    >
      <span className="inline-flex items-center gap-2">
        {attention ? <AttentionDot /> : null}
        <span>{label}</span>
      </span>
    </button>
  );
}

export function WorkspaceOutboundQueue({
  clientId,
  refreshKey = 0,
  embedded = false,
  onAddLead,
}: WorkspaceOutboundQueueProps) {
  const { hasPendingDrafts, refetch: refetchAttention } = useWorkspaceAttention(clientId, {
    refreshKey,
  });
  const [workspaceClientId, setWorkspaceClientId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<QueueTab>("active");
  const [queue, setQueue] = useState<LeadRow[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [editedCopy, setEditedCopy] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [listPage, setListPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const resolved = await resolveWorkspaceClientId(clientId);
      if (!cancelled) {
        setWorkspaceClientId(resolved);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const syncAttention = useCallback(() => {
    void refetchAttention();
    invalidateWorkspaceAttention(clientId);
  }, [clientId, refetchAttention]);

  const showPendingAttention =
    hasPendingDrafts && !(activeTab === "pending" && !isLoading && queue.length === 0);
  const isActiveTab = activeTab === "active";
  const isSentTab = activeTab === "sent";
  const totalItems = queue.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / LIST_PAGE_SIZE));
  const safeListPage = Math.min(listPage, totalPages);
  const rangeStart = totalItems === 0 ? 0 : (safeListPage - 1) * LIST_PAGE_SIZE + 1;
  const rangeEnd = Math.min(safeListPage * LIST_PAGE_SIZE, totalItems);
  const paginatedQueue = queue.slice(
    (safeListPage - 1) * LIST_PAGE_SIZE,
    safeListPage * LIST_PAGE_SIZE,
  );

  const fetchQueue = useCallback(async () => {
    if (!workspaceClientId) {
      setQueue([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const queueStatus =
      activeTab === "pending"
        ? HUMAN_REVIEW_QUEUE_STATUSES
        : activeTab === "sent"
          ? LEAD_QUEUE_STATUS.SENT
          : LEAD_QUEUE_STATUS.ACTIVE;

    let query = supabase
      .from("leads")
      .select("*")
      .eq("client_id", workspaceClientId);

    query =
      activeTab === "pending"
        ? query.in("queue_status", [...HUMAN_REVIEW_QUEUE_STATUSES])
        : query.eq("queue_status", queueStatus as string);

    query =
      activeTab === "sent"
        ? query.order("sent_at", { ascending: false, nullsFirst: false })
        : activeTab === "active"
          ? query.order("next_send_date", { ascending: true, nullsFirst: false })
          : query.order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("OUTBOUND QUEUE FETCH ERROR:", error);
      setQueue([]);
    } else {
      const rows = (data ?? []) as LeadRow[];
      setQueue(rows.filter((row) => row.client_id === workspaceClientId));
      if (activeTab === "pending" && rows.length === 0) {
        syncAttention();
      }
    }

    setIsLoading(false);
  }, [activeTab, syncAttention, workspaceClientId]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue, refreshKey]);

  useEffect(() => {
    setSelectedLead(null);
    setEditedCopy("");
    setListPage(1);
  }, [activeTab]);

  useEffect(() => {
    if (listPage > totalPages) {
      setListPage(totalPages);
    }
  }, [listPage, totalPages]);

  useEffect(() => {
    setListPage(1);
  }, [refreshKey]);

  useEffect(() => {
    setEditedCopy(selectedLead?.generated_copy ?? "");
  }, [selectedLead]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = window.setTimeout(() => setStatusMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  const handleApprove = async () => {
    if (!selectedLead?.id || isSubmitting || isSentTab || isActiveTab || !workspaceClientId) {
      return;
    }
    if (selectedLead.client_id && selectedLead.client_id !== workspaceClientId) {
      console.error("WORKSPACE_ISOLATION: lead client_id mismatch");
      return;
    }

    const recipientEmail = selectedLead.email?.trim();
    if (!recipientEmail) {
      setStatusMessage("> ERROR: LEAD HAS NO EMAIL — CANNOT SEND");
      return;
    }

    if (!editedCopy.trim()) {
      setStatusMessage("> ERROR: DRAFT BODY IS EMPTY");
      return;
    }

    setIsSubmitting(true);

    const { error: approveError } = await supabase
      .from("leads")
      .update({
        queue_status: LEAD_QUEUE_STATUS.APPROVED,
        generated_copy: editedCopy,
      })
      .eq("id", selectedLead.id)
      .eq("client_id", workspaceClientId);

    if (approveError) {
      console.error("APPROVE STATUS ERROR:", approveError);
      setStatusMessage("> ERROR: FAILED TO MARK DRAFT APPROVED");
      setIsSubmitting(false);
      return;
    }

    const company =
      selectedLead.target_company?.trim() ||
      selectedLead.company_name?.trim() ||
      "your team";

    const sendResult = await sendApprovedLeadEmail({
      clientId: workspaceClientId,
      leadId: selectedLead.id,
      email: recipientEmail,
      body: editedCopy,
      subject: `Quick question for ${company}`,
    });

    if (!sendResult.success) {
      console.error("APPROVE SEND ERROR:", sendResult.error);
      setStatusMessage(`> SEND FAILED: ${sendResult.error ?? "unknown"}`);
      setIsSubmitting(false);
      return;
    }

    setSelectedLead(null);
    setEditedCopy("");
    setStatusMessage("> SYSTEM: SENT VIA RESEND — RECORD ARCHIVED TO OUTBOX");
    await fetchQueue();
    syncAttention();
    setIsSubmitting(false);
  };

  const handleDiscard = async () => {
    if (!selectedLead?.id || isSubmitting || isSentTab || isActiveTab || !workspaceClientId) {
      return;
    }
    if (selectedLead.client_id && selectedLead.client_id !== workspaceClientId) {
      console.error("WORKSPACE_ISOLATION: lead client_id mismatch");
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase
      .from("leads")
      .update({
        queue_status: LEAD_QUEUE_STATUS.DISCARDED,
        campaign_status: LEAD_CAMPAIGN_STATUS.DISCARDED,
        generated_copy: null,
        sent_at: null,
      })
      .eq("id", selectedLead.id)
      .eq("client_id", workspaceClientId);

    if (error) {
      console.error("DISCARD DRAFT ERROR:", error);
      setIsSubmitting(false);
      return;
    }

    setSelectedLead(null);
    setEditedCopy("");
    await fetchQueue();
    syncAttention();
    setIsSubmitting(false);
  };

  const listHeading = isActiveTab
    ? "Active sequence"
    : isSentTab
      ? "Sent history"
      : "Pending targets";
  const editorHeading = isActiveTab
    ? "Sequence status"
    : isSentTab
      ? "Sent copy"
      : "Draft editor";
  const emptyListCopy = isActiveTab
    ? "No leads in the active sequence."
    : isSentTab
      ? "No sent campaigns yet."
      : "No drafts pending approval.";

  return (
    <section className={`flex flex-col ${embedded ? "" : "min-h-[60vh]"}`}>
      {!embedded ? (
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
      ) : null}

      <div className={`flex flex-wrap gap-2 ${embedded ? "" : "mt-6"}`}>
        <QueueTabButton
          active={activeTab === "active"}
          label="In Sequence"
          onClick={() => setActiveTab("active")}
        />
        <QueueTabButton
          active={activeTab === "pending"}
          label="Pending Approval"
          attention={showPendingAttention}
          onClick={() => setActiveTab("pending")}
        />
        <QueueTabButton
          active={activeTab === "sent"}
          label="Sent History"
          onClick={() => setActiveTab("sent")}
        />
      </div>

      {statusMessage ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {statusMessage}
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-gray-700">{listHeading}</h2>
            {onAddLead ? <AddLeadTrigger onClick={onAddLead} /> : null}
          </div>

          <div className="flex max-h-[600px] flex-col rounded-lg border border-gray-200 bg-white">
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
            {isLoading ? (
              <div className="px-3 py-6 text-sm text-gray-500">Loading queue…</div>
            ) : queue.length === 0 ? (
              <div className="px-3 py-6 text-sm text-gray-500">{emptyListCopy}</div>
            ) : (
              paginatedQueue.map((lead) => {
                const isSelected = selectedLead?.id === lead.id;
                const name = lead.prospect_name?.trim() || "Unknown Prospect";
                const company = lead.target_company?.trim() || "—";
                const sentLabel = formatSentLabel(lead.sent_at, lead.created_at);

                return (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => setSelectedLead(lead)}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${
                      isSelected
                        ? "border-gray-300 bg-gray-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{name}</div>
                        <div className="mt-1 text-xs text-gray-500">{company}</div>
                      </div>
                      {isSentTab ? (
                        <Check
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
                          strokeWidth={2.5}
                          aria-hidden
                        />
                      ) : isActiveTab ? (
                        <span className="shrink-0 rounded-full bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700">
                          Active
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                          Pending
                        </span>
                      )}
                    </div>
                    {isSentTab ? (
                      <p className="mt-2 text-xs text-gray-500">Sent on {sentLabel}</p>
                    ) : isActiveTab ? (
                      <p className="mt-2 text-xs text-gray-500">
                        Step {lead.current_sequence_step ?? 1}
                        {lead.next_send_date
                          ? ` · Next ${formatSentLabel(lead.next_send_date)}`
                          : ""}
                      </p>
                    ) : null}
                  </button>
                );
              })
            )}
            </div>

            {!isLoading && totalItems > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-xs text-gray-500">
                  {rangeStart} – {rangeEnd} of {totalItems}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={safeListPage <= 1}
                    onClick={() => setListPage((page) => Math.max(1, page - 1))}
                    className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={safeListPage >= totalPages}
                    onClick={() => setListPage((page) => Math.min(totalPages, page + 1))}
                    className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="lg:col-span-8">
          <h2 className="mb-4 text-sm font-medium text-gray-700">{editorHeading}</h2>

          {!selectedLead ? (
            <div className="flex h-96 items-center justify-center rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">
                {isActiveTab
                  ? "Select a lead to view sequence placement."
                  : "Select a target to review their outreach draft."}
              </p>
            </div>
          ) : isActiveTab ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm">
                <p className="text-sm font-medium text-gray-900">
                  {selectedLead.prospect_name?.trim() || "Unknown Prospect"}
                </p>
                <p className="mt-1 text-sm text-gray-600">{selectedLead.email ?? "—"}</p>
                <p className="mt-1 text-sm text-gray-600">
                  {selectedLead.target_company?.trim() || "—"}
                </p>
              </div>
              <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-4 text-sm text-violet-900 shadow-sm">
                <p>
                  Sequence step {selectedLead.current_sequence_step ?? 1} · queue active
                </p>
                {selectedLead.next_send_date ? (
                  <p className="mt-2 text-violet-800/80">
                    Next send {formatSentLabel(selectedLead.next_send_date)}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-900">
                    {selectedLead.prospect_name ?? "—"}
                  </span>
                  <span className="text-gray-400"> · </span>
                  {selectedLead.email ?? "No email on file"}
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <textarea
                  value={editedCopy}
                  onChange={(e) => setEditedCopy(e.target.value)}
                  readOnly={isSentTab}
                  className={`h-96 w-full resize-y rounded-md border-0 bg-transparent p-0 text-sm leading-relaxed text-gray-800 focus:outline-none focus:ring-0 ${
                    isSentTab ? "cursor-default text-gray-600" : ""
                  }`}
                />
              </div>

              {isSentTab ? (
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={2.5} aria-hidden />
                  <span>Sent on {formatSentLabel(selectedLead.sent_at, selectedLead.created_at)}</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleDiscard()}
                    disabled={isSubmitting}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Discard draft
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleApprove()}
                    disabled={isSubmitting}
                    className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
                  >
                    Approve and send
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
