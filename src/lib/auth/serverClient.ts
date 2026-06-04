import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import type { SerializeOptions } from "cookie";
import type { SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

export type PendingAuthCookie = {
  name: string;
  value: string;
  options: SerializeOptions;
};

export type ServerAuthClient = {
  supabase: SupabaseClient;
  getPendingCookies: () => PendingAuthCookie[];
};

export function createServerAuthClient(request: Request): ServerAuthClient {
  const pending: PendingAuthCookie[] = [];
  const cookieHeader = request.headers.get("cookie") ?? "";

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return parseCookieHeader(cookieHeader).map((cookie) => ({
          name: cookie.name,
          value: cookie.value ?? "",
        }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          pending.push({ name, value, options: options ?? {} });
        }
      },
    },
    realtime: {
      transport: WebSocket,
    },
    global: {
      WebSocket,
    },
  });

  return {
    supabase,
    getPendingCookies: () => pending,
  };
}

export function applyPendingAuthCookies(
  response: Response,
  cookies: PendingAuthCookie[],
): Response {
  if (cookies.length === 0) return response;

  const headers = new Headers(response.headers);
  for (const cookie of cookies) {
    headers.append(
      "Set-Cookie",
      serializeCookieHeader(cookie.name, cookie.value, cookie.options),
    );
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
