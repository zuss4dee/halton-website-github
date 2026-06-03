import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  AGENT_MODEL_OPTIONS,
  agentToStudioDraft,
  fetchAgentForStudio,
  GLOBAL_TOOL_REGISTRY,
  saveAgentStudioConfig,
  type AgentStudioDraft,
  type AgentStudioRow,
} from "@/lib/admin/agentStudio";

type AgentStudioPageProps = {
  clientId: string;
  agentId: string;
};

function StudioToggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border border-hairline bg-paper px-3 py-3">
      <span className="min-w-0">
        <span className="block font-mono text-[10px] tracking-[0.14em] uppercase text-ink">
          {label}
        </span>
        {description ? (
          <span className="mt-1 block font-mono text-[9px] leading-relaxed text-ink-soft normal-case">
            {description}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 border ${
          checked ? "border-ink bg-ink" : "border-hairline bg-paper"
        }`}
      >
        <span
          className={`absolute top-0.5 block h-3.5 w-3.5 transition-transform ${
            checked ? "translate-x-[18px] bg-paper" : "translate-x-0.5 bg-ink-soft"
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
    return (
      <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink-soft">
        LOADING_AGENT_STUDIO...
      </p>
    );
  }

  if (!agent || !draft) {
    return (
      <div>
        <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-red-600">
          {errorMessage ?? "AGENT_UNAVAILABLE"}
        </p>
        <Link
          to="/admin/client/$id/orchestration"
          params={{ id: workspaceClientId }}
          className="mt-4 inline-block font-mono text-[11px] tracking-[0.16em] uppercase text-ink-soft hover:text-ink"
        >
          &lt; BACK_TO_ORCHESTRATION
        </Link>
      </div>
    );
  }

  const displayRole = agent.role ?? "—";
  const isGlobal = !agent.client_id;

  return (
    <div className="space-y-6">
      <header className="border-b border-hairline pb-6">
        <Link
          to="/admin/client/$id/orchestration"
          params={{ id: workspaceClientId }}
          className="mb-4 inline-block font-mono text-[11px] tracking-[0.16em] uppercase text-ink-soft transition-colors hover:text-ink"
        >
          &lt; ORCHESTRATION
        </Link>
        <div className="eyebrow mb-2">Agent Studio</div>
        <h1 className="font-display text-[clamp(1.75rem,4vw,3rem)] leading-[0.92] tracking-[-0.04em]">
          {(draft.name || agent.name || "UNNAMED_AGENT").toUpperCase()}
        </h1>
        <p className="mt-2 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft">
          Role // {displayRole} · {isGlobal ? "Global template" : "Workspace override"}
        </p>
      </header>

      {(statusMessage || errorMessage) && (
        <p
          className={`font-mono text-[10px] tracking-[0.12em] uppercase ${
            errorMessage ? "text-red-600" : "text-ink"
          }`}
        >
          {errorMessage ?? statusMessage}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <aside className="space-y-4 lg:col-span-3">
          <div className="border border-hairline bg-paper p-4">
            <h2 className="mb-4 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
              Metadata
            </h2>

            <label className="mb-4 block">
              <span className="mb-2 block font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft">
                Display Name
              </span>
              <input
                type="text"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => current && { ...current, name: event.target.value })
                }
                className="w-full border border-hairline bg-paper px-3 py-2 font-mono text-[11px] text-ink outline-none focus:border-ink"
              />
            </label>

            <StudioToggle
              checked={draft.is_active}
              onChange={(is_active) =>
                setDraft((current) => current && { ...current, is_active })
              }
              label="Active"
              description="Inactive agents cannot be delegated or used in workflows."
            />

            <label className="mt-4 block">
              <span className="mb-2 block font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft">
                LLM Model
              </span>
              <select
                value={draft.model}
                onChange={(event) =>
                  setDraft((current) => current && { ...current, model: event.target.value })
                }
                className="w-full border border-hairline bg-paper px-3 py-2 font-mono text-[10px] tracking-[0.08em] uppercase text-ink outline-none focus:border-ink"
              >
                {AGENT_MODEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <p className="mt-3 font-mono text-[9px] leading-relaxed text-ink-soft/80 normal-case">
              Edge runtime uses the workspace DeepSeek vault key. Non-DeepSeek models map to
              deepseek-chat until provider keys are added.
            </p>
          </div>
        </aside>

        <div className="space-y-6 lg:col-span-9">
          <section className="border border-hairline bg-paper p-4">
            <h2 className="mb-3 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
              System Prompt
            </h2>
            <textarea
              value={draft.system_prompt}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, system_prompt: event.target.value } : current,
                )
              }
              rows={18}
              className="min-h-[320px] w-full resize-y border border-hairline bg-paper px-3 py-3 font-mono text-[11px] leading-relaxed text-ink outline-none focus:border-ink"
              placeholder="Core agent instructions…"
              spellCheck={false}
            />
          </section>

          <section className="border border-hairline bg-paper p-4">
            <h2 className="mb-1 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
              Skill Registry
            </h2>
            <p className="mb-4 font-mono text-[9px] tracking-[0.1em] uppercase text-ink-soft/80">
              Attach global tools to this agent
            </p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {GLOBAL_TOOL_REGISTRY.map((tool) => {
                const attached = draft.tool_bindings.includes(tool.id);
                return (
                  <StudioToggle
                    key={tool.id}
                    checked={attached}
                    onChange={(enabled) => toggleTool(tool.id, enabled)}
                    label={tool.label}
                    description={tool.description}
                  />
                );
              })}
            </div>
          </section>

          <section className="border border-hairline bg-paper p-4">
            <h2 className="mb-4 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
              Reasoning Settings
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label>
                <span className="mb-2 block font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft">
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
                  className="w-full"
                />
              </label>

              <label>
                <span className="mb-2 block font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft">
                  Top P
                </span>
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
                  className="w-full border border-hairline bg-paper px-3 py-2 font-mono text-[11px] text-ink outline-none focus:border-ink"
                  placeholder="0.95"
                />
              </label>

              <label>
                <span className="mb-2 block font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft">
                  Max Tokens
                </span>
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
                  className="w-full border border-hairline bg-paper px-3 py-2 font-mono text-[11px] text-ink outline-none focus:border-ink"
                  placeholder="1024"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block font-mono text-[9px] tracking-[0.14em] uppercase text-ink-soft">
                Supplemental Reasoning Instructions
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
                className="w-full border border-hairline bg-paper px-3 py-2 font-mono text-[11px] leading-relaxed text-ink outline-none focus:border-ink"
                placeholder="Optional constraints appended at runtime…"
              />
            </label>
          </section>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave()}
            className="w-full border border-ink bg-ink px-4 py-3 font-mono text-[11px] tracking-[0.16em] uppercase text-paper transition-opacity hover:opacity-90 disabled:opacity-40 md:w-auto md:min-w-[240px]"
          >
            {isSaving ? "Saving…" : "Save Configuration"}
          </button>
        </div>
      </div>
    </div>
  );
}
