import type { ClientRow } from "@/lib/admin/clientsRepository";
import { supabase } from "@/lib/supabase";

export type CommandCenterMacroKpis = {
  activeWorkspaces: number;
  globalOutput: number;
  unreadSignals: number;
};

export type ClientDirectoryRow = ClientRow & {
  activeSequences: number;
  sent7d: number;
  replies7d: number;
};

export type CommandCenterPayload = {
  clients: ClientDirectoryRow[];
  macro: CommandCenterMacroKpis;
  error: string | null;
};

function emptyMacro(): CommandCenterMacroKpis {
  return { activeWorkspaces: 0, globalOutput: 0, unreadSignals: 0 };
}

export async function fetchCommandCenterData(): Promise<CommandCenterPayload> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [clientsRes, sent7dRes, replied7dRes, globalSentRes, workflowsRes, unreadRes] =
    await Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase
        .from("leads")
        .select("client_id")
        .eq("queue_status", "sent")
        .gte("sent_at", sevenDaysAgo),
      supabase
        .from("leads")
        .select("client_id")
        .eq("status", "replied")
        .gte("last_activity", sevenDaysAgo),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("queue_status", "sent"),
      supabase.from("workflows").select("client_id"),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "replied"),
    ]);

  if (clientsRes.error) {
    console.error("[command-center] clients:", clientsRes.error);
    return { clients: [], macro: emptyMacro(), error: clientsRes.error.message };
  }

  const clients = (clientsRes.data as ClientRow[]) ?? [];

  if (sent7dRes.error) console.error("[command-center] sent 7d:", sent7dRes.error);
  if (replied7dRes.error) console.error("[command-center] replied 7d:", replied7dRes.error);
  if (workflowsRes.error) console.error("[command-center] workflows:", workflowsRes.error);

  const sequencesByClient: Record<string, number> = {};
  for (const row of workflowsRes.data ?? []) {
    const id = row.client_id as string | null;
    if (!id) continue;
    sequencesByClient[id] = (sequencesByClient[id] ?? 0) + 1;
  }

  const sent7dByClient: Record<string, number> = {};
  const replies7dByClient: Record<string, number> = {};

  for (const row of sent7dRes.data ?? []) {
    const clientId = row.client_id as string | null;
    if (!clientId) continue;
    sent7dByClient[clientId] = (sent7dByClient[clientId] ?? 0) + 1;
  }

  for (const row of replied7dRes.data ?? []) {
    const clientId = row.client_id as string | null;
    if (!clientId) continue;
    replies7dByClient[clientId] = (replies7dByClient[clientId] ?? 0) + 1;
  }

  const directory: ClientDirectoryRow[] = clients.map((client) => {
    const id = client.id ?? "";
    return {
      ...client,
      activeSequences: id ? (sequencesByClient[id] ?? 0) : 0,
      sent7d: id ? (sent7dByClient[id] ?? 0) : 0,
      replies7d: id ? (replies7dByClient[id] ?? 0) : 0,
    };
  });

  const macro: CommandCenterMacroKpis = {
    activeWorkspaces: clients.length,
    globalOutput: globalSentRes.count ?? 0,
    unreadSignals: unreadRes.count ?? 0,
  };

  return { clients: directory, macro, error: null };
}
