import { useCallback, useEffect, useState } from "react";
import {
  deleteClientKnowledgeEntry,
  formatKnowledgeCategoryLabel,
  KNOWLEDGE_VAULT_UI_CATEGORIES,
  listClientKnowledgeEntries,
  saveToKnowledgeVault,
  toKnowledgeVaultUiCategory,
  updateClientKnowledgeEntry,
  type KnowledgeVaultListEntry,
  type KnowledgeVaultUiCategory,
} from "@/lib/admin/clientKnowledge";

type KnowledgeVaultUIProps = {
  clientId: string;
};

const EMPTY_FORM = {
  title: "",
  category: "general" as KnowledgeVaultUiCategory,
  content: "",
};

function previewContent(text: string, maxLength = 160): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-block border border-hairline bg-paper px-2 py-0.5 font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft">
      {formatKnowledgeCategoryLabel(category)}
    </span>
  );
}

export function KnowledgeVaultUI({ clientId }: KnowledgeVaultUIProps) {
  const workspaceClientId = clientId.trim();

  const [form, setForm] = useState(EMPTY_FORM);
  const [entries, setEntries] = useState<KnowledgeVaultListEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const loadEntries = useCallback(async () => {
    if (!workspaceClientId) {
      setEntries([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const result = await listClientKnowledgeEntries(workspaceClientId);

    if ("error" in result) {
      setErrorMessage(result.error);
      setEntries([]);
    } else {
      setEntries(result.entries);
    }

    setIsLoading(false);
  }, [workspaceClientId]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = window.setTimeout(() => setStatusMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  const handleEdit = (entry: KnowledgeVaultListEntry) => {
    setEditingId(entry.id);
    setForm({
      title: entry.title ?? "",
      category: toKnowledgeVaultUiCategory(entry.category),
      content: entry.content,
    });
    setErrorMessage(null);
    setStatusMessage(null);
    document.getElementById("vault-title")?.focus();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workspaceClientId || isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);

    const payload = {
      clientId: workspaceClientId,
      title: form.title,
      content: form.content,
      category: form.category,
    };

    const isUpdate = Boolean(editingId);
    const result = isUpdate
      ? await updateClientKnowledgeEntry({
          ...payload,
          entryId: editingId!,
        })
      : await saveToKnowledgeVault(payload);

    setIsSaving(false);

    if ("error" in result) {
      setErrorMessage(result.error);
      return;
    }

    resetForm();
    setStatusMessage(isUpdate ? "> ENTRY UPDATED" : "> ENTRY SAVED TO VAULT");
    await loadEntries();
  };

  const handleDelete = async (entryId: string) => {
    if (!workspaceClientId || deletingId) return;

    const confirmed = window.confirm("Delete this knowledge entry? This cannot be undone.");
    if (!confirmed) return;

    setDeletingId(entryId);
    setErrorMessage(null);

    const result = await deleteClientKnowledgeEntry(workspaceClientId, entryId);

    setDeletingId(null);

    if ("error" in result) {
      setErrorMessage(result.error);
      return;
    }

    if (editingId === entryId) {
      resetForm();
    }

    setStatusMessage("> ENTRY REMOVED");
    await loadEntries();
  };

  return (
    <section className="space-y-6">
      <div className="border border-hairline bg-paper">
        <div className="border-b border-hairline px-4 py-3">
          <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
            {editingId ? "Knowledge Vault // Edit Entry" : "Knowledge Vault // Add Entry"}
          </h2>
          <p className="mt-1 font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft/80">
            Workspace {workspaceClientId || "—"}
          </p>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 p-4">
          <div>
            <label
              htmlFor="vault-title"
              className="mb-2 block font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft"
            >
              Title
            </label>
            <input
              id="vault-title"
              type="text"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className="w-full border border-hairline bg-paper px-3 py-2 font-mono text-[11px] tracking-[0.06em] text-ink outline-none focus:border-ink"
              placeholder="e.g. Q3 logistics case study"
              required
            />
          </div>

          <div>
            <label
              htmlFor="vault-category"
              className="mb-2 block font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft"
            >
              Category
            </label>
            <select
              id="vault-category"
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  category: event.target.value as KnowledgeVaultUiCategory,
                }))
              }
              className="w-full border border-hairline bg-paper px-3 py-2 font-mono text-[11px] tracking-[0.08em] uppercase text-ink outline-none focus:border-ink"
            >
              {KNOWLEDGE_VAULT_UI_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {formatKnowledgeCategoryLabel(category)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="vault-content"
              className="mb-2 block font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft"
            >
              Content
            </label>
            <textarea
              id="vault-content"
              value={form.content}
              onChange={(event) =>
                setForm((current) => ({ ...current, content: event.target.value }))
              }
              rows={10}
              className="min-h-[200px] w-full resize-y border border-hairline bg-paper px-3 py-3 font-mono text-[11px] leading-relaxed text-ink outline-none focus:border-ink"
              placeholder="Paste case study, offer copy, brand voice rules, objection handlers…"
              required
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={isSaving || !workspaceClientId}
              className="flex-1 border border-ink bg-ink px-4 py-3 font-mono text-[11px] tracking-[0.16em] uppercase text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {isSaving
                ? "Saving…"
                : editingId
                  ? "Update Entry"
                  : "Save to Vault"}
            </button>
            {editingId ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={resetForm}
                className="border border-hairline px-4 py-3 font-mono text-[11px] tracking-[0.16em] uppercase text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
              >
                Cancel
              </button>
            ) : null}
          </div>
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
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-3">
          <div>
            <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
              Existing Vault
            </h2>
            <p className="mt-1 font-mono text-[10px] tracking-[0.12em] uppercase text-ink-soft/80">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadEntries()}
            className="border border-hairline px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft transition-colors hover:border-ink hover:text-ink"
          >
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-px border border-hairline bg-hairline md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="animate-pulse bg-paper p-4">
                <div className="h-3 w-2/5 bg-hairline" />
                <div className="mt-3 h-2 w-1/4 bg-hairline" />
                <div className="mt-4 h-12 w-full bg-hairline" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="border border-dashed border-hairline px-4 py-10 text-center font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
            Vault empty // add your first entry above
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-px border border-hairline bg-hairline md:grid-cols-2 xl:grid-cols-3">
            {entries.map((entry) => (
              <article
                key={entry.id}
                className={`flex flex-col bg-paper p-4 ${
                  editingId === entry.id ? "ring-1 ring-ink" : ""
                }`}
              >
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink">
                    {entry.title || "UNTITLED"}
                  </h3>
                  <CategoryBadge category={entry.category} />
                </div>
                <p className="flex-1 font-mono text-[10px] leading-relaxed text-ink-soft">
                  {entry.content
                    ? previewContent(entry.content)
                    : "— no content —"}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3">
                  <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft/70">
                    {entry.created_at
                      ? new Date(entry.created_at).toLocaleDateString()
                      : "—"}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={deletingId === entry.id || isSaving}
                      onClick={() => handleEdit(entry)}
                      className="border border-hairline px-2 py-1 font-mono text-[9px] tracking-[0.14em] uppercase text-ink transition-colors hover:border-ink disabled:opacity-40"
                    >
                      [ Edit ]
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === entry.id || isSaving}
                      onClick={() => void handleDelete(entry.id)}
                      className="border border-hairline px-2 py-1 font-mono text-[9px] tracking-[0.14em] uppercase text-red-600 transition-colors hover:border-red-600 disabled:opacity-40"
                    >
                      {deletingId === entry.id ? "Deleting…" : "[ Delete ]"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
