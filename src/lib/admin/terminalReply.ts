import type { AgentLogRow } from "@/lib/admin/agentTelemetry";

export type TerminalReplyContext = {
  logId: string;
  agentLabel: string;
  eventType: string;
  quotedText: string;
  createdAt?: string;
};

export function buildReplyPrefix(agentLabel: string): string {
  return `> Re: [${agentLabel}]: `;
}

export function extractReplyableText(log: AgentLogRow): string {
  const payload = log.payload ?? {};

  if (log.event_type === "THOUGHT") {
    return typeof payload.thought === "string" ? payload.thought.trim() : "";
  }

  if (log.event_type === "TOOL_RESULT") {
    const result = payload.result;
    if (typeof result === "string") return result.trim();
    return "";
  }

  return "";
}

export function shouldOfferQuickReply(log: AgentLogRow, agentLabel: string): boolean {
  if (agentLabel === "SYSTEM") return false;
  if (log.event_type !== "THOUGHT" && log.event_type !== "TOOL_RESULT") return false;

  const text = extractReplyableText(log);
  if (!text) return false;

  const hasQuestion =
    text.includes("?") ||
    /^(would you|could you|should we|can you|do you want|please confirm|which option|what would you)/im.test(
      text,
    );

  const hasOptionBlock =
    /(^|\n)\s*[-*•]\s+\S+/m.test(text) ||
    /(^|\n)\s*\d+[\).\]]\s+\S+/m.test(text) ||
    /\b(option\s*[a-d]|choose one of|pick one of)\b/i.test(text);

  return hasQuestion || hasOptionBlock;
}

export function buildReplyContext(
  log: AgentLogRow,
  agentLabel: string,
): TerminalReplyContext {
  return {
    logId: log.id,
    agentLabel,
    eventType: log.event_type,
    quotedText: extractReplyableText(log),
    createdAt: log.created_at,
  };
}

export function formatReplyContextForCeo(
  command: string,
  replyContext: TerminalReplyContext,
): string {
  return [
    "The admin is replying to a specific prior message in the telemetry thread.",
    "Respond directly to their feedback and preserve conversational continuity.",
    "",
    "--- REPLY TARGET ---",
    `Agent: ${replyContext.agentLabel}`,
    `Event: ${replyContext.eventType}`,
    `Log ID: ${replyContext.logId}`,
    replyContext.createdAt ? `Timestamp: ${replyContext.createdAt}` : null,
    "Prior message:",
    '"""',
    replyContext.quotedText,
    '"""',
    "",
    "--- ADMIN REPLY ---",
    command,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
