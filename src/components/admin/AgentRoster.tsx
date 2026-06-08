import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  AGENT_ACTIVITY_EVENT,
  AGENT_MISSION_EVENT,
  normalizeAgentRole,
  type AgentActivityDetail,
  type AgentMissionDetail,
} from "@/lib/admin/agentActivity";
import { getAgentStatus } from "@/lib/admin/agentStatus";
import { AgentStatusBadge } from "@/components/admin/AgentStatusBadge";
import type { AgentRosterRow } from "@/lib/admin/useAgentRoster";

type AgentRosterProps = {
  clientId: string;
  agents: AgentRosterRow[];
  isLoading: boolean;
};

const ACTIVITY_IDLE_MS = 90_000;
const MISSION_ACTIVITY_IDLE_MS = 300_000;

function AgentRosterSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="h-4 w-2/5 rounded bg-gray-200" />
          <div className="mt-3 h-3 w-1/3 rounded bg-gray-100" />
          <div className="mt-2 h-3 w-1/2 rounded bg-gray-100" />
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
  const displayName = agent.name?.trim() || "Unnamed Agent";
  const prompt = agent.system_prompt?.trim() ?? "";
  const inactive = agent.is_active === false;

  return (
    <article
      className={`rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-gray-300 ${
        inactive ? "opacity-60" : ""
      }`}
    >
      <Link
        to="/admin/client/$id/agents/$agentId"
        params={{ id: clientId, agentId: agent.id }}
        className="mb-3 inline-block text-xs text-gray-500 transition-colors hover:text-gray-900"
      >
        Agent Studio →
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-gray-900">{displayName}</h3>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="shrink-0 text-gray-500">Role</dt>
              <dd className="truncate text-gray-700">{agent.role ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-gray-500">Model</dt>
              <dd className="truncate text-gray-700">{agent.model ?? "—"}</dd>
            </div>
          </dl>
        </div>
        <AgentStatusBadge status={status} />
      </header>

      {prompt ? (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setInstructionsOpen((open) => !open)}
            className="flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-gray-900"
            aria-expanded={instructionsOpen}
          >
            {instructionsOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            {instructionsOpen ? "Hide instructions" : "View instructions"}
          </button>
          {instructionsOpen ? (
            <pre className="mt-2 max-h-44 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed whitespace-pre-wrap text-gray-600">
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
  const [missionActive, setMissionActive] = useState(false);
  const idleTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const missionActiveRef = useRef(false);

  useEffect(() => {
    missionActiveRef.current = missionActive;
  }, [missionActive]);

  useEffect(() => {
    const markRoleActive = (role: string, holdMs?: number) => {
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

      const idleMs =
        holdMs ??
        (missionActiveRef.current ? MISSION_ACTIVITY_IDLE_MS : ACTIVITY_IDLE_MS);

      const timeout = setTimeout(() => {
        idleTimeoutsRef.current.delete(normalized);
        setActiveRoles((current) => {
          if (!current[normalized]) return current;
          const next = { ...current };
          delete next[normalized];
          return next;
        });
      }, idleMs);

      idleTimeoutsRef.current.set(normalized, timeout);
    };

    const handleAgentActivity = (event: Event) => {
      const detail = (event as CustomEvent<AgentActivityDetail>).detail;
      if (!detail?.role) return;
      markRoleActive(detail.role, detail.holdMs);
    };

    const handleMissionState = (event: Event) => {
      const detail = (event as CustomEvent<AgentMissionDetail>).detail;
      setMissionActive(Boolean(detail?.active));
    };

    window.addEventListener(AGENT_ACTIVITY_EVENT, handleAgentActivity);
    window.addEventListener(AGENT_MISSION_EVENT, handleMissionState);

    return () => {
      window.removeEventListener(AGENT_ACTIVITY_EVENT, handleAgentActivity);
      window.removeEventListener(AGENT_MISSION_EVENT, handleMissionState);
      for (const timeout of idleTimeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
      idleTimeoutsRef.current.clear();
    };
  }, []);

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Agent roster</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <AgentRosterSkeleton />
        ) : agents.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-gray-200 bg-gray-50 py-8 text-center text-sm text-gray-500">
            No agents configured for this workspace.
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
