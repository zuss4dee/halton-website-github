import { redirect } from "@tanstack/react-router";
import { routeParamMatchesClientId } from "./clientAccess";
import { fetchAuthProfile } from "./profile";
import {
  clientWorkspacePath,
  postLoginPath,
} from "./redirects";
import { supabase } from "@/lib/supabase";
import type { AuthSession } from "./types";
export async function getClientAuthSession(): Promise<AuthSession | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const profile = await fetchAuthProfile(supabase, user.id);
  if (!profile) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    profile,
  };
}

export async function requireAuthSession(redirectTo?: string): Promise<AuthSession> {
  const session = await getClientAuthSession();
  if (!session) {
    throw redirect({
      to: "/login",
      search: redirectTo ? { redirect: redirectTo } : undefined,
    });
  }
  return session;
}

export async function requireAdminSession(): Promise<AuthSession> {
  const session = await requireAuthSession();
  if (session.profile.role !== "admin") {
    const target = clientWorkspacePath(session.profile);
    throw redirect({ to: target ?? "/login" });
  }
  return session;
}

export async function guardWorkspaceIndex(): Promise<void> {
  const session = await getClientAuthSession();
  if (session?.profile.role === "client" && session.profile.client_id) {
    throw redirect({
      to: "/workspace/$clientId",
      params: { clientId: session.profile.client_id },
    });
  }
  throw redirect({ to: "/login" });
}

export async function guardWorkspaceClientRoute(clientId: string): Promise<void> {
  const session = await requireAuthSession(`/workspace/${clientId}`);
  if (session.profile.role === "client" && session.profile.client_id) {
    const allowed = await routeParamMatchesClientId(
      supabase,
      clientId,
      session.profile.client_id,
    );
    if (!allowed) {
      throw redirect({
        to: "/workspace/$clientId",
        params: { clientId: session.profile.client_id },
      });
    }
  }
}

export async function guardLoginRoute(): Promise<void> {
  const session = await getClientAuthSession();
  if (session) {
    throw redirect({ to: postLoginPath(session.profile) });
  }
}
