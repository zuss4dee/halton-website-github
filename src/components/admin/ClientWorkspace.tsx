import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { sortAgentLogs, type AgentLogRow } from "@/lib/admin/agentTelemetry";
import type { ClientRow } from "@/lib/admin/clientsRepository";
import { supabase } from "@/lib/supabase";

type AgentRow = {
  id: string;
  name?: string | null;
  role?: string | null;
  model?: string | null;
};

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
  const content =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);

  return (
    <pre className="mt-1 overflow-x-auto bg-gray-900/50 p-2 text-[10px]">{content}</pre>
  );
}

function resolveAgentLabel(agentId: string | undefined, agents: AgentRow[]): string {
  if (!agentId) return "SYSTEM";

  const match = agents.find((agent) => agent.id === agentId);
  if (match?.role) return match.role;
  if (match?.name) return match.name.toUpperCase();
  return "AGENT";
}

function TelemetryLogPayload({ log }: { log: AgentLogRow }) {
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
    return <div className="whitespace-pre-wrap">{thought || "—"}</div>;
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

  return <JsonPre value={payload} />;
}

type TelemetryLogEntryProps = {
  log: AgentLogRow;
  agents: AgentRow[];
};

function TelemetryLogEntry({ log, agents }: TelemetryLogEntryProps) {
  const agentLabel = resolveAgentLabel(log.agent_id, agents);

  return (
    <div className="flex flex-col gap-1.5 border-b border-gray-800/50 py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-gray-500">{formatLogTimestamp(log.created_at)}</span>
        <span className="font-medium text-white">[{agentLabel}]</span>
        <span className={`font-medium uppercase ${eventBadgeClass(log.event_type)}`}>
          {log.event_type}
        </span>
      </div>
      <div className="ml-2 mt-1 border-l border-gray-700 pl-4 text-gray-300">
        <TelemetryLogPayload log={log} />
      </div>
    </div>
  );
}

type ClientWorkspaceProps = {
  client: ClientRow;
};

export function ClientWorkspace({ client }: ClientWorkspaceProps) {
  const clientId = client.id ?? "";
  const companyName = client.company_name?.trim() ?? "Unknown Client";

  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [telemetryLogs, setTelemetryLogs] = useState<AgentLogRow[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [command, setCommand] = useState("");
  const telemetryChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAgents = async () => {
      const { data, error } = await supabase.from("agents").select("*").order("role");
      if (error) {
        console.error("AGENT ROSTER ERROR:", error);
        return;
      }
      if (data) setAgents(data as AgentRow[]);
    };

    void fetchAgents();
  }, []);

  useEffect(() => {
    if (!clientId) return;

    let cancelled = false;

    const restoreTerminalState = async () => {
      const { data: latestLog, error: latestError } = await supabase
        .from("agent_logs")
        .select("execution_id")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (cancelled || latestError || !latestLog?.execution_id) return;

      setExecutionId(latestLog.execution_id);

      const { data: historicalLogs } = await supabase
        .from("agent_logs")
        .select("*")
        .eq("execution_id", latestLog.execution_id)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (historicalLogs) {
        setTelemetryLogs(historicalLogs as AgentLogRow[]);
      }
    };

    void restoreTerminalState();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

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
        (payload) => {
          const row = payload.new as AgentLogRow;
          if (row.client_id && row.client_id !== clientId) return;
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
  }, [clientId, executionId]);

  const handleDispatchMission = useCallback(async () => {
    const trimmed = command.trim();
    if (!trimmed || isExecuting || !clientId) return;

    setIsExecuting(true);
    // Clear history first, then break the old Realtime subscription before the new execution boots.
    setTelemetryLogs([]);
    setExecutionId(null);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: trimmed, clientId }),
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
        }
      }
    } catch (error) {
      console.error("DISPATCH MISSION ERROR:", error);
    } finally {
      setIsExecuting(false);
    }
  }, [clientId, command, isExecuting]);

  const sortedLogs = sortAgentLogs(telemetryLogs);
  const showTerminal = isExecuting || sortedLogs.length > 0 || Boolean(executionId);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [sortedLogs.length, isExecuting, executionId]);

  return (
    <div className="space-y-8">
      <header className="border-b border-hairline pb-6">
        <div className="mb-6 flex flex-wrap gap-4">
          <Link
            to="/admin/client/$id"
            params={{ id: clientId }}
            className="font-mono text-[11px] tracking-[0.16em] uppercase text-ink-soft transition-colors hover:text-ink"
          >
            &lt; COMMAND_DASHBOARD
          </Link>
          <Link
            to="/admin"
            className="font-mono text-[11px] tracking-[0.16em] uppercase text-ink-soft transition-colors hover:text-ink"
          >
            &lt; GLOBAL_LOBBY
          </Link>
        </div>
        <div className="eyebrow mb-3">Client Workspace // {clientId}</div>
        <h1 className="font-display text-[clamp(2rem,5vw,4rem)] leading-[0.9] tracking-[-0.04em]">
          {companyName.toUpperCase()}
        </h1>
        <p className="mt-4 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
          ORCHESTRATION_DECK // TENANT_SCOPED
        </p>
      </header>

      <section>
        <h2 className="mb-4 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
          01 // AGENT_ROSTER
        </h2>
        <div className="grid grid-cols-1 gap-px border border-hairline bg-hairline md:grid-cols-2 lg:grid-cols-3">
          {agents.length === 0 ? (
            <div className="col-span-full bg-paper px-4 py-6 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
              NO_AGENTS_ONLINE
            </div>
          ) : (
            agents.map((agent) => (
              <div key={agent.id} className="bg-paper px-4 py-4">
                <div className="font-mono text-[11px] tracking-[0.16em] uppercase text-ink">
                  {agent.name ?? "UNNAMED_AGENT"}
                </div>
                <div className="mt-2 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft">
                  ROLE: {agent.role ?? "—"}
                </div>
                <div className="mt-1 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft">
                  MODEL: {agent.model ?? "—"}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="border-t border-hairline pt-8">
        <h2 className="mb-4 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
          02 // MISSION_CONTROL
        </h2>
        <div className="border border-hairline">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleDispatchMission();
              }
            }}
            disabled={isExecuting}
            placeholder="Enter mission directive for this workspace…"
            className="w-full rounded-none border-0 border-b border-hairline bg-transparent px-4 py-4 font-mono text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none disabled:opacity-50"
          />
          <div className="flex justify-end px-4 py-3">
            <button
              type="button"
              onClick={() => void handleDispatchMission()}
              disabled={!command.trim() || isExecuting}
              className="rounded-none border border-hairline bg-ink px-4 py-2 font-mono text-[11px] tracking-[0.16em] uppercase text-paper disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isExecuting ? "[DISPATCHING...]" : "[DISPATCH_MISSION]"}
            </button>
          </div>
        </div>
      </section>

      {showTerminal && (
        <section className="border-t border-hairline pt-8">
          <h2 className="mb-4 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
            03 // TELEMETRY_TERMINAL
            {executionId ? ` // ${executionId}` : ""}
          </h2>
          <div className="h-96 overflow-y-auto border border-gray-800 bg-black p-3 font-mono text-xs leading-snug">
            {sortedLogs.length === 0 && isExecuting && (
              <div className="text-gray-500">&gt; [SYSTEM] AWAITING_TELEMETRY...</div>
            )}
            {sortedLogs.map((log, index) => (
              <TelemetryLogEntry
                key={log.id ?? `${log.event_type}-${log.created_at ?? index}`}
                log={log}
                agents={agents}
              />
            ))}
            <div ref={terminalEndRef} aria-hidden="true" />
          </div>
        </section>
      )}
    </div>
  );
}
