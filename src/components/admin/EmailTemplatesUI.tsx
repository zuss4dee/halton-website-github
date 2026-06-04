import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminBrutalist";
import { EmailTemplateEditorDrawer } from "@/components/admin/EmailTemplateEditorDrawer";
import {
  createEmailTemplate,
  deleteEmailTemplate,
  listEmailTemplates,
  updateEmailTemplate,
  type EmailTemplateRow,
} from "@/lib/admin/emailTemplatesRepository";

type EmailTemplatesUIProps = {
  clientId: string;
  clientName?: string | null;
};

function previewSubject(subject: string, maxLength = 72): string {
  const normalized = subject.replace(/\s+/g, " ").trim();
  if (!normalized) return "NO_SUBJECT";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

export function EmailTemplatesUI({ clientId, clientName }: EmailTemplatesUIProps) {
  const workspaceClientId = clientId.trim();

  const [templates, setTemplates] = useState<EmailTemplateRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplateRow | null>(null);

  const loadTemplates = useCallback(async () => {
    if (!workspaceClientId) {
      setTemplates([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const result = await listEmailTemplates(workspaceClientId);

    if ("error" in result) {
      setErrorMessage(result.error);
      setTemplates([]);
    } else {
      setTemplates(result.templates);
    }

    setIsLoading(false);
  }, [workspaceClientId]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const openCreate = () => {
    setEditingTemplate(null);
    setDrawerOpen(true);
  };

  const openEdit = (template: EmailTemplateRow) => {
    setEditingTemplate(template);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (isSaving) return;
    setDrawerOpen(false);
    setEditingTemplate(null);
  };

  const handleSave = async (values: { name: string; subject: string; body: string }) => {
    if (!workspaceClientId || isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);

    const result = editingTemplate
      ? await updateEmailTemplate(editingTemplate.id, values)
      : await createEmailTemplate({ clientId: workspaceClientId, ...values });

    setIsSaving(false);

    if ("error" in result) {
      setErrorMessage(result.error);
      return;
    }

    setDrawerOpen(false);
    setEditingTemplate(null);
    await loadTemplates();
  };

  const handleDelete = async (template: EmailTemplateRow) => {
    if (deletingId) return;
    if (!window.confirm(`Delete template "${template.name}"?`)) return;

    setDeletingId(template.id);
    setErrorMessage(null);

    const result = await deleteEmailTemplate(template.id);
    setDeletingId(null);

    if ("error" in result) {
      setErrorMessage(result.error);
      return;
    }

    if (editingTemplate?.id === template.id) {
      setDrawerOpen(false);
      setEditingTemplate(null);
    }

    await loadTemplates();
  };

  return (
    <section className="space-y-10">
      <AdminPageHeader
        code="03b // COPY_LIBRARY"
        title="Copy Library"
        description={
          clientName
            ? `${clientName} · Reusable Snippet Vault`
            : "Reusable Snippet Vault"
        }
        trailing={
          <button
            type="button"
            onClick={openCreate}
            disabled={!workspaceClientId}
            className="shrink-0 border border-ink bg-ink px-4 py-2.5 font-mono text-[10px] tracking-[0.16em] text-paper uppercase transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            + New Snippet
          </button>
        }
      />

      <div
        className="border-2 border-ink px-4 py-4 font-mono text-[10px] leading-relaxed tracking-[0.08em] text-ink uppercase"
        role="note"
      >
        <span className="text-ink">System Note:</span>{" "}
        These templates are for workflow nodes and ad-hoc drops. Automated cold email campaigns
        strictly use the{" "}
        <span className="bg-ink px-1 text-paper">AUTOMATED_SEQUENCE</span> tab.
      </div>

      {errorMessage ? (
        <p className="font-mono text-[11px] tracking-[0.12em] text-ink uppercase" role="alert">
          Error: {errorMessage}
        </p>
      ) : null}

      {isLoading ? (
        <p className="font-mono text-[11px] tracking-[0.2em] text-ink-soft uppercase">
          Loading snippets…
        </p>
      ) : templates.length === 0 ? (
        <div className="border border-hairline px-6 py-12 text-center">
          <p className="font-mono text-[11px] tracking-[0.14em] text-ink-soft uppercase">
            No snippets in vault
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-6 border border-ink px-4 py-2 font-mono text-[10px] tracking-[0.16em] text-ink uppercase transition-colors hover:bg-ink hover:text-paper"
          >
            Create First Snippet
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <article key={template.id} className="flex flex-col border border-hairline p-5">
              <h3 className="font-mono text-[12px] tracking-[0.12em] text-ink uppercase">
                {template.name}
              </h3>
              <p className="mt-3 font-mono text-[10px] leading-relaxed tracking-[0.06em] text-ink-soft">
                {previewSubject(template.subject)}
              </p>
              <div className="mt-6 flex gap-4 border-t border-hairline pt-4">
                <button
                  type="button"
                  disabled={deletingId === template.id || isSaving}
                  onClick={() => openEdit(template)}
                  className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase transition-colors hover:text-ink disabled:opacity-40"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={deletingId === template.id || isSaving}
                  onClick={() => void handleDelete(template)}
                  className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase transition-colors hover:text-ink disabled:opacity-40"
                >
                  {deletingId === template.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <EmailTemplateEditorDrawer
        open={drawerOpen}
        template={editingTemplate}
        isSaving={isSaving}
        onClose={closeDrawer}
        onSave={handleSave}
      />
    </section>
  );
}
