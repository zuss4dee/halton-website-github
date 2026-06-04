import { isWorkspaceIndexPath } from "./paths";
import type { AuthProfile } from "./types";

export function postLoginPath(profile: AuthProfile): string {
  if (profile.role === "admin") return "/admin";
  if (profile.client_id) return `/workspace/${profile.client_id}`;
  return "/login";
}

export function clientWorkspacePath(profile: AuthProfile): string | null {
  if (profile.role !== "client" || !profile.client_id) return null;
  return `/workspace/${profile.client_id}`;
}

/** Prevent clients from using ?redirect= to reach admin or other tenants. */
export function safeRedirectAfterLogin(
  redirectTo: string | undefined,
  profile: AuthProfile,
): string {
  const fallback = postLoginPath(profile);
  if (!redirectTo?.startsWith("/")) return fallback;

  if (profile.role === "admin") {
    if (redirectTo.startsWith("/admin") || redirectTo.startsWith("/workspace")) {
      return redirectTo;
    }
    return fallback;
  }

  if (
    redirectTo.startsWith("/admin") ||
    isWorkspaceIndexPath(redirectTo)
  ) {
    return fallback;
  }

  if (redirectTo.startsWith("/workspace/")) {
    const segment = redirectTo.split("/")[2];
    if (segment && segment === profile.client_id) {
      return redirectTo;
    }
    return fallback;
  }

  return fallback;
}
