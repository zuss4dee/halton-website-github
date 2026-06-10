import type { LeadRow } from "@/lib/admin/leadsRepository";
import {
  appendOutboundFounderSignature,
} from "@/lib/outbound/outboundSignature";
import {
  interpolateLeadMergeVariables,
  leadRowToMergeFields,
  personalizeOutboundEmailContent,
} from "@/lib/outbound/leadMergeVariables";

export const DRAFT_SUBJECT_FORM_KEY = "draft_subject";
export const DRAFT_REJECTION_HISTORY_KEY = "draft_rejection_history";

export type DraftRejectionEntry = {
  reason: string;
  rejected_at: string;
  prior_subject?: string | null;
  prior_body?: string | null;
};

export const OUTBOUND_MERGE_TAGS = [
  { tag: "{{first_name}}", label: "First name" },
  { tag: "{{company_name}}", label: "Company" },
  { tag: "{{target_role}}", label: "Role" },
  { tag: "{{prospect_name}}", label: "Full name" },
] as const;

export const DEFAULT_DRAFT_SUBJECT = "{{first_name}} — outbound at {{company_name}}";

export const RECOMMENDED_BODY_WORD_LIMIT = 120;

const SIGNATURE_MARKER = "Founder | Halton Works";

function readFormDataString(
  formData: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = formData?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Strip appended founder signature so operators edit body-only drafts. */
export function stripDraftSignature(body: string): string {
  const markerIndex = body.indexOf(SIGNATURE_MARKER);
  if (markerIndex === -1) return body.trim();

  const beforeSignature = body.slice(0, markerIndex).trimEnd();
  const lines = beforeSignature.split(/\r?\n/);
  while (lines.length > 0) {
    const last = lines[lines.length - 1]?.trim() ?? "";
    if (!last || /^best[,\s]*$/i.test(last)) {
      lines.pop();
      continue;
    }
    break;
  }
  return lines.join("\n").trim();
}

export function resolveDraftSubject(lead: LeadRow): string {
  const stored = readFormDataString(lead.form_data, DRAFT_SUBJECT_FORM_KEY);
  if (stored) return stored;

  const step = lead.current_sequence_step ?? 1;
  if (step === 2) return "Infrastructure vs another SDR hire — {{company_name}}";
  if (step === 3) return "Should I close the loop, {{first_name}}?";
  return DEFAULT_DRAFT_SUBJECT;
}

export function resolveDraftBody(lead: LeadRow, options?: { includeSignature?: boolean }): string {
  const raw = lead.generated_copy?.trim() ?? "";
  if (!raw) return "";

  if (options?.includeSignature) return raw;
  if (raw.includes(SIGNATURE_MARKER)) return stripDraftSignature(raw);
  return raw;
}

export function countDraftWords(body: string): number {
  const normalized = body.trim();
  if (!normalized) return 0;
  return normalized.split(/\s+/).filter(Boolean).length;
}

export function mergeLeadFormDataWithDraftSubject(
  formData: Record<string, unknown> | null | undefined,
  subject: string,
): Record<string, unknown> {
  return {
    ...(formData && typeof formData === "object" && !Array.isArray(formData) ? formData : {}),
    [DRAFT_SUBJECT_FORM_KEY]: subject.trim(),
  };
}

export type OutboundDraftPreview = {
  subject: string;
  body: string;
  bodyWithSignature: string;
  wordCount: number;
  overRecommendedLimit: boolean;
};

export function buildOutboundDraftPreview(
  subject: string,
  body: string,
  lead: LeadRow,
): OutboundDraftPreview {
  const mergeFields = leadRowToMergeFields(lead as Record<string, unknown>);
  const personalized = personalizeOutboundEmailContent(subject, body, mergeFields);
  const bodyWithSignature = appendOutboundFounderSignature(personalized.body);
  const wordCount = countDraftWords(personalized.body);

  return {
    subject: personalized.subject,
    body: personalized.body,
    bodyWithSignature,
    wordCount,
    overRecommendedLimit: wordCount > RECOMMENDED_BODY_WORD_LIMIT,
  };
}

/** Insert merge tag at selection or append when no textarea focus is available. */
export function insertAtSelection(
  value: string,
  tag: string,
  selectionStart: number,
  selectionEnd: number,
): { nextValue: string; nextCursor: number } {
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  const nextValue = `${before}${tag}${after}`;
  const nextCursor = selectionStart + tag.length;
  return { nextValue, nextCursor };
}

export function previewFromAddress(): string {
  return "Damilare Adeosun <damilare@haltonworks.com>";
}

export function previewToAddress(lead: LeadRow): string {
  const name = lead.prospect_name?.trim();
  const email = lead.email?.trim();
  if (name && email) return `${name} <${email}>`;
  return email ?? "prospect@example.com";
}

/** For read-only sent view — infer subject from form_data or fallback. */
export function resolveSentSubject(lead: LeadRow): string {
  const stored = readFormDataString(lead.form_data, DRAFT_SUBJECT_FORM_KEY);
  if (stored) {
    return interpolateLeadMergeVariables(stored, leadRowToMergeFields(lead as Record<string, unknown>));
  }
  const company = lead.target_company?.trim() || "your team";
  return `Quick question for ${company}`;
}

export function resolveDraftRejectionHistory(
  lead: LeadRow,
): DraftRejectionEntry[] {
  const raw = lead.form_data?.[DRAFT_REJECTION_HISTORY_KEY];
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((entry): entry is DraftRejectionEntry => {
      return (
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as DraftRejectionEntry).reason === "string" &&
        typeof (entry as DraftRejectionEntry).rejected_at === "string"
      );
    })
    .slice(-5);
}
