import { resolveCrmStatusBadge } from "@/lib/admin/leadsCrmStatus";
import type { LeadRow } from "@/lib/admin/leadsRepository";
import { getSupabaseServer } from "@/lib/supabase-server";

export type CrmLeadRecord = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  status: string;
};

export type FetchCrmLeadResult = {
  leads: CrmLeadRecord[];
  count: number;
  search_query: string;
};

const MAX_RESULTS = 25;

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

function quotePostgrestValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function splitProspectName(prospectName: string | null | undefined): {
  first_name: string;
  last_name: string;
} {
  const parts = prospectName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) {
    return { first_name: "Unknown", last_name: "" };
  }
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: "" };
  }
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
}

function mapLeadRowToCrmRecord(row: LeadRow): CrmLeadRecord {
  const { first_name, last_name } = splitProspectName(row.prospect_name);
  const company =
    row.target_company?.trim() || row.company_name?.trim() || "—";
  const status = resolveCrmStatusBadge(row).label;

  return {
    id: row.id,
    first_name,
    last_name,
    email: row.email?.trim() || "—",
    company,
    status,
  };
}

export async function fetchCrmLeadsForWorkspace(
  workspaceClientId: string,
  searchQuery: string,
): Promise<FetchCrmLeadResult | { error: string }> {
  const clientId = workspaceClientId.trim();
  const query = searchQuery.trim();

  if (!clientId) {
    return { error: "workspace client id is required." };
  }
  if (!query) {
    return { error: "search_query cannot be empty." };
  }

  const pattern = quotePostgrestValue(`%${escapeIlikePattern(query)}%`);
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, email, prospect_name, target_company, company_name, queue_status, status, email_status, current_sequence_step, sent_at, last_activity, created_at",
    )
    .eq("client_id", clientId)
    .or(
      `email.ilike.${pattern},prospect_name.ilike.${pattern},target_company.ilike.${pattern},company_name.ilike.${pattern}`,
    )
    .order("last_activity", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(MAX_RESULTS);

  if (error) {
    console.error("[fetch_crm_lead]", error);
    return { error: error.message };
  }

  const leads = ((data as LeadRow[]) ?? []).map(mapLeadRowToCrmRecord);

  return {
    leads,
    count: leads.length,
    search_query: query,
  };
}
