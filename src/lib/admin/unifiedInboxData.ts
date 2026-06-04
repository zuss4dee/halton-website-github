import type { LeadRow } from "@/lib/admin/leadsRepository";
import type { ClientRow } from "@/lib/admin/clientsRepository";
import { supabase } from "@/lib/supabase";

export type UnifiedInboxRow = {
  id: string;
  clientName: string;
  leadName: string;
  activityDate: string | null;
};

export type UnifiedInboxPayload = {
  rows: UnifiedInboxRow[];
  error: string | null;
};

function leadDisplayName(lead: LeadRow): string {
  const name = lead.prospect_name?.trim();
  if (name) return name;
  const company = lead.target_company?.trim() ?? lead.company_name?.trim();
  if (company) return company;
  return "UNKNOWN_PROSPECT";
}

export async function fetchUnifiedInboxData(): Promise<UnifiedInboxPayload> {
  const { data: leadsData, error: leadsError } = await supabase
    .from("leads")
    .select("id, prospect_name, target_company, company_name, last_activity, created_at, client_id")
    .eq("status", "replied")
    .order("last_activity", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (leadsError) {
    console.error("[unified-inbox] leads:", leadsError);
    return { rows: [], error: leadsError.message };
  }

  const leads = (leadsData as LeadRow[]) ?? [];
  const clientIds = [
    ...new Set(leads.map((l) => l.client_id).filter((id): id is string => Boolean(id))),
  ];

  const clientNameById: Record<string, string> = {};

  if (clientIds.length > 0) {
    const { data: clientsData, error: clientsError } = await supabase
      .from("clients")
      .select("id, company_name")
      .in("id", clientIds);

    if (clientsError) {
      console.error("[unified-inbox] clients:", clientsError);
    } else {
      for (const client of (clientsData as ClientRow[]) ?? []) {
        if (client.id) {
          clientNameById[client.id] = client.company_name?.trim() || "—";
        }
      }
    }
  }

  const rows: UnifiedInboxRow[] = leads.map((lead) => ({
    id: lead.id,
    clientName: lead.client_id ? (clientNameById[lead.client_id] ?? "—") : "—",
    leadName: leadDisplayName(lead),
    activityDate: lead.last_activity ?? lead.created_at ?? null,
  }));

  return { rows, error: null };
}
