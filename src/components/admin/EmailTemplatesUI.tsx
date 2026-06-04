import { useCallback, useEffect, useState } from "react";
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
};

function previewSubject(subject: string, maxLength = 72): string {
  const normalized = subject.replace(/\s+/g, " ").trim();
  if (!normalized) return "No subject line";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

export function EmailTemplatesUI({ clientId }: EmailTemplatesUIProps) {
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
    <section>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Template Library</h1>
          <p className="mt-2 text-sm text-gray-500">
            Manage base email frameworks and follow-up structures for the AI.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={!workspaceClientId}
          className="shrink-0 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
        >
          + Create Template
        </button>
      </div>

      {errorMessage ? (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="h-5 w-2/5 rounded bg-gray-200" />
              <div className="mt-3 h-4 w-4/5 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
          <p className="text-sm text-gray-500">No templates yet.</p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-4 text-sm font-medium text-gray-900 underline-offset-2 hover:underline"
          >
            Create your first template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <article
              key={template.id}
              className="flex flex-col rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
            >
              <h3 className="font-semibold text-gray-900">{template.name}</h3>
              <p className="mt-2 text-sm text-gray-500">{previewSubject(template.subject)}</p>
              <div className="mt-5 flex gap-4 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  disabled={deletingId === template.id || isSaving}
                  onClick={() => openEdit(template)}
                  className="text-sm text-gray-500 transition-colors hover:text-gray-900 disabled:opacity-40"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={deletingId === template.id || isSaving}
                  onClick={() => void handleDelete(template)}
                  className="text-sm text-gray-500 transition-colors hover:text-gray-900 disabled:opacity-40"
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
