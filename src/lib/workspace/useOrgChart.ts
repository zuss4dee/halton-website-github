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

const AGENT_ORG_SELECT_LEGACY =
  "id, name, role, model, is_active, created_at" as const;

type UseOrgChartOptions = {
  enabled?: boolean;
};

async function fetchAgentsForOrgChart(workspaceClientId: string) {
  const primary = await supabase
    .from("agents")
    .select(AGENT_ORG_SELECT)
    .eq("client_id", workspaceClientId)
    .order("created_at", { ascending: true });

  if (!primary.error) {
    return primary;
  }

  const message = primary.error.message.toLowerCase();
  const missingHierarchyColumn =
    primary.error.code === "42703" || message.includes("reports_to_agent_id");

  if (!missingHierarchyColumn) {
    return primary;
  }

  console.warn("[org-chart] reports_to_agent_id missing — using legacy agent select");
  return supabase
    .from("agents")
    .select(AGENT_ORG_SELECT_LEGACY)
    .eq("client_id", workspaceClientId)
    .order("created_at", { ascending: true });
}

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

export function useOrgChart(clientIdParam: string, options: UseOrgChartOptions = {}) {
  const enabled = options.enabled ?? true;
  const [tree, setTree] = useState<AgentOrgNode[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [resolvedClientId, setResolvedClientId] = useState<string | null>(null);

  const fetchOrgTree = useCallback(async () => {
    if (!enabled || typeof window === "undefined") return;

    setIsLoading(true);
    setError(null);

    try {
      const workspaceClientId = await resolveWorkspaceClientId(clientIdParam);
      setResolvedClientId(workspaceClientId);

      if (!workspaceClientId) {
        setTree([]);
        setError("Workspace not found.");
        setIsLoading(false);
        return;
      }

      const { data, error: fetchError } = await fetchAgentsForOrgChart(workspaceClientId);

      if (fetchError) {
        console.error("[org-chart] agents fetch:", fetchError);
        setTree([]);
        setError(fetchError.message);
        setIsLoading(false);
        return;
      }

      setTree(buildAgentOrgTree((data ?? []) as AgentOrgRow[]));
      setIsLoading(false);
    } catch (fetchError) {
      console.error("[org-chart] unexpected fetch failure:", fetchError);
      setTree([]);
      setError(
        fetchError instanceof Error ? fetchError.message : "Unable to load agent org chart.",
      );
      setIsLoading(false);
    }
  }, [clientIdParam, enabled]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setError(null);
      setTree([]);
      setResolvedClientId(null);
      return;
    }

    void fetchOrgTree();
  }, [enabled, fetchOrgTree]);

  useEffect(() => {
    if (!enabled || !resolvedClientId || typeof window === "undefined") return;

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
  }, [enabled, fetchOrgTree, resolvedClientId]);

  return { tree, isLoading, error, refetch: fetchOrgTree };
}
