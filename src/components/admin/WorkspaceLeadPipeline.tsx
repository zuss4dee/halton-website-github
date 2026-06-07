import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { generateColdEmail } from "@/lib/ai/outreach-agent";
import type { EmailStatus, EnrichmentStatus, StagedLead } from "@/lib/admin/leadScratchpad";
import { mapLeadRowToStagedLead, type LeadRow } from "@/lib/admin/leadsRepository";
import { supabase } from "@/lib/supabase";

type WorkspaceLeadPipelineProps = {
  clientId: string;
};

type DraftEmailState = {
  subject: string;
  body: string;
  leadName: string;
};

function EmailStatusCell({ status }: { status: EmailStatus }) {
  if (status === "VERIFIED") {
    return (
      <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-ink">VERIFIED</span>
    );
  }
  return (
    <span className="inline-block rounded-none border border-hairline px-2 py-1 font-mono text-[11px] tracking-[0.16em] uppercase text-ink-soft">
      RISKY
    </span>
  );
}

function EnrichmentCell({ status }: { status: EnrichmentStatus }) {
  const tone =
    status === "PENDING_SCRAPE" || status === "SCRAPING..."
      ? "text-ink"
      : status === "ENRICHED"
        ? "text-ink-soft"
        : "text-ink-soft";

  return (
    <span className={`font-mono text-[11px] tracking-[0.16em] uppercase ${tone}`}>
      {status}
    </span>
  );
}

type LeadActionsCellProps = {
  lead: StagedLead;
  isDrafting: boolean;
  onApprove: (leadId: string) => void;
  onReject: (leadId: string) => void;
  onDraftCampaign: (lead: StagedLead) => void;
};

function LeadActionsCell({
  lead,
  isDrafting,
  onApprove,
  onReject,
  onDraftCampaign,
}: LeadActionsCellProps) {
  if (lead.enrichment === "SCRAPING...") {
    return (
      <span className="font-mono text-[11px] tracking-[0.16em] uppercase animate-pulse text-gray-500">
        [RESEARCHING_TARGET...]
      </span>
    );
  }

  if (lead.enrichment === "ENRICHED") {
    return (
      <button
        type="button"
        disabled={isDrafting}
        onClick={() => onDraftCampaign(lead)}
        className="font-mono text-[11px] tracking-[0.16em] uppercase text-white hover:text-green-400 transition-colors disabled:opacity-50"
      >
        {isDrafting ? "[DRAFTING_CAMPAIGN...]" : "[DRAFT_CAMPAIGN]"}
      </button>
    );
  }

  if (lead.enrichment === "PENDING_SCRAPE") {
    return (
      <div className="flex flex-wrap gap-4 font-mono text-[11px] tracking-[0.16em] uppercase">
        <button
          type="button"
          className="text-ink hover:text-white transition-colors"
          onClick={() => onApprove(lead.id)}
        >
          [APPROVE]
        </button>
        <button
          type="button"
          className="text-ink-soft hover:text-ink transition-colors"
          onClick={() => onReject(lead.id)}
        >
          [REJECT]
        </button>
      </div>
    );
  }

  if (lead.enrichment === "SKIPPED") {
    return (
      <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-ink-soft">
        [SKIPPED]
      </span>
    );
  }

  return null;
}

function BatchCheckbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      onClick={onToggle}
      className="shrink-0 font-mono text-[11px] tracking-[0.08em] text-ink transition-colors hover:text-ink-soft"
    >
      {checked ? "[X]" : "[ ]"}
    </button>
  );
}

export function WorkspaceLeadPipeline({ clientId }: WorkspaceLeadPipelineProps) {
  const [leads, setLeads] = useState<StagedLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [draftEmail, setDraftEmail] = useState<DraftEmailState | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftingLeadId, setDraftingLeadId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchLeads = async () => {
      setIsLoading(true);

      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("SUPABASE ERROR:", error);
        setLeads([]);
      } else if (data) {
        setLeads(data.map((row) => mapLeadRowToStagedLead(row as LeadRow)));
      }

      setIsLoading(false);
    };

    void fetchLeads();

    const channel = supabase
      .channel(`leads:${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          void fetchLeads();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [clientId]);

  const toggleSelection = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((leadId) => leadId !== id) : [...prev, id],
    );
  };

  function toggleAll() {
    if (isLoading || leads.length === 0) return;
    setSelectedLeadIds((prev) =>
      prev.length === leads.length ? [] : leads.map((lead) => lead.id),
    );
  }

  const handleApproveLead = async (leadId: string) => {
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId ? { ...lead, enrichment: "SCRAPING..." as const } : lead,
      ),
    );

    await new Promise((res) => setTimeout(res, 2000));

    const { error } = await supabase
      .from("leads")
      .update({ enrichment_status: "ENRICHED" })
      .eq("id", leadId)
      .eq("client_id", clientId);

    if (error) {
      console.error("Update failed:", error);
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId ? { ...lead, enrichment: "PENDING_SCRAPE" as const } : lead,
        ),
      );
      return;
    }

    setLeads((prev) =>
      prev.map((lead) => (lead.id === leadId ? { ...lead, enrichment: "ENRICHED" as const } : lead)),
    );
  };

  function handleRejectLead(leadId: string) {
    console.info("[LEAD_PIPELINE] reject", leadId);
  }

  const handleBatchEnrich = async () => {
    if (selectedLeadIds.length === 0) return;

    setIsBatchRunning(true);
    const ids = [...selectedLeadIds];

    try {
      for (const id of ids) {
        await handleApproveLead(id);
        await new Promise((res) => setTimeout(res, 300));
      }
    } finally {
      setSelectedLeadIds([]);
      setIsBatchRunning(false);
    }
  };

  const handleBatchPurge = async () => {
    if (selectedLeadIds.length === 0) return;

    const ids = [...selectedLeadIds];
    const { error } = await supabase
      .from("leads")
      .delete()
      .in("id", ids)
      .eq("client_id", clientId);

    if (error) {
      console.error("BATCH PURGE ERROR:", error);
      return;
    }

    setLeads((prev) => prev.filter((lead) => !ids.includes(lead.id)));
    setSelectedLeadIds([]);
  };

  const handleDraftCampaign = async (lead: StagedLead) => {
    setIsDrafting(true);
    setDraftingLeadId(lead.id);

    try {
      let clientData: Record<string, unknown> = {
        company_name: "Halton Works Client",
        slug: "client",
      };

      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, company_name, slug, monthly_retainer")
        .eq("id", clientId)
        .single();

      if (clientError) {
        console.error("CLIENT LOOKUP ERROR:", clientError);
      } else if (client) {
        clientData = client;
      }

      const generated = await generateColdEmail(lead, clientData);

      setDraftEmail({
        subject: generated.subject,
        body: generated.body,
        leadName: lead.name,
      });
    } catch (error) {
      console.error("OUTREACH DRAFT ERROR:", error);
    } finally {
      setIsDrafting(false);
      setDraftingLeadId(null);
    }
  };

  function handleDiscardDraft() {
    setDraftEmail(null);
  }

  function handleQueueInInstantly() {
    console.info("[LEAD_PIPELINE] queued in Instantly:", draftEmail);
    setDraftEmail(null);
  }

  const allSelected = selectedLeadIds.length === leads.length && leads.length > 0;
  const hasSelection = selectedLeadIds.length > 0;

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
        <div className="eyebrow mb-4">Workspace 02 // Lead Pipeline</div>
        <h1 className="font-display text-[clamp(2.5rem,8vw,6rem)] leading-[0.88] tracking-[-0.04em]">
          LEAD_PIPELINE // WORKSPACE_SCOPED
        </h1>
        <p className="mt-4 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
          INGESTION_SOURCE // AI_ORCHESTRATOR_ONLY
        </p>
      </header>

      <section className="pt-12 md:pt-16">
        <h2 className="mb-8 font-mono text-[11px] tracking-[0.2em] uppercase text-ink md:mb-12">
          01 // LEAD_STAGING_TABLE
        </h2>

        <div className="border border-hairline">
          <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4 border-b border-hairline py-4 font-mono text-[11px] tracking-[0.18em] uppercase text-ink-soft">
            <div className="col-span-1 flex items-center">
              <BatchCheckbox
                checked={allSelected}
                onToggle={toggleAll}
                label={allSelected ? "Deselect all leads" : "Select all leads"}
              />
            </div>
            <div className="col-span-3">Target Prospect</div>
            <div className="col-span-2">Target Company</div>
            <div className="col-span-2">Email Status</div>
            <div className="col-span-2">Enrichment</div>
            <div className="col-span-2">Actions</div>
          </div>

          <div className="max-h-[500px] overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:var(--color-ink-soft)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-none [&::-webkit-scrollbar-thumb]:bg-ink-soft/35">
            {isLoading ? (
              <div className="border-b border-hairline py-8 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
                LOADING_PIPELINE...
              </div>
            ) : leads.length === 0 ? (
              <div className="border-b border-hairline px-5 py-8 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
                NO_LEADS_IN_STAGING // DISPATCH_RESEARCHER_FROM_ORCHESTRATION
              </div>
            ) : (
              leads.map((lead) => {
                const isSelected = selectedLeadIds.includes(lead.id);
                const isLeadDrafting = isDrafting && draftingLeadId === lead.id;

                return (
                  <div
                    key={lead.id}
                    className={`grid grid-cols-1 gap-4 border-b border-hairline py-6 lg:grid-cols-12 lg:items-center lg:gap-4 lg:py-5 ${
                      isSelected ? "bg-gray-900/50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 lg:col-span-1">
                      <BatchCheckbox
                        checked={isSelected}
                        onToggle={() => toggleSelection(lead.id)}
                        label={isSelected ? `Deselect ${lead.name}` : `Select ${lead.name}`}
                      />
                      <span className="eyebrow lg:hidden">Select</span>
                    </div>

                    <div className="lg:col-span-3">
                      <div className="eyebrow mb-1 lg:hidden">Target Prospect</div>
                      <div className="font-display text-lg leading-tight tracking-[-0.03em]">
                        {lead.name}
                      </div>
                      <div className="mt-1 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
                        {lead.title}
                      </div>
                    </div>

                    <div className="lg:col-span-2">
                      <div className="eyebrow mb-1 lg:hidden">Target Company</div>
                      <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink">
                        {lead.company}
                      </div>
                    </div>

                    <div className="lg:col-span-2">
                      <div className="eyebrow mb-1 lg:hidden">Email Status</div>
                      <EmailStatusCell status={lead.emailStatus} />
                    </div>

                    <div className="lg:col-span-2">
                      <div className="eyebrow mb-1 lg:hidden">Enrichment</div>
                      <EnrichmentCell status={lead.enrichment} />
                    </div>

                    <div className="lg:col-span-2">
                      <div className="eyebrow mb-2 lg:hidden">Actions</div>
                      <LeadActionsCell
                        lead={lead}
                        isDrafting={isLeadDrafting}
                        onApprove={handleApproveLead}
                        onReject={handleRejectLead}
                        onDraftCampaign={handleDraftCampaign}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <div className="mt-12 shrink-0 border-t border-hairline bg-paper md:mt-16">
        <div className="border border-hairline border-b-0 md:border-x-0">
          <div className="border-b border-hairline px-5 py-3 md:px-0">
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink">
              02 // BATCH_OPERATIONS
            </span>
            {hasSelection && (
              <span className="ml-4 font-mono text-[11px] tracking-[0.16em] uppercase text-ink-soft">
                · {selectedLeadIds.length} selected
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2">
            <button
              type="button"
              onClick={() => void handleBatchEnrich()}
              disabled={!hasSelection || isBatchRunning}
              className={`rounded-none border-b border-hairline px-6 py-5 font-mono text-[11px] tracking-[0.14em] uppercase transition-opacity md:border-b-0 md:border-r md:border-hairline ${
                hasSelection && !isBatchRunning
                  ? "cursor-pointer border-hairline bg-ink text-paper hover:opacity-90"
                  : "cursor-not-allowed bg-paper text-ink-soft opacity-40"
              }`}
            >
              {isBatchRunning ? "BATCH_ENRICHING..." : "BATCH_SEND_TO_SCRAPER"}
            </button>
            <button
              type="button"
              onClick={() => void handleBatchPurge()}
              disabled={!hasSelection || isBatchRunning}
              className={`rounded-none border border-transparent px-6 py-5 font-mono text-[11px] tracking-[0.14em] uppercase transition-opacity ${
                hasSelection && !isBatchRunning
                  ? "cursor-pointer bg-ink text-paper hover:opacity-90"
                  : "cursor-not-allowed bg-ink/40 text-paper/60"
              }`}
            >
              BATCH_PURGE_SELECTION
            </button>
          </div>
        </div>
      </div>

      {draftEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 md:p-8">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col border border-gray-800 bg-black font-mono text-white">
            <div className="border-b border-gray-800 px-6 py-4">
              <div className="text-[10px] tracking-[0.2em] uppercase text-gray-500">
                OUTREACH_DRAFT // TARGET
              </div>
              <div className="mt-2 text-sm tracking-[0.12em] uppercase">{draftEmail.leadName}</div>
            </div>

            <div className="space-y-6 overflow-y-auto px-6 py-6">
              <div>
                <div className="mb-2 text-[10px] tracking-[0.2em] uppercase text-gray-500">Subject</div>
                <div className="border border-gray-800 px-4 py-3 text-xs tracking-[0.08em] uppercase">
                  {draftEmail.subject}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[10px] tracking-[0.2em] uppercase text-gray-500">Body</div>
                <textarea
                  value={draftEmail.body}
                  onChange={(e) =>
                    setDraftEmail((prev) => (prev ? { ...prev, body: e.target.value } : prev))
                  }
                  rows={12}
                  className="w-full resize-y rounded-none border border-gray-800 bg-black px-4 py-3 text-xs leading-relaxed tracking-[0.06em] text-white focus:border-gray-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 border-t border-gray-800">
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="rounded-none border-r border-gray-800 px-6 py-4 text-[11px] tracking-[0.16em] uppercase text-gray-400 transition-colors hover:text-white"
              >
                [DISCARD]
              </button>
              <button
                type="button"
                onClick={handleQueueInInstantly}
                className="rounded-none px-6 py-4 text-[11px] tracking-[0.16em] uppercase text-white transition-colors hover:text-green-400"
              >
                [QUEUE_IN_INSTANTLY]
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
