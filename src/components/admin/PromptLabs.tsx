import { useEffect, useState } from "react";
import {
  AGENT_TOOLS,
  DEFAULT_SYSTEM_PROMPT,
  MERGE_VARIABLES,
  SYSTEM_AGENTS,
  getDefaultToolsForAgent,
  type AgentToolId,
} from "@/lib/admin/promptLabs";

export function PromptLabs() {
  const [selectedAgentId, setSelectedAgentId] = useState(SYSTEM_AGENTS[2]?.id ?? "email");
  const [prompt, setPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [enabledTools, setEnabledTools] = useState<Set<AgentToolId>>(() =>
    getDefaultToolsForAgent(SYSTEM_AGENTS[2]?.id ?? "email"),
  );

  useEffect(() => {
    setEnabledTools(getDefaultToolsForAgent(selectedAgentId));
  }, [selectedAgentId]);

  function toggleTool(toolId: AgentToolId) {
    setEnabledTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
  }

  function handleCommit() {
    console.info("[PROMPT_LABS] commit prompt version", {
      agentId: selectedAgentId,
      prompt,
      tools: [...enabledTools],
    });
  }

  return (
    <section className="space-y-12 md:space-y-16">
      <header className="border-b border-hairline pb-8 md:pb-10">
        <div className="eyebrow mb-4">Index 003 // Prompt Labs</div>
        <h1 className="font-display text-[clamp(2.5rem,8vw,6rem)] leading-[0.88] tracking-[-0.04em]">
          PROMPT_LABS // 003
        </h1>
      </header>

      <div className="grid min-h-[32rem] grid-cols-1 border border-hairline md:grid-cols-3">
        {/* Left column */}
        <aside className="flex flex-col border-b border-hairline md:col-span-1 md:border-b-0 md:border-r md:border-hairline">
          <div className="border-b border-hairline px-5 py-6 md:px-6">
            <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink">
              01 // AGENTS
            </h2>
            <ul className="mt-5 space-y-2">
              {SYSTEM_AGENTS.map((agent, index) => {
                const isSelected = selectedAgentId === agent.id;
                return (
                  <li key={agent.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedAgentId(agent.id)}
                      className={`w-full rounded-none border px-4 py-3 text-left font-mono text-[11px] tracking-[0.12em] uppercase transition-colors ${
                        isSelected
                          ? "border-ink bg-ink text-paper"
                          : agent.active
                            ? "border-hairline bg-transparent text-ink hover:border-ink"
                            : "border-hairline text-ink-soft"
                      }`}
                    >
                      Agent {String(index + 1).padStart(2, "0")}: {agent.label}
                      {agent.active ? " // Active" : " // Inactive"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="border-b border-hairline px-5 py-6 md:px-6">
            <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink">
              02 // AVAILABLE_VARIABLES
            </h2>
            <ul className="mt-5 flex flex-col gap-2">
              {MERGE_VARIABLES.map((token) => (
                <li key={token}>
                  <span className="inline-block w-full rounded-none border border-hairline px-3 py-2 font-mono text-[11px] tracking-[0.08em] text-ink">
                    {token}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex-1 px-5 py-6 md:px-6">
            <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink">
              03 // AGENT_TOOLS
            </h2>
            <ul className="mt-5 flex flex-col gap-3">
              {AGENT_TOOLS.map((tool) => {
                const checked = enabledTools.has(tool.id);
                return (
                  <li key={tool.id}>
                    <button
                      type="button"
                      onClick={() => toggleTool(tool.id)}
                      className="flex w-full items-center gap-3 rounded-none text-left font-mono text-[11px] tracking-[0.08em] text-ink transition-opacity hover:opacity-80"
                    >
                      <span
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-none border border-ink ${
                          checked ? "bg-ink text-paper" : "bg-transparent"
                        }`}
                        aria-hidden
                      >
                        {checked ? (
                          <span className="text-[9px] leading-none">×</span>
                        ) : null}
                      </span>
                      <span className={checked ? "text-ink" : "text-ink-soft"}>
                        [{checked ? "x" : " "}] {tool.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* Right column */}
        <div className="flex flex-col md:col-span-2">
          <div className="border-b border-hairline px-5 py-6 md:px-8">
            <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink">
              03 // SYSTEM_PROMPT_CONFIGURATION
            </h2>
          </div>

          <div className="relative flex flex-1 flex-col p-5 md:p-8">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              spellCheck={false}
              className="min-h-[22rem] w-full flex-1 resize-y rounded-none border border-hairline bg-[oklch(0.08_0_0)] px-5 py-5 font-mono text-[12px] leading-relaxed tracking-[0.04em] text-[oklch(0.92_0_0)] placeholder:text-[oklch(0.55_0_0)] focus:border-ink focus:outline-none md:min-h-[28rem] md:text-[13px]"
            />
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleCommit}
                className="rounded-none border border-ink bg-white px-6 py-3 font-mono text-[11px] tracking-[0.16em] uppercase text-black transition-opacity hover:opacity-85"
              >
                COMMIT_PROMPT_VERSION
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
