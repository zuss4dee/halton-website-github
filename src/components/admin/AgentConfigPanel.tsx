import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  agentToConfigDraft,
  getSkillsForAgentPanel,
  isCeoRole,
  saveAgentConfiguration,
  type AgentConfigDraft,
} from "@/lib/admin/agentConfig";
import type { AgentRosterRow } from "@/lib/admin/useAgentRoster";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type AgentConfigPanelProps = {
  clientId: string;
  agent: AgentRosterRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (agentId: string) => void;
};

function ConfigToggle({
  checked,
  disabled,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 border border-hairline bg-paper px-3 py-3 transition-colors ${
        disabled ? "opacity-50" : "hover:border-ink-soft"
      }`}
    >
      <span className="min-w-0">
        <span className="block font-mono text-[10px] tracking-[0.14em] uppercase text-ink">
          {label}
        </span>
        {description ? (
          <span className="mt-1 block font-mono text-[9px] leading-relaxed tracking-[0.08em] text-ink-soft normal-case">
            {description}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 cursor-pointer border transition-colors disabled:cursor-not-allowed ${
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

export function AgentConfigPanel({
  clientId,
  agent,
  open,
  onOpenChange,
  onSaved,
}: AgentConfigPanelProps) {
  const [draft, setDraft] = useState<AgentConfigDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!agent || !open) {
      setDraft(null);
      setStatusMessage(null);
      return;
    }
    setDraft(agentToConfigDraft(agent));
    setStatusMessage(null);
  }, [agent, open]);

  const skillOptions = agent ? getSkillsForAgentPanel(agent.role) : [];
  const isGlobalAgent = Boolean(agent && !agent.client_id);
  const ceoAgent = agent ? isCeoRole(agent.role) : false;

  const toggleSkill = (skillId: string, enabled: boolean) => {
    setDraft((current) => {
      if (!current) return current;
      const next = new Set(current.skills);
      if (enabled) {
        next.add(skillId);
      } else {
        next.delete(skillId);
      }
      return { ...current, skills: [...next] };
    });
  };

  const handleSave = async () => {
    if (!agent || !draft) return;

    setIsSaving(true);
    setStatusMessage(null);

    const result = await saveAgentConfiguration(clientId, agent, draft);

    setIsSaving(false);

    if (!result.ok) {
      setStatusMessage(`> SAVE FAILED: ${result.error}`);
      return;
    }

    setStatusMessage("> CONFIGURATION SAVED");
    onSaved?.(result.agentId);
    window.setTimeout(() => onOpenChange(false), 400);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-l border-hairline bg-paper p-0 sm:max-w-md [&>button]:hidden"
      >
        <div className="flex items-start justify-between border-b border-hairline px-5 py-4">
          <SheetHeader className="space-y-1 text-left">
            <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-ink-soft">
              Agent Configuration
            </p>
            <SheetTitle className="font-mono text-[13px] tracking-[0.12em] uppercase text-ink">
              {agent?.name?.trim() || "UNNAMED_AGENT"}
            </SheetTitle>
            <SheetDescription className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft">
              Role // {agent?.role ?? "—"}
              {isGlobalAgent && !ceoAgent ? (
                <span className="mt-1 block text-amber-700">
                  Workspace override on save
                </span>
              ) : isGlobalAgent ? (
                <span className="mt-1 block text-ink-soft/80">Global agent</span>
              ) : (
                <span className="mt-1 block text-ink-soft/80">Workspace-scoped</span>
              )}
            </SheetDescription>
          </SheetHeader>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="border border-hairline p-2 text-ink-soft transition-colors hover:border-ink hover:text-ink"
            aria-label="Close configuration panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {draft && agent ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
                    Status
                  </h3>
                </div>
                <ConfigToggle
                  checked={draft.is_active}
                  onChange={(is_active) => setDraft((current) => current && { ...current, is_active })}
                  label="Active"
                  description="Inactive agents cannot be delegated to and show as offline in the roster."
                />
              </section>

              <section>
                <label
                  htmlFor="agent-config-name"
                  className="mb-2 block font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft"
                >
                  Display Name
                </label>
                <input
                  id="agent-config-name"
                  type="text"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => current && { ...current, name: event.target.value })
                  }
                  className="w-full border border-hairline bg-paper px-3 py-2 font-mono text-[11px] tracking-[0.08em] text-ink outline-none focus:border-ink"
                />
              </section>

              <section>
                <label
                  htmlFor="agent-config-prompt"
                  className="mb-2 block font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft"
                >
                  System Prompt
                </label>
                <textarea
                  id="agent-config-prompt"
                  value={draft.system_prompt}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, system_prompt: event.target.value } : current,
                    )
                  }
                  rows={14}
                  className="min-h-[220px] w-full resize-y border border-hairline bg-paper px-3 py-3 font-mono text-[11px] leading-relaxed text-ink outline-none focus:border-ink"
                  placeholder="Core instructions for this agent…"
                />
              </section>

              <section>
                <h3 className="mb-3 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
                  Skills & Tools
                </h3>
                <div className="space-y-2">
                  {skillOptions.map((skill) => (
                    <ConfigToggle
                      key={skill.id}
                      checked={draft.skills.includes(skill.id)}
                      onChange={(enabled) => toggleSkill(skill.id, enabled)}
                      label={skill.label}
                      description={skill.description}
                    />
                  ))}
                </div>
              </section>
            </div>

            <div className="border-t border-hairline px-5 py-4">
              {statusMessage ? (
                <p
                  className={`mb-3 font-mono text-[10px] tracking-[0.12em] uppercase ${
                    statusMessage.includes("FAILED") ? "text-red-600" : "text-ink"
                  }`}
                >
                  {statusMessage}
                </p>
              ) : null}
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleSave()}
                className="w-full border border-ink bg-ink px-4 py-3 font-mono text-[11px] tracking-[0.16em] uppercase text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {isSaving ? "Saving…" : "Save Configuration"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center px-5 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-soft">
            Select an agent
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
