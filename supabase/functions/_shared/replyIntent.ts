export type ReplyIntentResult = {
  isHotLead: boolean;
  intent: "book_meeting" | "interested" | "question" | "neutral" | "not_interested" | "opt_out";
  confidence: "high" | "medium" | "low";
  source: "deepseek" | "heuristic";
  reason: string;
};

const OPT_OUT_PATTERN =
  /\b(unsubscribe|opt out|opt-out|remove me|stop emailing|don't contact|do not contact|not interested)\b/i;

const POSITIVE_PATTERN =
  /\b(yes|yeah|sure|sounds good|interested|let'?s (talk|chat|connect)|book|schedule|calendar|15.?min|call|meeting|would love|happy to|keen to|let me know when)\b/i;

export function classifyReplyHeuristic(replyText: string): ReplyIntentResult {
  const trimmed = replyText.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return {
      isHotLead: false,
      intent: "neutral",
      confidence: "low",
      source: "heuristic",
      reason: "Empty reply body",
    };
  }

  if (OPT_OUT_PATTERN.test(trimmed)) {
    return {
      isHotLead: false,
      intent: "opt_out",
      confidence: "high",
      source: "heuristic",
      reason: "Opt-out language detected",
    };
  }

  if (/\b(not interested|no thanks|no thank you|pass for now|wrong person|not a fit)\b/i.test(trimmed)) {
    return {
      isHotLead: false,
      intent: "not_interested",
      confidence: "high",
      source: "heuristic",
      reason: "Negative reply language detected",
    };
  }

  if (/\?/.test(trimmed) && !POSITIVE_PATTERN.test(trimmed)) {
    return {
      isHotLead: false,
      intent: "question",
      confidence: "medium",
      source: "heuristic",
      reason: "Question without clear booking intent",
    };
  }

  if (POSITIVE_PATTERN.test(trimmed)) {
    const bookSignals = /\b(book|schedule|calendar|call|meeting|15.?min|would love|happy to|yes)\b/i.test(
      trimmed,
    );
    return {
      isHotLead: bookSignals,
      intent: bookSignals ? "book_meeting" : "interested",
      confidence: "medium",
      source: "heuristic",
      reason: bookSignals ? "Positive reply with meeting intent" : "Positive interest without explicit booking ask",
    };
  }

  return {
    isHotLead: false,
    intent: "neutral",
    confidence: "low",
    source: "heuristic",
    reason: "No clear positive or negative signals",
  };
}

function parseIntentJson(raw: string): ReplyIntentResult | null {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      intent?: string;
      is_hot_lead?: boolean;
      reason?: string;
    };

    const intentRaw = parsed.intent?.trim().toLowerCase();
    const validIntents = [
      "book_meeting",
      "interested",
      "question",
      "neutral",
      "not_interested",
      "opt_out",
    ] as const;

    const intent = validIntents.includes(intentRaw as (typeof validIntents)[number])
      ? (intentRaw as ReplyIntentResult["intent"])
      : "neutral";

    const isHotLead =
      typeof parsed.is_hot_lead === "boolean"
        ? parsed.is_hot_lead
        : intent === "book_meeting" || intent === "interested";

    return {
      isHotLead: intent === "opt_out" || intent === "not_interested" ? false : isHotLead,
      intent,
      confidence: "high",
      source: "deepseek",
      reason: typeof parsed.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim()
        : "LLM classification",
    };
  } catch {
    return null;
  }
}

export async function classifyReplyIntent(
  replyText: string,
  deepseekApiKey: string | null,
): Promise<ReplyIntentResult> {
  const heuristic = classifyReplyHeuristic(replyText);
  if (!deepseekApiKey?.trim()) {
    return heuristic;
  }

  const systemPrompt = `You triage B2B cold-email replies for a founder selling outbound infrastructure.
Return ONLY valid JSON (no markdown):
{"intent":"book_meeting"|"interested"|"question"|"neutral"|"not_interested"|"opt_out","is_hot_lead":boolean,"reason":"one short sentence"}

Rules:
- book_meeting: wants a call, meeting, calendar link, or says yes to scheduling (includes "I'd love to have a call booked")
- interested: positive but no explicit scheduling ask yet
- question: asking for info, pricing, how it works
- not_interested: polite no
- opt_out: unsubscribe / stop / remove me
- is_hot_lead: true for book_meeting OR clearly warm interested replies worth immediate founder attention`;

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${deepseekApiKey.trim()}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.1,
        max_tokens: 200,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Reply to classify:\n\n${replyText.slice(0, 4000)}` },
        ],
      }),
    });

    if (!response.ok) {
      console.warn("[replyIntent] DeepSeek failed:", response.status);
      return heuristic;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    const parsed = parseIntentJson(content);
    if (parsed) return parsed;

    console.warn("[replyIntent] Unparseable LLM verdict, using heuristic");
    return heuristic;
  } catch (error) {
    console.warn(
      "[replyIntent] LLM error:",
      error instanceof Error ? error.message : String(error),
    );
    return heuristic;
  }
}
