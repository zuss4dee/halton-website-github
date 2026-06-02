import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Panel,
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
            style: { stroke: "#4b5563" },
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
    <div className="flex h-[800px] w-full flex-col bg-black font-mono">
      <div className="border-b border-gray-800 p-4">
        <Link
          to="/admin/client/$id"
          params={{ id: clientId }}
          className="mb-2 inline-block text-[10px] tracking-[0.14em] uppercase text-gray-500 transition-colors hover:text-gray-300"
        >
          &lt; COMMAND_DASHBOARD
        </Link>
        <h2 className="text-xs text-gray-300">[ SOP_BUILDER ] - VISUAL LOGIC ENGINE</h2>
        <p className="mt-1 text-[10px] tracking-[0.12em] uppercase text-gray-500">
          CLIENT::{clientId}
          {isHydrated ? " // AUTO_SAVE_ON" : " // LOADING..."}
          {isRunning ? " // EXECUTING_DAG..." : ""}
        </p>
        {loadError ? (
          <p className="mt-2 text-[10px] uppercase text-amber-500">
            LOAD_FALLBACK // {loadError}
          </p>
        ) : null}
      </div>
      <div className="flex min-h-0 w-full flex-1">
        <div className="relative min-w-0 flex-1">
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
          colorMode="dark"
          className={isHydrated ? undefined : "opacity-0"}
        >
          <Background color="#333" gap={16} />
          <Controls className="!border-gray-700 !bg-black [&_button]:!border-gray-700 [&_button]:!bg-black [&_button]:!fill-gray-300" />
          <Panel position="top-right" className="!m-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void runAutomation()}
              disabled={!isHydrated || isRunning}
              className="flex items-center justify-center gap-2 border border-violet-700 bg-violet-950/60 px-4 py-2 text-[10px] tracking-[0.12em] uppercase text-violet-200 transition-colors hover:border-violet-500 hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <span aria-hidden>▶</span>
              )}
              Run Automation
            </button>
            <button
              type="button"
              onClick={addAutomationStep}
              disabled={!isHydrated || isRunning}
              className="border border-emerald-800 bg-gray-900 px-3 py-2 text-[10px] tracking-[0.12em] uppercase text-emerald-400 transition-colors hover:border-emerald-600 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Add Automation Step
            </button>
          </Panel>
        </ReactFlow>
        {!isHydrated ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black text-[11px] uppercase tracking-[0.14em] text-gray-500">
            [ HYDRATING_WORKFLOW_GRAPH... ]
          </div>
        ) : null}
        {isRunning ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" aria-hidden />
            <p className="text-[11px] tracking-[0.14em] text-violet-300 uppercase">
              [ EXECUTING_DAG... ]
            </p>
          </div>
        ) : null}
        </div>

        {sidebarProps ? (
          <WorkflowNodeConfigSidebar
            key={sidebarProps.nodeId}
            nodeId={sidebarProps.nodeId}
            nodeType={sidebarProps.nodeType}
            nodeData={sidebarProps.nodeData}
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
