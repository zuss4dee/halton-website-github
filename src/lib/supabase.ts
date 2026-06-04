import { createBrowserClient, type SupabaseClient } from "@supabase/ssr";
import WebSocket from "isomorphic-ws";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/auth/env";

function createSupabaseBrowserClient(): SupabaseClient {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
      transport: WebSocket,
    },
    global: {
      WebSocket,
    },
  });
}

let browserClient: SupabaseClient | undefined;

/** Browser Supabase client — safe to import during SSR; only instantiates in the browser. */
export const supabase: SupabaseClient =
  typeof window === "undefined"
    ? (new Proxy({} as SupabaseClient, {
        get() {
          throw new Error("supabase browser client is not available during SSR.");
        },
      }) as SupabaseClient)
    : (() => {
        if (!browserClient) {
          browserClient = createSupabaseBrowserClient();
        }
        return browserClient;
      })();
