import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  WorkflowExecutionModal,
  type WorkflowRunResult,
} from "@/components/admin/WorkflowExecutionModal";
import {
  buildSidebarPropsFromNode,
  WorkflowNodeConfigSidebar,
} from "@/components/admin/WorkflowNodeConfigSidebar";
import { WorkflowToolNode } from "@/components/admin/WorkflowToolNode";
import {
  readWorkflowNodeData,
  type WorkflowNodeData,
} from "@/lib/admin/workflowNodeConfig";
import type { WorkflowExecutorType } from "@/lib/admin/workflowsRepository";
import {
  DEFAULT_WORKFLOW_GRAPH,
  parseWorkflowGraph,
  toEnginePayload,
  WORKFLOW_EXECUTOR_TYPES,
} from "@/lib/admin/workflowsRepository";
import {
  listEmailTemplates,
  type EmailTemplateRow,
} from "@/lib/admin/emailTemplatesRepository";
import { supabase } from "@/lib/supabase";

const nodeTypes = Object.fromEntries(
  WORKFLOW_EXECUTOR_TYPES.map((type) => [type, WorkflowToolNode]),
);

const SAVE_DEBOUNCE_MS = 500;

type WorkspaceWorkflowBuilderProps = {
  clientId: string;
};

export function WorkspaceWorkflowBuilder({ clientId }: WorkspaceWorkflowBuilderProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvas clientId={clientId} />
    </ReactFlowProvider>
  );
}

function WorkflowCanvas({ clientId }: WorkspaceWorkflowBuilderProps) {
  const [nodes, setNodes] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [executionOpen, setExecutionOpen] = useState(false);
  const [executionResult, setExecutionResult] = useState<WorkflowRunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateRow[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const suppressSaveRef = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientIdRef = useRef(clientId);

  clientIdRef.current = clientId;

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  const persistWorkflow = useCallback(async () => {
    const activeClientId = clientIdRef.current;
    if (!activeClientId || suppressSaveRef.current) return;

    const payload = {
      client_id: activeClientId,
      graph_json: {
        nodes: nodesRef.current,
        edges: edgesRef.current,
      },
      is_active: true,
    };

    const { error } = await supabase
      .from("workflows")
      .upsert(payload, { onConflict: "client_id" });

    if (error) {
      console.error("WORKFLOW_SAVE_ERROR:", error);
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (suppressSaveRef.current || !isHydrated) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void persistWorkflow();
    }, SAVE_DEBOUNCE_MS);
  }, [isHydrated, persistWorkflow]);

  useEffect(() => {
    let cancelled = false;

    const loadWorkflow = async () => {
      setIsHydrated(false);
      setLoadError(null);
      suppressSaveRef.current = true;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      const { data, error } = await supabase
        .from("workflows")
        .select("graph_json")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      let nextNodes = DEFAULT_WORKFLOW_GRAPH.nodes;
      let nextEdges = DEFAULT_WORKFLOW_GRAPH.edges;

      if (error) {
        console.error("WORKFLOW_LOAD_ERROR:", error);
        setLoadError(error.message);
      } else {
        const graph = parseWorkflowGraph(data?.graph_json);
        if (graph) {
          nextNodes = graph.nodes;
          nextEdges = graph.edges;
        }
      }

      nodesRef.current = nextNodes;
      edgesRef.current = nextEdges;
      setNodes(nextNodes);
      setEdges(nextEdges);
      setSelectedNodeId(null);

      suppressSaveRef.current = true;
      setIsHydrated(true);

      requestAnimationFrame(() => {
        suppressSaveRef.current = false;
      });
    };

    void loadWorkflow();

    return () => {
      cancelled = true;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [clientId, setEdges, setNodes]);

  useEffect(() => {
    let cancelled = false;

    const loadTemplates = async () => {
      setTemplatesLoading(true);

      const result = await listEmailTemplates(clientId);

      if (cancelled) return;

      if ("error" in result) {
        console.error("EMAIL_TEMPLATES_LOAD_ERROR:", result.error);
        setEmailTemplates([]);
      } else {
        setEmailTemplates(result.templates);
      }

      setTemplatesLoading(false);
    };

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((current) => {
        const next = applyNodeChanges(changes, current);
        nodesRef.current = next;
        return next;
      });
      scheduleSave();
    },
    [scheduleSave, setNodes],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((current) => {
        const next = applyEdgeChanges(changes, current);
        edgesRef.current = next;
        return next;
      });
      scheduleSave();
    },
    [scheduleSave, setEdges],
  );

  const onSelectionChange = useCallback(({ nodes: selectedNodes }: OnSelectionChangeParams) => {
    if (selectedNodes.length === 1) {
      setSelectedNodeId(selectedNodes[0].id);
      return;
    }
    setSelectedNodeId(null);
  }, []);

  const patchNode = useCallback(
    (
      nodeId: string,
      patch: { type?: WorkflowExecutorType; data?: WorkflowNodeData },
    ) => {
      setNodes((current) => {
        const next = current.map((node) => {
          if (node.id !== nodeId) return node;

          const nextData = patch.data
            ? patch.type
              ? patch.data
              : { ...readWorkflowNodeData(node.data), ...patch.data }
            : node.data;

          return {
            ...node,
            ...(patch.type ? { type: patch.type } : {}),
            ...(patch.data ? { data: nextData } : {}),
          };
        });
        nodesRef.current = next;
        return next;
      });
      scheduleSave();
    },
    [scheduleSave, setNodes],
  );

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return;

    setNodes((current) => {
      const next = current.filter((node) => node.id !== selectedNodeId);
      nodesRef.current = next;
      return next;
    });
    setEdges((current) => {
      const next = current.filter(
        (edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId,
      );
      edgesRef.current = next;
      return next;
    });
    setSelectedNodeId(null);
    scheduleSave();
  }, [scheduleSave, selectedNodeId, setEdges, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((current) => {
        const next = addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: "#9ca3af" },
          },
          current,
        );
        edgesRef.current = next;
        return next;
      });
      scheduleSave();
    },
    [scheduleSave, setEdges],
  );

  const addAutomationStep = useCallback(() => {
    const stepIndex = nodesRef.current.length;
    const newNode: Node = {
      id: `llm-${crypto.randomUUID()}`,
      type: "deepseek_llm",
      position: {
        x: 100 + (stepIndex % 4) * 48,
        y: 100 + Math.floor(stepIndex / 4) * 72,
      },
      data: {
        label: "[ DEEPSEEK ] - New Step",
        prompt: "Write a short outreach line using prior step data via {{steps.NODE_ID.field}}.",
      },
    };

    setNodes((current) => {
      const next = [...current, newNode];
      nodesRef.current = next;
      return next;
    });
    scheduleSave();
  }, [scheduleSave, setNodes]);

  const runAutomation = useCallback(async () => {
    const testEmail = window.prompt(
      "Safemode destination email (Resend will send here):",
      "",
    );

    if (testEmail === null) return;

    const trimmedEmail = testEmail.trim();
    if (!trimmedEmail) {
      window.alert("testEmail is required for safemode execution.");
      return;
    }

    setIsRunning(true);
    setRunError(null);
    setExecutionResult(null);
    setNodes((current) => {
      const next = current.map((node) => ({
        ...node,
        data: {
          ...(readWorkflowNodeData(node.data) as Record<string, unknown>),
          runtimeStatus: "idle",
        },
      }));
      nodesRef.current = next;
      return next;
    });

    const { nodes: engineNodes, edges: engineEdges } = toEnginePayload(
      nodesRef.current,
      edgesRef.current,
    );

    try {
      const { data, error } = await supabase.functions.invoke("run-outbound", {
        body: {
          clientId: clientIdRef.current,
          nodes: engineNodes,
          edges: engineEdges,
          testEmail: trimmedEmail,
        },
      });

      const payload = data as WorkflowRunResult | null;

      if (payload?.error) {
        throw new Error(payload.error);
      }

      if (error) {
        throw error;
      }

      setExecutionResult(payload ?? { success: true });
      setExecutionOpen(true);
    } catch (err: unknown) {
      console.error("RUN_AUTOMATION_ERROR:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      setRunError(message);
      setExecutionOpen(true);
    } finally {
      setIsRunning(false);
    }
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`workflow-step-events-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_logs",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const row = payload.new as {
            event_type?: string;
            payload?: { nodeId?: string };
          };
          const eventType = row.event_type;
          const nodeId = row.payload?.nodeId;
          if (!nodeId) return;
          if (eventType !== "STEP_START" && eventType !== "STEP_COMPLETE") return;

          const runtimeStatus = eventType === "STEP_START" ? "running" : "complete";

          setNodes((current) => {
            let changed = false;
            const next = current.map((node) => {
              if (node.id !== nodeId) return node;
              changed = true;
              return {
                ...node,
                data: {
                  ...(readWorkflowNodeData(node.data) as Record<string, unknown>),
                  runtimeStatus,
                },
              };
            });
            if (!changed) return current;
            nodesRef.current = next;
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientId, setNodes]);

  const selectedNode = selectedNodeId
    ? nodes.find((node) => node.id === selectedNodeId)
    : undefined;

  const sidebarProps = selectedNode ? buildSidebarPropsFromNode(selectedNode) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-4 flex w-full shrink-0 items-center justify-between border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Campaign Rules</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure automated outbound sequences and logic gates.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={addAutomationStep}
            disabled={!isHydrated || isRunning}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Add Automation Step
          </button>
          <button
            type="button"
            onClick={() => void runAutomation()}
            disabled={!isHydrated || isRunning}
            className="flex items-center justify-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <span aria-hidden>▶</span>
            )}
            Run Automation
          </button>
        </div>
      </div>

      {(loadError || !isHydrated || isRunning) && (
        <div className="mb-3 shrink-0 rounded-md border border-gray-200 bg-white px-4 py-2 text-xs text-gray-500">
          {!isHydrated ? "Loading workflow…" : null}
          {isHydrated && isRunning ? "Running automation…" : null}
          {loadError ? (
            <span className="text-amber-700">
              Could not load saved workflow — using defaults. {loadError}
            </span>
          ) : null}
        </div>
      )}

      <div className="flex min-h-0 flex-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50/50 shadow-inner">
        <div className="relative h-full min-h-0 min-w-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          nodesConnectable
          edgesReconnectable
          elementsSelectable
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          proOptions={{ hideAttribution: true }}
          colorMode="light"
          className={`!h-full !w-full bg-gray-50/50 ${isHydrated ? undefined : "opacity-0"}`}
        >
          <Background color="#cbd5e1" gap={16} />
          <Controls className="!rounded-md !border-gray-200 !bg-white !shadow-sm [&_button]:!border-gray-200 [&_button]:!bg-white [&_button]:!fill-gray-600 [&_button:hover]:!bg-gray-50" />
        </ReactFlow>
        {!isHydrated ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gray-50/90 text-sm text-gray-500">
            Loading workflow…
          </div>
        ) : null}
        {isRunning ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/70">
            <Loader2 className="h-8 w-8 animate-spin text-gray-700" aria-hidden />
            <p className="text-sm text-gray-600">Running automation…</p>
          </div>
        ) : null}
        </div>

        {sidebarProps ? (
          <WorkflowNodeConfigSidebar
            key={sidebarProps.nodeId}
            nodeId={sidebarProps.nodeId}
            nodeType={sidebarProps.nodeType}
            nodeData={sidebarProps.nodeData}
            emailTemplates={emailTemplates}
            templatesLoading={templatesLoading}
            onPatch={(patch) => patchNode(sidebarProps.nodeId, patch)}
            onDelete={deleteSelectedNode}
          />
        ) : null}
      </div>

      <WorkflowExecutionModal
        open={executionOpen}
        onOpenChange={setExecutionOpen}
        result={executionResult}
        error={runError}
      />
    </div>
  );
}
