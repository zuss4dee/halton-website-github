import { Resend } from "resend";
import type { ClientRow } from "@/lib/admin/clientsRepository";
import { createSupabaseServer } from "@/lib/supabase-server";

export type DnsStatusLabel = "VERIFIED" | "PENDING" | "FAILED" | "UNASSIGNED";

export type DomainFleetRow = {
  id: string;
  client: string;
  sendingDomain: string;
  dnsStatus: DnsStatusLabel;
  lastChecked: string;
};

export type DomainFleetApiResult =
  | { ok: true; rows: DomainFleetRow[]; checkedAt: string }
  | { ok: false; status: number; error: string };

type ResendDomainRecord = {
  id: string;
  name: string;
  status: string;
  created_at: string;
};

function resolveResendApiKey(): string | null {
  // Bracket access avoids Vite inlining undefined when the key is only set at deploy runtime.
  const fromProcess =
    process.env["RESEND_API_KEY"]?.trim() || process.env.RESEND_API_KEY?.trim();
  const fromViteMeta = (import.meta as ImportMeta & { env?: Record<string, string | undefined> })
    .env?.VITE_RESEND_API_KEY?.trim();
  const fromProcessVite = process.env.VITE_RESEND_API_KEY?.trim();

  const apiKey = fromProcess || fromViteMeta || fromProcessVite || null;

  if (!apiKey) {
    console.error(
      "[domainFleetService] RESEND API key not found. Checked sources:",
      {
        "process.env.RESEND_API_KEY": fromProcess ? "present" : "missing",
        "import.meta.env.VITE_RESEND_API_KEY": fromViteMeta ? "present" : "missing",
        "process.env.VITE_RESEND_API_KEY": fromProcessVite ? "present" : "missing",
        nodeEnv: process.env.NODE_ENV ?? "unknown",
        vercelEnv: process.env.VERCEL_ENV ?? "unknown",
      },
    );
  }

  return apiKey;
}

function normalizeDomainKey(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.includes("@")) {
    const host = trimmed.split("@").pop();
    return host?.trim() || trimmed;
  }
  return trimmed.replace(/^https?:\/\//, "").split("/")[0] ?? trimmed;
}

function mapResendStatusToDns(status: string | undefined): DnsStatusLabel {
  const normalized = status?.trim().toLowerCase() ?? "";
  if (normalized === "verified") return "VERIFIED";
  if (normalized === "failed" || normalized === "partially_failed") return "FAILED";
  return "PENDING";
}

function findResendDomainForClient(
  sendingDomain: string,
  byName: Map<string, ResendDomainRecord>,
): ResendDomainRecord | null {
  const key = normalizeDomainKey(sendingDomain);
  const exact = byName.get(key);
  if (exact) return exact;

  for (const [name, record] of byName) {
    if (key === name || key.endsWith(`.${name}`) || name.endsWith(`.${key}`)) {
      return record;
    }
  }

  return null;
}

async function fetchAllResendDomains(resend: Resend): Promise<ResendDomainRecord[]> {
  const collected: ResendDomainRecord[] = [];
  let after: string | undefined;

  for (let page = 0; page < 20; page += 1) {
    const { data, error } = await resend.domains.list(
      after ? { limit: 50, after } : { limit: 50 },
    );

    if (error) {
      throw new Error(error.message);
    }

    const pageData = data?.data ?? [];
    collected.push(...pageData);

    if (!data?.has_more || pageData.length === 0) {
      break;
    }

    after = pageData[pageData.length - 1]?.id;
  }

  return collected;
}

export async function buildDomainFleetSnapshot(): Promise<DomainFleetApiResult> {
  const apiKey = resolveResendApiKey();
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      error:
        "RESEND_API_KEY is not configured. Set RESEND_API_KEY (runtime) or VITE_RESEND_API_KEY (build) in Vercel — see server logs for [domainFleetService] source diagnostics.",
    };
  }

  const supabase = createSupabaseServer();
  const checkedAt = new Date().toISOString();

  const { data: clientsData, error: clientsError } = await supabase
    .from("clients")
    .select("id, company_name, sending_domain")
    .order("company_name", { ascending: true });

  if (clientsError) {
    console.error("[api/admin/domains] clients:", clientsError);
    return { ok: false, status: 500, error: clientsError.message };
  }

  const clients = (clientsData as ClientRow[]) ?? [];
  const resend = new Resend(apiKey);

  let resendDomains: ResendDomainRecord[];
  try {
    resendDomains = await fetchAllResendDomains(resend);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resend domains.list failed.";
    console.error("[api/admin/domains] resend:", message);
    return { ok: false, status: 502, error: message };
  }

  const byName = new Map<string, ResendDomainRecord>();
  for (const domain of resendDomains) {
    byName.set(normalizeDomainKey(domain.name), domain);
  }

  const rows: DomainFleetRow[] = clients
    .filter((client) => client.id)
    .map((client) => {
      const sendingRaw = client.sending_domain?.trim() ?? "";
      const clientName = client.company_name?.trim() || "—";

      if (!sendingRaw) {
        return {
          id: client.id!,
          client: clientName,
          sendingDomain: "—",
          dnsStatus: "UNASSIGNED" as const,
          lastChecked: checkedAt,
        };
      }

      const match = findResendDomainForClient(sendingRaw, byName);
      const dnsStatus: DnsStatusLabel = match
        ? mapResendStatusToDns(match.status)
        : "FAILED";

      return {
        id: client.id!,
        client: clientName,
        sendingDomain: sendingRaw,
        dnsStatus,
        lastChecked: checkedAt,
      };
    });

  return { ok: true, rows, checkedAt };
}
