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

const fieldInputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200";

function previewContent(text: string, maxLength = 160): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function formatCategoryPillLabel(category: string): string {
  return category
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-block rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
      {formatCategoryPillLabel(category)}
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
    <section className="space-y-8">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
          <div>
            <label htmlFor="vault-title" className="mb-2 block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              id="vault-title"
              type="text"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className={fieldInputClass}
              placeholder="e.g. Q3 logistics case study"
              required
            />
          </div>

          <div>
            <label htmlFor="vault-category" className="mb-2 block text-sm font-medium text-gray-700">
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
              className={fieldInputClass}
            >
              {KNOWLEDGE_VAULT_UI_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {formatKnowledgeCategoryLabel(category)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="vault-content" className="mb-2 block text-sm font-medium text-gray-700">
              Content
            </label>
            <textarea
              id="vault-content"
              value={form.content}
              onChange={(event) =>
                setForm((current) => ({ ...current, content: event.target.value }))
              }
              rows={10}
              className={`${fieldInputClass} min-h-[200px] resize-y leading-relaxed`}
              placeholder="Paste case study, offer copy, brand voice rules, objection handlers…"
              required
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={isSaving || !workspaceClientId}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
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
                className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </div>

      {(statusMessage || errorMessage) && (
        <p
          className={`text-sm ${errorMessage ? "text-red-600" : "text-emerald-700"}`}
        >
          {errorMessage ?? statusMessage}
        </p>
      )}

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Existing Assets</h2>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void loadEntries()}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
          >
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="h-4 w-2/5 rounded bg-gray-200" />
                <div className="mt-3 h-3 w-1/4 rounded bg-gray-100" />
                <div className="mt-4 h-12 w-full rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
            No assets yet. Add your first entry above.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {entries.map((entry) => (
              <article
                key={entry.id}
                className={`flex flex-col rounded-lg border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 ${
                  editingId === entry.id ? "ring-2 ring-gray-200" : ""
                }`}
              >
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {entry.title || "Untitled"}
                  </h3>
                  <CategoryBadge category={entry.category} />
                </div>
                <p className="flex-1 text-sm leading-relaxed text-gray-600">
                  {entry.content ? previewContent(entry.content) : "No content"}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                  <span className="text-xs text-gray-400">
                    {entry.created_at
                      ? new Date(entry.created_at).toLocaleDateString()
                      : "—"}
                  </span>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      disabled={deletingId === entry.id || isSaving}
                      onClick={() => handleEdit(entry)}
                      className="text-sm text-gray-500 transition-colors hover:text-gray-900 disabled:opacity-40"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === entry.id || isSaving}
                      onClick={() => void handleDelete(entry.id)}
                      className="text-sm text-gray-500 transition-colors hover:text-red-600 disabled:opacity-40"
                    >
                      {deletingId === entry.id ? "Deleting…" : "Delete"}
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
