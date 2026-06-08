import { getSupabaseUrl } from "@/lib/auth/env";

export type RunOutboundPayload = {
  clientId: string;
  nodes?: unknown[];
  edges?: unknown[];
  testEmail?: string;
  sendApproved?: boolean;
  mode?: string;
  executiveOverride?: {
    node_id: string;
    corrected_payload: string;
    reason: string;
  };
  priorContext?: Record<string, unknown>;
};

export type RunOutboundExecutionLogEntry = {
  nodeId: string;
  type?: string;
  status: string;
};

export type RunOutboundResult = {
  success?: boolean;
  executionLog?: RunOutboundExecutionLogEntry[];
  context?: Record<string, unknown>;
  error?: string;
  details?: string;
};

export type InvokeRunOutboundResponse =
  | { ok: true; data: RunOutboundResult }
  | { ok: false; error: string; data?: RunOutboundResult | null };

function resolveSupabaseFunctionsBaseUrl(): string | null {
  const raw =
    getSupabaseUrl()?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    process.env.VITE_SUPABASE_URL?.trim() ||
    null;

  return raw ? raw.replace(/\/$/, "") : null;
}

function resolveServiceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

/** Invokes the deployed run-outbound Edge Function (not build-and-run-automation). */
export async function invokeRunOutbound(
  payload: RunOutboundPayload,
): Promise<InvokeRunOutboundResponse> {
  const supabaseUrl = resolveSupabaseFunctionsBaseUrl();
  const serviceRoleKey = resolveServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      ok: false,
      error: "Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY for run-outbound.",
    };
  }

  const endpoint = `${supabaseUrl}/functions/v1/run-outbound`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "x-workflow-type": "automation",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as RunOutboundResult | null;

    if (!response.ok) {
      const message =
        typeof data?.error === "string"
          ? data.error
          : `run-outbound failed (${response.status})`;
      return { ok: false, error: message, data };
    }

    if (data?.error) {
      return { ok: false, error: data.error, data };
    }

    return { ok: true, data: data ?? { success: true } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "run-outbound request failed.";
    return { ok: false, error: message };
  }
}
