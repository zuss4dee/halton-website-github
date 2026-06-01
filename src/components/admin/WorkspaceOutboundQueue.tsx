import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { LeadRow } from "@/lib/admin/leadsRepository";
import { supabase } from "@/lib/supabase";

type WorkspaceOutboundQueueProps = {
  clientId: string;
};

export function WorkspaceOutboundQueue({ clientId }: WorkspaceOutboundQueueProps) {
  const [queue, setQueue] = useState<LeadRow[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [editedCopy, setEditedCopy] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("client_id", clientId)
      .eq("campaign_status", "PENDING_REVIEW");

    if (error) {
      console.error("OUTBOUND QUEUE FETCH ERROR:", error);
      setQueue([]);
    } else if (data) {
      setQueue(data as LeadRow[]);
    }

    setIsLoading(false);
  }, [clientId]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    setEditedCopy(selectedLead?.generated_copy ?? "");
  }, [selectedLead]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = window.setTimeout(() => setStatusMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  const handleApprove = async () => {
    if (!selectedLead?.id || isSubmitting) return;

    setIsSubmitting(true);

    const { error } = await supabase
      .from("leads")
      .update({
        campaign_status: "SENT",
        generated_copy: editedCopy,
      })
      .eq("id", selectedLead.id)
      .eq("client_id", clientId);

    if (error) {
      console.error("APPROVE SEND ERROR:", error);
      setIsSubmitting(false);
      return;
    }

    setQueue((prev) => prev.filter((lead) => lead.id !== selectedLead.id));
    setSelectedLead(null);
    setEditedCopy("");
    setStatusMessage("> SYSTEM: SIMULATED SEND SUCCESSFUL");
    console.info("> SYSTEM: SIMULATED SEND SUCCESSFUL");
    setIsSubmitting(false);
  };

  const handleDiscard = async () => {
    if (!selectedLead?.id || isSubmitting) return;

    setIsSubmitting(true);

    const { error } = await supabase
      .from("leads")
      .update({
        campaign_status: "DISCARDED",
        generated_copy: null,
      })
      .eq("id", selectedLead.id)
      .eq("client_id", clientId);

    if (error) {
      console.error("DISCARD DRAFT ERROR:", error);
      setIsSubmitting(false);
      return;
    }

    setQueue((prev) => prev.filter((lead) => lead.id !== selectedLead.id));
    setSelectedLead(null);
    setEditedCopy("");
    setIsSubmitting(false);
  };

  return (
    <section className="flex min-h-[60vh] flex-col">
      <header className="border-b border-hairline pb-8 md:pb-10">
        <Link
          to="/admin/client/$id/orchestration"
          params={{ id: clientId }}
          className="mb-6 inline-block font-mono text-[11px] tracking-[0.16em] uppercase text-ink-soft transition-colors hover:text-ink"
        >
          &lt; RETURN_TO_ORCHESTRATION
        </Link>
        <div className="eyebrow mb-4">Workspace 03 // Outbound Queue</div>
        <h1 className="font-display text-[clamp(2rem,6vw,4.5rem)] leading-[0.88] tracking-[-0.04em]">
          OUTBOUND_QUEUE // HUMAN_REVIEW
        </h1>
        <p className="mt-4 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
          APPROVAL_LAYER // AI_DRAFTS_PENDING_RELEASE
        </p>
      </header>

      {statusMessage && (
        <div className="mt-6 border border-green-800 bg-green-950/30 px-4 py-3 font-mono text-xs tracking-[0.12em] text-green-400">
          {statusMessage}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-4">
          <h2 className="mb-4 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
            01 // PENDING_TARGETS
          </h2>

          <div className="space-y-2 border border-hairline p-2">
            {isLoading ? (
              <div className="px-3 py-6 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
                LOADING_QUEUE...
              </div>
            ) : queue.length === 0 ? (
              <div className="px-3 py-6 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
                QUEUE_EMPTY // NO_DRAFTS_PENDING
              </div>
            ) : (
              queue.map((lead) => {
                const isSelected = selectedLead?.id === lead.id;
                const name = lead.prospect_name?.trim() || "Unknown Prospect";
                const company = lead.target_company?.trim() || "—";

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
                      <span className="shrink-0 bg-yellow-400 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-black">
                        [PENDING]
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-8">
          <h2 className="mb-4 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
            02 // DRAFT_EDITOR
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
                className="h-96 w-full resize-y border border-gray-800 bg-black p-4 font-mono text-xs leading-relaxed text-gray-300 focus:border-gray-600 focus:outline-none"
              />

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
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
