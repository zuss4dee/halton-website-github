import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { sortAgentLogs, isOperationalPipelineLog, type AgentLogRow } from "@/lib/admin/agentTelemetry";
import type { AgentRosterRow } from "@/lib/admin/useAgentRoster";
import {
  buildReplyContext,
  buildReplyPrefix,
  shouldOfferQuickReply,
  type TerminalReplyContext,
} from "@/lib/admin/terminalReply";
import { ThinkingIndicator, ThoughtLogBlock } from "@/components/admin/ThoughtLogBlock";
import { dispatchAgentActivity, dispatchAgentMissionState } from "@/lib/admin/agentActivity";
import { resolveAgentForWorkspace, type ResolvedAgentRow } from "@/lib/admin/agentConfig";
import { resolveActivityRolesFromLog } from "@/lib/admin/resolveAgentActivityRole";
import { supabase } from "@/lib/supabase";

function formatLogTimestamp(createdAt?: string): string {
  if (!createdAt) return "[SYS_TIME]";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(createdAt));
  } catch {
    return "[SYS_TIME]";
  }
}

function eventBadgeClass(eventType: string): string {
  switch (eventType) {
    case "SPAWN":
      return "bg-white text-black px-1";
    case "THOUGHT":
      return "text-blue-400";
    case "TOOL_CALL":
      return "text-yellow-400";
    case "TOOL_RESULT":
      return "text-green-400";
    default:
      return "text-gray-400";
  }
}

function JsonPre({ value }: { value: unknown }) {
  const content = typeof value === "string" ? value : JSON.stringify(value, null, 2);

  return <pre className="mt-1 overflow-x-auto bg-gray-900/50 p-2 text-[10px]">{content}</pre>;
}

function resolveAgentLabel(agentId: string | undefined, agents: AgentRosterRow[]): string {
  if (!agentId) return "SYSTEM";

  const match = agents.find((agent) => agent.id === agentId);
  if (match?.role) return match.role;
  if (match?.name) return match.name.toUpperCase();
  return "AGENT";
}

function emitAgentActivityForLog(log: AgentLogRow, agents: AgentRosterRow[]) {
  const roles = resolveActivityRolesFromLog(log, agents);
  for (const role of roles) {
    dispatchAgentActivity(role);
  }
}

function TelemetryLogPayload({
  log,
  isLatestThought,
  isExecuting,
  replyAction,
}: {
  log: AgentLogRow;
  isLatestThought?: boolean;
  isExecuting?: boolean;
  replyAction?: ReactNode;
}) {
  const payload = log.payload ?? {};

  if (log.event_type === "SPAWN") {
    const action = typeof payload.action === "string" ? payload.action : "BOOT";
    const command = typeof payload.command === "string" ? payload.command : null;
    const task = typeof payload.task === "string" ? payload.task : null;

    return (
      <div className="space-y-1">
        <div className="text-gray-400">{action}</div>
        {(command || task) && (
          <div className="whitespace-pre-wrap text-gray-300">{command ?? task}</div>
        )}
      </div>
    );
  }

  if (log.event_type === "THOUGHT") {
    const thought = typeof payload.thought === "string" ? payload.thought : "";
    return (
      <ThoughtLogBlock
        thought={thought}
        defaultOpen={Boolean(isLatestThought && isExecuting)}
        replyAction={replyAction}
      />
    );
  }

  if (log.event_type === "TOOL_CALL") {
    const toolName =
      typeof payload.tool === "string"
        ? payload.tool
        : typeof payload.tool_name === "string"
          ? payload.tool_name
          : typeof payload.action === "string"
            ? payload.action
            : "UNKNOWN_TOOL";

    const args =
      payload.args ??
      (typeof payload.task !== "undefined" || typeof payload.target !== "undefined"
        ? {
            target: payload.target,
            task: payload.task,
          }
        : payload);

    return (
      <div>
        <div className="font-medium text-yellow-300">{toolName}</div>
        <JsonPre value={args} />
      </div>
    );
  }

  if (log.event_type === "TOOL_RESULT") {
    const result = payload.result ?? payload;
    const status = typeof payload.status === "string" ? payload.status : null;

    if (typeof result === "string") {
      return (
        <div className="space-y-1">
          {status && <div className="text-green-400">{status}</div>}
          <div className="whitespace-pre-wrap">{result}</div>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {status && <div className="text-green-400">{status}</div>}
        <JsonPre value={result} />
      </div>
    );
  }

  if (log.event_type === "OUTBOUND_PIPELINE") {
    const leadEmail = typeof payload.leadEmail === "string" ? payload.leadEmail : null;
    const company = typeof payload.company === "string" ? payload.company : null;
    const halted = payload.haltedAtApprovalGate === true;
    const steps = Array.isArray(payload.steps) ? payload.steps.length : 0;
    const label = company ?? leadEmail ?? "lead";

    return (
      <div className="text-xs text-gray-500">
        Outbound pipeline · {label} · {steps} step{steps === 1 ? "" : "s"}
        {halted ? " · halted at approval gate" : ""}
      </div>
    );
  }

  if (log.event_type === "STEP_START" || log.event_type === "STEP_COMPLETE") {
    const nodeType =
      typeof payload.nodeType === "string"
        ? payload.nodeType
        : typeof payload.nodeId === "string"
          ? payload.nodeId
          : "step";

    return <div className="text-xs text-gray-600">{nodeType}</div>;
  }

  return <JsonPre value={payload} />;
}

type TelemetryLogEntryProps = {
  log: AgentLogRow;
  agentLabel: string;
  onReplyToPoint?: (context: TerminalReplyContext) => void;
  isLatestThought?: boolean;
  isExecuting?: boolean;
};

function TelemetryLogEntry({
  log,
  agentLabel,
  onReplyToPoint,
  isLatestThought,
  isExecuting,
}: TelemetryLogEntryProps) {
  const isThought = log.event_type === "THOUGHT";
  const canReply = shouldOfferQuickReply(log, agentLabel);

  const replyButton =
    canReply && onReplyToPoint ? (
      <button
        type="button"
        onClick={() => onReplyToPoint(buildReplyContext(log, agentLabel))}
        className="font-mono text-[10px] tracking-[0.1em] text-gray-500 uppercase transition-colors hover:text-gray-300"
      >
        ↳ Reply to this point
      </button>
    ) : null;

  return (
    <div className="flex flex-col gap-1.5 border-b border-gray-800/50 py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-gray-500">{formatLogTimestamp(log.created_at)}</span>
        <span className="font-medium text-white">[{agentLabel}]</span>
        {isThought ? (
          <span className="text-xs font-normal italic text-gray-500">Reasoning</span>
        ) : (
          <span className={`font-medium uppercase ${eventBadgeClass(log.event_type)}`}>
            {log.event_type}
          </span>
        )}
      </div>
      <div
        className={`ml-2 mt-1 pl-4 ${isThought ? "border-l border-gray-800" : "border-l border-gray-700 text-gray-300"}`}
      >
        <TelemetryLogPayload
          log={log}
          isLatestThought={isLatestThought}
          isExecuting={isExecuting}
          replyAction={isThought ? replyButton : undefined}
        />
        {!isThought ? replyButton : null}
      </div>
    </div>
  );
}

type TerminalChatProps = {
  clientId: string;
  agents: AgentRosterRow[];
};

export function TerminalChat({ clientId, agents }: TerminalChatProps) {
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [telemetryLogs, setTelemetryLogs] = useState<AgentLogRow[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [command, setCommand] = useState("");
  const [replyContext, setReplyContext] = useState<TerminalReplyContext | null>(null);
  const [ceoAgent, setCeoAgent] = useState<ResolvedAgentRow | null>(null);
  const [ceoLoading, setCeoLoading] = useState(true);
  const [ceoResponse, setCeoResponse] = useState<string | null>(null);
  const [showPipelineLogs, setShowPipelineLogs] = useState(false);

  const telemetryChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!clientId) {
      setCeoAgent(null);
      setCeoLoading(false);
      return;
    }

    let cancelled = false;
    setCeoLoading(true);

    void resolveAgentForWorkspace("CEO", clientId).then((result) => {
      if (cancelled) return;
      const workspaceCeo =
        result.agent?.client_id === clientId ? result.agent : null;
      setCeoAgent(workspaceCeo);
      setCeoLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    const fromRoster = agents.find(
      (agent) => agent.role?.trim().toUpperCase() === "CEO" && agent.client_id === clientId,
    );
    if (fromRoster) {
      setCeoAgent(fromRoster as ResolvedAgentRow);
      setCeoLoading(false);
    }
  }, [agents, clientId]);

  useEffect(() => {
    if (!clientId) return;

    let cancelled = false;

    const restoreTerminalState = async () => {
      const { data: latestMission, error: latestError } = await supabase
        .from("agent_logs")
        .select("execution_id")
        .eq("client_id", clientId)
        .in("event_type", ["SPAWN", "THOUGHT"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled || latestError || !latestMission?.execution_id) return;

      setExecutionId(latestMission.execution_id);

      const { data: historicalLogs } = await supabase
        .from("agent_logs")
        .select("*")
        .eq("execution_id", latestMission.execution_id)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (historicalLogs) {
        const rows = historicalLogs as AgentLogRow[];
        setTelemetryLogs(rows);
        const latestThought = [...rows].reverse().find((log) => log.event_type === "THOUGHT");
        const thought =
          latestThought?.payload &&
          typeof latestThought.payload.thought === "string"
            ? latestThought.payload.thought.trim()
            : "";
        if (thought) {
          setCeoResponse(thought);
        }
        for (const log of rows) {
          emitAgentActivityForLog(log, agents);
        }
      }
    };

    void restoreTerminalState();

    return () => {
      cancelled = true;
    };
  }, [agents, clientId]);

  useEffect(() => {
    dispatchAgentMissionState(isExecuting);
  }, [isExecuting]);

  useEffect(() => {
    if (!isExecuting || telemetryLogs.length === 0) return;

    for (const log of telemetryLogs) {
      emitAgentActivityForLog(log, agents);
    }
  }, [agents, isExecuting, telemetryLogs]);

  useEffect(() => {
    if (!executionId || !clientId) return;

    if (telemetryChannelRef.current) {
      void supabase.removeChannel(telemetryChannelRef.current);
      telemetryChannelRef.current = null;
    }

    const channel = supabase
      .channel(`telemetry:${clientId}:${executionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_logs",
          filter: `execution_id=eq.${executionId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as AgentLogRow;
          if (row.client_id && row.client_id !== clientId) return;
          emitAgentActivityForLog(row, agents);
          setTelemetryLogs((prev) => {
            if (row.id && prev.some((log) => log.id === row.id)) return prev;
            return [...prev, row];
          });
        },
      )
      .subscribe();

    telemetryChannelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      if (telemetryChannelRef.current === channel) {
        telemetryChannelRef.current = null;
      }
    };
  }, [agents, clientId, executionId]);

  const handleReplyToPoint = useCallback((context: TerminalReplyContext) => {
    setReplyContext(context);
    setCommand(buildReplyPrefix(context.agentLabel));
    requestAnimationFrame(() => {
      commandInputRef.current?.focus();
      const prefixLength = buildReplyPrefix(context.agentLabel).length;
      commandInputRef.current?.setSelectionRange(prefixLength, prefixLength);
    });
  }, []);

  const clearReplyContext = useCallback(() => {
    setReplyContext(null);
  }, []);

  const handleDispatchMission = useCallback(async () => {
    const trimmed = command.trim();
    if (!trimmed || isExecuting || !clientId) return;

    const activeReply = replyContext;
    const replyPrefix = activeReply ? buildReplyPrefix(activeReply.agentLabel) : "";
    const adminReplyBody =
      activeReply && trimmed.startsWith(replyPrefix)
        ? trimmed.slice(replyPrefix.length).trim()
        : trimmed;

    if (activeReply && !adminReplyBody) {
      return;
    }

    setIsExecuting(true);

    if (!activeReply) {
      setTelemetryLogs([]);
      setExecutionId(null);
      setCeoResponse(null);
    }

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: adminReplyBody || trimmed,
          clientId,
          replyContext: activeReply ?? undefined,
        }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorBody?.error ?? `Agent API failed (${response.status}).`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Agent API returned an empty response body.");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;

          const data = JSON.parse(line) as {
            executionId?: string;
            text?: string;
            error?: string;
          };

          if (data.error) {
            throw new Error(data.error);
          }

          if (data.executionId) {
            setExecutionId(data.executionId);
          }

          if (typeof data.text === "string" && data.text.trim()) {
            setCeoResponse(data.text.trim());
          }
        }
      }
    } catch (error) {
      console.error("DISPATCH MISSION ERROR:", error);
    } finally {
      setIsExecuting(false);
      setReplyContext(null);
    }
  }, [clientId, command, isExecuting, replyContext]);

  const sortedLogs = sortAgentLogs(telemetryLogs);
  const hiddenPipelineLogCount = sortedLogs.filter(isOperationalPipelineLog).length;
  const visibleLogs = showPipelineLogs
    ? sortedLogs
    : sortedLogs.filter((log) => !isOperationalPipelineLog(log));
  const latestThoughtLogId = [...visibleLogs]
    .reverse()
    .find((log) => log.event_type === "THOUGHT")?.id;
  const showTerminal =
    isExecuting ||
    visibleLogs.length > 0 ||
    hiddenPipelineLogCount > 0 ||
    Boolean(ceoResponse) ||
    Boolean(executionId);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [sortedLogs.length, visibleLogs.length, isExecuting, executionId, ceoResponse]);

  return (
    <>
      <section>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Mission control</h2>
          <div className="text-sm text-gray-600">
            {ceoLoading ? (
              <span>Loading workspace CEO…</span>
            ) : ceoAgent ? (
              <span>
                <span className="font-medium text-gray-900">
                  {ceoAgent.name ?? "Workspace CEO"}
                </span>
                <span className="text-gray-400"> · {ceoAgent.role}</span>
                {ceoAgent.is_active === false ? (
                  <span className="text-amber-600"> · offline</span>
                ) : (
                  <span className="text-emerald-600"> · online</span>
                )}
              </span>
            ) : (
              <span className="text-amber-600">No workspace CEO provisioned</span>
            )}
          </div>
        </div>
        {replyContext ? (
          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Replying to {replyContext.agentLabel} · {replyContext.eventType}
            <button
              type="button"
              onClick={clearReplyContext}
              className="ml-3 text-gray-900 transition-colors hover:text-gray-600"
            >
              Clear
            </button>
          </div>
        ) : null}
        <div className="rounded-xl border border-gray-300 bg-white p-2 shadow-sm">
          <input
            ref={commandInputRef}
            type="text"
            value={command}
            onChange={(event) => {
              setCommand(event.target.value);
              if (
                replyContext &&
                !event.target.value.startsWith(buildReplyPrefix(replyContext.agentLabel))
              ) {
                setReplyContext(null);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleDispatchMission();
              }
              if (event.key === "Escape" && replyContext) {
                event.preventDefault();
                clearReplyContext();
                setCommand("");
              }
            }}
            disabled={isExecuting}
            placeholder={
              replyContext
                ? "Respond to the selected point…"
                : "Enter mission directive for this workspace…"
            }
            className="w-full rounded-lg border-0 bg-transparent px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
          />
          <div className="flex justify-end px-1 pb-1 pt-2">
            <button
              type="button"
              onClick={() => void handleDispatchMission()}
              disabled={!command.trim() || isExecuting}
              className="rounded-lg bg-black px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isExecuting ? "Dispatching…" : "Dispatch"}
            </button>
          </div>
        </div>
      </section>

      {showTerminal ? (
        <section className="mt-4 overflow-hidden rounded-lg border border-gray-800 shadow-inner">
          {ceoResponse ? (
            <div className="border-b border-gray-700 bg-gray-950 px-4 py-4">
              <p className="font-mono text-[10px] tracking-[0.16em] text-emerald-500 uppercase">
                CEO response
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-100">
                {ceoResponse}
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-700 bg-gray-800 px-4 py-2 text-xs text-gray-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            Live Execution Logs
            {hiddenPipelineLogCount > 0 ? (
              <button
                type="button"
                onClick={() => setShowPipelineLogs((prev) => !prev)}
                className="rounded border border-gray-600 px-2 py-0.5 font-mono text-[10px] tracking-[0.08em] text-gray-400 uppercase transition-colors hover:border-gray-500 hover:text-gray-200"
              >
                {showPipelineLogs
                  ? "Hide pipeline logs"
                  : `Show pipeline logs (${hiddenPipelineLogCount})`}
              </button>
            ) : null}
            {executionId ? (
              <span className="ml-auto truncate font-mono text-[10px] text-gray-500">
                {executionId}
              </span>
            ) : null}
          </div>
          <div className="h-96 overflow-y-auto bg-gray-900 p-4 font-mono text-sm leading-snug text-green-400">
            {visibleLogs.length === 0 && isExecuting ? (
              <div className="text-gray-500">&gt; Awaiting telemetry…</div>
            ) : null}
            {visibleLogs.length === 0 && !isExecuting && hiddenPipelineLogCount > 0 ? (
              <div className="text-gray-500">
                &gt; Pipeline activity hidden — use Show pipeline logs to inspect outbound steps.
              </div>
            ) : null}
            {visibleLogs.map((log, index) => {
              const agentLabel = resolveAgentLabel(log.agent_id, agents);
              return (
                <TelemetryLogEntry
                  key={log.id ?? `${log.event_type}-${log.created_at ?? index}`}
                  log={log}
                  agentLabel={agentLabel}
                  onReplyToPoint={handleReplyToPoint}
                  isLatestThought={Boolean(latestThoughtLogId && log.id === latestThoughtLogId)}
                  isExecuting={isExecuting}
                />
              );
            })}
            {isExecuting ? <ThinkingIndicator /> : null}
            <div ref={terminalEndRef} aria-hidden="true" />
          </div>
        </section>
      ) : null}
    </>
  );
}
