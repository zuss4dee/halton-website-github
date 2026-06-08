import {
  HUMAN_REVIEW_QUEUE_STATUSES,
  LEAD_QUEUE_STATUS,
  type LeadRow,
} from "@/lib/admin/leadsRepository";

export type CrmStatusTone = "gray" | "blue" | "yellow" | "green" | "red";

export type CrmStatusBadge = {
  label: string;
  tone: CrmStatusTone;
};

const FAILED_PIPELINE_STATUSES = new Set(["send_failed", "bounced", "failed"]);
const BOUNCED_EMAIL_STATUSES = new Set(["bounced", "BOUNCED"]);

function normalize(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function resolveLeadCampaignLabel(lead: LeadRow): string {
  const step = lead.current_sequence_step;
  const queueStatus = normalize(lead.queue_status);

  if (step && step > 0) {
    return `Automated Sequence · Step ${step}`;
  }

  if (queueStatus === LEAD_QUEUE_STATUS.ACTIVE) {
    return "Automated Sequence";
  }

  if (
    HUMAN_REVIEW_QUEUE_STATUSES.some((status) => status === queueStatus) ||
    queueStatus === LEAD_QUEUE_STATUS.APPROVED
  ) {
    return "Human Review Queue";
  }

  if (queueStatus === LEAD_QUEUE_STATUS.SENT) {
    return "Outbound Campaign";
  }

  if (queueStatus === LEAD_QUEUE_STATUS.COMPLETED) {
    return "Automated Sequence · Complete";
  }

  if (queueStatus === LEAD_QUEUE_STATUS.PAUSED) {
    return "Automated Sequence · Paused";
  }

  return lead.campaign_status?.trim() || "Outbound Campaign";
}

export function resolveCrmStatusBadge(lead: LeadRow): CrmStatusBadge {
  const pipelineStatus = normalize(lead.status);
  const queueStatus = normalize(lead.queue_status);
  const emailStatus = lead.email_status?.trim() ?? "";
  const step = lead.current_sequence_step ?? 0;

  if (
    FAILED_PIPELINE_STATUSES.has(pipelineStatus) ||
    BOUNCED_EMAIL_STATUSES.has(emailStatus)
  ) {
    const label = pipelineStatus === "bounced" || BOUNCED_EMAIL_STATUSES.has(emailStatus)
      ? "Bounced"
      : "Failed";
    return { label, tone: "red" };
  }

  if (queueStatus === LEAD_QUEUE_STATUS.COMPLETED) {
    return { label: "Completed", tone: "green" };
  }

  if (queueStatus === LEAD_QUEUE_STATUS.PAUSED) {
    return { label: "Paused", tone: "yellow" };
  }

  if (queueStatus === LEAD_QUEUE_STATUS.ACTIVE) {
    return { label: "Active", tone: "blue" };
  }

  if (queueStatus === LEAD_QUEUE_STATUS.SENT) {
    if (step === 1) {
      return { label: "Sent Step 1", tone: "blue" };
    }
    if (step > 1) {
      return { label: `Sent Step ${step}`, tone: "blue" };
    }
    return { label: "Sent", tone: "blue" };
  }

  if (
    queueStatus === LEAD_QUEUE_STATUS.PENDING ||
    queueStatus === LEAD_QUEUE_STATUS.NEEDS_HUMAN_REVIEW ||
    queueStatus === LEAD_QUEUE_STATUS.QA_REJECTED ||
    queueStatus === LEAD_QUEUE_STATUS.APPROVED
  ) {
    return { label: "Pending", tone: "gray" };
  }

  if (queueStatus === LEAD_QUEUE_STATUS.DISCARDED) {
    return { label: "Discarded", tone: "gray" };
  }

  if (pipelineStatus === "replied") {
    return { label: "Replied", tone: "green" };
  }

  return { label: "Pending", tone: "gray" };
}

export function resolveLeadLastActionDate(lead: LeadRow): string | null {
  return lead.sent_at ?? lead.last_activity ?? lead.created_at ?? null;
}

export function isPendingApprovalLead(lead: LeadRow): boolean {
  const queueStatus = normalize(lead.queue_status);
  return (
    HUMAN_REVIEW_QUEUE_STATUSES.some((status) => status === queueStatus) ||
    queueStatus === LEAD_QUEUE_STATUS.APPROVED
  );
}

export function isActiveSendLead(lead: LeadRow): boolean {
  return normalize(lead.queue_status) === LEAD_QUEUE_STATUS.ACTIVE;
}

export function isCompletedOrBouncedLead(lead: LeadRow): boolean {
  const pipelineStatus = normalize(lead.status);
  const queueStatus = normalize(lead.queue_status);
  const emailStatus = lead.email_status?.trim() ?? "";

  return (
    queueStatus === LEAD_QUEUE_STATUS.COMPLETED ||
    FAILED_PIPELINE_STATUSES.has(pipelineStatus) ||
    BOUNCED_EMAIL_STATUSES.has(emailStatus)
  );
}
