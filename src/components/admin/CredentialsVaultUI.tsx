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

const fieldClassName =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200 disabled:opacity-60";

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

  const emptyStateCopy = workspaceClientId
    ? "No API keys stored for this workspace."
    : "No API keys stored yet.";

  return (
    <section className="space-y-8">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Key name</span>
              <input
                list="credential-key-suggestions"
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                placeholder="RESEND_API_KEY"
                required
                className={fieldClassName}
              />
              <datalist id="credential-key-suggestions">
                {SUGGESTED_KEY_NAMES.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Scope</span>
              <select
                value={formScope}
                onChange={(event) =>
                  setFormScope(event.target.value as CredentialScope)
                }
                className={fieldClassName}
              >
                <option value="global">Global</option>
                <option value="client">Client-specific</option>
              </select>
            </label>
          </div>

          {formScope === "client" ? (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">
                Workspace client
              </span>
              <select
                value={formClientId}
                onChange={(event) => setFormClientId(event.target.value)}
                required
                disabled={Boolean(workspaceClientId)}
                className={fieldClassName}
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
            <span className="mb-2 block text-sm font-medium text-gray-700">Value</span>
            <div className="relative">
              <input
                type={showFormValue ? "text" : "password"}
                value={formValue}
                onChange={(event) => setFormValue(event.target.value)}
                required
                autoComplete="off"
                className={`${fieldClassName} pr-10`}
                placeholder="••••••••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowFormValue((open) => !open)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:text-gray-900"
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
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
          >
            {isSaving ? "Saving…" : "Save Key"}
          </button>
        </form>
      </div>

      {(statusMessage || errorMessage) && (
        <p className={`text-sm ${errorMessage ? "text-red-600" : "text-emerald-700"}`}>
          {errorMessage ?? statusMessage}
        </p>
      )}

      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Active Keys</h2>
          <button
            type="button"
            onClick={() => void loadCredentials()}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="hidden grid-cols-12 gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 md:grid">
            <div className="col-span-3 text-xs font-medium uppercase tracking-wider text-gray-500">
              Key name
            </div>
            <div className="col-span-2 text-xs font-medium uppercase tracking-wider text-gray-500">
              Scope
            </div>
            <div className="col-span-3 text-xs font-medium uppercase tracking-wider text-gray-500">
              Last updated
            </div>
            <div className="col-span-2 text-xs font-medium uppercase tracking-wider text-gray-500">
              Status
            </div>
            <div className="col-span-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Actions
            </div>
          </div>

          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">Loading keys…</div>
          ) : credentials.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">{emptyStateCopy}</div>
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
                  className="grid grid-cols-1 gap-3 border-b border-gray-100 px-4 py-4 last:border-b-0 md:grid-cols-12 md:items-center md:gap-2"
                >
                  <div className="md:col-span-3">
                    <p className="text-sm font-medium text-gray-900">{row.name}</p>
                    <p className="mt-1 break-all text-xs text-gray-500 md:hidden">
                      {isVisible ? row.value : row.maskedValue}
                    </p>
                  </div>
                  <div className="text-sm text-gray-600 md:col-span-2">
                    {row.scope === "global" ? "Global" : clientLabel}
                  </div>
                  <div className="text-sm text-gray-600 md:col-span-3">
                    {formatCredentialUpdatedAt(row.updated_at)}
                  </div>
                  <div className="md:col-span-2">
                    <button
                      type="button"
                      onClick={() => toggleVisible(row.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
                    >
                      {isVisible ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5" aria-hidden />
                          Visible
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" aria-hidden />
                          Hidden
                        </>
                      )}
                    </button>
                    {isVisible ? (
                      <p className="mt-2 break-all text-xs text-gray-700 md:mt-1">{row.value}</p>
                    ) : null}
                  </div>
                  <div className="md:col-span-2 md:text-right">
                    <button
                      type="button"
                      disabled={deletingId === row.id}
                      onClick={() => void handleDelete(row.id, row.name)}
                      className="text-sm text-gray-500 transition-colors hover:text-red-600 disabled:opacity-40"
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
