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

export function appendOutboundFounderSignature(body: string): string {
  const trimmed = body.trimEnd();
  if (!trimmed) {
    return OUTBOUND_FOUNDER_SIGNATURE_TEXT.trimStart();
  }
  if (trimmed.includes(SIGNATURE_MARKER)) {
    return trimmed;
  }
  return `${trimmed}${OUTBOUND_FOUNDER_SIGNATURE_TEXT}`;
}
