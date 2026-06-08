import { LEAD_QUEUE_STATUS } from "@/lib/admin/leadsRepository";
import { supabase } from "@/lib/supabase";

export type SequenceCampaignStatus = "active" | "paused" | "stopped";

export const SEQUENCE_CAMPAIGN_STATUSES: SequenceCampaignStatus[] = [
  "active",
  "paused",
  "stopped",
];

export function normalizeSequenceCampaignStatus(
  value: string | null | undefined,
): SequenceCampaignStatus {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "paused" || normalized === "stopped") {
    return normalized;
  }
  return "active";
}

export async function fetchSequenceCampaignStatus(
  clientId: string,
): Promise<{ status: SequenceCampaignStatus } | { error: string }> {
  const workspaceClientId = clientId.trim();
  if (!workspaceClientId) {
    return { error: "clientId is required." };
  }

  const { data, error } = await supabase
    .from("clients")
    .select("sequence_status")
    .eq("id", workspaceClientId)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!data) {
    return { error: "Workspace not found." };
  }

  return {
    status: normalizeSequenceCampaignStatus(
      (data as { sequence_status?: string | null }).sequence_status,
    ),
  };
}

export async function updateSequenceCampaignStatus(
  clientId: string,
  status: SequenceCampaignStatus,
): Promise<{ status: SequenceCampaignStatus } | { error: string }> {
  const workspaceClientId = clientId.trim();
  if (!workspaceClientId) {
    return { error: "clientId is required." };
  }

  if (!SEQUENCE_CAMPAIGN_STATUSES.includes(status)) {
    return { error: `Invalid sequence status: ${status}` };
  }

  const { data, error } = await supabase
    .from("clients")
    .update({ sequence_status: status })
    .eq("id", workspaceClientId)
    .select("sequence_status")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!data) {
    return { error: "Workspace not found." };
  }

  if (status === "stopped") {
    const { error: haltError } = await supabase
      .from("leads")
      .update({
        queue_status: LEAD_QUEUE_STATUS.COMPLETED,
        next_send_date: null,
      })
      .eq("client_id", workspaceClientId)
      .eq("queue_status", LEAD_QUEUE_STATUS.ACTIVE);

    if (haltError) {
      console.error("[sequence-status] halt active leads:", haltError);
      return { error: haltError.message };
    }
  }

  return {
    status: normalizeSequenceCampaignStatus(
      (data as { sequence_status?: string | null }).sequence_status,
    ),
  };
}
