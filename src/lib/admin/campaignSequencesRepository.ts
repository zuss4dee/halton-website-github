import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { getSupabaseServer } from "@/lib/supabase-server";

export type CampaignSequenceRow = {
  id: string;
  client_id: string;
  step_number: number;
  subject: string;
  body: string;
  delay_days: number;
  created_at: string;
  updated_at: string;
};

export type CampaignSequenceStepInput = {
  stepNumber: 1 | 2 | 3;
  subject: string;
  body: string;
  delayDays: number;
};

export type CampaignSequenceStepPayload = {
  step_number: number;
  subject: string;
  body: string;
  delay_days: number;
};

export const SEQUENCE_MERGE_VARIABLES = ["{{first_name}}", "{{company_name}}"] as const;

const STEP_NUMBERS = [1, 2, 3] as const;

export function validateSequenceMergeVariables(
  steps: Pick<CampaignSequenceStepPayload, "subject" | "body" | "step_number">[],
): string | null {
  for (const step of steps) {
    const combined = `${step.subject}\n${step.body}`;
    const missing = SEQUENCE_MERGE_VARIABLES.filter((token) => !combined.includes(token));
    if (missing.length > 0) {
      return `Step ${step.step_number}: must include merge variables ${missing.join(", ")} in subject or body.`;
    }
  }
  return null;
}

export async function upsertCampaignSequenceSteps(
  db: SupabaseClient,
  clientId: string,
  steps: CampaignSequenceStepPayload[],
): Promise<{ steps: CampaignSequenceRow[] } | { error: string }> {
  const workspaceClientId = clientId.trim();
  if (!workspaceClientId) {
    return { error: "clientId is required." };
  }

  if (steps.length === 0) {
    return { error: "At least one sequence step is required." };
  }

  const seenStepNumbers = new Set<number>();
  for (const step of steps) {
    if (!Number.isInteger(step.step_number) || step.step_number < 1 || step.step_number > 3) {
      return { error: `Invalid step_number ${step.step_number}; must be 1, 2, or 3.` };
    }
    if (seenStepNumbers.has(step.step_number)) {
      return { error: `Duplicate step_number ${step.step_number}.` };
    }
    seenStepNumbers.add(step.step_number);
  }

  const mergeError = validateSequenceMergeVariables(steps);
  if (mergeError) {
    return { error: mergeError };
  }

  const now = new Date().toISOString();
  const payload = [];

  for (const step of steps) {
    const subject = step.subject.trim();
    if (!subject) {
      return { error: `Step ${step.step_number}: subject line is required.` };
    }

    const delayDays = Number.isFinite(step.delay_days)
      ? Math.max(0, Math.floor(step.delay_days))
      : 0;

    payload.push({
      client_id: workspaceClientId,
      step_number: step.step_number,
      subject,
      body: step.body.trim(),
      delay_days: delayDays,
      updated_at: now,
    });
  }

  const { data, error } = await db
    .from("campaign_sequences")
    .upsert(payload, { onConflict: "client_id,step_number" })
    .select("id, client_id, step_number, subject, body, delay_days, created_at, updated_at")
    .order("step_number", { ascending: true });

  if (error) {
    return { error: error.message };
  }

  return { steps: (data ?? []) as CampaignSequenceRow[] };
}

export async function upsertCampaignSequencesServer(
  clientId: string,
  steps: CampaignSequenceStepPayload[],
): Promise<{ steps: CampaignSequenceRow[] } | { error: string }> {
  return upsertCampaignSequenceSteps(getSupabaseServer(), clientId, steps);
}

export async function listCampaignSequences(
  clientId: string,
): Promise<{ steps: CampaignSequenceRow[] } | { error: string }> {
  const workspaceClientId = clientId.trim();
  if (!workspaceClientId) {
    return { error: "clientId is required." };
  }

  const { data, error } = await supabase
    .from("campaign_sequences")
    .select("id, client_id, step_number, subject, body, delay_days, created_at, updated_at")
    .eq("client_id", workspaceClientId)
    .in("step_number", STEP_NUMBERS)
    .order("step_number", { ascending: true });

  if (error) {
    return { error: error.message };
  }

  return { steps: (data ?? []) as CampaignSequenceRow[] };
}

export async function upsertCampaignSequences(
  clientId: string,
  steps: CampaignSequenceStepInput[],
): Promise<{ steps: CampaignSequenceRow[] } | { error: string }> {
  const workspaceClientId = clientId.trim();
  if (!workspaceClientId) {
    return { error: "clientId is required." };
  }

  if (steps.length !== 3) {
    return { error: "All three sequence steps are required." };
  }

  return upsertCampaignSequenceSteps(
    supabase,
    workspaceClientId,
    steps.map((step) => ({
      step_number: step.stepNumber,
      subject: step.subject,
      body: step.body,
      delay_days: step.delayDays,
    })),
  );
}
