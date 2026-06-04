import { supabase } from "@/lib/supabase";

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

const STEP_NUMBERS = [1, 2, 3] as const;

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

  const now = new Date().toISOString();
  const payload: {
    client_id: string;
    step_number: number;
    subject: string;
    body: string;
    delay_days: number;
    updated_at: string;
  }[] = [];

  for (const step of steps) {
    const subject = step.subject.trim();
    if (!subject) {
      return { error: `Step ${step.stepNumber}: subject line is required.` };
    }

    const delayDays = Number.isFinite(step.delayDays)
      ? Math.max(0, Math.floor(step.delayDays))
      : 0;

    payload.push({
      client_id: workspaceClientId,
      step_number: step.stepNumber,
      subject,
      body: step.body.trim(),
      delay_days: delayDays,
      updated_at: now,
    });
  }

  const { data, error } = await supabase
    .from("campaign_sequences")
    .upsert(payload, { onConflict: "client_id,step_number" })
    .select("id, client_id, step_number, subject, body, delay_days, created_at, updated_at")
    .order("step_number", { ascending: true });

  if (error) {
    return { error: error.message };
  }

  return { steps: (data ?? []) as CampaignSequenceRow[] };
}
