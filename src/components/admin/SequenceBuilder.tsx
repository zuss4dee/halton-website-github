import { useCallback, useEffect, useState } from "react";
import {
  ADMIN_FIELD_LABEL_CLASS,
  ADMIN_INPUT_CLASS,
  ADMIN_TEXTAREA_CLASS,
  AdminPageHeader,
} from "@/components/admin/AdminBrutalist";
import {
  listCampaignSequences,
  upsertCampaignSequences,
  type CampaignSequenceStepInput,
} from "@/lib/admin/campaignSequencesRepository";

type SequenceBuilderProps = {
  clientId: string;
  clientName?: string | null;
};

type StepDraft = {
  stepNumber: 1 | 2 | 3;
  title: string;
  subtitle: string;
  subject: string;
  body: string;
  delayDays: string;
  defaultDelayDays: number;
};

const STEP_DEFINITIONS: StepDraft[] = [
  {
    stepNumber: 1,
    title: "STEP 1 (Cold Email)",
    subtitle: "Initial outbound touch",
    subject: "",
    body: "",
    delayDays: "0",
    defaultDelayDays: 0,
  },
  {
    stepNumber: 2,
    title: "STEP 2 (Follow-Up)",
    subtitle: "Second touch if no reply",
    subject: "",
    body: "",
    delayDays: "3",
    defaultDelayDays: 3,
  },
  {
    stepNumber: 3,
    title: "STEP 3 (Breakup)",
    subtitle: "Final close-the-loop message",
    subject: "",
    body: "",
    delayDays: "7",
    defaultDelayDays: 7,
  },
];

function buildInitialDrafts(): StepDraft[] {
  return STEP_DEFINITIONS.map((step) => ({ ...step }));
}

function mergeLoadedSteps(
  drafts: StepDraft[],
  loaded: { step_number: number; subject: string; body: string; delay_days: number }[],
): StepDraft[] {
  return drafts.map((draft) => {
    const row = loaded.find((s) => s.step_number === draft.stepNumber);
    if (!row) return draft;
    return {
      ...draft,
      subject: row.subject ?? "",
      body: row.body ?? "",
      delayDays: String(row.delay_days ?? draft.defaultDelayDays),
    };
  });
}

export function SequenceBuilder({ clientId, clientName }: SequenceBuilderProps) {
  const workspaceClientId = clientId.trim();
  const [steps, setSteps] = useState<StepDraft[]>(buildInitialDrafts);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const loadSequence = useCallback(async () => {
    if (!workspaceClientId) {
      setSteps(buildInitialDrafts());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const result = await listCampaignSequences(workspaceClientId);

    if ("error" in result) {
      setErrorMessage(result.error);
      setSteps(buildInitialDrafts());
    } else {
      setSteps(mergeLoadedSteps(buildInitialDrafts(), result.steps));
    }

    setIsLoading(false);
  }, [workspaceClientId]);

  useEffect(() => {
    void loadSequence();
  }, [loadSequence]);

  const updateStep = (stepNumber: 1 | 2 | 3, patch: Partial<Pick<StepDraft, "subject" | "body" | "delayDays">>) => {
    setSteps((current) =>
      current.map((step) => (step.stepNumber === stepNumber ? { ...step, ...patch } : step)),
    );
    setSaveMessage(null);
  };

  const handleSave = async () => {
    if (!workspaceClientId || isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSaveMessage(null);

    const payload: CampaignSequenceStepInput[] = steps.map((step) => ({
      stepNumber: step.stepNumber,
      subject: step.subject,
      body: step.body,
      delayDays: Number.parseInt(step.delayDays, 10),
    }));

    const result = await upsertCampaignSequences(workspaceClientId, payload);

    if ("error" in result) {
      setErrorMessage(result.error);
    } else {
      setSteps(mergeLoadedSteps(buildInitialDrafts(), result.steps));
      setSaveMessage("SEQUENCE_SAVED");
    }

    setIsSaving(false);
  };

  return (
    <section className="space-y-10">
      <AdminPageHeader
        code="03a // AUTOMATED_SEQUENCE"
        title="Automated Sequence"
        description={
          clientName
            ? `${clientName} · The 3-Step Linear Drip Cadence`
            : "The 3-Step Linear Drip Cadence"
        }
      />

      <div className="border border-hairline bg-ink/[0.02] px-4 py-4 font-mono text-[10px] leading-relaxed tracking-[0.1em] text-ink-soft uppercase">
        <p className="text-ink/70">Merge variables at send time:</p>
        <p className="mt-2">
          <span className="text-ink">{"{{first_name}}"}</span>
          <span className="mx-2 text-ink/30">·</span>
          <span className="text-ink">{"{{company_name}}"}</span>
        </p>
        <p className="mt-2 text-ink/45">
          Insert tokens in subject or body — replaced per lead when the sequence runs.
        </p>
      </div>

      {errorMessage ? (
        <p className="font-mono text-[11px] tracking-[0.12em] text-ink uppercase" role="alert">
          Error: {errorMessage}
        </p>
      ) : null}

      {saveMessage ? (
        <p className="font-mono text-[11px] tracking-[0.12em] text-ink uppercase">{saveMessage}</p>
      ) : null}

      {isLoading ? (
        <p className="font-mono text-[11px] tracking-[0.2em] text-ink-soft uppercase">
          Loading sequence…
        </p>
      ) : (
        <div className="space-y-8">
          {steps.map((step) => (
            <fieldset
              key={step.stepNumber}
              className="border border-hairline p-5 md:p-6"
              disabled={isSaving}
            >
              <legend className="mb-6 px-1 font-mono text-[11px] tracking-[0.22em] text-ink uppercase">
                {step.title}
              </legend>
              <p className="mb-6 font-mono text-[9px] tracking-[0.16em] text-ink/40 uppercase">
                {step.subtitle}
              </p>

              <div className="space-y-6">
                <div>
                  <label
                    htmlFor={`subject-${step.stepNumber}`}
                    className={ADMIN_FIELD_LABEL_CLASS}
                  >
                    Subject Line
                  </label>
                  <input
                    id={`subject-${step.stepNumber}`}
                    type="text"
                    value={step.subject}
                    onChange={(e) => updateStep(step.stepNumber, { subject: e.target.value })}
                    placeholder="e.g. Quick idea for {{company_name}}"
                    className={ADMIN_INPUT_CLASS}
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label htmlFor={`body-${step.stepNumber}`} className={ADMIN_FIELD_LABEL_CLASS}>
                    Email Body
                  </label>
                  <textarea
                    id={`body-${step.stepNumber}`}
                    value={step.body}
                    onChange={(e) => updateStep(step.stepNumber, { body: e.target.value })}
                    placeholder={"Hi {{first_name}},\n\n…"}
                    className={`${ADMIN_TEXTAREA_CLASS} min-h-[160px]`}
                    rows={8}
                  />
                </div>

                <div className="max-w-[200px]">
                  <label
                    htmlFor={`delay-${step.stepNumber}`}
                    className={ADMIN_FIELD_LABEL_CLASS}
                  >
                    Delay Days
                  </label>
                  <input
                    id={`delay-${step.stepNumber}`}
                    type="number"
                    min={0}
                    step={1}
                    value={step.delayDays}
                    onChange={(e) => updateStep(step.stepNumber, { delayDays: e.target.value })}
                    className={ADMIN_INPUT_CLASS}
                  />
                  <p className="mt-2 font-mono text-[9px] tracking-[0.12em] text-ink/35 uppercase">
                    {step.stepNumber === 1
                      ? "Days before step 1 sends (usually 0)"
                      : "Days after previous step"}
                  </p>
                </div>
              </div>
            </fieldset>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={isLoading || isSaving || !workspaceClientId}
        className="w-full max-w-md border border-ink bg-ink px-4 py-3 font-mono text-[11px] tracking-[0.2em] text-paper uppercase transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSaving ? "Saving…" : "Save Sequence"}
      </button>
    </section>
  );
}
