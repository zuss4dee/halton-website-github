export function isValidCronRequest(request: Request): boolean {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    console.error("CRON_SECRET environment variable is missing.");
    return false;
  }
  const cronSecretHeader = request.headers.get("CRON_SECRET");
  const xCronSecretHeader = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

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
