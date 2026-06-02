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
  SENT: "sent",
  DISCARDED: "discarded",
} as const;

export type LeadQueueStatus = (typeof LEAD_QUEUE_STATUS)[keyof typeof LEAD_QUEUE_STATUS];

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
  /** @deprecated legacy column */
  company_name?: string | null;
  /** @deprecated legacy column */
  role?: string | null;
  /** @deprecated legacy column */
  status?: string | null;
  email_status?: string | null;
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
