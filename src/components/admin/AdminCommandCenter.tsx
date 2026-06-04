import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AdminKpiCard, AdminPageHeader } from "@/components/admin/AdminBrutalist";
import { OnboardClientSheet, OnboardClientTrigger } from "@/components/admin/OnboardClientSheet";
import {
  fetchCommandCenterData,
  type ClientDirectoryRow,
  type CommandCenterMacroKpis,
} from "@/lib/admin/commandCenterData";

function formatStatusLabel(row: ClientDirectoryRow): string {
  const status = row.infrastructure_status?.trim();
  if (!status) return "ACTIVE";
  return status.replace(/_/g, " ").toUpperCase();
}

const commandActionClassName =
  "font-mono text-[10px] tracking-[0.14em] text-ink uppercase underline-offset-4 transition-colors hover:text-ink/60";

type GlobalLobbyProps = {
  initialOnboardOpen?: boolean;
};

function GlobalLobby({ initialOnboardOpen = false }: GlobalLobbyProps) {
  const [clients, setClients] = useState<ClientDirectoryRow[]>([]);
  const [macro, setMacro] = useState<CommandCenterMacroKpis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnboardOpen, setIsOnboardOpen] = useState(initialOnboardOpen);

  useEffect(() => {
    setIsOnboardOpen(initialOnboardOpen);
  }, [initialOnboardOpen]);

  const load = useCallback(async () => {
    setIsLoading(true);
    const payload = await fetchCommandCenterData();
    setClients(payload.clients);
    setMacro(payload.macro);
    setError(payload.error);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-12">
      <AdminPageHeader
        code="00 // TENANT_INDEX"
        title="Command Center"
        description="Tenant index · global telemetry · operational roster"
      />

      <section className="grid grid-cols-1 gap-0 md:grid-cols-3">
        <AdminKpiCard
          label="Active Workspaces"
          value={macro ? String(macro.activeWorkspaces) : "0"}
          isLoading={isLoading}
        />
        <AdminKpiCard
          label="Global Output"
          value={macro ? macro.globalOutput.toLocaleString() : "0"}
          isLoading={isLoading}
        />
        <AdminKpiCard
          label="Unread Signals"
          value={macro ? macro.unreadSignals.toLocaleString() : "0"}
          isLoading={isLoading}
        />
      </section>

      <OnboardClientTrigger
        onClick={() => setIsOnboardOpen(true)}
        clientCount={isLoading ? undefined : clients.length}
      />

      <OnboardClientSheet
        open={isOnboardOpen}
        onOpenChange={setIsOnboardOpen}
        onSuccess={load}
      />

      <section>
        <div className="mb-8 flex items-baseline justify-between gap-4">
          <h2 className="font-mono text-[11px] tracking-[0.28em] text-ink/50 uppercase">
            Client Directory
          </h2>
          {!isLoading ? (
            <span className="font-mono text-[10px] tracking-[0.14em] text-ink/40 uppercase tabular-nums">
              {clients.length} records
            </span>
          ) : null}
        </div>

        {error ? (
          <p className="mb-6 font-mono text-[10px] tracking-[0.14em] text-red-700 uppercase">
            Error // {error}
          </p>
        ) : null}

        <div className="overflow-x-auto border border-hairline">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-hairline bg-ink/[0.03] font-mono text-[9px] tracking-[0.22em] text-ink/40 uppercase">
                <th className="pb-4 pr-6 font-normal">Company</th>
                <th className="pb-4 pr-6 text-right font-normal tabular-nums">
                  Active Sequences
                </th>
                <th className="pb-4 pr-6 text-right font-normal tabular-nums">Sent (7d)</th>
                <th className="pb-4 pr-6 text-right font-normal tabular-nums">Replies</th>
                <th className="pb-4 pr-6 font-normal">Status</th>
                <th className="pb-4 text-right font-normal">Action</th>
              </tr>
            </thead>
            <tbody className="font-mono text-[11px] tracking-[0.06em] text-ink">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-ink/40 uppercase">
                    Loading directory…
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-ink/40 uppercase">
                    No tenants.{" "}
                    <button
                      type="button"
                      onClick={() => setIsOnboardOpen(true)}
                      className="text-ink underline underline-offset-4 hover:no-underline"
                    >
                      Onboard new client
                    </button>
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr
                    key={client.id ?? client.slug}
                    className="border-t border-hairline/80"
                  >
                    <td className="py-5 pr-6">
                      <span className="block text-sm tracking-[0.04em] text-ink uppercase">
                        {client.company_name ?? "—"}
                      </span>
                      <span className="mt-1 block text-[9px] tracking-[0.12em] text-ink/35 uppercase">
                        {client.slug ?? "—"}
                      </span>
                    </td>
                    <td className="py-5 pr-6 text-right tabular-nums">
                      {client.activeSequences}
                    </td>
                    <td className="py-5 pr-6 text-right tabular-nums">{client.sent7d}</td>
                    <td className="py-5 pr-6 text-right tabular-nums">
                      {client.replies7d}
                    </td>
                    <td className="py-5 pr-6 text-[10px] tracking-[0.12em] text-ink/55 uppercase">
                      {formatStatusLabel(client)}
                    </td>
                    <td className="py-5 text-right">
                      {client.id ? (
                        <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                          <Link
                            to="/admin/client/$id"
                            params={{ id: client.id }}
                            className={commandActionClassName}
                          >
                            [ Manage Campaigns ]
                          </Link>
                          <Link
                            to="/workspace/$clientId"
                            params={{ clientId: client.id }}
                            className={commandActionClassName}
                          >
                            [ View As Client ]
                          </Link>
                        </div>
                      ) : (
                        <span className="text-ink/30">[ — ]</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

type AdminCommandCenterProps = {
  initialOnboardOpen?: boolean;
};

export function AdminCommandCenter({ initialOnboardOpen }: AdminCommandCenterProps) {
  return <GlobalLobby initialOnboardOpen={initialOnboardOpen} />;
}
