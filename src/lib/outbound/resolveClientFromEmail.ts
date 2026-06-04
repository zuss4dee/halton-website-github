export type ClientSendingConfig = {
  company_name?: string | null;
  sending_domain?: string | null;
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
 * Uses clients.sending_domain when set; otherwise workspace name + platform env address.
 */
export function resolveClientFromEmail(client: ClientSendingConfig): string | null {
  const workspaceName = client.company_name?.trim() || "";
  const sendingDomain = client.sending_domain?.trim() || "";
  const platformDefault = platformFromEmail();

  if (sendingDomain) {
    const email = sendingDomain.includes("@")
      ? sendingDomain
      : `outbound@${sendingDomain.replace(/^@/, "")}`;
    const displayName = workspaceName || sendingDomain;
    return formatFrom(displayName, email);
  }

  if (workspaceName && platformDefault) {
    const parsed = parseAngleAddress(platformDefault);
    if (parsed) {
      return formatFrom(workspaceName, parsed.email);
    }
    return formatFrom(workspaceName, platformDefault);
  }

  if (platformDefault) {
    return platformDefault;
  }

  return null;
}
