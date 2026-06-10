import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  readInboundReplyFromLead,
  readInboundSubjectFromLead,
} from "@/lib/admin/inboundReply";
import type { LeadRow } from "@/lib/admin/leadsRepository";
import { supabase } from "@/lib/supabase";

export type PipelineAction = "closed_won" | "follow_up";

type HighIntentLeadDrawerProps = {
  lead: LeadRow | null;
  clientId: string;
  onClose: () => void;
  onLeadUpdated: (action: PipelineAction, label: string) => void;
};

function formatDrawerDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function deriveSourceLabel(lead: LeadRow): string {
  const status = lead.status?.trim().toLowerCase() ?? "";
  if (status === "form_filled") return "Form";
  if (status === "positive_reply" || status === "replied" || lead.is_hot_lead) return "Reply";
  if (status === "qualified") return "Qualified";
  return "Reply";
}

export function HighIntentLeadDrawer({
  lead,
  clientId,
  onClose,
  onLeadUpdated,
}: HighIntentLeadDrawerProps) {
  const [latestSignal, setLatestSignal] = useState<string | null>(null);
  const [isLoadingSignal, setIsLoadingSignal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!lead?.id) {
      setLatestSignal(null);
      return;
    }

    let cancelled = false;

    const loadLatestSignal = async () => {
      setIsLoadingSignal(true);

      const { data, error } = await supabase
        .from("replies")
        .select("text")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      const fromFormData = readInboundReplyFromLead(lead);

      if (error) {
        console.error("HIGH_INTENT reply fetch:", error);
        setLatestSignal(fromFormData || lead.generated_copy?.trim() || null);
      } else {
        setLatestSignal(
          data?.text?.trim() || fromFormData || lead.generated_copy?.trim() || null,
        );
      }

      setIsLoadingSignal(false);
    };

    void loadLatestSignal();

    return () => {
      cancelled = true;
    };
  }, [lead?.id, lead?.generated_copy]);

  useEffect(() => {
    if (!lead) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [lead, onClose]);

  if (!lead) return null;

  const name = lead.prospect_name?.trim() || "Unknown Prospect";
  const company = lead.target_company?.trim() || lead.company_name?.trim() || "—";
  const role = lead.target_role?.trim() || lead.role?.trim() || "—";

  const inboundSubject = readInboundSubjectFromLead(lead);

  const intakeFields = [
    { label: "Email", value: lead.email?.trim() || "—" },
    { label: "Role", value: role },
    { label: "Company", value: company },
    { label: "Reply subject", value: inboundSubject || "—" },
    { label: "Last activity", value: formatDrawerDate(lead.last_activity ?? lead.created_at) },
    { label: "Source", value: deriveSourceLabel(lead) },
    { label: "Pipeline status", value: lead.status?.trim() || "—" },
    {
      label: "Sequence",
      value: lead.queue_status?.trim() || "—",
    },
  ];

  const leadLabel =
    lead.prospect_name?.trim() ||
    lead.target_company?.trim() ||
    lead.email?.trim() ||
    "Lead";

  const updateLeadStatus = async (status: PipelineAction) => {
    if (!lead.id || isUpdating) return;

    setIsUpdating(true);
    const { error } = await supabase
      .from("leads")
      .update({ status })
      .eq("id", lead.id)
      .eq("client_id", clientId);

    if (error) {
      console.error("HIGH_INTENT status update:", error);
      toast.error(`Could not update ${leadLabel}. Try again or check admin access.`);
      setIsUpdating(false);
      return;
    }

    if (status === "follow_up") {
      toast.success(`${leadLabel} marked for follow-up`, {
        description:
          "Removed from Replied list. Status saved in Halton — follow up in Gmail for now.",
      });
    } else {
      toast.success(`${leadLabel} marked closed won`, {
        description: "Removed from Replied list. Deal recorded in Halton.",
      });
    }

    setIsUpdating(false);
    onLeadUpdated(status, leadLabel);
    onClose();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close drawer"
        className="fixed inset-0 z-[120] bg-black/40"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="high-intent-drawer-title"
        className="fixed inset-y-0 right-0 z-[121] flex w-full max-w-[min(100%,28rem)] flex-col border-l border-gray-200 bg-white shadow-xl sm:w-[38vw] sm:max-w-none"
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 id="high-intent-drawer-title" className="text-2xl font-semibold tracking-tight text-gray-900">
              {name}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {company} · {role}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <section className="mb-8">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Intake Data</h3>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
              {intakeFields.map((field) => (
                <div key={field.label}>
                  <dt className="text-xs text-gray-400">{field.label}</dt>
                  <dd className="mt-1 text-sm text-gray-900">{field.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Latest Signal</h3>
            <blockquote className="mt-4 border border-gray-100 bg-gray-50 p-4 text-sm italic leading-relaxed text-gray-700">
              {isLoadingSignal
                ? "Loading latest signal…"
                : latestSignal ||
                  "No inbound message on file. If this lead replied before the latest deploy, re-send a test reply or confirm RESEND_API_KEY is set on production so the webhook can fetch the email body."}
            </blockquote>
          </section>
        </div>

        <div className="border-t border-gray-100 px-6 py-5">
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => void updateLeadStatus("closed_won")}
            className="w-full rounded-lg bg-black px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
          >
            Mark as Closed - Won
          </button>
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => void updateLeadStatus("follow_up")}
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            Move to Follow-Up
          </button>
        </div>
      </aside>
    </>
  );
}
