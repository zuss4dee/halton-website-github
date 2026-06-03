import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  LEAD_CAMPAIGN_STATUS,
  LEAD_QUEUE_STATUS,
  type LeadRow,
} from "@/lib/admin/leadsRepository";
import { sendApprovedLeadEmail } from "@/lib/admin/outboundSend";
import { supabase } from "@/lib/supabase";

type WorkspaceOutboundQueueProps = {
  clientId: string;
  refreshKey?: number;
  embedded?: boolean;
};

/** Alias for workspace human review queue & outbox */
export type HumanReviewQueueProps = WorkspaceOutboundQueueProps;
export function HumanReviewQueue(props: WorkspaceOutboundQueueProps) {
  return <WorkspaceOutboundQueue {...props} />;
}

type QueueTab = "pending" | "sent";

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
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-4 py-2 font-mono text-[10px] tracking-[0.16em] uppercase transition-colors ${
        active
          ? "border-ink bg-ink text-paper"
          : "border-hairline bg-paper text-ink-soft hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

export function WorkspaceOutboundQueue({
  clientId,
  refreshKey = 0,
  embedded = false,
}: WorkspaceOutboundQueueProps) {
  const workspaceClientId = clientId.trim();

  const [activeTab, setActiveTab] = useState<QueueTab>("pending");
  const [queue, setQueue] = useState<LeadRow[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [editedCopy, setEditedCopy] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [listPage, setListPage] = useState(1);

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
      activeTab === "pending" ? LEAD_QUEUE_STATUS.PENDING : LEAD_QUEUE_STATUS.SENT;

    let query = supabase
      .from("leads")
      .select("*")
      .eq("client_id", workspaceClientId)
      .eq("queue_status", queueStatus);

    query =
      activeTab === "sent"
        ? query.order("sent_at", { ascending: false, nullsFirst: false })
        : query.order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("OUTBOUND QUEUE FETCH ERROR:", error);
      setQueue([]);
    } else {
      const rows = (data ?? []) as LeadRow[];
      setQueue(rows.filter((row) => row.client_id === workspaceClientId));
    }

    setIsLoading(false);
  }, [activeTab, workspaceClientId]);

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
    if (!selectedLead?.id || isSubmitting || isSentTab || !workspaceClientId) return;
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
    setIsSubmitting(false);
  };

  const handleDiscard = async () => {
    if (!selectedLead?.id || isSubmitting || isSentTab || !workspaceClientId) return;
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
    setIsSubmitting(false);
  };

  const listHeading = isSentTab ? "01 // SENT_HISTORY" : "01 // PENDING_TARGETS";
  const editorHeading = isSentTab ? "02 // SENT_COPY" : "02 // DRAFT_EDITOR";
  const emptyListCopy = isSentTab
    ? "OUTBOX_EMPTY // NO_SENT_CAMPAIGNS"
    : "QUEUE_EMPTY // NO_DRAFTS_PENDING";

  return (
    <section className={`flex flex-col ${embedded ? "" : "min-h-[60vh]"}`}>
      {!embedded ? (
        <header className="border-b border-hairline pb-8 md:pb-10">
          <Link
            to="/admin/client/$id/orchestration"
            params={{ id: workspaceClientId }}
            className="mb-6 inline-block font-mono text-[11px] tracking-[0.16em] uppercase text-ink-soft transition-colors hover:text-ink"
          >
            &lt; RETURN_TO_ORCHESTRATION
          </Link>
          <div className="eyebrow mb-4">04 // Outbound Queue</div>
          <h1 className="font-display text-[clamp(2rem,6vw,4.5rem)] leading-[0.88] tracking-[-0.04em]">
            OUTBOUND_QUEUE // HUMAN_REVIEW
          </h1>
          <p className="mt-4 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
            WORKSPACE_SCOPED // {workspaceClientId || "NO_CLIENT"}
          </p>
          <p className="mt-1 font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft/80">
            {isSentTab
              ? "OUTBOX_LAYER // DEPLOYED_CAMPAIGN_HISTORY"
              : "APPROVAL_LAYER // AI_DRAFTS_PENDING_RELEASE"}
          </p>
        </header>
      ) : (
        <div className="mb-4 border-b border-hairline pb-3">
          <h3 className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
            Human Review Queue
          </h3>
        </div>
      )}

      <div className={`flex flex-wrap gap-2 ${embedded ? "" : "mt-6"}`}>
        <QueueTabButton
          active={activeTab === "pending"}
          label="Pending Approval"
          onClick={() => setActiveTab("pending")}
        />
        <QueueTabButton
          active={activeTab === "sent"}
          label="Sent History"
          onClick={() => setActiveTab("sent")}
        />
      </div>

      {statusMessage ? (
        <div className="mt-6 border border-green-800 bg-green-950/30 px-4 py-3 font-mono text-xs tracking-[0.12em] text-green-400">
          {statusMessage}
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-4">
          <h2 className="mb-4 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
            {listHeading}
          </h2>

          <div className="flex max-h-[600px] flex-col border border-hairline">
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
            {isLoading ? (
              <div className="px-3 py-6 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
                LOADING_QUEUE...
              </div>
            ) : queue.length === 0 ? (
              <div className="px-3 py-6 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
                {emptyListCopy}
              </div>
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
                    className={`w-full border border-gray-800 p-3 text-left transition-colors ${
                      isSelected ? "bg-gray-900" : "bg-black hover:bg-gray-950"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-xs uppercase tracking-[0.12em] text-white">
                          {name}
                        </div>
                        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-gray-500">
                          {company}
                        </div>
                      </div>
                      {isSentTab ? (
                        <Check
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500/90"
                          strokeWidth={2.5}
                          aria-hidden
                        />
                      ) : (
                        <span className="shrink-0 bg-yellow-400 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-black">
                          [PENDING]
                        </span>
                      )}
                    </div>
                    {isSentTab ? (
                      <p className="mt-2 font-mono text-[9px] tracking-[0.08em] text-gray-600">
                        Sent on {sentLabel}
                      </p>
                    ) : null}
                  </button>
                );
              })
            )}
            </div>

            {!isLoading && totalItems > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-paper px-3 py-2">
                <span className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-soft">
                  {rangeStart} – {rangeEnd} of {totalItems}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={safeListPage <= 1}
                    onClick={() => setListPage((page) => Math.max(1, page - 1))}
                    className="border border-hairline px-2 py-1 font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={safeListPage >= totalPages}
                    onClick={() => setListPage((page) => Math.min(totalPages, page + 1))}
                    className="border border-hairline px-2 py-1 font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="lg:col-span-8">
          <h2 className="mb-4 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
            {editorHeading}
          </h2>

          {!selectedLead ? (
            <div className="flex h-96 items-center justify-center border border-gray-800 bg-black font-mono text-xs tracking-[0.16em] uppercase text-gray-500">
              &gt; NO_TARGET_SELECTED
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border border-gray-800 bg-black px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-500">
                TARGET: {selectedLead.prospect_name ?? "—"} //{" "}
                {selectedLead.email ?? "NO_EMAIL_ON_FILE"}
              </div>

              <textarea
                value={editedCopy}
                onChange={(e) => setEditedCopy(e.target.value)}
                readOnly={isSentTab}
                className={`h-96 w-full resize-y border border-gray-800 bg-black p-4 font-mono text-xs leading-relaxed focus:outline-none ${
                  isSentTab
                    ? "cursor-default text-gray-400"
                    : "text-gray-300 focus:border-gray-600"
                }`}
              />

              {isSentTab ? (
                <div className="flex items-center gap-2 border border-gray-800 bg-black px-4 py-3 font-mono text-[10px] tracking-[0.08em] text-gray-500">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500/90" strokeWidth={2.5} aria-hidden />
                  <span>Sent on {formatSentLabel(selectedLead.sent_at, selectedLead.created_at)}</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleDiscard()}
                    disabled={isSubmitting}
                    className="rounded-none border border-gray-800 px-4 py-3 font-mono text-[11px] tracking-[0.16em] uppercase text-gray-400 transition-colors hover:border-gray-600 hover:text-white disabled:opacity-40"
                  >
                    [ DISCARD_DRAFT ]
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleApprove()}
                    disabled={isSubmitting}
                    className="rounded-none border border-green-700 bg-green-900/40 px-4 py-3 font-mono text-[11px] tracking-[0.16em] uppercase text-green-300 transition-colors hover:bg-green-800/60 hover:text-green-200 disabled:opacity-40"
                  >
                    [ APPROVE_AND_SEND ]
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
