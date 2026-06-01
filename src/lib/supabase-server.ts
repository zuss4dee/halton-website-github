import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client (service role). Never import from client components.
 */
function createSupabaseServer() {
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    import.meta.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing VITE_SUPABASE_URL (or SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY for server Supabase.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const supabase = createSupabaseServer();
