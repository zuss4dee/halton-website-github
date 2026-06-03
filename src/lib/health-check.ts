export type IntegrationHealthStatus = "connected" | "failed" | "ready";

export type HealthCheckResult = {
  status: IntegrationHealthStatus;
  detail: string;
};

const RESEND_DOMAINS_URL = "https://api.resend.com/domains";
const NOTION_API_VERSION = "2022-06-28";

const SLACK_WEBHOOK_PATTERN =
  /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9_-]+$/;

export async function checkResend(apiKey: string | null | undefined): Promise<HealthCheckResult> {
  const key = apiKey?.trim();

  if (!key) {
    return { status: "failed", detail: "No Resend API key configured." };
  }

  try {
    const response = await fetch(RESEND_DOMAINS_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      return { status: "connected", detail: "Resend API key authorized." };
    }

    if (response.status === 401 || response.status === 403) {
      return { status: "failed", detail: "Resend rejected the API key." };
    }

    const body = await response.text();
    return {
      status: "failed",
      detail: `Resend API returned HTTP ${response.status}: ${body.slice(0, 120)}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    return { status: "failed", detail: message };
  }
}

export async function checkNotion(
  apiKey: string | null | undefined,
  databaseId: string | null | undefined,
): Promise<HealthCheckResult> {
  const key = apiKey?.trim();
  const dbId = databaseId?.trim();

  if (!key) {
    return { status: "failed", detail: "No Notion API key configured." };
  }

  if (!dbId) {
    return { status: "failed", detail: "No Notion database ID configured." };
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Notion-Version": NOTION_API_VERSION,
      },
    });

    if (response.ok) {
      return { status: "connected", detail: "Notion database reachable." };
    }

    if (response.status === 401) {
      return { status: "failed", detail: "Notion API key is invalid." };
    }

    if (response.status === 404) {
      return { status: "failed", detail: "Notion database ID not found or not shared with integration." };
    }

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    const message = payload?.message ?? `HTTP ${response.status}`;
    return { status: "failed", detail: message };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    return { status: "failed", detail: message };
  }
}

export function checkSlack(webhookUrl: string | null | undefined): HealthCheckResult {
  const url = webhookUrl?.trim();

  if (!url) {
    return { status: "failed", detail: "No Slack webhook URL configured." };
  }

  if (!SLACK_WEBHOOK_PATTERN.test(url)) {
    return {
      status: "failed",
      detail: "Slack webhook URL format is invalid.",
    };
  }

  return {
    status: "ready",
    detail: "Webhook URL present and correctly formatted.",
  };
}

export type SystemHealthReport = {
  resend: HealthCheckResult;
  notion: HealthCheckResult;
  slack: HealthCheckResult;
  checkedAt: string;
};

export async function runSystemHealthChecks(config: {
  resendApiKey?: string | null;
  notionApiKey?: string | null;
  notionDatabaseId?: string | null;
  slackWebhookUrl?: string | null;
}): Promise<SystemHealthReport> {
  const [resend, notion] = await Promise.all([
    checkResend(config.resendApiKey),
    checkNotion(config.notionApiKey, config.notionDatabaseId),
  ]);

  const slack = checkSlack(config.slackWebhookUrl);

  return {
    resend,
    notion,
    slack,
    checkedAt: new Date().toISOString(),
  };
}
