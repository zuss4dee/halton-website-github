import type { EmailStatus, EnrichmentStatus } from "@/lib/admin/leadScratchpad";
import type { StagedLead } from "@/lib/admin/leadScratchpad";

export const LEAD_CAMPAIGN_STATUS = {
  PENDING_REVIEW: "PENDING_REVIEW",
  SENT: "SENT",
  DISCARDED: "DISCARDED",
} as const;

/** Human review queue / outbox — maps to leads.queue_status */
export const LEAD_QUEUE_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  NEEDS_HUMAN_REVIEW: "needs_human_review",
  QA_REJECTED: "qa_rejected",
  SENT: "sent",
  DISCARDED: "discarded",
  PAUSED: "paused",
  ACTIVE: "active",
  COMPLETED: "completed",
} as const;

/** Statuses shown in the human Pending Approval queue */
export const HUMAN_REVIEW_QUEUE_STATUSES = [
  LEAD_QUEUE_STATUS.PENDING,
  LEAD_QUEUE_STATUS.NEEDS_HUMAN_REVIEW,
  LEAD_QUEUE_STATUS.QA_REJECTED,
] as const;

/** Pending approval tab + CRM KPI — includes QA-auto-approved awaiting send */
export const PENDING_APPROVAL_QUEUE_STATUSES = [
  ...HUMAN_REVIEW_QUEUE_STATUSES,
  LEAD_QUEUE_STATUS.APPROVED,
] as const;

export type LeadQueueStatus = (typeof LEAD_QUEUE_STATUS)[keyof typeof LEAD_QUEUE_STATUS];

/** Pipeline stages after an operator confirms an inbound reply (Follow-Up / Closed Won). */
export const POST_REPLY_PIPELINE_STATUSES = [
  "follow_up",
  "closed_won",
  "positive_reply",
] as const;

/** Inbound reply + confirmed post-reply stages — used for reply-rate numerator only. */
export const REPLY_ANALYTICS_STATUSES = [
  "replied",
  ...POST_REPLY_PIPELINE_STATUSES,
] as const;

/** @deprecated Use REPLY_ANALYTICS_STATUSES — qualified is not an inbound reply. */
export const REPLIED_PIPELINE_STATUSES = REPLY_ANALYTICS_STATUSES;

/** Outbound still in flight — awaiting reply or mid-sequence. */
export const ACTIVE_OUTBOUND_QUEUE_STATUSES = [
  LEAD_QUEUE_STATUS.SENT,
  LEAD_QUEUE_STATUS.ACTIVE,
  LEAD_QUEUE_STATUS.PAUSED,
] as const;

export function formatReplyRate(replied: number, emailsSent: number): string {
  if (emailsSent <= 0) return "—";
  return `${((replied / emailsSent) * 100).toFixed(1)}%`;
}

/** Pipeline statuses treated as high-intent for the closer dashboard */
export const HIGH_INTENT_LEAD_STATUSES = [
  "replied",
  "qualified",
  "form_filled",
  "positive_reply",
] as const;

export function buildHighIntentLeadsFilter(): string {
  const statusFilters = HIGH_INTENT_LEAD_STATUSES.map((s) => `status.eq.${s}`).join(",");
  return `is_hot_lead.eq.true,${statusFilters}`;
}

/** Inbound webhook — leads ready for manual follow-up in Gmail */
export function buildManualFollowUpLeadsFilter(): string {
  return "status.eq.replied";
}

export type LeadRow = {
  id: string;
  client_id?: string | null;
  prospect_name?: string | null;
  target_company?: string | null;
  target_role?: string | null;
  enrichment_status?: string | null;
  email?: string | null;
  generated_copy?: string | null;
  campaign_status?: string | null;
  queue_status?: LeadQueueStatus | string | null;
  sent_at?: string | null;
  is_hot_lead?: boolean | null;
  last_activity?: string | null;
  current_step?: number | null;
  current_sequence_step?: number | null;
  next_send_date?: string | null;
  /** @deprecated Not a DB column — use target_company */
  company_name?: string | null;
  /** @deprecated legacy column */
  role?: string | null;
  /** @deprecated legacy column */
  status?: string | null;
  email_status?: string | null;
  form_data?: Record<string, unknown> | null;
  created_at?: string | null;
};

function normalizeEmailStatus(value: string | null | undefined): EmailStatus {
  return value?.trim().toUpperCase() === "VERIFIED" ? "VERIFIED" : "RISKY";
}

function normalizeEnrichment(value: string | null | undefined): EnrichmentStatus {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (normalized === "SKIPPED") return "SKIPPED";
  if (normalized === "ENRICHED") return "ENRICHED";
  if (normalized === "SCRAPING..." || normalized === "SCRAPING") return "SCRAPING...";
  return "PENDING_SCRAPE";
}

export function mapLeadRowToStagedLead(row: LeadRow): StagedLead {
  const company = row.target_company ?? row.company_name;
  const role = row.target_role ?? row.role;
  const enrichment = row.enrichment_status ?? row.status;

  return {
    id: row.id,
    clientId: row.client_id ?? undefined,
    name: row.prospect_name?.trim() || "Unknown Prospect",
    title: role?.trim() || "—",
    company: company?.trim() || "—",
    emailStatus: normalizeEmailStatus(row.email_status),
    enrichment: normalizeEnrichment(enrichment),
  };
}
