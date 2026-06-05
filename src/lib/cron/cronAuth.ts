export function getCronSecret(): string | null {
  const secret =
    process.env["CRON_SECRET"]?.trim() || process.env.CRON_SECRET?.trim() || null;
  return secret || null;
}

/** Headers accepted by isValidCronRequest — use for internal cron fetches. */
export function buildCronAuthHeaders(): Record<string, string> | null {
  const secret = getCronSecret();
  if (!secret) {
    return null;
  }

  return {
    CRON_SECRET: secret,
    "x-cron-secret": secret,
    Authorization: `Bearer ${secret}`,
  };
}

export function isValidCronRequest(request: Request): boolean {
  const expectedSecret = getCronSecret();
  if (!expectedSecret) {
    console.error("CRON_SECRET environment variable is missing.");
    return false;
  }
  const cronSecretHeader = request.headers.get("CRON_SECRET");
  const xCronSecretHeader = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;

  return (
    cronSecretHeader === expectedSecret ||
    xCronSecretHeader === expectedSecret ||
    bearerToken === expectedSecret
  );
}

/** @deprecated Use isValidCronRequest */
export function verifyCronSecret(request: Request): boolean {
  return isValidCronRequest(request);
}
