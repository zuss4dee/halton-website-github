/** Address prospects reply to — must use a Resend Inbound subdomain (not Google MX root). */
export function resolveInboundReplyToAddress(): string | null {
  const explicit = Deno.env.get("INBOUND_REPLY_ADDRESS")?.trim();
  if (explicit) return explicit;

  const domain = Deno.env.get("INBOUND_REPLY_DOMAIN")?.trim();
  if (!domain) return null;

  const localPart = Deno.env.get("INBOUND_REPLY_LOCAL")?.trim() || "replies";
  return `${localPart}@${domain.replace(/^@/, "")}`;
}
