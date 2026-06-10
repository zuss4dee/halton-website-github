import { useCallback, useEffect, useRef, useState } from "react";
import type { LeadRow } from "@/lib/admin/leadsRepository";
import { ADMIN_FIELD_LABEL_CLASS } from "@/components/admin/AdminBrutalist";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  OUTBOUND_MERGE_TAGS,
  RECOMMENDED_BODY_WORD_LIMIT,
  buildOutboundDraftPreview,
  insertAtSelection,
  previewFromAddress,
  previewToAddress,
  resolveDraftBody,
  resolveDraftSubject,
  resolveSentSubject,
} from "@/lib/outbound/outboundDraft";

type FocusField = "subject" | "body";

type OutboundDraftEditorProps = {
  lead: LeadRow;
  readOnly?: boolean;
  subject: string;
  body: string;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
};

const fieldClassName =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200 disabled:cursor-default disabled:bg-gray-50 disabled:text-gray-600";

export function OutboundDraftEditor({
  lead,
  readOnly = false,
  subject,
  body,
  onSubjectChange,
  onBodyChange,
}: OutboundDraftEditorProps) {
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [focusField, setFocusField] = useState<FocusField>("body");

  const preview = buildOutboundDraftPreview(
    readOnly ? resolveSentSubject(lead) : subject,
    readOnly ? resolveDraftBody(lead, { includeSignature: true }) : body,
    lead,
  );

  const insertMergeTag = useCallback(
    (tag: string) => {
      if (readOnly) return;

      const ref = focusField === "subject" ? subjectRef.current : bodyRef.current;
      const value = focusField === "subject" ? subject : body;
      const onChange = focusField === "subject" ? onSubjectChange : onBodyChange;

      if (!ref) {
        onChange(`${value}${tag}`);
        return;
      }

      const { nextValue, nextCursor } = insertAtSelection(
        value,
        tag,
        ref.selectionStart ?? value.length,
        ref.selectionEnd ?? value.length,
      );
      onChange(nextValue);

      requestAnimationFrame(() => {
        ref.focus();
        ref.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [body, focusField, onBodyChange, onSubjectChange, readOnly, subject],
  );

  useEffect(() => {
    if (readOnly) return;
    setFocusField("body");
  }, [lead.id, readOnly]);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="edit">
        <TabsList className="h-9 bg-gray-100">
          <TabsTrigger value="edit" className="text-xs sm:text-sm">
            Edit
          </TabsTrigger>
          <TabsTrigger value="preview" className="text-xs sm:text-sm">
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="mt-4 space-y-4">
          {!readOnly ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                Merge fields
              </p>
              <div className="flex flex-wrap gap-2">
                {OUTBOUND_MERGE_TAGS.map(({ tag, label }) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertMergeTag(tag)}
                    className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
                    title={`Insert ${tag}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <label htmlFor="outbound-draft-subject" className={ADMIN_FIELD_LABEL_CLASS}>
              Subject
            </label>
            <input
              ref={subjectRef}
              id="outbound-draft-subject"
              type="text"
              value={readOnly ? preview.subject : subject}
              onChange={(event) => onSubjectChange(event.target.value)}
              onFocus={() => setFocusField("subject")}
              readOnly={readOnly}
              className={fieldClassName}
              placeholder="e.g. {{first_name}} — outbound at {{company_name}}"
            />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="outbound-draft-body" className={ADMIN_FIELD_LABEL_CLASS}>
                Body
              </label>
              {!readOnly ? (
                <span
                  className={`text-xs ${
                    preview.overRecommendedLimit ? "font-medium text-amber-700" : "text-gray-500"
                  }`}
                >
                  {preview.wordCount} words · aim for under {RECOMMENDED_BODY_WORD_LIMIT}
                </span>
              ) : null}
            </div>
            <textarea
              ref={bodyRef}
              id="outbound-draft-body"
              value={readOnly ? preview.bodyWithSignature : body}
              onChange={(event) => onBodyChange(event.target.value)}
              onFocus={() => setFocusField("body")}
              readOnly={readOnly}
              rows={14}
              className={`${fieldClassName} min-h-[280px] resize-y leading-relaxed`}
              placeholder="Write a short, founder-led note — 3–4 lines and one clear ask."
            />
            {!readOnly && preview.overRecommendedLimit ? (
              <p className="mt-2 text-xs text-amber-700">
                Long cold emails often land in Promotions. Try trimming to one hook and one question.
              </p>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Gmail preview
              </p>
            </div>
            <div className="space-y-3 px-4 py-4 text-sm">
              <PreviewRow label="From" value={previewFromAddress()} />
              <PreviewRow label="To" value={previewToAddress(lead)} />
              <PreviewRow label="Subject" value={preview.subject} />
              <div className="border-t border-gray-100 pt-4">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800">
                  {preview.bodyWithSignature}
                </pre>
              </div>
            </div>
          </div>
          {!readOnly ? (
            <p className="mt-2 text-xs text-gray-500">
              Signature is added automatically on send. Merge fields resolve with this lead&apos;s
              data.
            </p>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] gap-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="break-words text-gray-900">{value}</span>
    </div>
  );
}

export function loadDraftFromLead(lead: LeadRow, readOnly: boolean): { subject: string; body: string } {
  return {
    subject: resolveDraftSubject(lead),
    body: resolveDraftBody(lead, { includeSignature: readOnly }),
  };
}
