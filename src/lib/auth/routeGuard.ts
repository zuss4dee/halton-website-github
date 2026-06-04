import { redirect } from "@tanstack/react-router";
import { routeParamMatchesClientId } from "./clientAccess";
import { fetchAuthProfile } from "./profile";
import { redirectToWorkspaceClient } from "./workspaceRedirect";
import { supabase } from "@/lib/supabase";
import type { AuthSession } from "./types";

/** Route guards use the browser Supabase client; defer checks until hydration. */
function isBrowserAuthRuntime(): boolean {
  return typeof window !== "undefined";
}

export async function getClientAuthSession(): Promise<AuthSession | null> {
  if (!isBrowserAuthRuntime()) {
    return null;
  }

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
  if (!isBrowserAuthRuntime()) {
    throw new Error("requireAuthSession must run in the browser");
  }

  const session = await getClientAuthSession();
  if (!session) {
    throw redirect({
      to: "/login",
      search: redirectTo ? { redirect: redirectTo } : undefined,
    });
  }
  return session;
}

export async function requireAdminSession(): Promise<void> {
  if (!isBrowserAuthRuntime()) {
    return;
  }

  const session = await requireAuthSession();
  if (session.profile.role !== "admin") {
    if (session.profile.client_id) {
      throw redirectToWorkspaceClient(session.profile.client_id);
    }
    throw redirect({ to: "/login" });
  }
}

export async function guardWorkspaceIndex(): Promise<void> {
  if (!isBrowserAuthRuntime()) {
    return;
  }

  const session = await getClientAuthSession();
  if (session?.profile.role === "client" && session.profile.client_id) {
    throw redirectToWorkspaceClient(session.profile.client_id);
  }
  throw redirect({ to: "/login" });
}

export async function guardWorkspaceClientRoute(clientId: string): Promise<void> {
  if (!isBrowserAuthRuntime()) {
    return;
  }

  const session = await requireAuthSession(`/workspace/${clientId}`);

  // Admins may open any client workspace ("View As Client").
  if (session.profile.role === "admin") {
    return;
  }

  if (session.profile.role === "client" && session.profile.client_id) {
    const allowed = await routeParamMatchesClientId(
      supabase,
      clientId,
      session.profile.client_id,
    );
    if (!allowed) {
      throw redirectToWorkspaceClient(session.profile.client_id);
    }
  }
}

export async function guardLoginRoute(): Promise<void> {
  if (!isBrowserAuthRuntime()) {
    return;
  }

  const session = await getClientAuthSession();
  if (!session) return;

  if (session.profile.role === "admin") {
    throw redirect({ to: "/admin" });
  }
  if (session.profile.client_id) {
    throw redirectToWorkspaceClient(session.profile.client_id);
  }
  throw redirect({ to: "/login" });
}
