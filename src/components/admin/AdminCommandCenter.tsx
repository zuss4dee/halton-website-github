import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { companyToSlug } from "@/lib/admin-workspaces";
import type { ClientRow } from "@/lib/admin/clientsRepository";
import { supabase } from "@/lib/supabase";

function formatStatus(row: ClientRow): string {
  const status = row.infrastructure_status?.trim();
  if (!status) return "ACTIVE";
  return status.toUpperCase();
}

function formatIndustry(row: ClientRow): string {
  const industry = row.industry?.trim();
  return industry || "GENERAL";
}

function GlobalLobby() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardName, setOnboardName] = useState("");
  const [isOnboarding, setIsOnboarding] = useState(false);

  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("LOBBY FETCH ERROR:", error);
      setClients([]);
    } else if (data) {
      setClients(data as ClientRow[]);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  const handleOnboardClient = async () => {
    const companyName = onboardName.trim();
    if (!companyName || isOnboarding) return;

    setIsOnboarding(true);
    const slug = companyToSlug(companyName);

    const { error } = await supabase.from("clients").insert({
      company_name: companyName,
      slug,
      monthly_retainer: 1500,
      infrastructure_status: "Nominal",
    });

    if (error) {
      console.error("ONBOARD ERROR:", error);
    } else {
      setOnboardName("");
      await fetchClients();
    }

    setIsOnboarding(false);
  };

  const enterWorkspace = (client: ClientRow) => {
    if (!client.id) return;
    void navigate({ to: "/admin/client/$id", params: { id: client.id } });
  };

  return (
    <div className="space-y-8">
      <header className="border-b border-hairline pb-6">
        <div className="eyebrow mb-3">Index 000 // Global Lobby</div>
        <h1 className="font-display text-[clamp(2rem,5vw,4rem)] leading-[0.9] tracking-[-0.04em]">
          HALTON WORKS // TENANT_INDEX
        </h1>
        <p className="mt-4 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
          SERVER_DIRECTORY // ACTIVE_CLIENT_WORKSPACES
        </p>
      </header>

      <section>
        <h2 className="mb-4 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
          00 // ONBOARD_CLIENT
        </h2>
        <div className="flex border border-hairline">
          <input
            type="text"
            value={onboardName}
            onChange={(e) => setOnboardName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleOnboardClient();
              }
            }}
            disabled={isOnboarding}
            placeholder="Company name…"
            className="min-w-0 flex-1 rounded-none border-0 border-r border-hairline bg-transparent px-4 py-3 font-mono text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void handleOnboardClient()}
            disabled={!onboardName.trim() || isOnboarding}
            className="shrink-0 rounded-none bg-ink px-4 py-3 font-mono text-[11px] tracking-[0.16em] uppercase text-paper disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isOnboarding ? "[PROVISIONING...]" : "[ONBOARD]"}
          </button>
        </div>
      </section>

      <section className="border-t border-hairline pt-8">
        <h2 className="mb-4 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
          01 // CLIENT_DIRECTORY
        </h2>

        <div className="border border-hairline">
          <div className="hidden md:grid md:grid-cols-12 md:gap-4 border-b border-hairline px-4 py-3 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
            <div className="col-span-4">Company</div>
            <div className="col-span-3">Industry</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3 text-right">Action</div>
          </div>

          {isLoading ? (
            <div className="px-4 py-8 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
              LOADING_DIRECTORY...
            </div>
          ) : clients.length === 0 ? (
            <div className="px-4 py-8 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
              NO_ACTIVE_CLIENTS
            </div>
          ) : (
            clients.map((client) => (
              <div
                key={client.id ?? client.slug}
                className="grid grid-cols-1 gap-3 border-b border-hairline px-4 py-4 last:border-b-0 md:grid-cols-12 md:items-center md:gap-4 md:py-3"
              >
                <div className="md:col-span-4">
                  <div className="eyebrow mb-1 md:hidden">Company</div>
                  <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink">
                    {client.company_name ?? "—"}
                  </div>
                  <div className="mt-1 font-mono text-[10px] tracking-[0.1em] uppercase text-ink-soft">
                    ID: {client.id ?? "—"}
                  </div>
                </div>
                <div className="md:col-span-3">
                  <div className="eyebrow mb-1 md:hidden">Industry</div>
                  <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-soft">
                    {formatIndustry(client)}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <div className="eyebrow mb-1 md:hidden">Status</div>
                  <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink">
                    {formatStatus(client)}
                  </div>
                </div>
                <div className="md:col-span-3 md:text-right">
                  <button
                    type="button"
                    onClick={() => enterWorkspace(client)}
                    disabled={!client.id}
                    className="rounded-none border border-hairline px-3 py-2 font-mono text-[10px] tracking-[0.16em] uppercase text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-40"
                  >
                    [ENTER_WORKSPACE]
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export function AdminCommandCenter() {
  return (
    <div className="min-h-[60vh]">
      <GlobalLobby />
    </div>
  );
}
