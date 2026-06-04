import { LEAD_CAMPAIGN_STATUS, LEAD_QUEUE_STATUS } from "@/lib/admin/leadsRepository";
import { createSupabaseServer } from "@/lib/supabase-server";

const DEFAULT_FOLLOW_UP_DAYS = 3;

/** Pipeline statuses that indicate a positive reply — never requeue for follow-up. */
const EXCLUDED_REPLY_STATUSES = [
  "replied",
  "positive_reply",
  "qualified",
  "form_filled",
] as const;

export type CronSweeperResult =
  | {
      ok: true;
      swept: number;
      failed: number;
      dueCount: number;
      followUpDays: number;
      leadIds: string[];
      errors: Array<{ leadId: string; error: string }>;
    }
  | { ok: false; status: number; error: string };

function resolveFollowUpDays(): number {
  const raw =
    process.env.CRON_SWEEPER_FOLLOW_UP_DAYS?.trim() ||
    process.env.FOLLOW_UP_DAYS?.trim();

  if (!raw) return DEFAULT_FOLLOW_UP_DAYS;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FOLLOW_UP_DAYS;
}

function isDueForFollowUp(
  sentAt: string | null | undefined,
  lastActivity: string | null | undefined,
  cutoffMs: number,
): boolean {
  const anchor = sentAt ?? lastActivity;
  if (!anchor) return false;

  const anchorMs = Date.parse(anchor);
  if (Number.isNaN(anchorMs)) return false;

  return anchorMs < cutoffMs;
}

export async function runCronSweeper(): Promise<CronSweeperResult> {
  const followUpDays = resolveFollowUpDays();
  const cutoffMs = Date.now() - followUpDays * 24 * 60 * 60 * 1000;

  const supabase = createSupabaseServer();

  const { data: candidates, error: fetchError } = await supabase
    .from("leads")
    .select("id, current_step, sent_at, last_activity, status, is_hot_lead, queue_status")
    .eq("status", "contacted")
    .eq("queue_status", LEAD_QUEUE_STATUS.SENT);

  if (fetchError) {
    console.error("[cron/sweeper] Lead fetch failed:", fetchError);
    return { ok: false, status: 500, error: "Failed to query leads for follow-up." };
  }

  const dueLeads = (candidates ?? []).filter((lead) => {
    const status = lead.status?.trim().toLowerCase() ?? "";
    if (EXCLUDED_REPLY_STATUSES.includes(status as (typeof EXCLUDED_REPLY_STATUSES)[number])) {
      return false;
    }

    if (lead.is_hot_lead === true) {
      return false;
    }

    return isDueForFollowUp(lead.sent_at, lead.last_activity, cutoffMs);
  });

  if (dueLeads.length === 0) {
    return {
      ok: true,
      swept: 0,
      failed: 0,
      dueCount: 0,
      followUpDays,
      leadIds: [],
      errors: [],
    };
  }

  const leadIds: string[] = [];
  const errors: Array<{ leadId: string; error: string }> = [];

  for (const lead of dueLeads) {
    const nextStep = (typeof lead.current_step === "number" ? lead.current_step : 1) + 1;

    const { error: updateError } = await supabase
      .from("leads")
      .update({
        current_step: nextStep,
        queue_status: LEAD_QUEUE_STATUS.PENDING,
        generated_copy: null,
        campaign_status: LEAD_CAMPAIGN_STATUS.PENDING_REVIEW,
      })
      .eq("id", lead.id)
      .eq("status", "contacted")
      .eq("queue_status", LEAD_QUEUE_STATUS.SENT);

    if (updateError) {
      console.error(`[cron/sweeper] Failed to requeue lead ${lead.id}:`, updateError);
      errors.push({ leadId: lead.id, error: updateError.message });
      continue;
    }

    leadIds.push(lead.id);
  }

  return {
    ok: true,
    swept: leadIds.length,
    failed: errors.length,
    dueCount: dueLeads.length,
    followUpDays,
    leadIds,
    errors,
  };
}
