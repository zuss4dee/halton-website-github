import type { LeadRow } from "@/lib/admin/leadsRepository";
import { supabase } from "@/lib/supabase";

export type CrmLeadUpdateInput = {
  clientId: string;
  leadId: string;
  email: string;
  firstName?: string;
  companyName?: string;
};

export async function updateCrmLead(
  input: CrmLeadUpdateInput,
): Promise<{ ok: true; lead: LeadRow } | { ok: false; error: string }> {
  const clientId = input.clientId.trim();
  const leadId = input.leadId.trim();
  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName?.trim() || null;
  const companyName = input.companyName?.trim() || null;

  if (!clientId || !leadId) {
    return { ok: false, error: "Workspace or lead context is missing." };
  }

  if (!email) {
    return { ok: false, error: "Email address is required." };
  }

  const { data, error } = await supabase
    .from("leads")
    .update({
      email,
      prospect_name: firstName,
      target_company: companyName,
      last_activity: new Date().toISOString(),
    })
    .eq("id", leadId)
    .eq("client_id", clientId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[leadsCrmMutations] update:", error);
    return { ok: false, error: error.message };
  }

  if (!data) {
    return { ok: false, error: "Lead not found in this workspace." };
  }

  return { ok: true, lead: data as LeadRow };
}

export async function deleteCrmLead(input: {
  clientId: string;
  leadId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const clientId = input.clientId.trim();
  const leadId = input.leadId.trim();

  if (!clientId || !leadId) {
    return { ok: false, error: "Workspace or lead context is missing." };
  }

  const { error, count } = await supabase
    .from("leads")
    .delete({ count: "exact" })
    .eq("id", leadId)
    .eq("client_id", clientId);

  if (error) {
    console.error("[leadsCrmMutations] delete:", error);
    return { ok: false, error: error.message };
  }

  if ((count ?? 0) === 0) {
    return { ok: false, error: "Lead not found in this workspace." };
  }

  return { ok: true };
}

export async function deleteCrmLeadsBatch(input: {
  clientId: string;
  leadIds: string[];
}): Promise<{ ok: true; deletedCount: number } | { ok: false; error: string }> {
  const clientId = input.clientId.trim();
  const leadIds = [...new Set(input.leadIds.map((id) => id.trim()).filter(Boolean))];

  if (!clientId) {
    return { ok: false, error: "Workspace context is missing." };
  }

  if (leadIds.length === 0) {
    return { ok: false, error: "No leads selected." };
  }

  const { error, count } = await supabase
    .from("leads")
    .delete({ count: "exact" })
    .eq("client_id", clientId)
    .in("id", leadIds);

  if (error) {
    console.error("[leadsCrmMutations] batch delete:", error);
    return { ok: false, error: error.message };
  }

  const deletedCount = count ?? 0;
  if (deletedCount === 0) {
    return { ok: false, error: "No matching leads found in this workspace." };
  }

  return { ok: true, deletedCount };
}
