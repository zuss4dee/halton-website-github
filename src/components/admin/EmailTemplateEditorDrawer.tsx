import { useEffect, useState } from "react";
import type { EmailTemplateRow } from "@/lib/admin/emailTemplatesRepository";

export type EmailTemplateFormValues = {
  name: string;
  subject: string;
  body: string;
};

type EmailTemplateEditorDrawerProps = {
  open: boolean;
  template: EmailTemplateRow | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: EmailTemplateFormValues) => void | Promise<void>;
};

const fieldClassName =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200 disabled:opacity-60";

const EMPTY_FORM: EmailTemplateFormValues = {
  name: "",
  subject: "",
  body: "",
};

export function EmailTemplateEditorDrawer({
  open,
  template,
  isSaving,
  onClose,
  onSave,
}: EmailTemplateEditorDrawerProps) {
  const [form, setForm] = useState<EmailTemplateFormValues>(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;

    if (template) {
      setForm({
        name: template.name,
        subject: template.subject,
        body: template.body,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, template]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) onClose();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, isSaving, onClose]);

  if (!open) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    void onSave(form);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close editor"
        className="fixed inset-0 z-[120] bg-black/40"
        onClick={isSaving ? undefined : onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-template-drawer-title"
        className="fixed inset-y-0 right-0 z-[121] flex w-full max-w-[min(100%,32rem)] flex-col border-l border-gray-200 bg-white shadow-xl sm:w-[42vw] sm:max-w-none"
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2
              id="email-template-drawer-title"
              className="text-xl font-semibold tracking-tight text-gray-900"
            >
              {template ? "Edit Template" : "Create Template"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Define the base framework the AI uses for outbound email.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:opacity-40"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-5 w-5"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
            <div>
              <label htmlFor="template-name" className="mb-2 block text-sm font-medium text-gray-700">
                Template Name
              </label>
              <input
                id="template-name"
                type="text"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                className={fieldClassName}
                placeholder="e.g. Cold intro — SaaS founders"
                required
              />
            </div>

            <div>
              <label
                htmlFor="template-subject"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Subject Line
              </label>
              <input
                id="template-subject"
                type="text"
                value={form.subject}
                onChange={(event) =>
                  setForm((current) => ({ ...current, subject: event.target.value }))
                }
                className={fieldClassName}
                placeholder="Quick idea for {{company}}"
                required
              />
            </div>

            <div>
              <label htmlFor="template-body" className="mb-2 block text-sm font-medium text-gray-700">
                Body Content
              </label>
              <textarea
                id="template-body"
                value={form.body}
                onChange={(event) =>
                  setForm((current) => ({ ...current, body: event.target.value }))
                }
                rows={14}
                className={`${fieldClassName} min-h-[240px] resize-y leading-relaxed`}
                placeholder="Hi {{first_name}},&#10;&#10;…"
              />
              <p className="mt-2 text-xs text-gray-500">
                Supported variables: {"{{first_name}}"}, {"{{company}}"}, {"{{pain_point}}"},{" "}
                {"{{industry}}"}.
              </p>
            </div>
          </div>

          <div className="border-t border-gray-100 px-6 py-5">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-lg bg-black px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
            >
              {isSaving ? "Saving…" : "Save Template"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
