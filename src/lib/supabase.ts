import { createBrowserClient } from "@supabase/ssr";
import WebSocket from "isomorphic-ws";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/auth/env";

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("CRITICAL: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    transport: WebSocket,
  },
  global: {
    WebSocket,
  },
});
