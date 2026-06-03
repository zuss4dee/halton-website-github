import { useCallback, useEffect, useState } from "react";
import { mergeAgentsForWorkspace } from "@/lib/admin/agentRosterMerge";
import { supabase } from "@/lib/supabase";

export type AgentRosterRow = {
  id: string;
  name: string | null;
  role: string | null;
  model: string | null;
  system_prompt: string | null;
  skills: unknown;
  is_active: boolean | null;
  client_id: string | null;
  created_at: string | null;
};

const AGENT_SELECT =
  "id, name, role, model, system_prompt, skills, is_active, client_id, created_at" as const;

function sortAgents(agents: AgentRosterRow[]) {
  return [...agents].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (aTime !== bTime) return aTime - bTime;
    return (a.role ?? "").localeCompare(b.role ?? "");
  });
}

export function useAgentRoster(clientId?: string) {
  const [agents, setAgents] = useState<AgentRosterRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const workspaceClientId = clientId?.trim() ?? "";

  const applyRows = useCallback(
    (rows: AgentRosterRow[]) => {
      const merged = workspaceClientId
        ? mergeAgentsForWorkspace(rows, workspaceClientId)
        : sortAgents(rows);
      setAgents(merged);
    },
    [workspaceClientId],
  );

  const fetchAgents = useCallback(async () => {
    setIsLoading(true);

    let query = supabase.from("agents").select(AGENT_SELECT).order("created_at", {
      ascending: true,
    });

    if (workspaceClientId) {
      query = query.or(`client_id.is.null,client_id.eq.${workspaceClientId}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("AGENT_ROSTER_FETCH_ERROR:", error);
      setAgents([]);
    } else {
      applyRows((data ?? []) as AgentRosterRow[]);
    }

    setIsLoading(false);
  }, [applyRows, workspaceClientId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsLoading(true);

      let query = supabase.from("agents").select(AGENT_SELECT).order("created_at", {
        ascending: true,
      });

      if (workspaceClientId) {
        query = query.or(`client_id.is.null,client_id.eq.${workspaceClientId}`);
      }

      const { data, error } = await query;

      if (cancelled) return;

      if (error) {
        console.error("AGENT_ROSTER_FETCH_ERROR:", error);
        setAgents([]);
      } else {
        applyRows((data ?? []) as AgentRosterRow[]);
      }

      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [applyRows, workspaceClientId]);

  useEffect(() => {
    const channel = supabase
      .channel(`agent-roster-live-${workspaceClientId || "global"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agents" },
        () => {
          void fetchAgents();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchAgents, workspaceClientId]);

  return { agents, isLoading, refetch: fetchAgents };
}
