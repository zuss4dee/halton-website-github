import type { ClientRow } from "@/lib/admin/clientsRepository";
import { supabase } from "@/lib/supabase";

export type DomainFleetRow = {
  id: string;
  domain: string;
  linkedClient: string;
  status: string;
};

export type DomainFleetPayload = {
  rows: DomainFleetRow[];
  error: string | null;
  source: "clients.sending_domain";
};

function formatDomainStatus(row: ClientRow): string {
  const infra = row.infrastructure_status?.trim();
  if (infra) return infra.replace(/_/g, " ").toUpperCase();
  return "ACTIVE";
}

export async function fetchDomainFleetData(): Promise<DomainFleetPayload> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, company_name, sending_domain, infrastructure_status")
    .order("company_name", { ascending: true });

  if (error) {
    console.error("[domain-fleet] clients:", error);
    return { rows: [], error: error.message, source: "clients.sending_domain" };
  }

  const clients = (data as ClientRow[]) ?? [];

  const rows: DomainFleetRow[] = clients
    .filter((c) => c.id)
    .map((client) => {
      const domain = client.sending_domain?.trim();
      return {
        id: client.id!,
        domain: domain || "—",
        linkedClient: client.company_name?.trim() || "—",
        status: domain ? formatDomainStatus(client) : "UNASSIGNED",
      };
    });

  return { rows, error: null, source: "clients.sending_domain" };
}
