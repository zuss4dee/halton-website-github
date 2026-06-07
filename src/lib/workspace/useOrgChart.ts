import { useCallback, useEffect, useState } from "react";
import {
  buildAgentOrgTree,
  type AgentOrgNode,
  type AgentOrgRow,
} from "@/lib/workspace/buildAgentOrgTree";
import { supabase } from "@/lib/supabase";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const AGENT_ORG_SELECT =
  "id, name, role, model, reports_to_agent_id, is_active, created_at" as const;

async function resolveWorkspaceClientId(clientIdParam: string): Promise<string | null> {
  const trimmed = clientIdParam.trim();
  if (!trimmed) return null;

  const isUuid = UUID_PATTERN.test(trimmed);
  const query = supabase.from("clients").select("id");

  const { data, error } = isUuid
    ? await query.eq("id", trimmed).maybeSingle()
    : await query.eq("slug", trimmed).maybeSingle();

  if (error) {
    console.error("[org-chart] client lookup:", error);
    return null;
  }

  return (data?.id as string | undefined) ?? null;
}

export function useOrgChart(clientIdParam: string) {
  const [tree, setTree] = useState<AgentOrgNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedClientId, setResolvedClientId] = useState<string | null>(null);

  const fetchOrgTree = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const workspaceClientId = await resolveWorkspaceClientId(clientIdParam);
    setResolvedClientId(workspaceClientId);

    if (!workspaceClientId) {
      setTree([]);
      setError("Workspace not found.");
      setIsLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("agents")
      .select(AGENT_ORG_SELECT)
      .eq("client_id", workspaceClientId)
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("[org-chart] agents fetch:", fetchError);
      setTree([]);
      setError(fetchError.message);
      setIsLoading(false);
      return;
    }

    setTree(buildAgentOrgTree((data ?? []) as AgentOrgRow[]));
    setIsLoading(false);
  }, [clientIdParam]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      setError(null);

      const workspaceClientId = await resolveWorkspaceClientId(clientIdParam);
      if (cancelled) return;

      setResolvedClientId(workspaceClientId);

      if (!workspaceClientId) {
        setTree([]);
        setError("Workspace not found.");
        setIsLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("agents")
        .select(AGENT_ORG_SELECT)
        .eq("client_id", workspaceClientId)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (fetchError) {
        console.error("[org-chart] agents fetch:", fetchError);
        setTree([]);
        setError(fetchError.message);
      } else {
        setTree(buildAgentOrgTree((data ?? []) as AgentOrgRow[]));
      }

      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [clientIdParam]);

  useEffect(() => {
    if (!resolvedClientId) return;

    const channel = supabase
      .channel(`workspace-org-chart-${resolvedClientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agents",
          filter: `client_id=eq.${resolvedClientId}`,
        },
        () => {
          void fetchOrgTree();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchOrgTree, resolvedClientId]);

  return { tree, isLoading, error, refetch: fetchOrgTree };
}
