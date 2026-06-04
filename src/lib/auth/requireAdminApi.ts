import { createServerAuthClient } from "./serverClient";
import { fetchAuthProfile } from "./profile";
import type { AuthSession } from "./types";

export async function requireAdminApiSession(
  request: Request,
): Promise<{ session: AuthSession; unauthorizedResponse?: never } | { session?: never; unauthorizedResponse: Response }> {
  const { supabase } = createServerAuthClient(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      unauthorizedResponse: Response.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  const profile = await fetchAuthProfile(supabase, user.id);
  if (!profile || profile.role !== "admin") {
    return {
      unauthorizedResponse: Response.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  return {
    session: {
      userId: user.id,
      email: user.email ?? null,
      profile,
    },
  };
}
