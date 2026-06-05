import type { LeadRow } from "@/lib/admin/leadsRepository";
import { supabase } from "@/lib/supabase";

export type UnifiedInboxClient = {
  company_name?: string | null;
};

export type UnifiedInboxLead = LeadRow & {
  clients?: UnifiedInboxClient | UnifiedInboxClient[] | null;
};

export type UnifiedInboxPayload = {
  rows: UnifiedInboxLead[];
  error: string | null;
};

function normalizeClients(
  clients: UnifiedInboxLead["clients"],
): UnifiedInboxClient | null {
  if (!clients) return null;
  if (Array.isArray(clients)) return clients[0] ?? null;
  return clients;
}

export async function fetchUnifiedInboxData(): Promise<UnifiedInboxPayload> {
  const { data: leadsData, error: leadsError } = await supabase
    .from("leads")
    .select("*, clients(company_name)")
    .eq("status", "replied")
    .order("last_activity", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (leadsError) {
    console.error("[unified-inbox] leads:", leadsError);
    return { rows: [], error: leadsError.message };
  }

  const rows: UnifiedInboxLead[] = ((leadsData as UnifiedInboxLead[]) ?? []).map(
    (lead) => ({
      ...lead,
      clients: normalizeClients(lead.clients),
    }),
  );

  return { rows, error: null };
}
