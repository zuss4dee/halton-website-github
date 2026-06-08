import { useCallback, useEffect, useId, useState } from "react";
import { LEAD_QUEUE_STATUS, HUMAN_REVIEW_QUEUE_STATUSES } from "@/lib/admin/leadsRepository";
import { resolveWorkspaceClientId } from "@/lib/admin/resolveWorkspaceClientId";
import {
  WORKSPACE_ATTENTION_INVALIDATE,
} from "@/lib/admin/workspaceAttentionEvents";
import { supabase } from "@/lib/supabase";

type UseWorkspaceAttentionOptions = {
  refreshKey?: number;
};

export function useWorkspaceAttention(
  clientIdParam?: string,
  options: UseWorkspaceAttentionOptions = {},
) {
  const { refreshKey = 0 } = options;
  const channelInstanceId = useId();
  const [pendingDraftCount, setPendingDraftCount] = useState(0);
  const [resolvedClientId, setResolvedClientId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCounts = useCallback(async () => {
    if (!clientIdParam?.trim() || typeof window === "undefined") {
      setPendingDraftCount(0);
      setResolvedClientId(null);
      return;
    }

    try {
      const workspaceClientId = await resolveWorkspaceClientId(clientIdParam);
      setResolvedClientId(workspaceClientId);

      if (!workspaceClientId) {
        setPendingDraftCount(0);
        return;
      }

      const { count, error } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("client_id", workspaceClientId)
        .in("queue_status", [...HUMAN_REVIEW_QUEUE_STATUSES]);

      if (error) {
        console.error("[workspace-attention] pending count:", error);
        setPendingDraftCount(0);
        return;
      }

      setPendingDraftCount(count ?? 0);
    } catch (error) {
      console.error("[workspace-attention] unexpected failure:", error);
      setPendingDraftCount(0);
    }
  }, [clientIdParam]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      await fetchCounts();
      if (!cancelled) setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchCounts, refreshKey]);

  useEffect(() => {
    if (!clientIdParam?.trim() || typeof window === "undefined") return;

    const onInvalidate = (event: Event) => {
      const detail = (event as CustomEvent<{ clientId?: string | null }>).detail;
      const target = detail?.clientId?.trim();
      const current = clientIdParam.trim();

      if (!target) {
        void fetchCounts();
        return;
      }

      void (async () => {
        const [targetId, currentId] = await Promise.all([
          resolveWorkspaceClientId(target),
          resolveWorkspaceClientId(current),
        ]);

        if (targetId && currentId && targetId === currentId) {
          void fetchCounts();
        }
      })();
    };

    window.addEventListener(WORKSPACE_ATTENTION_INVALIDATE, onInvalidate);
    return () => {
      window.removeEventListener(WORKSPACE_ATTENTION_INVALIDATE, onInvalidate);
    };
  }, [clientIdParam, fetchCounts]);

  useEffect(() => {
    if (!resolvedClientId || typeof window === "undefined") return;

    const channel = supabase
      .channel(`workspace-attention-${resolvedClientId}-${channelInstanceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: `client_id=eq.${resolvedClientId}`,
        },
        () => {
          void fetchCounts();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelInstanceId, fetchCounts, resolvedClientId]);

  const refetch = useCallback(async () => {
    await fetchCounts();
  }, [fetchCounts]);

  return {
    pendingDraftCount,
    hasPendingDrafts: pendingDraftCount > 0,
    isLoading,
    refetch,
  };
}
