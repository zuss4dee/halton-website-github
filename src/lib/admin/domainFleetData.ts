import type { DomainFleetRow } from "@/lib/admin/domainFleetService";

export type { DomainFleetRow, DnsStatusLabel } from "@/lib/admin/domainFleetService";

export type DomainFleetPayload = {
  rows: DomainFleetRow[];
  checkedAt: string | null;
  error: string | null;
};

export async function fetchDomainFleetFromApi(): Promise<DomainFleetPayload> {
  try {
    const response = await fetch("/api/admin/domains", {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    const body = (await response.json()) as {
      ok?: boolean;
      rows?: DomainFleetRow[];
      checkedAt?: string;
      error?: string;
    };

    if (!response.ok) {
      return {
        rows: [],
        checkedAt: null,
        error: body.error ?? `Request failed (${response.status}).`,
      };
    }

    return {
      rows: body.rows ?? [],
      checkedAt: body.checkedAt ?? null,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Domain fleet request failed.";
    return { rows: [], checkedAt: null, error: message };
  }
}
