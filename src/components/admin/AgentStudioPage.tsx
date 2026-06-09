import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  AGENT_MODEL_OPTIONS,
  agentToStudioDraft,
  fetchAgentForStudio,
  getStudioToolsForRole,
  saveAgentStudioConfig,
  type AgentStudioDraft,
  type AgentStudioRow,
} from "@/lib/admin/agentStudio";
import { isDynamicAgentRole } from "@/lib/ai/coreToolRegistry";
import { isCeoRole } from "@/lib/admin/agentConfig";
import { getAgentStatus } from "@/lib/admin/agentStatus";
import { AgentStatusBadge } from "@/components/admin/AgentStatusBadge";

type AgentStudioPageProps = {
  clientId: string;
  agentId: string;
};

const fieldClassName =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200";

function StudioToggleRow({
  checked,
  onChange,
  label,
  description,
  isLast = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  isLast?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-4 ${
        isLast ? "" : "border-b border-gray-100"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        {description ? (
          <span className="mt-1 block text-xs leading-relaxed text-gray-500">{description}</span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-gray-900" : "bg-gray-200"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export function AgentStudioPage({ clientId, agentId }: AgentStudioPageProps) {
  const workspaceClientId = clientId.trim();

  const [agent, setAgent] = useState<AgentStudioRow | null>(null);
  const [draft, setDraft] = useState<AgentStudioDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadAgent = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const result = await fetchAgentForStudio(agentId, workspaceClientId);

    if ("error" in result) {
      setAgent(null);
      setDraft(null);
      setErrorMessage(result.error);
    } else {
      setAgent(result.agent);
      setDraft(agentToStudioDraft(result.agent));
    }

    setIsLoading(false);
  }, [agentId, workspaceClientId]);

  useEffect(() => {
    void loadAgent();
  }, [loadAgent]);

  const toggleTool = (toolId: string, attached: boolean) => {
    setDraft((current) => {
      if (!current) return current;
      const next = new Set(current.tool_bindings);
      if (attached) {
        next.add(toolId);
      } else {
        next.delete(toolId);
      }
      return { ...current, tool_bindings: [...next] };
    });
  };

  const handleSave = async () => {
    if (!agent || !draft || isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);

    const result = await saveAgentStudioConfig(workspaceClientId, agent, draft);

    setIsSaving(false);

    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }

    setStatusMessage("> CONFIGURATION SAVED");
    await loadAgent();
  };

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading agent studio…</p>;
  }

  if (!agent || !draft) {
    return (
      <div>
        <p className="text-sm text-red-600">{errorMessage ?? "Agent unavailable."}</p>
        <Link
          to="/admin/client/$id/orchestration"
          params={{ id: workspaceClientId }}
          className="mt-4 inline-block text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          ← Back to agents
        </Link>
      </div>
    );
  }

  const displayName = draft.name || agent.name || "Unnamed agent";
  const isGlobal = !agent.client_id;
  const isCeo = isCeoRole(agent.role);
  const isDynamicRole = isDynamicAgentRole(agent.role);
  const studioTools = getStudioToolsForRole(agent.role);
  const agentStatus = getAgentStatus(
    {
      role: agent.role,
      name: draft.name,
      model: draft.model,
      system_prompt: draft.system_prompt,
      is_active: draft.is_active,
    },
    false,
  );

  return (
    <div className="space-y-8">
      <header className="border-b border-gray-200 pb-8">
        <Link
          to="/admin/client/$id/orchestration"
          params={{ id: workspaceClientId }}
          className="mb-6 inline-block text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          ← Back to agents
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold capitalize text-gray-900">{displayName}</h1>
          {isDynamicRole && agent.role ? (
            <span className="rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 font-mono text-xs text-violet-800">
              {agent.role}
            </span>
          ) : null}
          <AgentStatusBadge status={agentStatus} />
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Configure settings, prompts, and skills for this agent.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {isGlobal ? "Global template" : "Workspace override"}
        </p>
      </header>

      {(statusMessage || errorMessage) && (
        <p className={`text-sm ${errorMessage ? "text-red-600" : "text-emerald-700"}`}>
          {errorMessage ?? statusMessage}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Metadata</h2>

            <label className="mb-5 block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Display name</span>
              <input
                type="text"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => current && { ...current, name: event.target.value })
                }
                className={fieldClassName}
              />
            </label>

            <StudioToggleRow
              checked={draft.is_active}
              onChange={(is_active) =>
                setDraft((current) => current && { ...current, is_active })
              }
              label="Active"
              description="Inactive agents cannot be delegated or used in workflows."
              isLast
            />

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-medium text-gray-700">LLM model</span>
              <select
                value={draft.model}
                onChange={(event) =>
                  setDraft((current) => current && { ...current, model: event.target.value })
                }
                className={fieldClassName}
              >
                {AGENT_MODEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <p className="mt-3 text-xs leading-relaxed text-gray-500">
              Edge runtime uses the workspace DeepSeek vault key. Non-DeepSeek models map to
              deepseek-chat until provider keys are added.
            </p>
          </div>
        </aside>

        <div className="space-y-6 lg:col-span-9">
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-gray-900">System prompt</h2>
            {agent.role?.trim().toUpperCase() === "CEO" ? (
              <p className="mb-4 text-sm text-gray-500">
                Saved here as <code className="text-xs">agents.system_prompt</code> and injected
                dynamically on every CEO mission dispatch.
              </p>
            ) : (
              <div className="mb-4" />
            )}
            <textarea
              value={draft.system_prompt}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, system_prompt: event.target.value } : current,
                )
              }
              rows={18}
              className={`${fieldClassName} min-h-[320px] resize-y font-mono text-xs leading-relaxed`}
              placeholder="Core agent instructions…"
              spellCheck={false}
            />
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-gray-900">Skill registry</h2>
            <p className="mb-2 text-sm text-gray-500">
              {isCeo
                ? "Attach CEO orchestration tools. Sub-agent research tools are configured on hired specialists."
                : "Assign sub-agent runtime tools. These map to the core tool registry used by hireSubAgent and spawn_ephemeral_agent."}
            </p>
            <div>
              {studioTools.map((tool, index) => {
                const attached = draft.tool_bindings.includes(tool.id);
                return (
                  <StudioToggleRow
                    key={tool.id}
                    checked={attached}
                    onChange={(enabled) => toggleTool(tool.id, enabled)}
                    label={tool.label}
                    description={tool.description}
                    isLast={index === studioTools.length - 1}
                  />
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Reasoning settings</h2>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-medium text-gray-700">
                  Temperature ({draft.temperature.toFixed(2)})
                </span>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.05}
                  value={draft.temperature}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, temperature: Number(event.target.value) }
                        : current,
                    )
                  }
                  className="h-2 w-full cursor-pointer accent-gray-900"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-medium text-gray-700">Top P</span>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={draft.reasoning_config.top_p ?? ""}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            reasoning_config: {
                              ...current.reasoning_config,
                              top_p: event.target.value
                                ? Number(event.target.value)
                                : undefined,
                            },
                          }
                        : current,
                    )
                  }
                  className={fieldClassName}
                  placeholder="0.95"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-medium text-gray-700">Max tokens</span>
                <input
                  type="number"
                  min={64}
                  max={8192}
                  step={64}
                  value={draft.reasoning_config.max_tokens ?? ""}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            reasoning_config: {
                              ...current.reasoning_config,
                              max_tokens: event.target.value
                                ? Number(event.target.value)
                                : undefined,
                            },
                          }
                        : current,
                    )
                  }
                  className={fieldClassName}
                  placeholder="1024"
                />
              </label>
            </div>

            <label className="mt-6 block">
              <span className="mb-2 block text-sm font-medium text-gray-700">
                Supplemental reasoning instructions
              </span>
              <textarea
                value={draft.reasoning_config.instructions ?? ""}
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          reasoning_config: {
                            ...current.reasoning_config,
                            instructions: event.target.value,
                          },
                        }
                      : current,
                  )
                }
                rows={4}
                className={`${fieldClassName} resize-y leading-relaxed`}
                placeholder="Optional constraints appended at runtime…"
              />
            </label>
          </section>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave()}
            className="rounded-md bg-black px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "Saving…" : "Save Configuration"}
          </button>
        </div>
      </div>
    </div>
  );
}
