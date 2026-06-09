export type OutboundFromClient = {
  company_name?: string | null;
  sending_domain?: string | null;
  primary_contact_email?: string | null;
};

function readDenoEnv(...names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  return "";
}

function formatFrom(displayName: string, email: string): string {
  return displayName ? `${displayName} <${email}>` : email;
}

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, "");
}

function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).trim().toLowerCase() || null;
}

/**
 * Resolves Resend `from` for a workspace.
 * Prefers primary_contact_email when it matches sending_domain (e.g. damilare@haltonworks.com).
 */
export function resolveOutboundFromEmail(client: OutboundFromClient): string | null {
  const workspaceName = client.company_name?.trim() || "";
  const sendingDomain = normalizeDomain(client.sending_domain?.trim() || "");
  const primaryContact = client.primary_contact_email?.trim() || "";
  const displayName =
    readDenoEnv("OUTBOUND_FROM_NAME") || "Damilare Adeosun";
  const platformDefault =
    readDenoEnv("RESEND_FROM_EMAIL", "VITE_RESEND_FROM_EMAIL");

  if (primaryContact && sendingDomain) {
    const primaryDomain = emailDomain(primaryContact);
    if (primaryDomain === sendingDomain) {
      return formatFrom(displayName, primaryContact);
    }
  }

  if (sendingDomain) {
    const localPart = readDenoEnv("OUTBOUND_FROM_LOCAL") || "outbound";
    return formatFrom(displayName, `${localPart}@${sendingDomain}`);
  }

  if (platformDefault) {
    return platformDefault.includes("<") ? platformDefault : formatFrom(displayName, platformDefault);
  }

  if (workspaceName && primaryContact) {
    return formatFrom(workspaceName, primaryContact);
  }

  return null;
}
