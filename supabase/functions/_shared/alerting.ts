/** Deno mirror of src/lib/tools/alerting.ts — keep payload structure in sync. */

export type AlertChannel = "ops" | "leads";
export type AlertLevel = "warning" | "critical";

export type AlertHumanOperatorResult =
  | { ok: true; channel: AlertChannel }
  | { ok: false; channel: AlertChannel; error: string };

function readDenoEnv(...names: string[]): string | null {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  return null;
}

export function resolveSlackWebhookUrl(channel: AlertChannel): string | null {
  if (channel === "ops") {
    return readDenoEnv("SLACK_OPS_WEBHOOK_URL");
  }

  return readDenoEnv("SLACK_LEADS_WEBHOOK_URL", "SLACK_WEBHOOK_URL");
}

function buildSlackPayload(channel: AlertChannel, level: AlertLevel, message: string) {
  const headline =
    channel === "ops" ? `🚨 *${level.toUpperCase()} Alert*` : `🔥 *New Lead Alert*`;

  return {
    text: headline,
    attachments: [
      {
        color: level === "critical" ? "#FF0000" : "#FFA500",
        text: message.trim(),
        footer: `Halton Works | ${new Date().toISOString()}`,
      },
    ],
  };
}

export async function alertHumanOperator(
  channel: AlertChannel,
  level: AlertLevel,
  message: string,
): Promise<AlertHumanOperatorResult> {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    return { ok: false, channel, error: "message is required." };
  }

  const webhookUrl = resolveSlackWebhookUrl(channel);
  if (!webhookUrl) {
    const envName =
      channel === "ops" ? "SLACK_OPS_WEBHOOK_URL" : "SLACK_LEADS_WEBHOOK_URL (or SLACK_WEBHOOK_URL)";
    return { ok: false, channel, error: `${envName} is not configured.` };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSlackPayload(channel, level, trimmedMessage)),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false,
        channel,
        error: `Slack webhook failed (${response.status})${body ? `: ${body}` : ""}`,
      };
    }

    return { ok: true, channel };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown Slack error.";
    return { ok: false, channel, error: detail };
  }
}

export async function alertLeadsChannel(message: string): Promise<AlertHumanOperatorResult> {
  return alertHumanOperator("leads", "warning", message);
}
