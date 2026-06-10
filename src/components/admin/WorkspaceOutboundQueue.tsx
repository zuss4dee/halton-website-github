import { Link } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AttentionDot } from "@/components/admin/AttentionDot";
import {
  LEAD_CAMPAIGN_STATUS,
  LEAD_QUEUE_STATUS,
  type LeadRow,
} from "@/lib/admin/leadsRepository";
import { AddLeadTrigger } from "@/components/admin/AddLeadSheet";
import {
  loadDraftFromLead,
  OutboundDraftEditor,
} from "@/components/admin/OutboundDraftEditor";
import {
  mergeLeadFormDataWithDraftSubject,
  resolveDraftRejectionHistory,
} from "@/lib/outbound/outboundDraft";
import { regenerateOutboundDraft } from "@/lib/admin/regenerateOutboundDraft";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchActiveSequenceLeads,
  fetchPendingApprovalLeads,
  fetchSentLeads,
} from "@/lib/admin/leadsQueueData";
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

type RegenerateJob = {
  leadId: string;
  label: string;
};

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

  const [activeTab, setActiveTab] = useState<QueueTab>("pending");
  const [queue, setQueue] = useState<LeadRow[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [regeneratingJobs, setRegeneratingJobs] = useState<Record<string, RegenerateJob>>({});
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | "info">("success");
  const mountedRef = useRef(true);
  const [listPage, setListPage] = useState(1);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const regeneratingCount = Object.keys(regeneratingJobs).length;
  const isLeadRegenerating = useCallback(
    (leadId: string) => Boolean(regeneratingJobs[leadId]),
    [regeneratingJobs],
  );
  const selectedLeadRegenerating = selectedLead ? isLeadRegenerating(selectedLead.id) : false;

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

    try {
      const rows =
        activeTab === "pending"
          ? await fetchPendingApprovalLeads(workspaceClientId)
          : activeTab === "sent"
            ? await fetchSentLeads(workspaceClientId)
            : await fetchActiveSequenceLeads(workspaceClientId);

      setQueue(rows);
      if (activeTab === "pending" && rows.length === 0) {
        syncAttention();
      }
    } catch (error) {
      console.error("OUTBOUND QUEUE FETCH ERROR:", error);
      setQueue([]);
    }

    setIsLoading(false);
  }, [activeTab, syncAttention, workspaceClientId]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue, refreshKey]);

  useEffect(() => {
    setSelectedLead(null);
    setEditedSubject("");
    setEditedBody("");
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
    if (!selectedLead) {
      setEditedSubject("");
      setEditedBody("");
      return;
    }

    const draft = loadDraftFromLead(selectedLead, isSentTab);
    setEditedSubject(draft.subject);
    setEditedBody(draft.body);
  }, [selectedLead, isSentTab]);

  useEffect(() => {
    if (!statusMessage) return;
    const duration = statusTone === "error" ? 8000 : 5000;
    const timer = window.setTimeout(() => setStatusMessage(null), duration);
    return () => window.clearTimeout(timer);
  }, [statusMessage, statusTone]);

  const showStatus = useCallback((message: string, tone: "success" | "error" | "info" = "success") => {
    if (!mountedRef.current) return;
    setStatusTone(tone);
    setStatusMessage(message);
  }, []);

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

    if (!editedBody.trim()) {
      setStatusMessage("> ERROR: DRAFT BODY IS EMPTY");
      return;
    }

    const trimmedSubject = editedSubject.trim();
    if (!trimmedSubject) {
      setStatusMessage("> ERROR: SUBJECT LINE IS EMPTY");
      return;
    }

    setIsSubmitting(true);

    const nextFormData = mergeLeadFormDataWithDraftSubject(
      selectedLead.form_data,
      trimmedSubject,
    );

    const { error: approveError } = await supabase
      .from("leads")
      .update({
        queue_status: LEAD_QUEUE_STATUS.APPROVED,
        generated_copy: editedBody.trim(),
        form_data: nextFormData,
      })
      .eq("id", selectedLead.id)
      .eq("client_id", workspaceClientId);

    if (approveError) {
      console.error("APPROVE STATUS ERROR:", approveError);
      setStatusMessage("> ERROR: FAILED TO MARK DRAFT APPROVED");
      setIsSubmitting(false);
      return;
    }

    const sendResult = await sendApprovedLeadEmail({
      clientId: workspaceClientId,
      leadId: selectedLead.id,
      email: recipientEmail,
      body: editedBody.trim(),
      subject: trimmedSubject,
    });

    if (!sendResult.success) {
      console.error("APPROVE SEND ERROR:", sendResult.error);
      setStatusMessage(`> SEND FAILED: ${sendResult.error ?? "unknown"}`);
      setIsSubmitting(false);
      return;
    }

    setSelectedLead(null);
    setEditedSubject("");
    setEditedBody("");
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
    setEditedSubject("");
    setEditedBody("");
    await fetchQueue();
    syncAttention();
    setIsSubmitting(false);
  };

  const handleRejectAndRegenerate = () => {
    if (
      !selectedLead?.id ||
      isSubmitting ||
      selectedLeadRegenerating ||
      isSentTab ||
      isActiveTab ||
      !workspaceClientId
    ) {
      return;
    }

    const reason = rejectReason.trim();
    if (!reason) {
      showStatus("Add a rejection reason for the writer.", "error");
      return;
    }

    const leadId = selectedLead.id;
    const label =
      selectedLead.prospect_name?.trim() ||
      selectedLead.target_company?.trim() ||
      selectedLead.email?.trim() ||
      "lead";
    const payload = {
      clientId: workspaceClientId,
      lead: selectedLead,
      reason,
      priorSubject: editedSubject,
      priorBody: editedBody,
    };

    setRejectDialogOpen(false);
    setRejectReason("");
    setRegeneratingJobs((current) => ({
      ...current,
      [leadId]: { leadId, label },
    }));
    showStatus(`Regenerating ${label} in the background — you can keep working.`, "info");

    void (async () => {
      const result = await regenerateOutboundDraft(payload);

      if (!mountedRef.current) return;

      setRegeneratingJobs((current) => {
        const next = { ...current };
        delete next[leadId];
        return next;
      });

      if (!result.success) {
        console.error("REGENERATE DRAFT ERROR:", result.error);
        showStatus(`Regenerate failed for ${label}: ${result.error ?? "unknown"}`, "error");
        return;
      }

      await fetchQueue();

      const { data: refreshedLead, error: refreshError } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .eq("client_id", workspaceClientId)
        .maybeSingle();

      if (!mountedRef.current) return;

      if (refreshError) {
        console.error("REGENERATE REFRESH ERROR:", refreshError);
      } else if (refreshedLead) {
        setSelectedLead((current) =>
          current?.id === leadId ? (refreshedLead as LeadRow) : current,
        );
      }

      showStatus(`New draft ready for ${label} — review when you're free.`, "success");
      syncAttention();
    })();
  };

  const rejectionHistory = selectedLead ? resolveDraftRejectionHistory(selectedLead) : [];

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
          <h1 className="text-3xl font-bold text-gray-900">Approve &amp; Send</h1>
          <p className="mt-2 text-sm text-gray-500">
            Review pending drafts and approve outbound emails for sending.
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

      {regeneratingCount > 0 ? (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          <span>
            Regenerating {regeneratingCount} draft{regeneratingCount === 1 ? "" : "s"} in the
            background — switch leads or tabs while you wait.
          </span>
        </div>
      ) : null}

      {statusMessage ? (
        <div
          className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
            statusTone === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : statusTone === "info"
                ? "border-blue-200 bg-blue-50 text-blue-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
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
                const leadRegenerating = isLeadRegenerating(lead.id);
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
                      ) : leadRegenerating ? (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                          Regenerating
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
                {rejectionHistory.length > 0 && !isSentTab ? (
                  <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                    <p className="font-medium">Previous rejection feedback</p>
                    <ul className="mt-2 space-y-2 text-xs text-amber-900/90">
                      {rejectionHistory.map((entry) => (
                        <li key={`${entry.rejected_at}-${entry.reason}`}>
                          <span className="font-medium">{entry.reason}</span>
                          {entry.rejected_at ? (
                            <span className="text-amber-800/70">
                              {" "}
                              · {formatSentLabel(entry.rejected_at)}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {selectedLeadRegenerating ? (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    <span>Regenerating this draft in the background…</span>
                  </div>
                ) : null}
                <OutboundDraftEditor
                  lead={selectedLead}
                  readOnly={isSentTab}
                  subject={editedSubject}
                  body={editedBody}
                  onSubjectChange={setEditedSubject}
                  onBodyChange={setEditedBody}
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
                    disabled={isSubmitting || selectedLeadRegenerating}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Discard draft
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectDialogOpen(true)}
                    disabled={isSubmitting || selectedLeadRegenerating}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900 transition-colors hover:border-amber-300 hover:bg-amber-100 disabled:opacity-40"
                  >
                    {selectedLeadRegenerating ? "Regenerating…" : "Reject & regenerate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleApprove()}
                    disabled={isSubmitting || selectedLeadRegenerating}
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

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reject & regenerate</DialogTitle>
            <DialogDescription>
              Tell the writer what to fix. Regeneration runs in the background — you can close this
              dialog and work on other leads.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            rows={4}
            placeholder="e.g. Too generic — mention their SaaS vertical and drop the dash punctuation."
            className="w-full resize-y rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setRejectDialogOpen(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleRejectAndRegenerate()}
              disabled={!rejectReason.trim()}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-40"
            >
              Start regenerate
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
