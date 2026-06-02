import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type AgentRosterRow = {
  id: string;
  name: string | null;
  role: string | null;
  model: string | null;
  system_prompt: string | null;
  created_at: string | null;
};

const AGENT_SELECT =
  "id, name, role, model, system_prompt, created_at" as const;

function sortAgents(agents: AgentRosterRow[]) {
  return [...agents].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (aTime !== bTime) return aTime - bTime;
    return (a.role ?? "").localeCompare(b.role ?? "");
  });
}

export function useAgentRoster() {
  const [agents, setAgents] = useState<AgentRosterRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchAgents = async () => {
      setIsLoading(true);

      const { data, error } = await supabase
        .from("agents")
        .select(AGENT_SELECT)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error("AGENT_ROSTER_FETCH_ERROR:", error);
        setAgents([]);
      } else {
        setAgents(sortAgents((data ?? []) as AgentRosterRow[]));
      }

      setIsLoading(false);
    };

    void fetchAgents();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("agent-roster-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agents" },
        (payload) => {
          const row = payload.new as AgentRosterRow;
          if (!row?.id) return;

          setAgents((current) => {
            if (current.some((agent) => agent.id === row.id)) return current;
            return sortAgents([...current, row]);
          });
          setIsLoading(false);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "agents" },
        (payload) => {
          const row = payload.old as { id?: string };
          if (!row?.id) return;

          setAgents((current) => current.filter((agent) => agent.id !== row.id));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return { agents, isLoading };
}
