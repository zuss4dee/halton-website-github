import type { LeadRow } from "@/lib/admin/leadsRepository";

export type LeadFormData = {
  inbound_reply?: string;
  inbound_subject?: string;
  inbound_received_at?: string;
  [key: string]: unknown;
};

export function readLeadFormData(lead: LeadRow): LeadFormData {
  if (!lead.form_data || typeof lead.form_data !== "object") {
    return {};
  }
  return lead.form_data as LeadFormData;
}

export function readInboundSubjectFromLead(lead: LeadRow): string | null {
  const subject = readLeadFormData(lead).inbound_subject?.trim();
  return subject || null;
}

export function readInboundReplyFromLead(lead: LeadRow): string | null {
  const reply = readLeadFormData(lead).inbound_reply?.trim();
  return reply || null;
}

export function truncateReplyPreview(text: string, maxLength = 120): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}
