import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  deleteCredential,
  formatCredentialUpdatedAt,
  listCredentials,
  upsertCredential,
  type CredentialListItem,
  type CredentialScope,
} from "@/lib/admin/credentialsRepository";
import { supabase } from "@/lib/supabase";

type ClientOption = { id: string; label: string };

type CredentialsVaultUIProps = {
  /** When set, form defaults to client scope and list filters global + this client. */
  workspaceClientId?: string;
};

const SUGGESTED_KEY_NAMES = [
  "RESEND_API_KEY",
  "DEEPSEEK_API_KEY",
  "APOLLO_API_KEY",
  "FIRECRAWL_API_KEY",
  "NOTION_API_KEY",
  "NOTION_DATABASE_ID",
  "SLACK_WEBHOOK_URL",
  "CAL_COM_API_KEY",
] as const;

export function CredentialsVaultUI({ workspaceClientId }: CredentialsVaultUIProps) {
  const [credentials, setCredentials] = useState<CredentialListItem[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [visibleIds, setVisibleIds] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formScope, setFormScope] = useState<CredentialScope>(
    workspaceClientId ? "client" : "global",
  );
  const [formClientId, setFormClientId] = useState(workspaceClientId ?? "");
  const [showFormValue, setShowFormValue] = useState(false);

  const loadCredentials = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const result = await listCredentials(workspaceClientId);

    if ("error" in result) {
      setErrorMessage(result.error);
      setCredentials([]);
    } else {
      setCredentials(result.credentials);
    }

    setIsLoading(false);
  }, [workspaceClientId]);

  useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name, slug")
        .order("company_name", { ascending: true });

      if (error) {
        console.error("CREDENTIALS_CLIENTS_FETCH:", error);
        return;
      }

      setClients(
        (data ?? []).map((row) => ({
          id: row.id as string,
          label:
            (row.company_name as string | null)?.trim() ||
            (row.slug as string | null)?.trim() ||
            (row.id as string),
        })),
      );
    })();
  }, []);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = window.setTimeout(() => setStatusMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  const toggleVisible = (id: string) => {
    setVisibleIds((current) => ({ ...current, [id]: !current[id] }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);

    const result = await upsertCredential({
      name: formName,
      value: formValue,
      scope: formScope,
      clientId: formScope === "client" ? formClientId : null,
    });

    setIsSaving(false);

    if ("error" in result) {
      setErrorMessage(result.error);
      return;
    }

    setFormValue("");
    setStatusMessage(`> KEY SAVED: ${result.credential.name}`);
    await loadCredentials();
  };

  const handleDelete = async (id: string, name: string) => {
    if (deletingId) return;
    if (!window.confirm(`Delete credential ${name}?`)) return;

    setDeletingId(id);
    const result = await deleteCredential(id);
    setDeletingId(null);

    if ("error" in result) {
      setErrorMessage(result.error);
      return;
    }

    setStatusMessage(`> KEY REMOVED: ${name}`);
    await loadCredentials();
  };

  return (
    <section className="space-y-8">
      <div className="border border-hairline bg-paper">
        <div className="border-b border-hairline px-4 py-3">
          <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
            Add / Update Key
          </h2>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
                Key Name
              </span>
              <input
                list="credential-key-suggestions"
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                placeholder="RESEND_API_KEY"
                required
                className="w-full border border-hairline bg-paper px-3 py-2 font-mono text-[11px] uppercase text-ink outline-none focus:border-ink"
              />
              <datalist id="credential-key-suggestions">
                {SUGGESTED_KEY_NAMES.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>

            <label className="block">
              <span className="mb-2 block font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
                Scope
              </span>
              <select
                value={formScope}
                onChange={(event) =>
                  setFormScope(event.target.value as CredentialScope)
                }
                className="w-full border border-hairline bg-paper px-3 py-2 font-mono text-[11px] tracking-[0.08em] uppercase text-ink outline-none focus:border-ink"
              >
                <option value="global">Global</option>
                <option value="client">Client-specific</option>
              </select>
            </label>
          </div>

          {formScope === "client" ? (
            <label className="block">
              <span className="mb-2 block font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
                Workspace Client
              </span>
              <select
                value={formClientId}
                onChange={(event) => setFormClientId(event.target.value)}
                required
                disabled={Boolean(workspaceClientId)}
                className="w-full border border-hairline bg-paper px-3 py-2 font-mono text-[11px] text-ink outline-none focus:border-ink disabled:opacity-60"
              >
                <option value="">Select client…</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block">
            <span className="mb-2 block font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
              Value
            </span>
            <div className="relative">
              <input
                type={showFormValue ? "text" : "password"}
                value={formValue}
                onChange={(event) => setFormValue(event.target.value)}
                required
                autoComplete="off"
                className="w-full border border-hairline bg-paper px-3 py-2 pr-10 font-mono text-[11px] text-ink outline-none focus:border-ink"
                placeholder="••••••••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowFormValue((open) => !open)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-soft hover:text-ink"
                aria-label={showFormValue ? "Hide value" : "Show value"}
              >
                {showFormValue ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={isSaving}
            className="border border-ink bg-ink px-4 py-3 font-mono text-[11px] tracking-[0.16em] uppercase text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {isSaving ? "Saving…" : "Save Key"}
          </button>
        </form>
      </div>

      {(statusMessage || errorMessage) && (
        <p
          className={`font-mono text-[10px] tracking-[0.12em] uppercase ${
            errorMessage ? "text-red-600" : "text-ink"
          }`}
        >
          {errorMessage ?? statusMessage}
        </p>
      )}

      <div>
        <div className="mb-4 flex items-end justify-between gap-3 border-b border-hairline pb-3">
          <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
            Stored Keys
          </h2>
          <button
            type="button"
            onClick={() => void loadCredentials()}
            className="border border-hairline px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft hover:border-ink hover:text-ink"
          >
            Refresh
          </button>
        </div>

        <div className="border border-hairline">
          <div className="hidden grid-cols-12 gap-2 border-b border-hairline bg-paper px-4 py-2 font-mono text-[9px] tracking-[0.16em] uppercase text-ink-soft md:grid">
            <div className="col-span-3">Key Name</div>
            <div className="col-span-2">Scope</div>
            <div className="col-span-3">Last Updated</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {isLoading ? (
            <div className="px-4 py-8 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
              LOADING_VAULT...
            </div>
          ) : credentials.length === 0 ? (
            <div className="px-4 py-8 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
              VAULT_EMPTY // NO_KEYS_STORED
            </div>
          ) : (
            credentials.map((row) => {
              const isVisible = Boolean(visibleIds[row.id]);
              const clientLabel =
                clients.find((client) => client.id === row.client_id)?.label ??
                row.client_id?.slice(0, 8) ??
                "—";

              return (
                <div
                  key={row.id}
                  className="grid grid-cols-1 gap-3 border-b border-hairline px-4 py-4 last:border-b-0 md:grid-cols-12 md:items-center md:gap-2"
                >
                  <div className="md:col-span-3">
                    <p className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink">
                      {row.name}
                    </p>
                    <p className="mt-1 font-mono text-[9px] text-ink-soft md:hidden">
                      {isVisible ? row.value : row.maskedValue}
                    </p>
                  </div>
                  <div className="md:col-span-2 font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft">
                    {row.scope === "global" ? "Global" : clientLabel}
                  </div>
                  <div className="md:col-span-3 font-mono text-[10px] tracking-[0.1em] text-ink-soft">
                    {formatCredentialUpdatedAt(row.updated_at)}
                  </div>
                  <div className="md:col-span-2">
                    <button
                      type="button"
                      onClick={() => toggleVisible(row.id)}
                      className="inline-flex items-center gap-1 border border-hairline px-2 py-1 font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft transition-colors hover:border-ink hover:text-ink"
                    >
                      {isVisible ? (
                        <>
                          <EyeOff className="h-3 w-3" aria-hidden />
                          Visible
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3" aria-hidden />
                          Hidden
                        </>
                      )}
                    </button>
                    {isVisible ? (
                      <p className="mt-2 break-all font-mono text-[9px] text-ink md:mt-1">
                        {row.value}
                      </p>
                    ) : null}
                  </div>
                  <div className="md:col-span-2 md:text-right">
                    <button
                      type="button"
                      disabled={deletingId === row.id}
                      onClick={() => void handleDelete(row.id, row.name)}
                      className="border border-hairline px-2 py-1 font-mono text-[9px] tracking-[0.14em] uppercase text-red-600 hover:border-red-600 disabled:opacity-40"
                    >
                      {deletingId === row.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
