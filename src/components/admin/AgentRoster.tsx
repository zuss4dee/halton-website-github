import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  AGENT_ACTIVITY_EVENT,
  normalizeAgentRole,
  type AgentActivityDetail,
} from "@/lib/admin/agentActivity";
import type { AgentRosterRow } from "@/lib/admin/useAgentRoster";

type AgentRosterProps = {
  clientId: string;
  agents: AgentRosterRow[];
  isLoading: boolean;
};

type AgentStatusTone = "online" | "working" | "error" | "standby";

type AgentStatus = {
  label: "Online" | "Working" | "Error" | "Standby";
  tone: AgentStatusTone;
};

const ACTIVITY_IDLE_MS = 1500;

const STATUS_DOT_CLASS: Record<AgentStatusTone, string> = {
  online: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.9)]",
  working: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.9)] animate-pulse",
  error: "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)]",
  standby: "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]",
};

function getAgentStatus(agent: AgentRosterRow, isWorking: boolean): AgentStatus {
  const role = normalizeAgentRole(agent.role);

  if (role === "CEO_ROUTER" || role === "CEO") {
    return { label: "Online", tone: "online" };
  }

  if (agent.is_active === false) {
    return { label: "Standby", tone: "standby" };
  }

  const hasMissingData =
    !agent.name?.trim() ||
    !agent.role?.trim() ||
    !agent.model?.trim() ||
    !agent.system_prompt?.trim();

  if (hasMissingData) {
    return { label: "Error", tone: "error" };
  }

  if (isWorking) {
    return { label: "Working", tone: "working" };
  }

  return { label: "Standby", tone: "standby" };
}

function AgentRosterSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="animate-pulse bg-paper px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-hairline" />
            <div className="h-3 w-2/5 bg-hairline" />
          </div>
          <div className="mt-2 h-2 w-1/3 bg-hairline pl-4" />
          <div className="mt-1.5 h-2 w-1/2 bg-hairline pl-4" />
        </div>
      ))}
    </>
  );
}

function AgentRosterCard({
  agent,
  clientId,
  isWorking,
}: {
  agent: AgentRosterRow;
  clientId: string;
  isWorking: boolean;
}) {
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const status = getAgentStatus(agent, isWorking);
  const displayName = agent.name?.trim() || "UNNAMED_AGENT";
  const prompt = agent.system_prompt?.trim() ?? "";
  const inactive = agent.is_active === false;

  return (
    <article
      className={`bg-paper transition-colors ${inactive ? "opacity-60" : ""}`}
    >
      <div className="px-3 pt-3">
        <Link
          to="/admin/client/$id/agents/$agentId"
          params={{ id: clientId, agentId: agent.id }}
          className="mb-2 inline-block font-mono text-[9px] tracking-[0.16em] uppercase text-ink-soft transition-colors hover:text-ink"
        >
          Agent Studio →
        </Link>
      </div>
      <div className="px-3 pb-3">
      <header className="flex items-start gap-2">
        <span
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASS[status.tone]}`}
          title={status.label}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <h3 className="truncate font-mono text-[11px] tracking-[0.16em] uppercase text-ink">
              {displayName}
            </h3>
            <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft">
              {status.label}
            </span>
          </div>
          <dl className="mt-2 space-y-0.5 font-mono text-[10px] tracking-[0.12em] uppercase">
            <div className="flex gap-2">
              <dt className="shrink-0 text-ink-soft/70">Role</dt>
              <dd className="truncate text-ink">{agent.role ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-ink-soft/70">Model</dt>
              <dd className="truncate text-ink">{agent.model ?? "—"}</dd>
            </div>
          </dl>
        </div>
      </header>
      </div>

      {prompt ? (
        <div className="border-t border-hairline px-3 pb-3 pt-2 pl-7">
          <button
            type="button"
            onClick={() => setInstructionsOpen((open) => !open)}
            className="flex items-center gap-1 font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft transition-colors hover:text-ink"
            aria-expanded={instructionsOpen}
          >
            {instructionsOpen ? (
              <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
            )}
            {instructionsOpen ? "Hide Instructions" : "View Instructions"}
          </button>
          {instructionsOpen ? (
            <pre className="mt-2 max-h-44 overflow-y-auto border border-hairline bg-paper p-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-ink-soft">
              {prompt}
            </pre>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function AgentRoster({
  clientId,
  agents,
  isLoading,
}: AgentRosterProps) {
  const [activeRoles, setActiveRoles] = useState<Record<string, true>>({});
  const idleTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const markRoleActive = (role: string) => {
      const normalized = normalizeAgentRole(role);
      if (!normalized || normalized === "CEO" || normalized === "CEO_ROUTER") {
        return;
      }

      setActiveRoles((current) =>
        current[normalized] ? current : { ...current, [normalized]: true },
      );

      const existingTimeout = idleTimeoutsRef.current.get(normalized);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeout = setTimeout(() => {
        idleTimeoutsRef.current.delete(normalized);
        setActiveRoles((current) => {
          if (!current[normalized]) return current;
          const next = { ...current };
          delete next[normalized];
          return next;
        });
      }, ACTIVITY_IDLE_MS);

      idleTimeoutsRef.current.set(normalized, timeout);
    };

    const handleAgentActivity = (event: Event) => {
      const detail = (event as CustomEvent<AgentActivityDetail>).detail;
      if (!detail?.role) return;
      markRoleActive(detail.role);
    };

    window.addEventListener(AGENT_ACTIVITY_EVENT, handleAgentActivity);

    return () => {
      window.removeEventListener(AGENT_ACTIVITY_EVENT, handleAgentActivity);
      for (const timeout of idleTimeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
      idleTimeoutsRef.current.clear();
    };
  }, []);

  return (
    <section>
      <h2 className="mb-4 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
        01 // AGENT_ROSTER
      </h2>
      <div className="grid grid-cols-1 gap-px border border-hairline bg-hairline md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <AgentRosterSkeleton />
        ) : agents.length === 0 ? (
          <div className="col-span-full bg-paper px-4 py-6 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
            NO_AGENTS_ONLINE
          </div>
        ) : (
          agents.map((agent) => {
            const roleKey = normalizeAgentRole(agent.role);
            return (
              <AgentRosterCard
                key={agent.id}
                agent={agent}
                clientId={clientId}
                isWorking={Boolean(roleKey && activeRoles[roleKey])}
              />
            );
          })
        )}
      </div>
    </section>
  );
}
