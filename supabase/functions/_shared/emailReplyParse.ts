/** Notion rich_text content limit per text object. */
const NOTION_TEXT_CHUNK_SIZE = 2000;

export type SplitEmailReplyResult = {
  freshReply: string;
  threadHistory: string;
};

/**
 * Splits an inbound reply into the new message vs quoted thread history.
 * Uses common email client quote markers; keeps the earliest split point.
 */
export function splitInboundEmailReply(raw: string): SplitEmailReplyResult {
  const normalized = raw.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return { freshReply: "", threadHistory: "" };
  }

  let splitIndex = normalized.length;

  const markerPatterns: RegExp[] = [
    /^On .+ wrote:\s*$/im,
    /^-{2,}\s*Original Message\s*-{2,}\s*$/im,
    /^-----\s*Forwarded message\s*-----$/im,
    /^_{10,}\s*$/m,
  ];

  for (const pattern of markerPatterns) {
    const match = pattern.exec(normalized);
    if (match && match.index < splitIndex) {
      splitIndex = match.index;
    }
  }

  const quotedBlockMatch = normalized.match(/\n\n(?:> .+(?:\n|$))+/);
  if (quotedBlockMatch?.index !== undefined && quotedBlockMatch.index < splitIndex) {
    splitIndex = quotedBlockMatch.index;
  }

  const fromHeaderMatch = normalized.match(/\n\nFrom:\s[^\n]+(?:\n(?:Sent|Date|To|Subject|Cc|Bcc):[^\n]+)+/i);
  if (fromHeaderMatch?.index !== undefined && fromHeaderMatch.index < splitIndex) {
    splitIndex = fromHeaderMatch.index;
  }

  const fromLineMatch = normalized.match(/\nFrom:\s[^\n]+/i);
  if (fromLineMatch?.index !== undefined && fromLineMatch.index < splitIndex) {
    splitIndex = fromLineMatch.index;
  }

  let freshReply = normalized.slice(0, splitIndex).trim();
  let threadHistory = normalized.slice(splitIndex).trim();

  if (!freshReply && threadHistory) {
    const [firstParagraph, ...rest] = threadHistory.split(/\n\n/);
    freshReply = firstParagraph?.trim() ?? threadHistory;
    threadHistory = rest.join("\n\n").trim();
  }

  if (!freshReply) {
    freshReply = normalized;
    threadHistory = "";
  }

  return { freshReply, threadHistory };
}

export function notionRichTextFromPlain(text: string): Array<{ type: "text"; text: { content: string } }> {
  const trimmed = text.trim();
  if (!trimmed) {
    return [{ type: "text", text: { content: "—" } }];
  }

  const chunks: Array<{ type: "text"; text: { content: string } }> = [];
  for (let i = 0; i < trimmed.length; i += NOTION_TEXT_CHUNK_SIZE) {
    chunks.push({
      type: "text",
      text: { content: trimmed.slice(i, i + NOTION_TEXT_CHUNK_SIZE) },
    });
  }
  return chunks;
}

export function buildNotionReplyParagraphBlock(text: string): Record<string, unknown> {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: notionRichTextFromPlain(text),
    },
  };
}

export function buildNotionThreadHistoryToggleBlock(): Record<string, unknown> {
  return {
    object: "block",
    type: "toggle",
    toggle: {
      rich_text: [{ type: "text", text: { content: "View Full Email Thread History" } }],
    },
  };
}

export function buildNotionReplyPageChildren(
  freshReply: string,
  threadHistory: string,
): Record<string, unknown>[] {
  const children: Record<string, unknown>[] = [];

  if (freshReply.trim()) {
    children.push(buildNotionReplyParagraphBlock(freshReply));
  }

  if (threadHistory.trim()) {
    children.push(buildNotionThreadHistoryToggleBlock());
  }

  return children;
}
