/**
 * HTML signature block for multipart or html-only sends.
 * Outbound pipeline currently dispatches plain `text` via Resend.
 */
export const OUTBOUND_FOUNDER_SIGNATURE_HTML = `<br><br>
Best,<br>
<b>Damilare Adeosun</b><br>
Founder | Halton Works<br>
<span style="font-size: 12px; color: #666;"><i>To opt out of future emails, just reply 'stop'.</i></span>`;

/** Plain-text signature appended to every outbound Resend `text` body. */
export const OUTBOUND_FOUNDER_SIGNATURE_TEXT = `

Best,
Damilare Adeosun
Founder | Halton Works
To opt out of future emails, just reply 'stop'.`;

const SIGNATURE_MARKER = "Founder | Halton Works";

/** AI drafts sign off as "Damilare" — strip it so the full block isn't doubled. */
const AI_SIGNOFF_LINE = /^[\s—–-]*(best|warm regards|regards|cheers|thanks|thank you)?[,\s]*(Damilare(\s+Adeosun)?)?[\s.,!]*$/i;

function stripTrailingAiSignoff(body: string): string {
  const lines = body.trimEnd().split(/\r?\n/);
  while (lines.length > 0) {
    const last = lines[lines.length - 1].trim();
    if (last && !AI_SIGNOFF_LINE.test(last)) break;
    lines.pop();
  }
  return lines.join("\n").trimEnd();
}

export function appendOutboundFounderSignature(body: string): string {
  const trimmed = body.trimEnd();
  if (!trimmed) {
    return OUTBOUND_FOUNDER_SIGNATURE_TEXT.trimStart();
  }
  if (trimmed.includes(SIGNATURE_MARKER)) {
    return trimmed;
  }
  const withoutAiSignoff = stripTrailingAiSignoff(trimmed);
  const base = withoutAiSignoff || trimmed;
  return `${base}${OUTBOUND_FOUNDER_SIGNATURE_TEXT}`;
}
