import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ADMIN_FIELD_LABEL_CLASS,
  ADMIN_INPUT_CLASS,
  ADMIN_TEXTAREA_CLASS,
  AdminPageHeader,
} from "@/components/admin/AdminBrutalist";
import { StopSequenceDialog } from "@/components/admin/StopSequenceDialog";
import {
  listCampaignSequences,
  upsertCampaignSequences,
  type CampaignSequenceStepInput,
} from "@/lib/admin/campaignSequencesRepository";
import {
  fetchSequenceCampaignStatus,
  updateSequenceCampaignStatus,
  type SequenceCampaignStatus,
} from "@/lib/admin/sequenceCampaignStatus";

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

type SaveButtonState = "idle" | "saving" | "saved";

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

const STATUS_BADGE: Record<
  SequenceCampaignStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "border-emerald-600/40 bg-emerald-600/10 text-emerald-800",
  },
  paused: {
    label: "Paused",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-900",
  },
  stopped: {
    label: "Stopped",
    className: "border-[#c03939]/40 bg-[#c03939]/10 text-[#c03939]",
  },
};

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

function serializeSteps(steps: StepDraft[]): string {
  return JSON.stringify(
    steps.map((step) => ({
      stepNumber: step.stepNumber,
      subject: step.subject,
      body: step.body,
      delayDays: step.delayDays,
    })),
  );
}

export function SequenceBuilder({ clientId, clientName }: SequenceBuilderProps) {
  const workspaceClientId = clientId.trim();
  const [steps, setSteps] = useState<StepDraft[]>(buildInitialDrafts);
  const [savedSnapshot, setSavedSnapshot] = useState(serializeSteps(buildInitialDrafts()));
  const [isLoading, setIsLoading] = useState(true);
  const [saveButtonState, setSaveButtonState] = useState<SaveButtonState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [campaignStatus, setCampaignStatus] = useState<SequenceCampaignStatus>("active");
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [stopDialogOpen, setStopDialogOpen] = useState(false);

  const isDirty = useMemo(
    () => serializeSteps(steps) !== savedSnapshot,
    [savedSnapshot, steps],
  );

  const loadSequence = useCallback(async () => {
    if (!workspaceClientId) {
      const initial = buildInitialDrafts();
      setSteps(initial);
      setSavedSnapshot(serializeSteps(initial));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const [sequenceResult, statusResult] = await Promise.all([
      listCampaignSequences(workspaceClientId),
      fetchSequenceCampaignStatus(workspaceClientId),
    ]);

    if ("error" in sequenceResult) {
      setErrorMessage(sequenceResult.error);
      const initial = buildInitialDrafts();
      setSteps(initial);
      setSavedSnapshot(serializeSteps(initial));
    } else {
      const merged = mergeLoadedSteps(buildInitialDrafts(), sequenceResult.steps);
      setSteps(merged);
      setSavedSnapshot(serializeSteps(merged));
    }

    if ("error" in statusResult) {
      setStatusError(statusResult.error);
    } else {
      setCampaignStatus(statusResult.status);
      setStatusError(null);
    }

    setIsLoading(false);
  }, [workspaceClientId]);

  useEffect(() => {
    void loadSequence();
  }, [loadSequence]);

  useEffect(() => {
    if (saveButtonState !== "saved") return;

    const timer = window.setTimeout(() => {
      setSaveButtonState("idle");
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [saveButtonState]);

  const updateStep = (
    stepNumber: 1 | 2 | 3,
    patch: Partial<Pick<StepDraft, "subject" | "body" | "delayDays">>,
  ) => {
    setSteps((current) =>
      current.map((step) => (step.stepNumber === stepNumber ? { ...step, ...patch } : step)),
    );
  };

  const handleSave = async () => {
    if (!workspaceClientId || saveButtonState === "saving") return;

    setSaveButtonState("saving");
    setErrorMessage(null);

    const payload: CampaignSequenceStepInput[] = steps.map((step) => ({
      stepNumber: step.stepNumber,
      subject: step.subject,
      body: step.body,
      delayDays: Number.parseInt(step.delayDays, 10),
    }));

    const result = await upsertCampaignSequences(workspaceClientId, payload);

    if ("error" in result) {
      setErrorMessage(result.error);
      setSaveButtonState("idle");
      return;
    }

    const merged = mergeLoadedSteps(buildInitialDrafts(), result.steps);
    setSteps(merged);
    setSavedSnapshot(serializeSteps(merged));
    setSaveButtonState("saved");
  };

  const applyCampaignStatus = async (nextStatus: SequenceCampaignStatus) => {
    if (!workspaceClientId || isStatusUpdating) return;

    setIsStatusUpdating(true);
    setStatusError(null);

    const result = await updateSequenceCampaignStatus(workspaceClientId, nextStatus);

    if ("error" in result) {
      setStatusError(result.error);
    } else {
      setCampaignStatus(result.status);
    }

    setIsStatusUpdating(false);
  };

  const handlePauseResume = () => {
    if (campaignStatus === "stopped") return;

    void applyCampaignStatus(campaignStatus === "paused" ? "active" : "paused");
  };

  const handleStopConfirm = async () => {
    const result = await updateSequenceCampaignStatus(workspaceClientId, "stopped");
    if ("error" in result) {
      throw new Error(result.error);
    }
    setCampaignStatus(result.status);
    setStatusError(null);
  };

  const statusBadge = STATUS_BADGE[campaignStatus];
  const isStopped = campaignStatus === "stopped";
  const saveDisabled =
    isLoading || saveButtonState === "saving" || saveButtonState === "saved" || !workspaceClientId;

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

      <div className="flex flex-col gap-4 border border-hairline bg-paper px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[10px] tracking-[0.2em] text-ink/45 uppercase">
            Sequence status
          </span>
          <span
            className={`inline-flex items-center border px-2.5 py-1 font-mono text-[10px] tracking-[0.16em] uppercase ${statusBadge.className}`}
          >
            {statusBadge.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePauseResume}
            disabled={isLoading || isStatusUpdating || isStopped}
            className="border border-hairline px-4 py-2 font-mono text-[10px] tracking-[0.18em] text-ink uppercase transition-colors hover:bg-ink/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isStatusUpdating
              ? "Updating…"
              : campaignStatus === "paused"
                ? "Resume"
                : "Pause"}
          </button>
          <button
            type="button"
            onClick={() => setStopDialogOpen(true)}
            disabled={isLoading || isStatusUpdating || isStopped}
            className="border border-[#c03939]/50 px-4 py-2 font-mono text-[10px] tracking-[0.18em] text-[#c03939] uppercase transition-colors hover:border-[#c03939] hover:bg-[#c03939]/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Stop
          </button>
        </div>
      </div>

      {statusError ? (
        <p className="font-mono text-[11px] tracking-[0.12em] text-[#c03939] uppercase" role="alert">
          Status error: {statusError}
        </p>
      ) : null}

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
              disabled={saveButtonState === "saving"}
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {isDirty ? (
          <p className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-amber-800 uppercase">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
            Unsaved changes
          </p>
        ) : (
          <span className="font-mono text-[10px] tracking-[0.16em] text-ink/35 uppercase">
            All changes saved
          </span>
        )}

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saveDisabled}
          className="w-full max-w-md border border-ink bg-ink px-4 py-3 font-mono text-[11px] tracking-[0.2em] text-paper uppercase transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {saveButtonState === "saving"
            ? "Saving…"
            : saveButtonState === "saved"
              ? "Saved ✓"
              : "Save Sequence"}
        </button>
      </div>

      <StopSequenceDialog
        open={stopDialogOpen}
        onOpenChange={setStopDialogOpen}
        clientName={clientName}
        onConfirm={handleStopConfirm}
      />
    </section>
  );
}
