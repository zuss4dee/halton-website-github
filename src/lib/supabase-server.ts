import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { getSupabaseUrl } from "@/lib/auth/env";

/**
 * Server-only Supabase client (service role). Never import from client components.
 */
export function createSupabaseServer(): SupabaseClient {
  const supabaseUrl = getSupabaseUrl() || process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing VITE_SUPABASE_URL (or SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY for server Supabase.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: {
      transport: WebSocket,
    },
    global: {
      WebSocket,
    },
  });
}

let cachedServerClient: SupabaseClient | undefined;

/** Lazy singleton — avoids crashing SSR for public routes when the module is imported. */
export function getSupabaseServer(): SupabaseClient {
  if (!cachedServerClient) {
    cachedServerClient = createSupabaseServer();
  }
  return cachedServerClient;
}
