import { routeParamMatchesClientId } from "./clientAccess";
import { fetchAuthProfile } from "./profile";
import {
  clientWorkspacePath,
  postLoginPath,
} from "./redirects";
import { serializeCookieHeader } from "@supabase/ssr";
import {
  applyPendingAuthCookies,
  createServerAuthClient,
  type PendingAuthCookie,
} from "./serverClient";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthSession } from "./types";
import {
  isAuthExemptPath,
  isProtectedPath,
  isWorkspaceIndexPath,
  workspaceClientIdFromPath,
} from "./paths";

export type AuthGuardResult =
  | { kind: "continue"; pendingCookies: PendingAuthCookie[] }
  | { kind: "redirect"; response: Response; pendingCookies: PendingAuthCookie[] };

function redirectResponse(
  location: string,
  pendingCookies: PendingAuthCookie[],
): AuthGuardResult {
  const headers = new Headers({ Location: location });
  for (const cookie of pendingCookies) {
    headers.append(
      "Set-Cookie",
      serializeCookieHeader(cookie.name, cookie.value, cookie.options),
    );
  }

  return {
    kind: "redirect",
    response: new Response(null, { status: 302, headers }),
    pendingCookies,
  };
}

async function resolveSession(request: Request): Promise<{
  session: AuthSession | null;
  pendingCookies: PendingAuthCookie[];
  supabase: SupabaseClient;
}> {
  const { supabase, getPendingCookies } = createServerAuthClient(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const pendingCookies = getPendingCookies();

  if (error || !user) {
    return { session: null, pendingCookies, supabase };
  }

  const profile = await fetchAuthProfile(supabase, user.id);
  if (!profile) {
    return { session: null, pendingCookies, supabase };
  }

  return {
    session: {
      userId: user.id,
      email: user.email ?? null,
      profile,
    },
    pendingCookies,
    supabase,
  };
}

async function guardRedirect(
  pathname: string,
  session: AuthSession | null,
  pendingCookies: PendingAuthCookie[],
  supabase: SupabaseClient,
): Promise<AuthGuardResult | null> {
  const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}`;

  if (pathname === "/login") {
    if (!session) return { kind: "continue", pendingCookies };
    return redirectResponse(postLoginPath(session.profile), pendingCookies);
  }

  if (!isProtectedPath(pathname)) {
    return { kind: "continue", pendingCookies };
  }

  if (!session) {
    return redirectResponse(loginUrl, pendingCookies);
  }

  const { profile } = session;

  if (pathname.startsWith("/admin")) {
    if (profile.role !== "admin") {
      const target = clientWorkspacePath(profile);
      if (target) return redirectResponse(target, pendingCookies);
      return redirectResponse("/login", pendingCookies);
    }
    return { kind: "continue", pendingCookies };
  }

  if (isWorkspaceIndexPath(pathname)) {
    if (profile.role === "client") {
      const target = clientWorkspacePath(profile);
      if (target) return redirectResponse(target, pendingCookies);
    }
    return redirectResponse("/login", pendingCookies);
  }

  if (pathname.startsWith("/workspace/")) {
    const routeClientId = workspaceClientIdFromPath(pathname);
    if (profile.role === "client") {
      if (!profile.client_id) {
        return redirectResponse("/login", pendingCookies);
      }
      if (routeClientId) {
        const allowed = await routeParamMatchesClientId(
          supabase,
          routeClientId,
          profile.client_id,
        );
        if (!allowed) {
          return redirectResponse(
            `/workspace/${profile.client_id}`,
            pendingCookies,
          );
        }
      }
    }
    return { kind: "continue", pendingCookies };
  }

  return { kind: "continue", pendingCookies };
}

export async function handleAuthRequest(request: Request): Promise<AuthGuardResult> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (isAuthExemptPath(pathname)) {
    return { kind: "continue", pendingCookies: [] };
  }

  const needsSession =
    isProtectedPath(pathname) || pathname === "/login";

  if (!needsSession) {
    return { kind: "continue", pendingCookies: [] };
  }

  const { session, pendingCookies, supabase } = await resolveSession(request);
  const decision = await guardRedirect(pathname, session, pendingCookies, supabase);

  return decision ?? { kind: "continue", pendingCookies };
}

export function finalizeAuthResponse(
  response: Response,
  guard: AuthGuardResult,
): Response {
  if (guard.kind === "redirect") {
    return guard.response;
  }
  return applyPendingAuthCookies(response, guard.pendingCookies);
}
