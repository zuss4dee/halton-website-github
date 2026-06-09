export type ClientSendingConfig = {
  company_name?: string | null;
  sending_domain?: string | null;
  primary_contact_email?: string | null;
};

function platformFromEmail(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.VITE_RESEND_FROM_EMAIL?.trim() ||
    ""
  );
}

function parseAngleAddress(value: string): { displayName: string; email: string } | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { displayName: match[1].trim(), email: match[2].trim() };
  }
  if (trimmed.includes("@")) {
    return { displayName: "", email: trimmed };
  }
  return null;
}

function formatFrom(displayName: string, email: string): string {
  return displayName ? `${displayName} <${email}>` : email;
}

/**
 * Resolves the Resend `from` address for a tenant.
 * Prefers primary_contact_email when it matches sending_domain (e.g. damilare@haltonworks.com).
 */
export function resolveClientFromEmail(client: ClientSendingConfig): string | null {
  const workspaceName = client.company_name?.trim() || "";
  const sendingDomain = client.sending_domain?.trim().replace(/^@/, "") || "";
  const primaryContact = client.primary_contact_email?.trim() || "";
  const displayName =
    process.env.OUTBOUND_FROM_NAME?.trim() || "Damilare Adeosun";
  const platformDefault = platformFromEmail();

  if (primaryContact && sendingDomain) {
    const at = primaryContact.lastIndexOf("@");
    const primaryDomain =
      at >= 0 ? primaryContact.slice(at + 1).trim().toLowerCase() : "";
    if (primaryDomain === sendingDomain.toLowerCase()) {
      return formatFrom(displayName, primaryContact);
    }
  }

  if (sendingDomain) {
    const localPart = process.env.OUTBOUND_FROM_LOCAL?.trim() || "outbound";
    const email = sendingDomain.includes("@")
      ? sendingDomain
      : `${localPart}@${sendingDomain}`;
    const name = displayName || workspaceName || sendingDomain;
    return formatFrom(name, email);
  }

  if (workspaceName && platformDefault) {
    const parsed = parseAngleAddress(platformDefault);
    if (parsed) {
      return formatFrom(displayName || workspaceName, parsed.email);
    }
    return formatFrom(workspaceName, platformDefault);
  }

  if (platformDefault) {
    return platformDefault;
  }

  return null;
}
