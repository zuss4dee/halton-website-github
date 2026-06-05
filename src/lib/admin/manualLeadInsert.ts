import { LEAD_QUEUE_STATUS } from "@/lib/admin/leadsRepository";
import { supabase } from "@/lib/supabase";

export type ManualLeadInput = {
  clientId: string;
  email: string;
  firstName?: string;
  companyName?: string;
};

export async function insertManualPipelineLead(
  input: ManualLeadInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const clientId = input.clientId.trim();
  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName?.trim() || null;
  const companyName = input.companyName?.trim() || null;

  if (!clientId) {
    return { ok: false, error: "Workspace context is missing." };
  }

  if (!email) {
    return { ok: false, error: "Email address is required." };
  }

  const { error } = await supabase.from("leads").insert({
    client_id: clientId,
    email,
    prospect_name: firstName,
    target_company: companyName,
    queue_status: LEAD_QUEUE_STATUS.ACTIVE,
    current_sequence_step: 1,
    next_send_date: new Date().toISOString(),
    enrichment_status: "SKIPPED",
    email_status: "VERIFIED",
  });

  if (error) {
    console.error("[manualLeadInsert]", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
